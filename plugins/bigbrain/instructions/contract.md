# Contract

How workers and the orchestrator talk. One channel each way: a worker writes its status file and reports; the orchestrator reads the status file, talks to the person, and submits answers back to the worker's tab. The JSON shapes are in the `documents` skill's `schemas/status.schema.json`; validate a status file with `node <documents skill>/scripts/check-bundle.mjs --status <file>`.

## Status file

`parent` in the launch context names it, normally `<feature worktree>/.agent/status/<role>.json`. The worker owns it and keeps it current: at start, at each control-flow step, when it needs the person, at a checkpoint, and at the end. `updated` is an ISO 8601 time.

```json
{ "profile": "bigbrain/implementer:opus", "source": "/abs/bundle/cover-sheet.html@rev3",
  "state": "running", "step": "qa", "round": 2,
  "needs_you": null, "needs": null, "checkpoint": null,
  "checks": { "pass": ["J-1", "S-1"], "fail": [], "undetermined": ["J-2"] },
  "assumptions": [], "pr": 412, "head": "3f9c2ab", "check_bundle": "pass",
  "failure": null, "updated": "2026-10-14T16:02:00Z" }
```

| state | Meaning | Worker then |
| --- | --- | --- |
| `running` | working | keeps working |
| `needs_you` | blocked on the person; `needs_you` says on what | keeps working on anything not blocked, waits for `answer:` |
| `checkpoint` | reached a planned review step and pushed; `checkpoint` says which | changes nothing on the branch until `continue:` |
| `blocked` | cannot go on for a reason the person cannot answer in one message (missing access, broken environment) | waits |
| `done` | finished; outputs are linked | stops |
| `failed` | no viable in-scope repair remains; `failure` says why | stops |

`needs` is the planner's request for other work: `{ "kind": "design", "screens": ["settings page"], "note": "…" }` asks the orchestrator to start the designer.

## needs_you

```json
"needs_you": {
  "id": "Q-7", "kind": "question", "title": "Invoice filename",
  "questions": [ { "q": "Use the invoice id or number in the PDF filename?",
                   "why": "Ids are stable; numbers can be reissued",
                   "options": ["Invoice id (recommended)", "Invoice number"] } ],
  "files": ["/abs/bundle/options.html#decision-2", "/abs/bundle/mockups/pdf-v2-1.png"],
  "blocking": true, "waiting": "P-2, P-3" }
```

- `id`: the next unused Q-n in the bundle. Read `decisions.html` and the other status files under `.agent/status/` first; Q-n are never reused.
- `kind`: `question` (an open product or design question), `choice` (pick an option on a page), `approval` (approve a page; the page passes `check-bundle --stage approve` first), `quiz` (one teacher question), `fyi` (no answer needed; `blocking` is false).
- `questions`: one round. Recommended option first, marked `(recommended)`. Each option is short; reasons go in `why`.
- `files`: absolute paths (with `#anchor` when useful) the person should see while answering.
- Every `[NEEDS DECISION: …]` in a page becomes a needs_you before that page can change stage.
- Implementers raise needs_you only for what the plan leaves open. Routine technical choices are theirs.

## Reporting through Pane

`runpane report` accepts four states and carries no files, so the status file holds the real state and the report points at it:

| Status state | Report |
| --- | --- |
| `needs_you` | `runpane report --state blocked --question "Q-7: Invoice filename" --summary-file <status file>` |
| `checkpoint` | `runpane report --state ready --pr <n> --head <sha> --summary-file <status file>` |
| `blocked` | `runpane report --state blocked --question "<what would unblock it>" --summary-file <status file>` |
| `done` | `runpane report --state ready --pr <n> --head <sha> --summary-file <status file>` when something waits on review or approval, otherwise `--state done` |
| `failed` | `runpane report --state failed --summary-file <status file>` |

A `fyi` needs no report of its own; the orchestrator batches it into the map. Each report replaces the previous one. Without Pane, report the same summary to whoever launched you.

## Answers and messages to a worker

The orchestrator submits plain text lines to the asking tab only:

- `answer: Q-7 → Invoice id. Recorded as D-12.` The worker records it where its skill says (the planner in `decisions.html`; others cite the D-n), clears `needs_you`, sets `running`, and continues. A free-text answer is quoted exactly.
- `clarify: Q-7 → <the person's question back>`: not an answer. Keep Q-7 open and `needs_you` set, record nothing, add the clarification to the question (in `why` or the page), and report the same needs_you again.
- `continue: <step id>`: resume after a checkpoint, or after `blocked`.
- `review: <step id> → must-fix F-2, F-5 (findings: <path>)`: fix exactly those, then run the checkpoint handshake again for the follow-up.
- `review: <step id> → no must-fix (findings: <path>)`: followed by `continue: <step id>`.
- `check-bundle: fail — <rule lines>`: the orchestrator ran `check-bundle --stage approve` before relaying your approval and it failed. Fix the page or JSON, run it yourself, and report again.
- `addendum: <path>`: a decision that changes running work; read it, adjust, report again.
- `stop`: save state, report, and end.

## Checkpoint handshake

At a control-flow step with `do: review`:

1. The implementer commits, pushes, runs `check-bundle`, and records the step's checks in `verification.json`.
2. It sets `state: checkpoint` and `checkpoint: { "step": "<id>", "scope": [...], "head": "<pushed sha>" }`, then reports (state `ready`).
3. It makes no further commits until `continue:`. Work on the next package may be read or planned, not written.
4. The orchestrator starts exactly one reviewer with that scope and head. The review posts once.
5. Must-fix items come back as `review: <step> → must-fix …`. The implementer fixes only those, pushes, and repeats step 2 with the new head. The orchestrator starts a follow-up that checks only those items.
6. `continue: <step>` resumes the flow at the next step.

The same handshake runs for the end review after the `pr` step; there `continue:` means the work is done. A waived end review (`"review": "none"`) still gets the handshake: the orchestrator starts no reviewer, puts "review now, or continue?" to the person, and sends `continue:` or a reviewer's findings accordingly.

## Starting message and helper brief

What the orchestrator sends a new worker, and what any profile sends a helper. Point to documents by path; never paraphrase them.

```text
Goal         one sentence
Source       /abs/bundle/cover-sheet.html @ rev 3   (plus D-n / Q-n in play)
Known state  what is done, current step, relevant IDs
Constraints  scope, files allowed, read-only or not, decisions still needed
Stop when    the finish condition, or what to report if blocked
Return       output format and length (helpers: ≤ 2k tokens)
Status file  /abs/worktree/.agent/status/<role>.json   (workers only)
Destination  where the bundle is published, and the Session folder
```

Quick-fix variant, for the quick-fix route only (no planner, no cover sheet, no control flow):

```text
Quick fix    the task, in the person's words
Done when    what the person will see when it works
Branch       the feature branch to commit to, or "new: <name>" for a new branch and draft PR labelled no-plan
Constraints  files or areas to stay inside; anything that needs a decision
Status file  /abs/worktree/.agent/status/implementer.json
```

## Copied skills: what bigbrain reads differently

The copied greenfield skills stay byte-identical. Where they name something bigbrain does not ship, read them this way:

- `options`, "mockup": the planner sets `needs: design` and the designer makes the mockups.
- `babysit-pr`, `create-ticket`: record the follow-up in the post-mortem's action items instead.
- `session-trace`, `handoff`: not used in bigbrain. Moving work to another machine is Pane's `runpane handoff`.
- `quick-verify`, the Cross-OS Workspaces link into `pr-test-automation`: not shipped in bigbrain. An OS-specific check you cannot run is `undetermined` with the reason.
