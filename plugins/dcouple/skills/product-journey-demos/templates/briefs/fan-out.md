# Brief: record journeys {RANGE} of {PRODUCT}

Project: `{PROJECT}`. First read `adapter.mjs`, the accepted scripts in
`journeys/`, and the skill's `references/harness.md`.

For each journey, one at a time:

1. Read its section `id="jN"` in `journeys.html`, and find the exact UI
   labels in the code (`{CODE_PATH}`).
2. Write `journeys/jNN.mjs` from the journey template: start on the start
   screen (or a named entry point), 4-8 steps, one caption sentence each,
   written for a new user. Journey-only data and fakes go in the journey file.
3. Record with `node harness/runner.mjs jNN --parallel 1` until it passes.
4. Check 3 frames plus the last against `templates/audit-checklist.md`.
5. Add the journey's row to `QA.md`, editing in place after a fresh read.

A journey with no UI records the closest real path and names the gap in the
last caption, or goes in `SKIPPED.md` with a reason.

Writes stay faked, data stays demo, and you touch only your journeys' files;
report harness or adapter needs. Reuse the running dev server. Time limit:
{MINUTES} minutes, about 6 per journey; partial delivery beats none.

Final message under 60 words: recorded, skipped and why, harness bugs.
