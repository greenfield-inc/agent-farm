// Product adapter for journey demos. Copy to <project>/adapter.mjs and replace
// every <...>. Contract: references/adapter-interface.md. Working example:
// assets/harness/selftest/adapter.mjs. URLs and credentials come from the
// environment; fixtures follow references/contextual-data.md; unlisted writes are faked.
import { userEnv } from './harness/login.mjs'

const env = name => process.env[name] || (() => { throw new Error(`Set ${name}`) })()

// A fresh world per recording, so one journey's faked writes stay out of the next.
function makeWorld({ world: options = {} }) {
  const persona = { id: 'me', name: '<Robin Demo>', email: '<robin@example.com>', title: '<Office manager>' }
  const org = { id: 'org-1', name: '<Northwind Studio>' }
  const items = [/* <records the start screen lists, in the app's store shape> */]
  return { persona, org, items, ...options, item: id => items.find(i => i.id === id) }
}

export default {
  name: '<Product>',
  app: { url: env('APP_URL'), api: process.env.API_URL, devServer: '<pnpm dev>' },

  login: {
    credentials: () => ({ user: userEnv('<PRODUCT>_TEST_USER'), password: userEnv('<PRODUCT>_TEST_PASSWORD') }),
    async signIn({ page, app, credentials, devLog, logLength, waitForLog }) {
      await page.goto(new URL('<#/login>', app.url).href)
      await page.getByLabel('<Email>').fill(credentials.user)
      await page.getByLabel('<Password>').fill(credentials.password)
      const since = logLength(devLog)
      await page.getByRole('button', { name: '<Log in>' }).click()
      // Second factor: const code = await waitForLog(devLog, '<code is (\\d{6})>', since)
      await page.getByRole('heading', { name: '<Inbox>' }).waitFor({ timeout: 60000 })
    },
    isValid: async ({ request, app }) => (await request.get(new URL('<api/session>', app.api || app.url).href)).ok(),
    allow: ['<POST /login>'],
  },

  start: {
    route: '<#/inbox>',
    ready: ({ app }) => app.getByRole('heading', { name: '<Inbox>' }),
  },

  fixtures: makeWorld,

  rules: (world, { signedOut }) => ({
    rest: {
      '<GET /api/me>': () => (signedOut ? { __status: 401 } : { user: world.persona, org: world.org }),
      '<GET /api/items>': () => world.items,
      '<POST /api/items>': req => {
        const item = { id: `demo-${world.items.length + 1}`, ...JSON.parse(req.postData() || '{}') }
        world.items.unshift(item) // later reads show it, as the server would
        return item
      },
    },
    // transform: text => text.replaceAll('<test account name>', world.persona.name),
  }),

  // socket: { parse, encodeReply, encodeError, isRead },

  brand: { accent: '<#4f46e5>', card: '<rgb(30 27 75 / .96)>', progress: '<#a5b4fc>', font: '<system-ui, sans-serif>' },

  modes: {
    preLogin: { signedOut: true, route: '<#/login>', ready: ({ app }) => app.getByRole('button', { name: '<Log in>' }) },
    // website: { url: '<https://www.example.com/>', ready: ({ app }) => app.getByRole('navigation').first() },
    // video: { camera: { name: '<Robin Demo>', note: '<Northwind Studio>' } },
  },
}
