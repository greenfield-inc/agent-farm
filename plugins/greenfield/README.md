# greenfield

Plan with a high-level cover sheet, then let one implementer build it. You pick the implementer's model when you launch it: Claude Opus 5.5 by default, GPT-6 Astra, or GPT-6.1 Sol. The implementer opens a draft pull request and watches it until checks are green. `greenfield/reviewer` reviews finished pull requests separately, and the implementer makes the fixes.

`greenfield` is the default plugin: `agent-farm init` and a bare `agent-farm plugin install` install it. It also holds the profiles that used to live in the `dcouple` plugin (see [Moved from dcouple](#moved-from-dcouple)).

For a one-page visual map of how work is routed, open [index.html](index.html). It's also on Grain: [view the guide](https://rungrain.com/share/49gtyr7fi7hm75n71itmmlgl).

<img alt="Greenfield map: how work moves through the planner, bug-reporter and implementer, with your steps in green" src="../../docs/assets/guides/greenfield-map.png">

## Profiles

| Profile | Entry model | Role |
| --- | --- | --- |
| `planner` (`planner:claude`) | Opus 5.5 high | Discussion, brief/options when needed, then the approved cover sheet |
| `planner:codex` | Astra high | The same planner workflow on Codex |
| `implementer` (`implementer:opus`) | Opus 5.5 medium | Builds a plan or a clear task with its skills, opens a draft PR, and watches it until checks are green |
| `implementer:astra` / `implementer:sol` | Astra medium / Sol 6.1 medium | The same implementer on Codex |
| `reviewer` (`reviewer:claude`) / `reviewer:codex` | Opus 5.5 high / Sol 6.1 max | Reviews a pull request from many angles and ranks what to fix |
| `qa-and-fix` (`qa-and-fix:claude`) / `qa-and-fix:codex` | Opus 5.5 medium / Sol 6.1 medium | Tests a finished pull request and fixes small safe problems |
| `product-researcher` (`product-researcher:astra`) / `product-researcher:opus` | Astra high, fast / Opus 5.5 high | Sourced research write-ups |
| `business` (`business:claude`) / `business:codex` | Opus 5.5 high / Astra high | Proposals, plans and memos, with reviewers |
| `seo` (`seo:claude`) / `seo:codex` | Opus 5.5 high / Astra high | Search strategy and pages |
| `audits` (`audits:claude`) / `audits:codex` | Opus 5.5 high / Astra low | Stale issues, pull requests and docs |
| `bug-reporter` | Opus 5.5 high | Reproduce and write a report without fixing code |
| `free-range` (`free-range:claude`) / `free-range:codex` | Opus 5.5 high / Astra medium | Raw-model comparison profiles without the Greenfield workflow |
| `orchestrator` | Opus 5.5 medium | Experimental coordination of separate work items/worktrees |

```sh
agent-farm plugin install
agent-farm run greenfield/planner --directory /path/to/project
agent-farm run greenfield/implementer --directory /path/to/project/worktrees/feature \
  --message "Implement the approved cover sheet at /absolute/path/to/bundle/cover-sheet.html."
agent-farm run greenfield/reviewer:codex --directory /path/to/project --message "Review PR #42"
```

For local development without installing:

```sh
pnpm build
node dist/cli.js plugin validate plugins/greenfield
node dist/cli.js run implementer --config-root plugins/greenfield --directory /path/to/project
```

## Options and complexity

Options include a short complexity statement covering added codebase complexity, likely bug risks, ongoing maintenance, and the feature requirements driving that cost. Present meaningful simplifications or deferrals with the user value lost, alongside implementation alternatives. Ground claims in known systems and label assumptions; do not invent numerical scores. Carry the chosen trade-off into the plan.

## Planning and the finish line

The planner retains the HTML `cover-sheet.html` in the existing work bundle. It contains the outcome, scope and exclusions, locked decisions, high-level architecture context, approved design, meaningful risks, and concise package approach notes: how the work will be implemented, systems reused or extended, new systems and why, schema/data changes or none, dependencies, and relevant checks. Use stacked package cards with visible outcomes and important risks, meaningful reuse/extend/new labels, and expandable approach notes on the same page. The narrative layout follows the approved Agent-started Grain setup sample. The implementer chooses concrete files, algorithms, and steps using repository patterns.

Every brief and plan cover sheet includes a linked table of contents and references to its other bundle files. Constraints and Non-goals occupy separate full-width sections stacked vertically, including on wide screens.

Keep the existing **How we will know it works** presentation: numbered journeys and whole-feature commands/suites, with observable outcomes and relevant prerequisites. No separate validation matrix or mandatory criterion IDs are needed. All requested behavior and approved visual states must be covered, including alternate entry paths when relevant. The planner records verification prerequisites and known blockers; it does not build a new harness as part of routine planning. The planner self-checks scope, approach, verification and presentation before marking the cover sheet ready for approval. Socrates remains earlier in options, before the direction is chosen; there is no separate plan-reviewer agent.

The cover sheet is the only plan document; older plans are still accepted as input. Planning is ready when the product decisions are settled and the finish line is testable, with coding choices left to the implementer.

## Implementation

The implementer is the model on its own with a few house habits, the former `dcouple/raw`. Before working it reads every skill listed in its agent file: `tdd` and `codebase-design` for code and tests, `quick-verify` after each change, `prepare-pr` and `babysit-pr` for the pull request, `investigate` for bugs, plus `create-ticket`, `handoff`, `smallest-test`, `pr-test-automation`, `ui-mockup`, `research-web`, `refactor-simple` and `session-trace`. It is the only writer on its branch. Under an orchestrator it keeps the named status file current and reports through `runpane report`.

It has no reviewer child. Review runs once, separately, through `greenfield/reviewer`, launched by you or by an orchestrator when a workstream's pull requests are ready to merge. Launched by an orchestrator, the reviewer only writes its findings file; the implementer that owns the pull request makes the must-fix changes, and a follow-up review checks only those items. Run by hand, the reviewer keeps its interactive fix flow. Nothing merges without the person's word.

## Children

| Child | Bound to | Model and task |
| --- | --- | --- |
| `explorer`, `cold-reader` | implementer | Sonnet 5 medium, native (Sol 6.1 low under the Codex variants); codebase facts and a fresh read of prose |
| `qa-and-verify` (agent `pr-qa`) | implementer | Opus 5.5 medium, native (Sol 6.1 medium under the Codex variants); a full QA pass on a finished pull request |
| `codebase-explorer` | reviewer, qa-and-fix | Targeted repository questions; a process child under `reviewer:claude` |
| business reviewers, `cold-reader` | business | Context, research adversary, spec and artifact reviewers |
| `socrates` | planner | Opus 5.5 high (Astra high under Codex planner); challenge unnecessary scope |
| `investigator`, `researcher` | planner; `investigator` also under bug-reporter | Opus 5.5 high (Sol 6.1 max under Codex planner); bounded evidence questions |
| `mockup-artist` | Claude planner | Sol 6.1 medium, process; generated design assets when needed |
| `qa` | bug-reporter | Opus 5.5 medium; reproduce a bug in the app |
| `advisor` | orchestrator | Astra high, process; advice about session coordination |

Planners do not launch the implementer. When a cover sheet is approved, the planner gives the person the `agent-farm run greenfield/implementer` command, and Agent Farm asks which variant to run.

## Post-mortem and conversation viewer

Every bundle includes `trace.html`, emphasizing user/agent messages with tool calls collapsed. Capture only authorized task sessions and descendants; clearly report unavailable capture and incomplete snapshots. After implementation, add `post-mortem.html` covering outcome, blockers, surprises, deviations, verification, and lessons. Link both from the hub and cover sheet. The HTML plan contains everything requiring user review; PLAN.md is never a required companion.

## Documents and destinations

One work item has one bundle: `index.html` (brief/hub), `options.html`, `cover-sheet.html`, `mockups/`, `explainers/`, `evidence/`, and `bundle.json`, as needed. The cover sheet is read by people, implementers, and reviewers. Use relative links and preserve the published identity on updates.

Destinations follow the conversation, then the `docs` argument, then standing workspace/repository preferences, then local `tmp/greenfield/<slug>/`. The plugin names no destination service itself: a repository that publishes to Grain, for example, says so in its committed `.agent-farm/workspace.yaml`, and a standing preference there publishes the same private artifact; a local working copy alone is not delivery. See `skills/page/references/bundle.md`.

An orchestrator passes the planner its source as `source` and a status JSON path as `parent`, and gives the implementer and reviewer the same in their starting message. Workers record stage, checks, evidence, assumptions and blockers there. Legacy plans are inputs, not a requirement to generate new planning files. Trivial unplanned work retains the `no-plan` PR label.

## Skills and source layout

- `agents/` and `profiles/` define models, bindings, and launch arguments.
- `instructions/` defines shared roles, permissions, and completion rules.
- `plan` and its cover-sheet reference define the high-level handoff and “How we will know it works” section.
- `verify-app` and `open-pr` support the planner's small-fix route; `prepare-pr`, `babysit-pr` and `quick-verify` support the implementer.
- `principled-review`, `review` and `pr-test-automation` support the reviewer and qa-and-fix.
- The research, business, SEO and audit skills support the profiles of the same names.
- `explain`, `brief`, `options`, `spike`, `mockup`, and `page` support planning.
- `bug-intake`, `gather-evidence`, `web-research`, and `orchestrate-sessions` support the other profiles.
- `tdd` and `codebase-design` remain vendored unchanged from [mattpocock/skills](https://github.com/mattpocock/skills/tree/c55ee46073ed/skills/engineering/tdd), MIT; see `THIRD_PARTY_NOTICES.md`.
- `session-trace` supports requested trace artifacts; follow the session's explicit permission requirements for conversation capture/export.

Compare runs using the same approved feature, current-code validation, reviewer rubric, model/effort, costs, active elapsed time, and human intervention time. Record the resolved trace identity `greenfield/<profile>[:<variant>]@<version>`; the earlier multi-worker benchmark is not the new workflow.

## Orchestration

`greenfield/orchestrator` routes all work the same way, each worker in its own workspace with fresh context. In Pane, each is a Pane created with `runpane panes create`, with its own tab, worktree and branch:

1. `greenfield/planner` writes the plan. Under an orchestrator, planners only plan.
2. After you approve it, `greenfield/implementer` builds it, one implementer and one PR per plan unless the cover sheet marks packages as independently shippable. A clearly straightforward, authorized fix may skip the planner as `no-plan` work.
3. When every PR in the workstream is ready to merge, `greenfield/reviewer:codex` (GPT-6.1 Sol, max) reviews each one, report only. Must-fix items go back to the implementer that owns the PR, and a follow-up checks only those items. You can skip review, add checkpoints, or review each plan; the current policy shows on the map.

The orchestrator keeps one workstream map per Session: every plan, a dependency graph of the order of work, progress per item, the review policy, and a "Needs you" list, updated on worker events. Before dispatching into a repository it resolves that repository's workspace instructions (`agent-farm inspect greenfield/<profile> --directory <repo>`) and passes their document destination and the Session name to the worker. When a Session spans destinations, the map lives with the first repository's destination and links to short stub hubs in the others. It collects a trace of every session it launched, and archives a worker's Pane once its plan is approved, its PR merged or closed, or its report delivered, after a `--dry-run` shows the worktree is clean and pushed. It never passes `--force` and never deletes remote branches.

Host-injected instructions own the mechanics; Greenfield owns roles, approvals and review policy. A standalone launch can pass `--arg host_policy=/absolute/path/to/host-guidance.md`; this is an instruction document, not a runtime adapter. Event-driven updates replace polling; without notifications, the orchestrator yields and reports the limitation. Urgency never implicitly enables fast mode. The orchestrator never edits project code and never merges.

The orchestrator runs in the Pane Session folder, outside any repository, so it gets no repository's workspace file. A personal `~/.config/agent-farm/workspace.yaml` can give it the connection it needs to publish the map and its own trace; keep routing out of that file, since destinations come from each repository's workspace instructions.

## Profile arguments

Pass repeatable `--arg key=value` flags before the native-CLI `--` separator. Quote each complete argument when it contains spaces or shell metacharacters. Values may contain `=`. Only declared keys are accepted; enums reject unsupported values. Profile presets override agent defaults, and launch flags override presets. Arguments apply to the selected entry agent, not automatically to its children.

| Profile | Accepted arguments |
| --- | --- |
| `planner`, `planner:codex` | `docs`, `source`, `parent` |
| `orchestrator` | `docs`, `host_policy` |
| `bug-reporter` | `source`, `parent` |

`parent` is the status JSON file path, not a host session ID. `host_policy` is a guidance-file path, not automatic tool configuration. Path arguments are passed through as written, so supply absolute paths for cross-workspace handoffs. `source` may be a document path, artifact URL, or contained task. Use `--message` for supplemental assignment text; unsupported profile arguments are not a substitute for host-injected context.

```sh
agent-farm run greenfield/planner:codex --directory /absolute/project/worktree \
  --arg 'source=https://example.test/plan?revision=3&mode=review' \
  --arg 'parent=/absolute/bundle/status files/planner.json'
agent-farm run greenfield/orchestrator --directory /absolute/coordination \
  --arg 'host_policy=/absolute/config/host guidance.md'
```

Use `agent-farm inspect greenfield/planner:codex` to inspect argument declarations, or add `--explain` to a run command to check resolved arguments without launching a model. The implementer and the profiles moved from dcouple declare no arguments: pass the cover sheet, task, or pull request in `--message`.

The former `one-shot` agent/profile has been removed. Update saved launches to `greenfield/implementer`, or use the planner’s authorized small-fix route.

## Moved from dcouple

The `audits`, `business`, `product-researcher`, `qa-and-fix`, `reviewer` and `seo` profiles, and `dcouple/raw` as `implementer`, moved here with every agent and skill they use, from [greenfield-inc/skills](https://github.com/greenfield-inc/skills) at `02ae3a3`. They behave as they did, with four changes:

- dcouple's `qa` agent is now `pr-qa`, because greenfield's own `qa` serves the bug-reporter.
- The implementer has no reviewer child; review runs through `greenfield/reviewer`.
- `reviewer:codex` runs GPT-6.1 Sol at max effort instead of GPT-6 Astra high.
- Skills name "the document destination your workspace instructions name" instead of Grain. Repositories that publish to Grain say so in their `.agent-farm/workspace.yaml`.

`dcouple/implementer` and `dcouple/ideate`, and the agents and skills only they used, did not move. Where both plugins had a skill (`tdd`, `codebase-design`, `babysit-pr`, `session-trace`), greenfield's copy stayed. The `dcouple` plugin still ships for existing installs; `agent-farm plugin uninstall dcouple` removes it.
