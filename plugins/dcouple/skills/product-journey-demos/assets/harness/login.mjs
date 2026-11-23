// Log in with the product's test account behind the guard and save the
// session to <project>/.auth/state.json.   node login.mjs [--project DIR]
// Credentials come from adapter.login.credentials() at run time only.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { installGuard } from './guard.mjs'
import { loadProject } from './project.mjs'

export const statePath = project => join(project, '.auth', 'state.json')

// An environment variable, falling back to the Windows user registry (setx
// only reaches new shells).
export function userEnv(name) {
  if (process.env[name]) return process.env[name]
  if (process.platform !== 'win32') return ''
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return out.match(new RegExp(`${name}\\s+REG_\\w+\\s+(.*)`))?.[1]?.trim() ?? ''
  } catch { return '' }
}

export const logLength = file => (file && existsSync(file) ? readFileSync(file, 'utf8').length : 0)

// Wait for a regex in a dev server log (e.g. a logged SMS code); returns group 1.
export async function waitForLog(file, re, since = 0, timeoutMs = 20000) {
  if (!file) throw new Error('No log file: set DEV_LOG to the dev server log')
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const tail = existsSync(file) ? readFileSync(file, 'utf8').slice(since) : ''
    const m = [...tail.matchAll(new RegExp(re, 'g'))].pop()
    if (m) return m[1] ?? m[0]
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`Nothing matching ${re} in ${file}`)
}

const origins = adapter => [adapter.app.url, adapter.app.api, ...(adapter.app.origins || [])].filter(Boolean)

export async function login({ adapter, project }, { headless = true } = {}) {
  const credentials = adapter.login.credentials()
  const state = statePath(project)
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless })
  try {
    // Reuse saved cookies, so a known device can skip a second factor.
    const context = await browser.newContext({ viewport: { width: 1100, height: 680 }, ...(existsSync(state) ? { storageState: state } : {}) })
    // Writes stay faked during login, except the session calls on login.allow.
    const guard = await installGuard(context, {
      origins: origins(adapter),
      rules: { socket: adapter.socket, loginAllow: adapter.login.allow || [] },
      login: true,
    })
    const page = await context.newPage()
    await adapter.login.signIn({ page, app: adapter.app, credentials, devLog: process.env.DEV_LOG, logLength, waitForLog })
    mkdirSync(dirname(state), { recursive: true })
    await context.storageState({ path: state })
    return guard.log
  } finally { await browser.close() }
}

// True when the saved session still works (adapter.login.isValid).
export async function sessionValid({ adapter, project }) {
  const state = statePath(project)
  if (!existsSync(state)) return false
  if (!adapter.login.isValid) return true
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined })
  try {
    const context = await browser.newContext({ storageState: state })
    return !!await adapter.login.isValid({ request: context.request, app: adapter.app })
  } catch { return false } finally { await browser.close() }
}

// Log in again only when the saved session no longer works.
export async function ensureLogin(p) {
  if (!p.adapter.login) return 'none'
  if (await sessionValid(p)) return 'reused'
  await login(p)
  return 'fresh'
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const log = await login(await loadProject(process.argv.slice(2)))
  console.log('logged in; session saved; faked during login:', [...new Set(log.filter(l => l.how === 'faked').map(l => l.name))].join(', ') || 'none')
}
