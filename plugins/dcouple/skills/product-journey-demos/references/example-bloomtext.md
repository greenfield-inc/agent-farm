# Reference example: BloomText

BloomText, a HIPAA-minded texting app for healthcare teams, is where this
workflow was built and proven. Its adapter, fixtures and 110 journey scripts
are in [PR #169](https://github.com/greenfield-inc/skills/pull/169)
(`bloomtext/skills/journey-demos/`). This page describes what was built and
what went wrong; accounts, keys, hosts and fixture records stay in #169.

## What was built and why

The team wanted short how-to demos of the real web app for new staff, one
per common task. Fifty hand-drawn mocks came first and were replaced, since
they drifted from the product and couldn't prove a feature existed.

- **Map:** 112 journeys in five tiers (core, less frequent, everyday staff
  and patient flows, admin flows, and 12 end-to-end flows), each with goal,
  steps, failure points, branches, gaps, audience and code evidence. Two gap
  sweeps (users, then admins) added journeys 51-100.
- **Harness:** Playwright drove the local web app against shared staging,
  with every write faked and every read from a synthetic demo org, from a
  working folder outside the product repo.
- **Output:** a WebP per journey, a gallery, the map with demos embedded, an
  audit report, and tracker issues for missing features.

## The numbers

| What | Count |
| --- | --- |
| Journeys mapped | 112 |
| Recorded on the real UI | 110 |
| Not recorded | 2: rating a video call (needs a live third-party call to end) and a voice message (mobile only, no web recorder) |
| First independent audit (105 audited) | 9 pass, 68 pass with notes, 26 fail, 2 not recorded |
| After the fix round | 32 pass, 78 pass with notes, 0 fail (26 fixed) |
| Missing-feature pass | 21 new issues (19 features, 2 bugs), 11 comments on existing issues, 4 candidates dropped because the feature existed or the bug didn't hold up |
| Library size | about 160 MB, 1-3.5 MB per journey |
| Concurrency | about 10 recording agents sharing one dev server, `--parallel 1` each |

All 26 audit failures had passed the recording agents' own QA, which is why
the independent audit is a phase of its own.

## Key design choices

- **Inbox start.** Every signed-in recording opens on the Inbox and
  navigates to the feature in its first steps. This was added after the first
  round, when recordings started on whatever page the feature lived on.
- **Brand tokens from the source.** The ring, card and progress colors came
  from the app's own color file (its primary purple, darkest purple and pale
  violet), plus a white halo on the ring so it stays visible on purple
  buttons. The overlay reads as part of the product, not a third-party tool.
- **PACE 1.33.** The first recordings were too fast for a healthcare
  audience. One factor slows every lead, hold, typing speed and overlay
  transition while the frame rate stays 15 fps.
- **Caption strip.** Captions sit in a 64px band under the app, one line,
  so narration never covers the UI. A guard fails any caption that wouldn't
  fit.
- **Demo persona.** One invented front-desk lead at an invented pediatric
  therapy practice, a second invented clinic for org switching, a roster of
  coworkers and teams, six demo families with chats, fictional `555-01xx`
  numbers and a reserved demo email domain. The real test account's identity
  is rewritten wherever it passes through.
- **Default deny.** Unknown socket commands are writes and get a fake reply;
  a read nobody answered fails the run instead of quietly showing staging
  data.

## Failure modes hit, and their fixes

| Failure | Cause | Fix (now in the generic harness) |
| --- | --- | --- |
| Other people's data on screen | Reads went to the shared staging backend, full of other agents' test data | A complete synthetic demo world; any `real` read fails the run; responses that pass through are rewritten to the persona |
| Error toasts after faked writes | Fakes returned the wrong shape | Copy field names from the app's store code |
| Blank panels, wrong empty states | A fake used `data \|\| {}`, turning `false`, `null` or `[]` into `{}` | The guard sends answers exactly; only `undefined` falls back |
| Ring on the wrong element, or on empty space | The ring used a stale box, or the locator re-resolved to another match after a dialog closed | Per-frame tracking of a tagged element, a fingerprint check on re-tag, and a ring check that fails the run |
| Ring drawn over a dialog that covers the target | No cover check | `elementFromPoint` at the target's center; a covered target gets no ring and the check names the cover |
| Card switched before the caption, or lingered over the next screen | Separate transitions | Card and caption swap together before any scroll; the card fades with the ring once the target is gone |
| Captions cut off with "..." | Too long for the strip | The caption guard measures every caption before recording |
| "Connecting..." banners | Each relayed ping wrote the shared user's presence to the staging database; under parallel load those writes timed out and the app dropped its socket | Pings answered in the guard; a cheap read every 25 s keeps each socket inside the server's idle limit |
| Faint ghosts of closed dialogs | ffmpeg's animated WebP encoder diffs frames lossily with no keyframe control | Pillow encoder with a keyframe at least every 15 frames (files about 1.5x larger) |
| "Debugger paused in another tab" banner | A real popup was held by the debugger | `window.open` and new-tab links show in a panel inside the recording; any real popup is closed at once |
| Black video previews | Chromium had a fake microphone but no fake camera | A canvas "Demo Camera" with the persona's initials and name |
| Image lightbox never opened | The app checked that it was the top window; in the recording frame it isn't | The app frame reports itself as its own parent |
| Recordings started on a settings page | No fixed start | The pinned start screen, with navigation steps |
| Captions named controls wrongly ("gear" for the "..." menu) | Labels guessed, not read from code | Exact labels from the code; the audit checks them |
| The demo org listed twice | Two real orgs renamed to the same demo name | One consistent fixture org list |
| Locator timeouts cut recordings short | Labels changed or a step waited on the wrong state | Check labels in code; wait for the right state |
| Logins failed mid-run | The shared account's sessions were dropped under load; new devices needed an SMS code | Re-login when the session check fails; read the code from the dev server log |
| `j10` also ran `j100`-`j109` | Substring filter | A bare id matches exactly |
| Parallel agents clobbered each other | Shared temp video folders, and late network replies after a context closed | Per-run temp folders; every late reply is caught |
| A "missing feature" existed | The map was written before checking one editor in code | Verify every gap in code before filing; the doc-sync round corrects the map |
| Agents overwrote shared logs | Whole-file writes to `QA.md` and the map | Edit only, inside your own row or slot, after re-reading |
| A screen reachable only through a live third-party call | Could not be faked reliably | Show the result instead (a past session with its rating) and name the prompt in a caption, or skip with a reason |
