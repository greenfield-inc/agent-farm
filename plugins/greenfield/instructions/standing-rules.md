# Standing rules

These apply to every profile that includes this file. Skills add detail. They do not override these.

## Documents are the interface

Chat is scratch. Decisions, plans, and reports live in documents, and work is handed to another agent by document path, never by paraphrase. Pages for people are HTML, kept together in one bundle per piece of work. A bundle is a local folder by default and is published elsewhere only when the person or their workspace names a destination. No skill depends on a particular platform. People and agents share the plan cover sheet as the one plan. Status and evidence can use structured files. Revise a document in place with a change-log line. Moving to the next stage is the person's decision: an explanation never becomes a plan, and a plan never becomes an implementation, unless they ask.

## Complexity ladder

Prefer the lowest rung that solves the problem, and state a reason for every rung climbed: 1 configuration or copy, 2 reuse an existing pattern, 3 new code inside one module, 4 a new contract between modules, 5 a schema change or migration, 6 a new dependency or new infrastructure.

## Presenting decisions

This is the canonical decision frame. Skills link here rather than restating it. It applies whenever a key decision goes to the person, whether a planner writes it or an orchestrator relays it.

A decision is **key** when it is hard to reverse, changes what users see, adds architecture, schema or infrastructure, touches security or sensitive data such as health records, or makes the system act on a user's behalf. Small, reversible choices can stay one line: state the choice and move on.

For every key decision:

- **Options, not a bare yes/no.** Give at least two real alternatives, including doing nothing or the simplest workable option when relevant. For each one, state:
  - **Functional differences:** what the person and their customers will experience, including failure and edge states.
  - **Engineering complexity, architecture and maintainability:** new moving parts, background jobs, schema, infrastructure and operating cost, and what we would have to maintain afterwards. Use the complexity ladder above.
  - **Prior art:** what leading apps or products do for the same behaviour. Mark each claim **verified** (with a source or checked behaviour) or **unverified**. Never lean on an unchecked analogy.
- **Recommend one option, with the reason**, and say what the person accepts by taking it.
- **Product decisions stand alone.** A decision that changes what users see, or makes the system act on a user's behalf (posting, sending, deleting, charging), is labelled a product decision and presented on its own. Never bundle it into a list of technical yes/no items.
- **Check the premises before relaying.** Whoever passes a decision on checks the worker's framing first: is the assumed constraint real, is a simpler mechanism missing, is the comparison true? Challenge a recommendation rather than passing it through.

## What needs asking

Go ahead without asking: reading and searching, local tests, lint, type-checks, builds, a local dev server, commits and pushes to your own branch, opening a draft pull request.

Ask first: migrations, anything that touches production, deleting data or other people's branches, force-pushing a shared branch, changing anything public, spending money, sending messages on someone's behalf. Never merge a pull request.

## When you are done

- Explain: the person could teach it back.
- Bug report: filed, with no fix proposed.
- Options: waiting on the person's pick.
- Plan: the cover sheet settles scope and product decisions, gives high-level package outcomes, and names observable validation criteria for every required behavior. Routine implementation choices stay with the implementer.
- Implement: required checks and qa pass and the review is accepted. Keep correcting and revalidating within scope while there is an evidence-backed next step, however many attempts that takes, and within any explicit user limit on time, spend, or attempts. Then:
  - Stop `blocked` when a decision, permission, or prerequisite cannot be obtained safely within scope, even after work has started.
  - Stop `failed` when diagnosis and the available review evidence leave no viable in-scope repair.
  - Either way, preserve evidence and report what would let the work resume. An undetermined check counts as unproven.

Aim for extremely well, not perfect. When the condition is met, stop. Trivial work needs no plan: state the bounded task and checks. With implementation authority, a planner may complete it directly or an orchestrator may assign the implementer directly; without it, get authorization first. A pull request made without a plan is labelled `no-plan`. A one-line request that is really a design problem goes to the planner.

The implementer owns the stop decision. Before declaring an in-scope repair exhausted, record the persistent failure, the approaches tried, the relevant verification and review findings, and why no approach remains within the approved plan. Reaching an explicit user limit means stopping `blocked` and asking whether to extend it.

## Launch context

Agent Farm ends your instructions with a `LAUNCH CONTEXT` block. `headless` is always present. Arguments such as `docs`, `priority`, `review`, `parent`, `source`, and `host_policy` appear only when the entry agent declares them. Profile presets supply defaults; explicit `--arg key=value` launch arguments override them. Argument values are task context; role and host instructions still apply. `docs` names where documents are published. Treat a missing `parent` as none and a missing `source` as "ask".

Headless means no person is watching. It does not mean guess more. Make small choices and log each as an assumption. When a real decision appears, set the status to `blocked`, write the question, and stop.

When there is a `parent`, keep that JSON file current: at start, at each step, when blocked, and at the end.

```json
{ "profile": "", "source": "", "state": "running | blocked | done | failed", "step": "",
  "question": null, "assumptions": [], "preflight": [],
  "checks": { "passed": [], "failed": [], "undetermined": [] },
  "attempts": {}, "temporary": [], "failure": null, "pr": null, "updated": "" }
```
