# Workflow in depth

A small product can run the eleven phases in one session. A large one (a
hundred journeys) runs as an orchestrator that fans briefs out to agents and
checks their work; fill the `{PROJECT}`, `{PRODUCT}`, `{RANGE}` and
`{MINUTES}` slots in `templates/briefs/`.

## 1. Map the journeys

Write `journeys.html` following [journey-map.md](journey-map.md). Everything
else is measured against it, so take labels from the code.

## 2. Build the harness

Set up the project ([harness.md](harness.md)), run the self-test, and write
`adapter.mjs` against [adapter-interface.md](adapter-interface.md).

- Run the product locally against a test or staging backend, and share one
  dev server across agents. Treat the backend as shared state: the test
  account's login is the only change it sees.
- Build the demo world first, then the rules: answer every read the start
  screen and main surfaces make, with synthetic records in the app's own
  shapes. Prepare labels using [contextual-data.md](contextual-data.md).
- Record two worked examples (a simple one and one with a write) and check
  every frame before anyone else writes scripts.
- Keep a short `FIXTURES.md` in the project: the persona, the org, the ids
  scripts can use, and which writes echo back into the world. Keep customer
  label provenance private and freeze the customer profile before fan-out.

Until the demo world is ready, agents may write and dry-run scripts
(`PACE=1`) but hold final recordings of screens that would show live records
or unapproved identities.

## 3. Pin the start screen

One shared start screen teaches viewers the way to each feature and keeps the
library consistent. Pre-login, website and customer-view journeys start at
their entry point, named in the first caption.

## 4-6. Script, record, self-QA

Fan out with `templates/briefs/fan-out.md`, about 10 journeys per agent. Each
agent writes, records and checks one journey at a time, then logs it in
`QA.md`. Journeys with no web UI record the closest real path and name the
gap, or go in `SKIPPED.md` with a reason. A failed run (ring miss, long
caption, `real` read) means fixing the cause.

The orchestrator spot-checks frames from every agent and collects repeated
failures into the next brief. When the harness improves mid-project (pace, a
new check, brand colors), re-record everything with
`templates/briefs/re-record.md` so the library stays consistent.

## 7-8. Independent audit and fix round

Fresh agents audit with `templates/briefs/audit.md`; then
`templates/briefs/fix.md` fixes, re-records and re-audits. Repeat until no
`fail` remains. Expect the audit to catch real problems: in the BloomText run
it failed 26 of 105 recordings that self-QA had accepted.

## 9-10. Sync the doc, file missing features

`templates/briefs/doc-sync.md` rewrites each journey's Steps to match its
final script and corrects whatever the recording disproved; then
`python harness/report.py`. When the person asks for issues,
`templates/briefs/file-features.md` verifies each gap in code and files one
issue per missing feature.

## 11. Publish

- **Internally:** share the gallery, audit report and map together; they
  link to each other.
- **Publicly** (help center, docs site): plan first and get the person's
  approval.
  - Publish real features; gap-centered journeys stay internal.
  - Map journeys to the site's sections, merging or splitting where it reads better.
  - Lazy-load each WebP with a poster frame, respect `prefers-reduced-motion`,
    write alt text from the steps, and budget 1-3 MB each.
  - Put the synced steps as text under each demo, after a human copy pass.
  - Ship in reviewed batches through the site's normal PR process.
- **Keep it current:** when the UI changes, re-record the affected journeys,
  re-audit and re-sync.

## Orchestrating many agents

- The orchestrator owns the map, harness, adapter and briefs; agents own
  their journeys' files and report shared needs.
- Agents edit `QA.md` and the map in place, re-reading first.
- Each brief has a time limit, a per-journey cap (about 6 minutes), and asks
  for a short final message: done, skipped and why, harness bugs.
- `--parallel 1` per agent when about 10 share one dev server.
