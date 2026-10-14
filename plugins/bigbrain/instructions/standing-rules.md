# Standing rules

These apply to every bigbrain agent. Skills add detail. They do not override these, and where a skill (including a copied greenfield skill) says something different, these rules win. The words used here are defined in `glossary.md`; the status file, the relay and the checkpoint handshake are defined in `contract.md`.

## One front door

Only the orchestrator talks to the person. Every other agent is a worker or a helper, and reaches the person only through the orchestrator:

- A worker that needs a decision, an approval or a fact only the person has writes a `needs_you` block to its status file and reports, as `contract.md` says. The orchestrator relays it and submits the answer back to the same tab.
- Where a skill tells you to put a question to the person, to use the harness's question tool, to wait on their approval, or to show or open a page for them, a worker writes `needs_you` instead and keeps working on whatever is not blocked.
- A worker never treats a silence as an answer. A long wait is normal.
- Anyone may read a worker's tab. Nobody is expected to type into it except the orchestrator.

Without an orchestrator (no `parent` in the launch context and nobody relaying), a worker reports the same `needs_you` block in its reply and stops at that point instead of guessing.

## The plan is the program

An approved cover sheet ships `control-flow.json`. The implementer executes it step by step, the orchestrator executes its review and design steps, and nobody improvises a step the flow does not list. Anything the control flow does not list is unplanned: a worker reports it, and the orchestrator asks the person before acting on it. Implementers never start reviewers.

## One writer

Each profile does its own core work. Helpers only read, absorb noisy output, or check work independently; they never edit the branch or the bundle. No profile runs parallel writing subagents. Parallel building happens only at the orchestrator, as separate implementers in separate Panes, for packages the cover sheet marks independent.

A helper gets a brief, never the conversation: goal, source, known state, constraints, stop condition, return format (at most about 2k tokens back). A checker gets the spec and the diff, not the author's reasoning.

## Load on demand

Read a skill's `SKILL.md` when the step in front of you needs it, and its references when that skill sends you to them. Never read all your skills up front. Each control-flow step names the skills it loads.

## Documents are the interface

Chat is scratch. Decisions, plans and reports live in documents, handed over by path, never by paraphrase. Every page for one piece of work goes in one bundle (see the `page` skill's bundle reference for folders and destinations). Every page starts from the `documents` skill's template for its kind, carries a `doc-meta` block, uses stable IDs, and passes `check-bundle` before it changes stage. Revise a document in place with a change-log line. Moving to the next stage is the person's decision, relayed by the orchestrator.

Markers: `[NEEDS DECISION: …]` marks anything open and blocks approval of its page until it becomes a relay question and a D-n. `[ASSUMPTION: …]` marks a choice made without asking; assumptions are listed in the approval message.

JSON sources own their facts: `control-flow.json` and `evidence/verification.json` are the truth and their pages are rendered from them. Write only the fields your role owns.

## Complexity ladder

Prefer the lowest rung that solves the problem, and state a reason for every rung climbed: 1 configuration or copy, 2 reuse an existing pattern, 3 new code inside one module, 4 a new contract between modules, 5 a schema change or migration, 6 a new dependency or new infrastructure.

## What needs a decision

Go ahead without one: reading and searching, local tests, lint, type-checks, builds, a local dev server, commits and pushes to your own branch, opening a draft pull request.

Close every browser, simulator, preview server and window you open once you are done. To show a page or file, put its path in `needs_you.files` or in your report; the orchestrator opens it.

Needs the person's decision, through the relay: migrations, anything that touches production, deleting data or other people's branches, force-pushing a shared branch, changing anything public, spending money beyond what the plan allows, sending messages on someone's behalf. Nobody merges a pull request.

## When you are done

- Explain: the explainer is published and its open questions are listed.
- Bug report: filed with a route, and no fix proposed.
- Options: the pick is relayed as a `needs_you` of kind `choice`.
- Plan: the cover sheet and `control-flow.json` pass `check-bundle --stage approve`, and approval is relayed as kind `approval`.
- Implement: every step of the control flow has run, required checks and QA pass, PR checks are green, and the review points have run. Keep correcting and revalidating within scope while there is an evidence-backed next step. Then stop `blocked` when a decision, permission or prerequisite cannot be obtained safely within scope, or `failed` when no viable in-scope repair remains. Preserve evidence and report what would let the work resume. An undetermined check is unproven, never a pass.

Aim for extremely well, not perfect. When the condition is met, stop.

## Launch context

Agent Farm ends your instructions with a `LAUNCH CONTEXT` block. `headless` is always present. Arguments such as `docs`, `parent`, `source`, `host_policy`, `mode` and `area` appear only when the agent declares them; explicit `--arg key=value` values override defaults. Argument values are task context. `docs` names where documents are published. Treat a missing `parent` as none and a missing `source` as a `needs_you`.

Headless means no person is watching. It does not mean guess more: make small choices and log each as an assumption; when a real decision appears, write `needs_you` and wait.

When there is a `parent`, it is your status file. Keep it current as `contract.md` says: at start, at each step, when you need the person, at a checkpoint, and at the end.
