// Visual-only tour overlay, loaded in the wrapper page that frames the app, so
// the app's DOM stays untouched. The runner tags each step's target with
// data-tour-target; the frame shares the wrapper's origin, so the overlay
// re-measures that element every animation frame and the ring, cursor and
// card follow it, hiding when it is gone (the runner's box is the fallback).
// API (page.evaluate): setPace, step, announce, lost, why, press, caption,
// done, closeTab, captionOverflow, acted.
(() => {
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.innerHTML = `<div class="tour-ring"></div>
<div class="tour-card"><b></b><small><em></em><i></i></small></div>
<div class="tour-caption"></div>
<div class="tour-cursor"><span></span><svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 8.5-6.6 1.6L8 18.5z" fill="#1f1d24" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div>`
  document.body.append(layer)
  const ring = layer.querySelector('.tour-ring'), card = layer.querySelector('.tour-card')
  const cap = layer.querySelector('.tour-caption'), cursor = layer.querySelector('.tour-cursor')
  const ripple = cursor.firstElementChild
  const APP_H = 680, PAD = 4
  const frame = () => document.getElementById('app')
  const nextFrame = () => new Promise(r => requestAnimationFrame(r))
  const wait = ms => new Promise(r => setTimeout(r, ms))

  // PACE (set by the runner) stretches every transition by the same factor.
  let pace = 1
  const paceStyle = document.createElement('style')
  document.head.append(paceStyle)
  function setPace(p) {
    pace = p || 1
    const t = s => `${(s * pace).toFixed(3)}s`
    const ease = 'cubic-bezier(.45,0,.2,1)'
    paceStyle.textContent = `
.tour-ring{transition:transform ${t(.7)} ${ease},width ${t(.7)} ${ease},height ${t(.7)} ${ease},opacity ${t(.3)}}
.tour-card{transition:opacity ${t(.3)},transform ${t(.55)} ${ease}}
.tour-card i::after{transition:width ${t(.5)}}
.tour-cursor{transition:transform ${t(.8)} ${ease},opacity ${t(.3)}}
.tour-caption{transition:opacity ${t(.25)}}
.tour-tracking.tour-ring{transition:opacity ${t(.3)}}
.tour-tracking.tour-card{transition:opacity ${t(.3)}}
.tour-tracking.tour-cursor{transition:opacity ${t(.3)}}`
  }
  setPace(1)

  // ---- Measuring -------------------------------------------------------
  let current = null // { id, fallback }
  function measure() {
    if (!current) return null
    let doc = null
    try { doc = frame()?.contentDocument } catch { doc = null }
    if (!doc) return current.fallback || null // cross-origin: runner's box
    // A target in the wrapper itself (the "new tab" panel) has no offset.
    const own = document.querySelector(`[data-tour-target="${current.id}"]`)
    if (own) {
      const r = own.getBoundingClientRect()
      return r.width < 1 || r.height < 1 ? null : { x: r.left, y: r.top, width: r.width, height: r.height }
    }
    const el = doc.querySelector(`[data-tour-target="${current.id}"]`)
    if (!el || !el.isConnected) return null
    // Hidden counts as gone: display:none, visibility:hidden or opacity:0 on
    // the element or an ancestor (a closed menu kept in the DOM).
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return null
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return null
    const f = frame().getBoundingClientRect()
    const box = { x: r.left + f.left, y: r.top + f.top, width: r.width, height: r.height }
    // Fully outside the app viewport counts as gone.
    if (box.y + box.height < f.top || box.y > f.top + f.height || box.x + box.width < f.left || box.x > f.left + f.width) return null
    // Covered counts as gone: the topmost element at the center of the
    // target's visible part must be the target, inside it, or an ancestor
    // (a pointer-events:none target). A dialog or overlay on top means no
    // ring. The new-tab panel covers the whole app.
    const vw = doc.documentElement.clientWidth || f.width, vh = doc.documentElement.clientHeight || f.height
    const cx = (Math.max(r.left, 0) + Math.min(r.right, vw)) / 2, cy = (Math.max(r.top, 0) + Math.min(r.bottom, vh)) / 2
    const hit = doc.elementFromPoint(cx, cy)
    // Part of the same widget (a decorative overlay on a thumbnail): the hit
    // is inside one of the target's 3 nearest ancestors. A dialog or backdrop
    // sits in a separate subtree (a portal) and still counts as a cover.
    let near = false
    for (let a = el.parentElement, k = 0; a && k < 3 && !near; a = a.parentElement, k++) near = a !== doc.body && a.contains(hit)
    if (!hit || !(hit === el || el.contains(hit) || hit.contains(el) || near)) {
      coverReason = hit ? `covered by ${describe(hit)}` : 'center off screen'
      return null
    }
    const panel = document.getElementById('newtab')
    if (panel && panel.style.display === 'block') { coverReason = 'covered by the new-tab panel'; return null }
    coverReason = ''
    return box
  }
  let coverReason = ''
  const describe = e => {
    const cls = typeof e.className === 'string' ? e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
    return `<${e.tagName.toLowerCase()}${cls ? '.' + cls : ''}>`
  }
  const same = (a, b) => a && b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5

  // ---- Placing ---------------------------------------------------------
  function place(b) {
    ring.style.transform = `translate(${b.x - PAD}px,${b.y - PAD}px)`
    ring.style.width = `${b.width + PAD * 2}px`; ring.style.height = `${b.height + PAD * 2}px`
    const cb = card.getBoundingClientRect(), gap = 12, W = innerWidth
    let top, left
    if (b.x < W * 0.3 && b.x + b.width + gap + cb.width < W - 12) {
      left = b.x + b.width + PAD + gap
      top = Math.min(Math.max(8, b.y + b.height / 2 - cb.height / 2), APP_H - cb.height - 8)
    } else {
      const below = b.y + b.height + PAD + gap + cb.height <= APP_H - 8
      top = below ? b.y + b.height + PAD + gap : Math.max(8, b.y - PAD - gap - cb.height)
      left = Math.min(Math.max(12, b.x + b.width / 2 - cb.width / 2), W - cb.width - 12)
    }
    card.style.transform = `translate(${left}px,${top}px)`
    cursor.style.transform = `translate(${b.x + Math.min(b.width / 2, 48)}px,${b.y + b.height / 2}px)`
  }
  function showMarks(on) {
    ring.style.opacity = on ? '1' : '0'
    cursor.style.opacity = on ? '1' : '0'
  }
  function tracking(on) {
    for (const e of [ring, card, cursor]) e.classList.toggle('tour-tracking', on)
  }

  // Follow the target every frame while a step is shown. Once the step's
  // action is done (tour.acted()), a target that is gone also fades the
  // card, so it doesn't linger over the next screen.
  let last = null, missing = 0, acted = false, cardFaded = false
  function fadeCard(out) {
    if (out === cardFaded) return
    cardFaded = out
    card.style.opacity = out || !card.dataset.title ? '0' : '1'
  }
  function loop() {
    if (current) {
      const b = measure()
      if (b) {
        missing = 0
        if (!same(b, last)) { place(b); last = b }
        showMarks(true)
        if (acted) fadeCard(false)
      } else if (++missing > 2) {
        showMarks(false) // target gone (closed, re-rendered): no ring on empty space
        if (acted) fadeCard(true)
      }
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  // ---- Text: card and caption swap together ------------------------------
  function setTexts(title, captionText, i, n) {
    const next = captionText || ''
    const changed = cap.dataset.text !== next || card.dataset.title !== (title || '')
    if (!changed) return Promise.resolve()
    cap.dataset.text = next; card.dataset.title = title || ''
    cap.style.opacity = '0'; card.style.opacity = '0'
    return wait(200 * pace).then(() => {
      card.querySelector('b').textContent = title || ''
      card.querySelector('em').textContent = `${i + 1} / ${n}`
      card.style.setProperty('--progress', `${((i + 1) / n) * 100}%`)
      cap.textContent = next
      if (last) place(last) // re-place with the new card size
      cap.style.opacity = next ? '1' : '0'; card.style.opacity = title ? '1' : '0'
    })
  }

  // Point at a step's target: wait until it holds still for 2 frames, move
  // there (animated), swap card and caption, then track it frame by frame.
  async function step(s, fallback) {
    tracking(false)
    acted = false; cardFaded = false
    current = { id: s.id, fallback }
    let prev = null, stable = 0
    const deadline = performance.now() + 3000
    while (performance.now() < deadline) {
      await nextFrame()
      const b = measure()
      if (b && same(b, prev)) { if (++stable >= 2) break } else stable = 0
      prev = b
    }
    last = null
    const texts = setTexts(s.title, s.caption, s.i, s.n)
    await nextFrame()
    await texts
    if (card.dataset.title) card.style.opacity = '1' // also when the text did not change
    await wait(800 * pace) // ring, cursor and card arrive
    tracking(true)
    return !!measure()
  }

  function lost() { return !!current && !measure() }
  // Why the ring is hidden for a target that is still in the DOM ('' = shown).
  function why() { measure(); return coverReason }

  function press() {
    ripple.animate([{ opacity: .4, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(1.5)' }], { duration: 450 * pace, easing: 'ease-out' })
  }

  function caption(text) {
    const next = text || ''
    if (cap.dataset.text === next) return
    cap.dataset.text = next
    cap.style.opacity = '0'
    setTimeout(() => { cap.textContent = next; cap.style.opacity = next ? '1' : '0' }, 200 * pace)
  }

  function hide() { current = null; showMarks(false); card.style.opacity = '0'; card.dataset.title = '' }

  function done(title) { hide(); caption('Done: ' + title) }

  // "New tab" panel: the app frame posts window.open URLs here (runner.mjs).
  const tab = () => document.getElementById('newtab')
  addEventListener('message', e => {
    let url
    try { url = new URL(e.data?.journeyNewTab) } catch { return }
    // Only web pages and files; a javascript: or data: URL would run in this page.
    if (!/^https?:$/.test(url.protocol) || !tab()) return
    url = url.href
    // Files (a PDF, an image) show in the panel; anything else (a video
    // call window, an outside page) stays outside the recording.
    const isFile = /\/__journey\/files\/|\.(pdf|png|jpe?g|gif|webp)(\?|#|$)/i.test(url)
    if (!isFile && !window.__journeyPanelAll) { (window.__journeyPopups ||= []).push(url); return }
    // Show the panel only once the viewer has loaded (a PDF takes a few
    // seconds), so the video never shows an empty tab.
    tab().onload = () => setTimeout(() => { if (tab().src === url) tab().style.display = 'block' }, 1200)
    tab().src = url
  })
  function closeTab() { if (tab()) { tab().style.display = 'none'; tab().src = 'about:blank' } }

  // How many px a caption is over the one-line strip (0 = fits), measured
  // with the strip's own font and padding.
  function captionOverflow(text) {
    const probe = cap.cloneNode(false)
    probe.textContent = text
    Object.assign(probe.style, { opacity: '0', visibility: 'hidden', maxWidth: 'none', width: 'auto', transition: 'none' })
    layer.append(probe)
    const max = parseFloat(getComputedStyle(cap).maxWidth) || 1040
    const over = Math.ceil(probe.getBoundingClientRect().width - Math.min(max, innerWidth - 24))
    probe.remove()
    return Math.max(0, over)
  }
  // The runner calls this when a step's action has completed.
  function markActed() { acted = true }

  // Swap the card and caption to a step before the runner scrolls to it.
  function announce(s) { return setTexts(s.title, s.caption, s.i, s.n) }

  window.tour = { step, announce, lost, press, caption, hide, done, setPace, closeTab, captionOverflow, acted: markActed, why }
})()
