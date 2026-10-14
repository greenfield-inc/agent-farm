# bigbrain

A second way to run features with Agent Farm, next to `greenfield`. Three rules carry it:

1. **One front door.** You talk only to `bigbrain/orchestrator`. Every other profile reaches you through it: questions, approvals, pages to look at.
2. **The plan is the program.** Every approved cover sheet ships a `control-flow.json` that says what the implementer builds, which flows the verifier must prove, and where review happens. The implementer runs it step by step.
3. **Reviews are planned or asked for.** A reviewer runs only at a review step in the control flow, or after you say yes. Implementers never start reviewers.

Documents are checkable: every page is built from a template, carries a `doc-meta` block and stable IDs, and passes `check-bundle` before it changes stage.

For a one-page visual map, open [index.html](index.html).

## Install and start

```sh
agent-farm plugin install bigbrain
```

Then start the orchestrator in your repository, as a Pane Session coordinator or in a Pane tab, and tell it what you want:

```sh
agent-farm run bigbrain/orchestrator --directory /path/to/project
```

It starts the other profiles as tabs in one Pane per feature (`runpane panels create`), so Pane must be installed with `runpane` on `PATH`. Workers can also be run on their own (`agent-farm run bigbrain/planner …`); without an orchestrator, they report their questions in their reply and stop there instead of guessing.

## Profiles

The first variant is the default. Every worker takes `parent` (its status file) and `source` (the document it works from) from the orchestrator.

| Profile | Entry model | Helpers | Does |
| --- | --- | --- | --- |
| `orchestrator` | Opus 5.5 medium | none | Talks to you, starts workers, relays every question, runs review and design steps, keeps the workstream map |
| `planner` (`:claude`) / `:codex` | Opus 5.5 high / Astra high | explorer, researcher, socrates | Interview (relayed), explain, brief, options, spike, then the cover sheet and `control-flow.json`. Only plans |
| `designer` | Sol medium (Codex) | none | Captures screens, writes design notes, three mockup options per round with Codex's image tool, records the approved design |
| `implementer` (`:opus`) / `:astra` / `:sol` | Opus 5.5 / Astra / Sol, medium | explorer, verifier | Runs the control flow: build, verify, QA loop, PR, post-mortem. The only writer on the branch |
| `reviewer` (`:codex`) / `:claude` | Sol high / Opus 5.5 high | review-worker | At a planned step: two-vendor finders, an other-vendor checker per finding, one `COMMENT` review. No fixes |
| `investigator` (`:claude`) / `:codex` | Opus 5.5 high / Sol high | verifier, explorer | `--arg mode=report` reproduces a bug and writes a report; `mode=sweep` hunts an `area` for issues. Never fixes |
| `teacher` | Opus 5.5 high | explorer | Quizzes you on a feature's PRs through the orchestrator and publishes a learning page. Never blocks merging |

Helpers: `verifier` (drives the app, QA, mockup fidelity, jank), `explorer` (one read-only codebase question, or a cold read), `researcher` (one web question), `review-worker` (finder or checker), `socrates` (one challenge before you pick an option). Claude helpers under a Claude profile run natively; a helper on the other vendor runs as a separate process. The reviewer's default Codex lead running Claude process workers was tested end to end before this release.

## What happens to one feature

1. You describe the work. The orchestrator starts a planner in a new Pane.
2. The planner's interview reaches you in the orchestrator's chat, one round at a time, the recommended answer first, the relevant pages opened beside you. Your answer goes back to the planner and lands in `decisions.html` as a D-n.
3. For interface work the planner asks for design; the orchestrator starts the designer, and you pick between its options the same way.
4. You approve the cover sheet (the orchestrator runs `check-bundle` first). The orchestrator starts the implementer.
5. The implementer runs the control flow. At a review step it pushes and waits; the orchestrator starts one reviewer for that step's scope; must-fix items go back, a follow-up checks only those, then it continues. The QA step runs the verifier for up to three rounds (or what the plan says): flows, mockup fidelity, and the jank checklist.
6. The implementer opens the PR, watches checks, writes `post-mortem.html`, and checks in at the end review. Any review the plan does not list is a question to you first ("review now, or continue?").
7. The orchestrator offers the teacher once. Nobody merges for you.

**Quick fixes.** When you ask for a simple fix, or approve one in words, the orchestrator sends it straight to an implementer: no planner, no cover sheet, no reviewer. It verifies its own work and reports what it checked. It never does this without your explicit word.

## The relay and status files

A worker never asks you anything in its own tab. It writes a `needs_you` block to `.agent/status/<role>.json` and reports with `runpane report` (`blocked` with `--question "Q-n: …"`; a checkpoint as `ready`); the orchestrator relays it and submits `answer: Q-n → …` to that tab only. The full contract (states, message formats, the checkpoint handshake) is `instructions/contract.md`.

## Control flow

`control-flow.json` sits in the plan's bundle and is rendered into the cover sheet's Control flow section, which you approve. Steps are `build`, `verify`, `qa`, `pr` (implementer) and `review`, `design` (orchestrator). Every flow ends with the end review; checkpoints are added only with a reason (`irreversible`, `schema`, `security`, `shared-contract`); "no review" only on your word, recorded as a D-n. Details: `skills/documents/references/control-flow.md`.

## IDs and the checker

| Prefix | What | Defined in |
| --- | --- | --- |
| SC-n | success criterion | brief (`index.html`) |
| P-n, J-n, S-n | package, journey (Given/When/Then/Check), suite (command → result) | cover sheet |
| D-n, Q-n | decision, and the relay question it came from | `decisions.html` |
| F-n | review finding | `findings/*.md` |
| B-n | bug | bug report |

IDs are never reused; documents cite them instead of copying text. `[NEEDS DECISION: …]` blocks approval; `[ASSUMPTION: …]` marks a choice made without asking. The checker needs only Node:

```sh
node <plugin>/skills/documents/scripts/check-bundle.mjs <bundle dir> [--stage draft|approve|done]
node <plugin>/skills/documents/scripts/check-bundle.mjs --status .agent/status/implementer.json
```

It checks required sections, `doc-meta`, ID definitions and citations, both JSON sources against their schemas, that the cover sheet still shows what `control-flow.json` will run, that nobody added, removed or reworded a verification check, that every J/S has a verdict before done, and that relative links resolve. Templates and worked examples for each page kind are in `skills/documents/formats/`.

## Designer image generation

The designer runs on Codex and uses Codex's own image generation tool; Agent Farm has no setting for it. Check it with `codex features list` (look for `image_generation`) and turn it on with `codex features enable image_generation`. Without it, the designer stops and asks whether to continue with HTML/CSS mockups only.

## Documents and destinations

Bundles are local by default. A destination (a document workspace) comes from your repository's workspace instructions or from what you tell the orchestrator, never from this plugin. Traces follow the same capture rules as greenfield.

## Maintaining this plugin

18 skills are byte-identical copies of greenfield's, pinned to a commit and checksummed with the rest of the plugin; never edit them here. After editing any bigbrain file, run `node scripts/sync-bigbrain-from-greenfield.mjs` to refresh the checksums; `--check` (run it before every commit to this plugin) fails on an edited copy or stale checksums. See [RUNBOOK.md](../../RUNBOOK.md#update-bundled-plugins). The copies keep greenfield's wording in two harmless places (the local bundle root `tmp/greenfield/` and an offer of `greenfield/simplify-and-refactor`); bigbrain's standing rules override what they say about asking you directly, and `instructions/contract.md` says how bigbrain reads the rest.
