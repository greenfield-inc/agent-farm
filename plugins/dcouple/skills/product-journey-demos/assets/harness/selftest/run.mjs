// Self-test: record the toy app end to end and check the guard held.
//   node selftest/run.mjs        (from the harness folder, after npm install)
// Starts a local server whose real data must never show, copies the adapter
// and journey into a temp project, logs in, records j01, and checks that no
// write reached the server and no real read reached the page.
import http from 'node:http'
import { cpSync, mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const hits = []
const server = http.createServer((req, res) => {
  hits.push(`${req.method} ${req.url}`)
  const json = v => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(v)) }
  const signedIn = (req.headers.cookie || '').includes('session=ok')
  if (req.url === '/' || req.url.startsWith('/#')) { res.setHeader('content-type', 'text/html'); return res.end(readFileSync(join(here, 'app.html'))) }
  if (req.url === '/api/session') return json({ signedIn })
  if (req.url === '/api/me') return json({ name: 'REAL PERSON' })
  if (req.url === '/api/notes' && req.method === 'GET') return json(['REAL NOTE'])
  if (req.url === '/login' && req.method === 'POST') { res.setHeader('set-cookie', 'session=ok; Path=/'); return json({ ok: true }) }
  res.statusCode = 404; res.end()
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const project = mkdtempSync(join(tmpdir(), 'journey-selftest-'))
cpSync(join(here, 'adapter.mjs'), join(project, 'adapter.mjs'))
cpSync(join(here, 'journeys'), join(project, 'journeys'), { recursive: true })
cpSync(join(here, 'journeys.html'), join(project, 'journeys.html'))
const env = { ...process.env, APP_URL: `http://127.0.0.1:${server.address().port}/`, JOURNEYS_HOME: project }
let ok = true
try {
  // The runner is a child process so this server keeps answering.
  const run = (await import('node:child_process')).spawn(process.execPath, [join(here, '..', 'runner.mjs'), 'j01', '--parallel', '1'], { env, stdio: 'inherit' })
  ok = (await new Promise(r => run.on('exit', r))) === 0
} finally { server.close() }
const calls = JSON.parse(readFileSync(join(project, 'recordings', 'j01-save-a-note.calls.json'), 'utf8'))
console.log('server saw:', hits.join(', '))
const writes = hits.filter(h => !/^(GET|HEAD) /.test(h) && h !== 'POST /login')
const checks = [
  ['runner reported no errors', ok && calls.errors.length === 0],
  ['recording written', existsSync(join(project, 'recordings', 'j01-save-a-note.webp'))],
  ['no write reached the server', writes.length === 0],
  ['the note save was faked', calls.calls.some(c => c.name === 'POST /api/notes' && c.how === 'faked')],
  ['socket read answered by a fixture', calls.calls.some(c => c.name === 'GetCount' && c.how === 'fixture')],
  ['no real reads', !calls.calls.some(c => c.how === 'real')],
]
for (const [what, pass] of checks) console.log(`${pass ? 'ok  ' : 'FAIL'} ${what}`)
console.log('project:', project)
if (checks.some(([, pass]) => !pass)) process.exit(1)
