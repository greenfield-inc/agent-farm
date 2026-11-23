# Harness manual

`assets/harness/` records a journey script on the real app with Playwright,
behind the side-effect guard, and encodes an animated WebP with a cursor,
highlight ring, step card and caption strip.

## Project layout

The project is a working folder outside any product repository, with
`assets/harness/` copied in as `harness/` (and `harness/gitignore.txt` as its
`.gitignore` if it is a repository).

```
<project>/
├── journeys.html        the journey map (journey-map.md)
├── adapter.mjs          the product adapter (adapter-interface.md)
├── harness/             copy of assets/harness/
├── journeys/jNN.mjs     one script per journey
├── demo-files/          fake attachments, served at /__journey/files/
├── recordings/          jNN-slug.webp + jNN-slug.calls.json  (generated)
├── audit/jNN.json       audit verdicts                       (generated)
├── QA.md                | jNN | accepted / needs fix | notes |
├── SKIPPED.md           journeys with no recording, and why  (report.py keeps it in sync)
├── index.html, audit-report.html                             (report.py)
└── .auth/ .video/       session (secret) and temp video
```

## Setup

- Node 20+, then `npm install` in `harness/`; a Chromium
  (`npx playwright install chromium`, or `CHROME`); ffmpeg on PATH; Python
  with Pillow (or `PYTHON`).
- `node harness/selftest/run.mjs` checks the install: it records a toy app
  and verifies that every write was faked and only demo data showed.
- The product running locally (`adapter.app.devServer`), with the URLs the
  adapter reads in the environment.

## Commands

```bash
node harness/login.mjs                     # log in once (the runner also does it when needed)
node harness/runner.mjs j06 --parallel 1   # record recordings/j06-<slug>.webp + .calls.json
python harness/report.py                   # gallery, audit report, SKIPPED.md, demos in the map
node --test harness/guard.test.mjs         # guard unit tests
```

- Project: `--project DIR`, else `$JOURNEYS_HOME`, else the folder above `harness/`.
- `j10` matches only `j10.mjs`; other filters match by substring.
- Runner options: `--parallel N` (default 2), `--out DIR`, `--keep-video`.
- Env: `PACE` (1.33), `WEBP_QUALITY` (75), `WEBP_KMIN`/`WEBP_KMAX` (9/15),
  `CHROME`, `PYTHON`, `DEV_LOG` (dev server log, for login codes).
- A failed run exits non-zero and leaves `.video/<name>-error.png` or `-not-ready.png`.

## A journey script

```js
export default {
  id: 'j06', slug: 'reply-to-a-message', title: 'Reply to a message',
  steps: [
    { title: 'Open the chat', caption: 'Click the chat to open it.',
      target: ({ app }) => app.getByRole('link', { name: 'Maria Gonzalez' }) },
    { title: 'Type a reply', caption: 'Type your reply in the message box.',
      target: ({ app }) => app.getByRole('textbox', { name: 'Message' }),
      action: 'type', text: 'See you Thursday.' },
    { title: 'Reply sent', caption: 'The reply shows in the thread.',
      target: ({ app }) => app.getByText('See you Thursday.').last(), action: 'none' },
  ],
}
```

| Journey key | Meaning |
| --- | --- |
| `id`, `slug`, `title` | `id` equals the file name; output is `recordings/<id>-<slug>.webp`. |
| `start` | Omitted for the start screen; `{ mode, route? }` for another entry point. |
| `ready(ctx)` | Locator showing the entry screen has loaded (overrides the mode's). |
| `world` | Options for `adapter.fixtures`. |
| `setup(ctx)` | Runs once before the first step. |
| `fakes`, `rest`, `failures` | Journey-only answers over the adapter's rules. |
| `camera` | `{ name, note, mirror }` for the fake camera card. |
| `popups` | `'panel'` shows every opened URL in the new-tab panel (default: files only). |

Step keys: `title`, `caption`, `target(ctx)`, `action` (`click` default,
`type` + `text`, `press` + `key`, `hover`, `none`), `before(ctx)`,
`after(ctx)`, `lead` (ms pointing before the action, default 1150), `wait`
(ms held after, default 1700, last step 2600), and `repoint: false`. `lead`,
`wait` and typing speed scale by PACE.

`ctx` holds `page`, `app` (the app frame's locator root), `demo` (the world),
`guard` (`guard.push(frame)` plays a server event), `wait(ms)`, `newTab` and
`closeTab()`, plus the adapter's `helpers`.

Prefer role, label, placeholder or text locators with the product's exact
labels, a class only for a control with no accessible name, and scope to a
dialog when the same label sits behind it.

## What the runner does

- **Ring check:** before each action the target's center must be inside the
  ring, and a ring held on a different element for 300 ms is a miss. A miss
  fails the run (`ring misses target: step N/M`). A covered target gets no
  ring, and the check names what covers it.
- **Caption guard:** every caption, the title and the "Done:" line are
  measured with the strip's font before recording; one that won't fit fails
  at once.
- **Real reads:** any `real` entry in the call log fails the run.
- **Overlay:** card and caption swap together before any scroll; the card
  fades with the ring once its target is gone.
- **Output:** app 1100x680 above a 64px caption strip; WebP at 15 fps, 880px
  wide, quality 75, a keyframe at least every 15 frames, 1-3 MB each.
- **Popups:** `window.open` and `target=_blank` open in a "new tab" panel
  inside the recording; any real popup closes at once.
- **Calls log:** `calls.json` names every intercepted call (never payloads)
  as `fixture`, `faked`, `failed`, `real`, `real-patched`, `allowed`,
  `session`, `error` or `dropped`, and lists aborted writes to other hosts
  under `externalBlocked`.

## Parallel recording

Faked writes make parallel runs safe. One dev server handled about 10
browser contexts on a 32-thread machine (pacing slowed 20-45 %, videos stayed
correct): up to `--parallel 6` for one agent, or `--parallel 1` each for
about 10 agents sharing a server.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `ring misses target` | Tighten the locator (role + name, `.first()`, scoped to the dialog) and target it while on screen. |
| `ring not shown: target covered by ...` | Target the control inside the dialog, or close the dialog first. |
| Ring stays on a button after it closes something | Point the "it worked" step at the result: toast, row or message. |
| `real read(s): X` | Answer it in the adapter's `rules` (shared screens) or the journey's `fakes`. |
| Error toast or blank panel after a faked write | Match the store's shape, and return falsy answers as-is. |
| "Connecting..." or loading banner early on | Make `ready` wait for loaded content; if the server writes on every ping, answer pings in `socket.answerLocally` and use `keepAlive`. |
| `app not ready` | Re-run (it re-logs in), check the dev server, and look at `.video/<name>-not-ready.png`. |
| Faint ghosts of closed dialogs | Fix Python/Pillow; `errors` says the ffmpeg fallback ran. |
| A locator timeout cuts the recording short | Check the label in the product's code and wait for the right state. |
