# Glossary

Every bigbrain document and skill uses these words with these meanings.

| Term | Meaning |
| --- | --- |
| bundle | The folder of pages for one piece of work, with `bundle.json`. Local by default; published as one unit. |
| page | One self-contained HTML document in a bundle, built from a `documents` template, carrying `doc-meta`. |
| doc-meta | The JSON block `<script type="application/json" id="doc-meta">` on every page: kind, status, revision, the IDs it defines and cites, open markers. |
| status | One vocabulary for every page: `draft` → `ready-for-review` → `approved` → `in-build` → `done`, plus `superseded` and `withdrawn`. |
| brief | `index.html`: the problem, success criteria, constraints. Never a solution. |
| cover sheet | `cover-sheet.html`: the one plan the person approves and the implementer builds from. |
| control flow | `control-flow.json` plus its rendered Control flow section: the steps the implementer and orchestrator execute. |
| step | One entry in the control flow: `build`, `verify`, `qa`, `pr`, `review` or `design`. |
| review point | A `review` step. The end review is always one; a checkpoint is one placed earlier for a stated `reason_kind`. A quick fix's draft PR gets one too, with step `quick-fix`. The orchestrator starts a sized review at every review point without asking, except an end review the person waived (`"review": "none"`), where it asks "review now, or continue?". |
| review size | `small`, `standard` or `large`: how many finders and lanes a review runs, set by the `review` skill's size table from files, lines and risk triggers (the `documents` skill's `scripts/review-size.mjs`). The reviewer may raise it, never lower it. |
| lane | One focused finder brief at a review: the data-cost lane (standard and large), or one of up to six principle lanes adapted from greenfield (large only). |
| PR mode | A review of a PR with no bigbrain bundle, checked against its linked issue and the PR description's claims. |
| approach/scope flag | A review finding's mark that fixing it would need a different approach or change the work's scope. A flagged finding goes to the person, never to the implementer. |
| thrash | A review fix loop going in circles: a fix-caused Must-Fix, an F-n open after two fix rounds, or a third round about to start. The orchestrator pauses the loop and asks the person. |
| checkpoint | A review point before the end, and the handshake the implementer runs there (see `contract.md`). |
| unplanned | Anything the control flow does not list. The orchestrator asks the person before acting on it. |
| verification | `evidence/verification.json` and its page: one row per J/S with verdict, method, evidence, commit and round. |
| verdict | `pending`, `pass`, `fail` or `undetermined`. Undetermined is never a pass. |
| QA loop | The `qa` step: the verifier checks flows, mockup fidelity and jank; the implementer fixes; repeat up to `max_rounds`. |
| jank checklist | The UI/UX defects listed in the `design` skill's `design-quality.md`. |
| status file | `.agent/status/<role>.json`, a worker's only channel to the orchestrator. |
| needs_you | The status-file block a worker writes when it needs the person. |
| relay | The orchestrator turning a needs_you into one message to the person, and the answer back into the asking tab. |
| worker | A profile the orchestrator starts in a tab: planner, designer, implementer, reviewer, investigator, teacher. |
| helper | A child a worker starts for read-only, noisy or independent checking work: verifier, explorer, researcher, review-worker, socrates. The one helper that edits is the builder. |
| builder | The implementer's helper for one chunk of a build step: edits only the files its brief assigns, never commits. Up to three run at once, on disjoint files. |
| integrator | The implementer, as the one agent that edits shared files, checks each builder's changes, integrates, verifies and commits. |
| finder, checker | The two briefs of a review-worker: a finder looks for one kind of problem; a checker tries to refute one finding. |
| marker | `[NEEDS DECISION: …]` (open; blocks approval) or `[ASSUMPTION: …]` (a choice made without asking). |
| check-bundle | The `documents` skill's checker. Workers run it before a stage change; the orchestrator runs it before relaying an approval. |
| map | `map.html` in the Session folder: every item, its control flow position, and what needs the person. |

## IDs

Stable, never reused or renumbered. A removed item becomes withdrawn. Documents cite IDs instead of copying text.

| Prefix | What | Defined in |
| --- | --- | --- |
| SC-n | success criterion | brief |
| P-n | package | cover sheet |
| J-n | journey: Given / When / Then / Check | cover sheet |
| S-n | suite: run a command, expect a result | cover sheet |
| D-n | decision | decision log |
| Q-n | relay question | decision log (the entry it produced) |
| F-n | review finding | findings file |
| B-n | bug | bug report |
