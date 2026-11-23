// Record journeys on the real app to animated WebP.
//   node runner.mjs [filter...] [--project DIR] [--parallel N] [--out DIR] [--keep-video]
// e.g. node runner.mjs j06 j13 --parallel 2
// Needs the app running (adapter.app.url) and, for a signed-in product, the
// test account (adapter.login). Writes <project>/recordings/<id>-<slug>.webp
// and <id>-<slug>.calls.json (every intercepted call, by name only).
import { execFileSync } from 'node:child_process'
import { readdirSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { installGuard } from './guard.mjs'
import { statePath, ensureLogin } from './login.mjs'
import { loadProject } from './project.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const sleep = ms => new Promise(r => setTimeout(r, ms))
// PACE slows every recording so a new user can follow it: it scales each
// lead, hold and wait, the typing speed and the overlay's transitions.
// Frame timing (15 fps) is untouched. PACE=1 only for quick local checks.
export const PACE = Number(process.env.PACE || 1.33)
const wait = ms => sleep(ms * PACE)
// Geometry: app 1100x680, caption strip 64px below it, video 1100x744.
const W = 1100, APP_H = 680, H = 744

// The wrapper page: the app frame, the new-tab panel and the overlay. Brand
// tokens become the overlay's CSS variables.
function brandCss(brand = {}) {
  const v = { '--tour-accent': brand.accent, '--tour-card': brand.card, '--tour-progress': brand.progress, '--tour-font': brand.font }
  return `<style>:root{${Object.entries(v).filter(([, x]) => x).map(([k, x]) => `${k}:${x}`).join(';')}}</style>`
}
const wrapper = brand => `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="tour.css">${brandCss(brand)}
<style>#app{position:fixed;left:0;top:0;width:${W}px;height:${APP_H}px;border:0;display:block;background:#fff}
#newtab{position:fixed;left:0;top:0;width:${W}px;height:${APP_H}px;border:0;display:none;background:#525659;z-index:10}</style>
<body><iframe id="app" src="about:blank"></iframe><iframe id="newtab"></iframe><script src="overlay.js"></script></body>`

// Consistent start: a journey opens on the adapter's start screen and its
// first steps navigate to the feature. Other entry points are modes:
//   start: undefined                          the start screen (default)
//   start: { mode: 'preLogin', route: '#/login' }
//   start: { mode: 'website' }                a mode with a url: read-only
export function resolveStart(adapter, journey) {
  const s = journey.start
  if (s === undefined || s === 'default') return { name: 'default', route: adapter.start.route, ready: adapter.start.ready, dismiss: adapter.start.dismiss }
  const mode = adapter.modes?.[s.mode]
  if (!mode) throw new Error(`${journey.id}: unknown mode '${s.mode}'; the adapter's modes are: ${Object.keys(adapter.modes || {}).join(', ') || 'none'}`)
  const ready = journey.ready || mode.ready
  if (!ready) throw new Error(`${journey.id}: mode '${s.mode}' needs a ready() in the journey or the mode`)
  const url = s.url || mode.url
  if (url) return { name: s.mode, ...mode, website: true, url: new URL(url).href, origin: new URL(url).origin, ready }
  return { name: s.mode, ...mode, route: s.route || mode.route || adapter.start.route, ready }
}

// The step's target center must lie inside the ring's box. Returns a reason
// string on a miss, '' when it holds.
async function checkRing(page, loc) {
  const [t, r, visible] = await Promise.all([
    loc.boundingBox({ timeout: 2000 }).catch(() => null),
    page.locator('.tour-ring').boundingBox({ timeout: 2000 }).catch(() => null),
    page.evaluate(() => getComputedStyle(document.querySelector('.tour-ring')).opacity !== '0'),
  ])
  // A target that already left the screen (a toast that faded) has nothing
  // to ring: only a ring away from a visible target is a miss.
  if (!t || !await loc.isVisible().catch(() => false)) return ''
  if (!r || !visible) {
    const why = await page.evaluate(() => tour.why()).catch(() => '')
    return why ? `ring not shown: target ${why}` : 'ring not shown'
  }
  const cx = t.x + t.width / 2, cy = t.y + t.height / 2
  if (cx < r.x || cx > r.x + r.width || cy < r.y || cy > r.y + r.height) {
    return `center (${Math.round(cx)},${Math.round(cy)}) outside ring (${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)})`
  }
  return ''
}

// Encode: ffmpeg scales to 880px at 15 fps into a lossless APNG, then
// encode_webp.py (Pillow) writes the animated WebP with a keyframe at least
// every 15 frames. ffmpeg's own libwebp_anim can't set keyframes, and its
// lossy frame diffing leaves faint ghosts of closed dialogs and old rings.
function encodeWebp(src, dst, startAt, dir, errors) {
  const vf = 'fps=15,scale=880:-1:flags=lanczos'
  const apng = join(dir, 'frames.apng')
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(startAt), '-i', src, '-vf', vf, '-f', 'apng', '-plays', '0', apng])
    execFileSync(process.env.PYTHON || 'python', [join(here, 'encode_webp.py'), apng, dst, process.env.WEBP_QUALITY || '75', process.env.WEBP_KMIN || '9', process.env.WEBP_KMAX || '15'], { stdio: ['ignore', 'ignore', 'pipe'] })
  } catch (e) {
    errors.push(`keyframed WebP encode failed, used ffmpeg fallback: ${String(e.stderr || e).slice(0, 200)}`)
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(startAt), '-i', src, '-vf', vf, '-c:v', 'libwebp_anim', '-loop', '0', '-quality', '70', dst])
  } finally {
    rmSync(apng, { force: true })
  }
}

// Demo camera: getUserMedia video answers with a canvas card (initials,
// name, note) and enumerateDevices lists "Demo Camera". Audio comes from
// Chromium's fake microphone.
function demoCamera(persona) {
  const md = navigator.mediaDevices
  if (!md || md.__demoCamera) return
  md.__demoCamera = true
  const realGUM = md.getUserMedia.bind(md), realEnum = md.enumerateDevices.bind(md)
  const initials = persona.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const track = () => {
    const c = Object.assign(document.createElement('canvas'), { width: 640, height: 480 })
    const g = c.getContext('2d'), t0 = performance.now()
    const draw = () => {
      const t = (performance.now() - t0) / 1000
      g.fillStyle = '#eceaf6'; g.fillRect(0, 0, 640, 480)
      // Self-view is mirrored, so text is drawn mirrored to read correctly.
      if (persona.mirror !== false) g.setTransform(-1, 0, 0, 1, 640, 0)
      const r = 62 + Math.sin(t * 2) * 3
      g.fillStyle = persona.accent; g.beginPath(); g.arc(320, 245, r, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#fff'; g.font = '600 52px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(initials, 320, 248)
      g.fillStyle = '#1f1d2b'; g.font = '600 32px system-ui, sans-serif'; g.fillText(persona.name, 320, 112)
      g.fillStyle = '#5b5870'; g.font = '20px system-ui, sans-serif'; g.fillText(persona.note || '', 320, 148)
      g.setTransform(1, 0, 0, 1, 0, 0)
    }
    draw(); setInterval(draw, 1000 / 15)
    const tr = c.captureStream(15).getVideoTracks()[0]
    try { Object.defineProperty(tr, 'label', { value: 'Demo Camera' }) } catch { /* read-only */ }
    return tr
  }
  md.getUserMedia = async (c = {}) => {
    const stream = c.audio ? await realGUM({ audio: c.audio }) : new MediaStream()
    if (c.video) stream.addTrack(track())
    return stream
  }
  md.enumerateDevices = async () => {
    const cam = { deviceId: 'demo-camera', groupId: 'demo', kind: 'videoinput', label: 'Demo Camera' }
    return [...await realEnum(), { ...cam, toJSON: () => cam }]
  }
}

// In the framed app, window.parent is the wrapper. Make the app frame its own
// parent, as in a real tab (some apps check it). window.open and
// target=_blank links show the URL in the wrapper's "new tab" panel instead
// of a real popup, which the video can't show.
function frameAsTab() {
  if (window === window.top || location.pathname.startsWith('/__journey/')) return
  const top = window.top
  try { Object.defineProperty(window, 'parent', { get: () => window, configurable: true }) } catch { /* not redefinable */ }
  const show = u => { if (u && u !== 'about:blank') top.postMessage({ journeyNewTab: String(new URL(u, location.href)) }, '*') }
  document.addEventListener('click', e => {
    const a = e.target.closest?.('a[target="_blank"], a[target="blank"]')
    if (a && a.href) { e.preventDefault(); show(a.href) }
  }, true)
  window.open = url => {
    show(url)
    const loc = { set href(u) { show(u) }, get href() { return 'about:blank' }, assign: show, replace: show }
    return { closed: false, close() {}, focus() {}, get location() { return loc }, set location(u) { show(u) } }
  }
}

export async function recordJourney(browser, journey, { project, adapter, out, keepVideo = false }) {
  const name = `${journey.id}-${journey.slug}`
  const start = resolveStart(adapter, journey)
  const tmp = join(project, '.video')
  // Unique per run: several agents may record the same journey at once.
  const dir = join(tmp, `${name}-${process.pid}-${Date.now()}`)
  const state = statePath(project)
  const signedIn = !start.website && adapter.login && existsSync(state)
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    ...(signedIn ? { storageState: state } : {}),
    recordVideo: { dir, size: { width: W, height: H } },
    ...(start.website ? {} : { permissions: ['camera', 'microphone'] }),
  })
  const t0 = Date.now()
  const errors = []
  const origins = [adapter.app.url, adapter.app.api, ...(adapter.app.origins || [])].filter(Boolean)
  const hosts = new Set(origins.map(o => new URL(o).host))

  // Registered first, so it runs last: a write to any other host (analytics,
  // error reporting), or any non-GET in website mode, is aborted.
  const external = []
  await context.route('**/*', route => {
    const req = route.request(), u = new URL(req.url())
    const ours = !start.website && hosts.has(u.host)
    if (ours || req.method() === 'GET' || req.method() === 'OPTIONS' || u.protocol === 'data:') return route.fallback().catch(() => {})
    external.push(`${req.method()} ${u.host}${u.pathname}`)
    return route.abort().catch(() => {})
  })

  const demo = start.website ? {} : adapter.fixtures({ journey, mode: start.name, signedOut: !!start.signedOut, world: journey.world || {} })
  let guard = { log: [], push() {} }
  if (!start.website) {
    guard = await installGuard(context, {
      origins,
      rules: { socket: adapter.socket, ...adapter.rules(demo, { journey, mode: start.name, signedOut: !!start.signedOut }) },
      journey: { fakes: journey.fakes, rest: journey.rest, failures: journey.failures },
    })
    await context.addInitScript(frameAsTab)
    const persona = journey.camera || start.camera
    if (persona) await context.addInitScript(demoCamera, { accent: adapter.brand?.accent || '#4f46e5', ...persona })
  } else {
    await context.addInitScript(() => {
      document.addEventListener('submit', e => { e.preventDefault(); e.stopImmediatePropagation() }, true)
    })
  }
  // Serve the wrapper from the app's origin (or the website's), so the framed
  // page is same-origin and the overlay can track elements inside it.
  const host = start.website ? start.origin : new URL(adapter.app.url).origin
  await context.route(`${host}/__journey/**`, route => {
    const file = new URL(route.request().url()).pathname.replace('/__journey/', '')
    const asset = file.startsWith('files/') ? join(project, 'demo-files', file.slice(6)) : join(here, file)
    const res = file === 'index.html' ? { contentType: 'text/html', body: wrapper(adapter.brand) } : existsSync(asset) ? { path: asset } : { status: 404 }
    return route.fulfill(res).catch(() => {})
  })

  const page = await context.newPage()
  page.on('pageerror', e => errors.push(String(e)))
  // A real popup would be paused for the debugger, and Chrome then shows
  // "Debugger paused in another tab" over the recording: close any at once.
  context.on('page', p => { if (p !== page) { guard.log.push({ at: new Date().toISOString(), kind: 'popup', name: 'closed popup', how: 'faked' }); p.close().catch(() => {}) } })
  await page.goto(`${host}/__journey/index.html`)
  await page.evaluate(p => tour.setPace(p), PACE)
  if (journey.popups === 'panel') await page.evaluate(() => { window.__journeyPanelAll = true })
  const appUrl = start.website ? start.url : new URL(start.route, adapter.app.url.replace(/\/?$/, '/')).href
  await page.evaluate(src => { document.getElementById('app').src = src }, appUrl)
  const app = page.frameLocator('#app')
  const newTab = page.locator('#newtab')
  const closeTab = () => page.evaluate(() => tour.closeTab())
  const ctx = { page, app, guard, demo, wait, newTab, closeTab }
  Object.assign(ctx, adapter.helpers?.(ctx))
  try {
    await (journey.ready || start.ready)(ctx).waitFor({ timeout: 60000 })
  } catch (e) {
    await page.screenshot({ path: join(tmp, `${name}-not-ready.png`) }).catch(() => {})
    await context.close()
    return { name, errors: [`app not ready (see .video/${name}-not-ready.png): ${String(e).split('\n')[0]}`], faked: guard.log.length, external: external.length }
  }
  // Dismiss first-run banners; they may queue one after another.
  for (let k = 0; k < (start.dismiss ? 4 : 0); k++) {
    await wait(700)
    const close = start.dismiss(ctx)
    if (!await close.isVisible().catch(() => false)) break
    await close.click().catch(() => {})
  }
  await journey.setup?.(ctx)
  await wait(800)
  const startAt = (Date.now() - t0) / 1000

  const misses = []
  // Caption guard: every caption must fit the one-line strip, measured with
  // the strip's own font. Checked before recording, so it fails fast.
  const texts = [journey.title, 'Done: ' + journey.title, ...journey.steps.map(s => s.caption || '')]
  const long = []
  for (const t of texts) {
    const over = await page.evaluate(x => tour.captionOverflow(x), t)
    if (over > 0) long.push(`"${t.slice(0, 60)}${t.length > 60 ? '...' : ''}" (${t.length} chars, ${over}px over)`)
  }
  if (long.length) {
    errors.push(`caption too long for one line: ${long.join('; ')}`)
    await context.close()
    return { name, errors, faked: guard.log.length, external: external.length }
  }
  try {
    await page.evaluate(t => { tour.caption(t) }, journey.title)
    await wait(1400)
    const n = journey.steps.length
    for (let i = 0; i < n; i++) {
      const step = journey.steps[i]
      await step.before?.(ctx)
      const loc = step.target(ctx)
      await loc.waitFor({ state: 'visible', timeout: 15000 })
      // Swap card and caption first, so a scroll never happens under the
      // previous step's text.
      await page.evaluate(s => tour.announce(s), { title: step.title, caption: step.caption, i, n })
      await loc.scrollIntoViewIfNeeded().catch(() => {})
      // Tag the target so the overlay tracks it every frame. A re-tag after a
      // re-render accepts only the first tag's fingerprint (tag, text, label).
      const id = `t${i}-${Date.now()}`
      let fingerprint = null
      const mark = async () => {
        const h = await loc.elementHandle({ timeout: 1000 }).catch(() => null)
        if (!h) return false
        const ok = await h.evaluate((el, [id, fp]) => {
          const mine = [el.tagName, (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
            el.getAttribute('aria-label') || '', el.getAttribute('placeholder') || ''].join('|')
          if (fp && fp !== mine) return null
          for (const e of el.ownerDocument.querySelectorAll('[data-tour-target]')) e.removeAttribute('data-tour-target')
          el.setAttribute('data-tour-target', id)
          return mine
        }, [id, fingerprint]).catch(() => null)
        await h.dispose().catch(() => {})
        if (ok && !fingerprint) fingerprint = ok
        return !!ok
      }
      await mark()
      const fallback = await loc.boundingBox({ timeout: 2000 }).catch(() => null)
      await page.evaluate(([s, b]) => tour.step(s, b), [{ id, title: step.title, caption: step.caption, i, n }, fallback])
      // Acceptance: the target's center must be inside the ring before the action.
      let ringMiss = await checkRing(page, loc)
      if (ringMiss) {
        await mark()
        await page.evaluate(([s, b]) => tour.step(s, b), [{ id, title: step.title, caption: step.caption, i, n }, await loc.boundingBox({ timeout: 2000 }).catch(() => null)])
        ringMiss = await checkRing(page, loc)
      }
      if (ringMiss) misses.push(`step ${i + 1}/${n} "${step.title}": ${ringMiss}`)
      // Hold: re-tag a replaced target, and keep checking that a shown ring
      // stays on the target (a miss must persist 300 ms while it holds still).
      let holdMiss = false
      const hold = async ms => {
        const end = Date.now() + ms * PACE
        while (Date.now() < end) {
          await sleep(Math.min(250, Math.max(0, end - Date.now())))
          if (step.repoint === false) continue
          if (await page.evaluate(() => tour.lost()).catch(() => false)) {
            if (await loc.isVisible().catch(() => false)) await mark()
            continue
          }
          if (!holdMiss && await page.evaluate(() => getComputedStyle(document.querySelector('.tour-ring')).opacity === '1').catch(() => false)) {
            const before = await loc.boundingBox({ timeout: 500 }).catch(() => null)
            const miss = await checkRing(page, loc)
            if (miss && !miss.startsWith('ring not shown')) {
              await sleep(300)
              const after = await loc.boundingBox({ timeout: 500 }).catch(() => null)
              const still = before && after && Math.abs(before.x - after.x) < 1 && Math.abs(before.y - after.y) < 1
              const again = still && await checkRing(page, loc)
              if (again && !again.startsWith('ring not shown')) { holdMiss = true; misses.push(`step ${i + 1}/${n} "${step.title}" (while shown): ${again}`) }
            }
          }
        }
      }
      // tour.step already waited about 1 s for the ring; lead adds the rest.
      await hold(Math.max(0, (step.lead ?? 1150) - 800))
      const action = step.action || 'click'
      if (start.website && !['click', 'hover', 'none'].includes(action)) throw new Error(`website mode is read-only: action '${action}' is not allowed`)
      if (action === 'click') { await page.evaluate(() => tour.press()); await loc.click() }
      if (action === 'type') { await page.evaluate(() => tour.press()); await loc.click(); await loc.pressSequentially(step.text, { delay: Math.round(45 * PACE) }) }
      if (action === 'press') { await page.evaluate(() => tour.press()); await loc.press(step.key) }
      if (action === 'hover') await loc.hover()
      // action 'none': point at the target only (to show a result).
      await step.after?.(ctx)
      await page.evaluate(() => tour.acted()).catch(() => {})
      if (await loc.isVisible().catch(() => false)) await mark()
      await hold(step.wait ?? (i === n - 1 ? 2600 : 1700))
    }
    await page.evaluate(t => tour.done(t), journey.title)
    await wait(1600)
  } catch (e) {
    errors.push(String(e).split('\n')[0])
    await page.screenshot({ path: join(tmp, `${name}-error.png`) }).catch(() => {})
  }

  const video = page.video()
  await context.close()
  encodeWebp(await video.path(), join(out, name + '.webp'), startAt, dir, errors)
  if (misses.length) errors.push(`ring misses target: ${misses.join('; ')}`)
  // A read that reached the server could render real people: fail the run.
  const real = [...new Set(guard.log.filter(l => l.how === 'real').map(l => l.name))]
  if (real.length) errors.push(`real read(s): ${real.join(', ')} (answer them in the adapter's rules or the journey's fakes)`)
  writeFileSync(join(out, name + '.calls.json'), JSON.stringify({ journey: name, recordedAt: new Date().toISOString(), calls: guard.log, externalBlocked: external, errors }, null, 2))
  if (!keepVideo) rmSync(dir, { recursive: true, force: true })
  return { name, errors, faked: guard.log.length, external: external.length }
}

export function pickJourneys(names, filters) {
  // A bare id (j10) matches only j10.mjs; other filters match by substring.
  return names.filter(f => f.endsWith('.mjs') && (!filters.length || filters.some(x => (/^j\d+$/.test(x) ? f === `${x}.mjs` : f.includes(x)))))
}

async function main() {
  const p = await loadProject(process.argv.slice(2))
  const args = p.args
  const opt = (flag, dflt) => { const i = args.indexOf(flag); return i >= 0 ? args.splice(i, 2)[1] : dflt }
  const parallel = Number(opt('--parallel', 2))
  const out = opt('--out', join(p.project, 'recordings'))
  const keepVideo = args.includes('--keep-video')
  const jdir = join(p.project, 'journeys')
  const filters = args.filter(a => !a.startsWith('--'))
  // A shared test account's session can be dropped between runs.
  console.log('login:', await ensureLogin(p))
  mkdirSync(out, { recursive: true }); mkdirSync(join(p.project, '.video'), { recursive: true })
  const files = pickJourneys(readdirSync(jdir), filters)
  const journeys = await Promise.all(files.map(async f => (await import(pathToFileURL(join(jdir, f)).href)).default))
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
  const queue = [...journeys]
  let failed = 0
  await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, async () => {
    for (let j; (j = queue.shift());) {
      const r = await recordJourney(browser, j, { ...p, out, keepVideo })
      if (r.errors.length) failed++
      console.log(`${r.errors.length ? 'FAIL' : 'ok  '} ${r.name}  calls=${r.faked} externalBlocked=${r.external}${r.errors.length ? '  ' + r.errors.join(' | ') : ''}`)
    }
  }))
  await browser.close()
  if (failed) process.exitCode = 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
