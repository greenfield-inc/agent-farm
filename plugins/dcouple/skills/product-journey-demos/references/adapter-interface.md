# Product adapter interface

The harness is product-agnostic. Each product supplies `<project>/adapter.mjs`,
whose default export is a plain object. Start from
[../templates/adapter.template.mjs](../templates/adapter.template.mjs); the
self-test adapter (`assets/harness/selftest/adapter.mjs`) is a complete small
example.

```js
export default { name, app, login, start, fixtures, rules, socket, brand, modes, helpers }
```

Required: `app.url`, `start.route`, `start.ready`, `fixtures`, `rules`.
`project.mjs` checks them before a browser starts. `name` is for reference;
the gallery takes its title from the journey map's `<title>`.

## `app`: where the product runs

```js
app: {
  url: process.env.APP_URL,      // the app the recording opens
  api: process.env.API_URL,      // the API, if on another origin
  origins: [],                   // any other origin to guard
  devServer: 'pnpm dev',         // how to start it, for agents
}
```

Read URLs from the environment. Every listed origin is guarded; writes to any
other host are aborted.

## `login`: the test account

Omit for a product with no sign-in.

```js
login: {
  credentials: () => ({ user: userEnv('ACME_TEST_USER'), password: userEnv('ACME_TEST_PASSWORD') }),
  async signIn({ page, app, credentials, devLog, logLength, waitForLog }) { /* drive the real form */ },
  isValid: async ({ request, app }) => (await request.get(`${app.api}/session`)).ok(),
  allow: ['POST /login', 'POST /login/mfa'],
}
```

- `credentials()` reads the account at run time. `userEnv` (from
  `harness/login.mjs`) also reads the Windows user registry. Credentials stay
  out of files, logs and recordings.
- `signIn` drives the real login form. A second-factor code can usually be
  read from the dev server log: `await waitForLog(devLog, 'code is (\\d{6})', since)`.
- `isValid` checks the saved session; the runner logs in again only when it fails.
- `allow` lists the only REST writes that reach the server, and only while
  logging in.

The session lives in `<project>/.auth/state.json`, which is a secret.

## `start`: the start screen

```js
start: {
  route: '#/inbox',                                                    // relative to app.url
  ready: ({ app }) => app.getByRole('heading', { name: 'Inbox' }),
  dismiss: ({ app }) => app.getByRole('button', { name: 'Dismiss' }),  // optional
}
```

Every journey opens on the screen a signed-in user lands on. Recording waits
for `ready`, so loading states stay out of the video. `dismiss` returns the
close control of first-run banners, clicked up to four times.

## `fixtures`: the demo world

```js
fixtures: ({ journey, mode, signedOut, world }) => ({
  persona: { name: 'Robin Demo', email: 'robin@example.com', title: 'Office manager' },
  org: { name: 'Northwind Studio' },
  customers: [/* ... */],
})
```

Return a fresh synthetic world per recording: the persona, the org and all
data the screens show, plus any helpers scripts use. `world` holds the
journey's options, `mode` the start mode (`'default'` for the start screen).
Scripts reach the world as `ctx.demo`. Prepare display labels using
[contextual-data.md](contextual-data.md), keeping IDs and records synthetic.
Use a demo email domain such as `example.com` and fictional phone numbers
(`555-01xx`), including for verified professional display names.

## `rules`: which reads use fixtures, which writes are faked

```js
rules: (world, { journey, mode, signedOut }) => ({
  rest: {                                    // 'METHOD /path' -> answer
    'GET /api/me': () => ({ name: world.persona.name }),
    'POST /api/orders': () => ({ id: 'demo-1', status: 'created' }),
  },
  reads: { GetInbox: () => world.inbox },    // socket reads
  writes: { SendMessage: () => ({ id: 'demo-msg' }) }, // socket writes
  allowReal: [],                             // reads allowed to reach the server
  patch: {},                                 // rewrite allowed socket reads: name -> (data, req) => data
  restPatch: {},                             // rewrite allowed REST reads: 'GET /path' -> json => json
  transform: text => text,                   // rewrite any response that passes through
  quiet: [],                                 // forwarded calls to leave out of the log
  restEmpty: {},                             // body for an unlisted faked REST write
})
```

The guard (`assets/harness/guard.mjs`) is default deny:

- **Writes stay in the browser.** Non-GET requests are answered by `rest` or
  `restEmpty`; socket writes by `writes` or the protocol's empty reply.
- **Reads come from fixtures.** A fetch/XHR GET or socket read with no answer
  is forwarded, logged `real`, and fails the run. Pages and assets load
  normally.
- **Answers go out exactly as returned**, including `false`, `null`, `0`,
  `''` and `[]`. Only `undefined` means "no answer", so avoid `value || {}`.
- **Match the app's shapes**, copied from its store or API types; a wrong
  shape shows up as an error toast or blank panel.
- A REST answer may be `{ __status: 404, ...body }` to set the status.
- A journey's `fakes`, `rest` and `failures` win; a fake returning `undefined`
  falls back to the adapter.

Reserve `allowReal`/`patch` for a read you can't rebuild (such as the
session's own user), rewritten to the persona. The audit accepts
`real-patched`.

## `socket`: the real-time protocol (optional)

Describe the frame format; the guard does the rest.

```js
socket: {
  parse: raw => ({ name, id, data, ok }) | null, // id undefined = a push
  encodeReply: (msg, data) => string,            // success reply
  encodeError: (msg, failure) => string,         // error reply (failure mode)
  isRead: name => boolean,                       // false = a write
  empty: {},                                     // reply data for an unfaked write
  encodePush: msg => string,                     // for guard.push(...) in scripts
  passPush: msg => boolean,                      // server pushes the app may see
  answerLocally: msg => string | null | undefined, // reply / swallow / handle normally
  dropReply: msg => boolean,                     // replies to the harness's own frames
  keepAlive: toServer => stopFn,                 // keep an idle socket open
  localOnly: url => boolean,                     // sockets answered entirely locally
  onOpen: sendToApp => {},                       // first frame on a local socket
}
```

Server pushes are dropped unless `passPush` allows them, so activity on a
shared server stays out of recordings; scripts play events with
`guard.push(...)`. Answer pings in `answerLocally` when the server writes on
each one. Client frames without an id are dropped.

## `brand`: the overlay's look

```js
brand: { accent: '#4f46e5', card: 'rgb(30 27 75 / .96)', progress: '#a5b4fc', font: 'system-ui, sans-serif' }
```

`accent` colors the ring, ripple and demo camera; `card` the step card;
`progress` the progress bar and caption dot. Take them from the product's own
design tokens so the overlay looks native.

## `modes`: other entry points

A journey picks one with `start: { mode: 'preLogin', route: '#/login' }`.

```js
modes: {
  preLogin: { signedOut: true, route: '#/login', ready: ({ app }) => app.getByRole('button', { name: 'Log in' }) },
  website: { url: 'https://www.example.com/', ready: ({ app }) => app.getByRole('navigation').first() },
  customer: { signedOut: true, route: '#/c/DEMO01' },
  video: { camera: { name: 'Robin Demo', note: 'Northwind Studio' } },
}
```

| Field | Effect |
| --- | --- |
| `route`, `ready`, `dismiss` | As in `start`; a journey's `start.route` and `ready` override them. |
| `signedOut` | Passed to `fixtures` and `rules` to answer session checks as signed out. The saved session stays loaded, so a faked sign-in continues into it. |
| `url` | Website mode, read-only: no session, non-GETs aborted, form submits blocked, and only `click`, `hover` and `none` actions. |
| `camera` | A canvas camera card with initials, `name` and `note`, plus Chromium's fake microphone. |

Failure mode is per journey: `failures: { SendMessage: true }`, or
`{ status, body }`, or a function that fails only the first call so a retry
succeeds.

## `helpers`: script shortcuts (optional)

```js
helpers: ({ app }) => ({ row: name => app.locator('.list-item').filter({ hasText: name }).first() })
```

Returned functions are added to each step's `ctx`.
