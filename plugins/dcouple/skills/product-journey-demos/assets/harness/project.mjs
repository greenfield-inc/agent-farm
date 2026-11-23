// Find the project folder and load its adapter.
// The project is --project DIR, else $JOURNEYS_HOME, else the folder that
// holds this harness copy (<project>/harness/).
import { existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export function projectDir(args = []) {
  const i = args.indexOf('--project')
  if (i >= 0) return resolve(args.splice(i, 2)[1])
  return resolve(process.env.JOURNEYS_HOME || join(here, '..'))
}

// Checks the parts of the adapter the runner relies on, so a missing piece
// fails before a browser starts.
export function checkAdapter(a) {
  const missing = []
  if (!a.app?.url) missing.push('app.url')
  if (!a.start?.route) missing.push('start.route')
  if (typeof a.start?.ready !== 'function') missing.push('start.ready')
  if (typeof a.fixtures !== 'function') missing.push('fixtures')
  if (typeof a.rules !== 'function') missing.push('rules')
  if (a.login && typeof a.login.signIn !== 'function') missing.push('login.signIn')
  if (a.socket) for (const k of ['parse', 'encodeReply', 'encodeError', 'isRead']) if (typeof a.socket[k] !== 'function') missing.push(`socket.${k}`)
  if (missing.length) throw new Error(`adapter.mjs is missing: ${missing.join(', ')} (see references/adapter-interface.md)`)
  return a
}

export async function loadProject(args = []) {
  const project = projectDir(args)
  const file = join(project, 'adapter.mjs')
  if (!existsSync(file)) throw new Error(`No adapter at ${file}: copy templates/adapter.template.mjs there and fill it in`)
  const adapter = checkAdapter((await import(pathToFileURL(file).href)).default)
  return { project, adapter, args }
}
