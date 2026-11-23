// Adapter for the self-test's toy app. A worked, minimal example of
// references/adapter-interface.md.
const env = name => process.env[name] || (() => { throw new Error(`Set ${name}`) })()

export default {
  name: 'Notebook',
  app: { url: env('APP_URL'), devServer: 'node selftest/run.mjs (starts it)' },
  login: {
    credentials: () => ({ user: 'demo@example.com', password: 'not-a-real-password' }),
    async signIn({ page, app, credentials }) {
      await page.goto(new URL('#/login', app.url).href)
      await page.getByPlaceholder('Email').fill(credentials.user)
      await page.getByPlaceholder('Password').fill(credentials.password)
      await page.getByRole('button', { name: 'Log in' }).click()
      await page.getByRole('heading', { name: 'Notes' }).waitFor()
    },
    isValid: async ({ request, app }) => (await (await request.get(new URL('/api/session', app.url).href)).json()).signedIn,
    allow: ['POST /login'],
  },
  start: {
    route: '#/notes',
    ready: ({ app }) => app.getByRole('heading', { name: 'Notes' }),
  },
  fixtures: () => ({
    persona: { name: 'Robin Demo' },
    notes: ['Call the plumber', 'Book the venue', 'Order team lunch'],
  }),
  rules: world => ({
    rest: {
      'GET /api/session': () => ({ signedIn: true }),
      'GET /api/me': () => ({ name: world.persona.name }),
      'GET /api/notes': () => world.notes,
    },
    reads: { GetCount: () => ({ count: world.notes.length }) },
    quiet: [],
  }),
  socket: {
    localOnly: () => true,
    parse: raw => { try { const m = JSON.parse(raw); return { name: m.cmd, id: m.id, data: m.data, ok: true } } catch { return null } },
    encodeReply: (msg, data) => JSON.stringify({ cmd: msg.name, id: msg.id, data }),
    encodeError: (msg, f) => JSON.stringify({ cmd: msg.name, id: msg.id, error: f.error || 'failed' }),
    isRead: name => /^Get/.test(name),
  },
  brand: { accent: '#4f46e5', card: 'rgb(30 27 75 / .96)', progress: '#a5b4fc', font: 'system-ui, sans-serif' },
  modes: {
    preLogin: { signedOut: true, route: '#/login' },
  },
}
