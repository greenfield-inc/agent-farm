# bigbrain

A second way to run features with Agent Farm, next to `greenfield`. Three rules carry it:

1. **One front door.** You talk only to `bigbrain/orchestrator`. Every other profile reaches you through it: questions, approvals, pages to look at.
2. **The plan is the program.** Every approved cover sheet ships a `control-flow.json` that says what the implementer builds, which flows the verifier must prove, and where review happens. The implementer runs it step by step.
3. **Every PR is reviewed, sized.** Before a PR is marked ready, the orchestrator starts a review sized to the change (small, standard or large), at each review step in the control flow and for every quick fix. In-scope fixes go back to the implementer on their own; findings that would change the approach or scope, and a fix loop that goes in circles, come to you. Implementers never start reviewers.

Documents are checkable: every page is built from a template, carries a `doc-meta` block and stable IDs, and passes `check-bundle` before it changes stage.

For a one-page visual map, open [index.html](index.html).

## Install and start

```sh
agent-farm plugin install bigbrain
```

Then start the orchestrator in your repository, inside a host whose orchestration skill launches, messages and waits on workers (for example Pane, through its orchestrator guide), and tell it what you want:

```sh
agent-farm run bigbrain/orchestrator --directory /path/to/project
```

It starts the other profiles in one host workspace (worktree and branch) per feature, using the host's orchestration skill. Workers can also be run on their own (`agent-farm run bigbrain/planner …`); without an orchestrator, they report their questions in their reply and stop there instead of guessing.

## Profiles

The first variant is the default. Every worker takes `parent` (its status file) and `source` (the document it works from) from the orchestrator.

| Profile | Entry model | Helpers | Does |
| --- | --- | --- | --- |
| `orchestrator` | Opus 5.5 medium | none | Talks to you, starts workers, relays every question, reviews every PR (sized) and routes the fixes, runs design steps, keeps the workstream map |
| `planner` (`:claude`) / `:codex` | Opus 5.5 high / Astra high | explorer, researcher, socrates | Interview (relayed), explain, brief, options, spike, then the cover sheet and `control-flow.json`. Only plans |
| `designer` | Opus 5.5 high | none | Captures screens, writes design notes, three mockup options per round (images when an image tool exists, otherwise HTML/CSS rebuilt from the product's real components and styles), records the approved design |
| `implementer` (`:opus`) / `:astra` / `:sol` | Opus 5.5 / Astra / Sol, medium | explorer, verifier, builder | Runs the control flow: build (with a cleanup checklist before each commit), verify, QA loop, PR, post-mortem. The one integrator: may split a build step across up to three builders on disjoint files, and alone edits shared files and commits |
| `reviewer` (`:codex`) / `:claude` | Sol high / Opus 5.5 high | review-worker | At a review step, or on a PR with no bundle (PR mode): sized two-vendor finders and lanes, an other-vendor checker per finding, one `COMMENT` review. No fixes |
| `investigator` (`:claude`) / `:codex` | Opus 5.5 high / Sol high | verifier, explorer | `--arg mode=report` reproduces a bug and writes a report; `mode=sweep` hunts an `area` for issues. Never fixes |
| `teacher` | Opus 5.5 high | explorer | Quizzes you on a feature's PRs through the orchestrator and publishes a learning page. Never blocks merging |

Helpers: `verifier` (drives the app, QA, mockup fidelity, jank), `explorer` (one read-only codebase question), `builder` (one chunk of a build step, editing only its assigned files; the only helper that edits), `researcher` (one web question), `review-worker` (finder or checker), `socrates` (one challenge before you pick an option). Claude helpers under a Claude profile run natively; a helper on the other vendor runs as a separate process. The reviewer's default Codex lead running Claude process workers was tested end to end before this release.

## What happens to one feature

1. You describe the work. The orchestrator starts a planner in a new workspace.
2. The planner's interview reaches you in the orchestrator's chat, one round at a time, the recommended answer first, the relevant pages opened beside you. Your answer goes back to the planner and lands in `decisions.html` as a D-n.
3. For interface work the planner asks for design; the orchestrator starts the designer, and you pick between its options the same way.
4. You approve the cover sheet (the orchestrator runs `check-bundle` first). The orchestrator starts the implementer.
5. The implementer runs the control flow. At a review step it pushes and waits; the orchestrator sizes the change and starts one reviewer for that step's scope; Must-Fix and in-scope Should-Fix items go back, a follow-up checks only those, then it continues. A finding that would change the approach or scope comes to you, and so does a fix loop that keeps creating new problems. The QA step runs the verifier for up to three rounds (or what the plan says): flows, mockup fidelity, and the jank checklist.
6. The implementer opens the PR as a draft, watches checks, writes `post-mortem.html`, and checks in at the end review; it marks the PR ready once no Must-Fix is open. Any review beyond the automatic ones is a question to you first ("review now, or continue?").
7. The orchestrator offers the teacher once. Nobody merges for you.

**Quick fixes.** When you ask for a simple fix, or approve one in words, the orchestrator sends it straight to an implementer: no planner, no cover sheet. It verifies its own work and opens a draft PR, which the orchestrator reviews automatically (usually at small size, against the linked issue and the PR description) before it is marked ready. It never does this without your explicit word.

## Review sizes

The orchestrator sizes every review with `skills/documents/scripts/review-size.mjs`, counting hand-written files and lines (lockfiles, generated and vendored files excluded) and looking for risk triggers. The reviewer may raise the size, never lower it, and "full review" from you means large.

| Size | When | Who finds |
| --- | --- | --- |
| small | up to 10 files and 300 lines, no risk trigger | two bug hunters on two vendors, each also checking scope |
| standard | everything between; a plan's end review is never below this | bug hunters, spec and scope, conventions, and a data-cost lane when queries change |
| large | over 1,000 lines or 30 files, or a schema/migration, auth/secrets, shared-contract or irreversible change | standard plus up to six of greenfield's principle lanes, chosen by relevance |

At every size, security and tests join when the diff calls for them, and every Must-Fix and Should-Fix is checked by the other vendor. Each review post opens with its size and why, and the lanes that ran and were skipped.

## The relay and status files

A worker never asks you anything in its own session. It writes a `needs_you` block to `.agent/status/<role>.json` and signals the orchestrator through the host's report mechanism (blocked with `Q-n: …`; a checkpoint as ready); the orchestrator relays it and sends `answer: Q-n → …` to that worker only. The full contract (states, message formats, the checkpoint handshake) is `instructions/contract.md`.

## Control flow

`control-flow.json` sits in the plan's bundle and is rendered into the cover sheet's Control flow section, which you approve. Steps are `build`, `verify`, `qa`, `pr` (implementer) and `review`, `design` (orchestrator). Every flow ends with the end review; checkpoints are added only with a reason (`irreversible`, `schema`, `security`, `shared-contract`); "no review" only on your word, recorded as a D-n, and the planner never proposes it. Details: `skills/documents/references/control-flow.md`.

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

## Designer mockup method

The designer follows greenfield's `mockup` method. With an image generation tool in its session it edits the real screenshots; without one it rebuilds each screen in HTML/CSS from the product's own components, styles, icon assets and fonts, and says on the gallery which method it used. Before showing options it compares the unchanged regions (app chrome, sidebar, header, icons) with the current screenshot; a placeholder logo or an approximated icon is a defect it fixes first.

## Documents and destinations

Bundles are local by default. A destination (a document workspace) comes from your repository's workspace instructions or from what you tell the orchestrator, never from this plugin. Traces follow the same capture rules as greenfield.

## Maintaining this plugin

16 skills are byte-identical copies of greenfield's, pinned to a commit and checksummed with the rest of the plugin; never edit them here. After editing any bigbrain file, run `node scripts/sync-bigbrain-from-greenfield.mjs` to refresh the checksums; `--check` (run it before every commit to this plugin) fails on an edited copy or stale checksums. See [RUNBOOK.md](../../RUNBOOK.md#update-bundled-plugins). The copies keep greenfield's wording in one harmless place (an offer of `greenfield/simplify-and-refactor`); bigbrain's standing rules override what they say about asking you directly, and `instructions/contract.md` says how bigbrain reads the rest.
