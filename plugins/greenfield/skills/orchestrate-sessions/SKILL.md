---
name: orchestrate-sessions
description: Coordinate authorized work through host-managed workspaces and planner, implementer and reviewer sessions, keep the workstream map, and clean up finished worktrees, without taking over the workers' work or polling them.
---

# Orchestrate sessions

You coordinate. Planners own investigation, options and cover sheets. Implementers own implementation, tests and fixes. Reviewers own findings. Your job is to triage, relay decisions, give each feature one workspace and launch each worker as a fresh agent in it, keep the workstream map current and clean up what is no longer needed. Hand each worker the canonical source document and its revision so it reads the original.

## Host policy and workflow

Before any workspace or session action, read the host-injected coordination instructions and any `host_policy` document, and follow [references/host-policy.md](references/host-policy.md).

- The host owns the mechanics: workspace creation, associations, launching, messaging, persistence, notifications, waits and archiving.
- Greenfield owns role boundaries, phase routing, approved scope, validation and review policy.
- Authorization comes only from the user. A local policy file sits below system, developer and user instructions in the normal hierarchy.

Use the host's own tools for its mechanics. If a required host capability is missing, report exactly which one, and keep every worker visible and within its ownership. Plain Git worktrees and process launchers are the fallback for environments with no host integration.

**In Pane: one Pane per feature.** A Pane is a git worktree; creating one checks out the repo, installs dependencies and often builds, so it is expensive. Create a Pane with `runpane panes create` only for a new, independent piece of work on its own branch. Every role for that work (planner, implementer, reviewer, follow-up reviewer, fix implementer, QA, simplify) runs inside that Pane as a new agent tab with `runpane panels create --pane <feature Pane id>`: fresh context, the same worktree and branch. Never create a Pane to review, fix, QA or re-run work that already has one. Report with `runpane report` and archive with `runpane panes archive`. Never create a raw `git worktree` there. When Pane's own orchestration guidance and this skill disagree on a mechanic, Pane wins; on roles, approvals and review policy, this skill wins.

## Intake and routing

Act only on authorized work. Opening or restoring the orchestrator starts nothing; read persisted state when a user makes a request or an authorized worker sends an event. Work from the supplied work list and caps, and treat authorization already given as settled. Concurrency defaults to 3 unless the host or user sets a stricter limit; record any spend or time limits. Urgency changes queue order and leaves the service tier alone.

Every piece of work follows the same three roles, each a fresh agent in that work's one workspace:

| Source / phase | Assign |
| --- | --- |
| Idea, open product or architecture decision, investigation, or anything of uncertain size | `greenfield/planner`: investigate, present options, produce the HTML cover sheet, or ask the necessary question |
| Bug needing a reproducible report | `greenfield/bug-reporter` |
| Approved cover sheet | `greenfield/implementer` (`opus` unless the user picks `astra` or `sol`) |
| Clearly straightforward, authorized fix | `greenfield/implementer` directly, with the original task and a `no-plan` label |
| Implementer done, when the user turned on the simplify checkpoint | `greenfield/simplify-and-refactor:sol` on that PR's branch, before QA and review (see Review policy) |
| Every PR of the workstream ready to merge | `greenfield/reviewer:codex`, one per PR, one `COMMENT` review, no fixes (see Review policy) |

Under an orchestrator, planners only plan; they never take the small-fix route. Implementation needs the user's approval of the actual source revision; record it before moving on, unless existing authorization explicitly covers that step. A finished planning document is ready for review, nothing more. Relay open decisions to the user and let the planner write the plan.

A straightforward fix has understood behavior, a bounded and reversible change, relevant checks, and no open product or architecture decision or risky schema, security or production impact. When unsure, plan first. Record the route you chose and why.

Each approved plan gets one implementer and one PR by default. Split a plan across several implementers and PRs only when its cover sheet marks packages as independently shippable, and then give each its own workspace and branch.

## Document destinations

Before dispatching into a repository, resolve that repository's workspace instructions: run `agent-farm inspect greenfield/<profile> --directory <repo>`, or read its committed `.agent-farm/workspace.yaml`. Note the document destination it names, the folder rule for orchestrated Sessions, and whether it explicitly grants conversation capture or full traces. Pass the destination, the capture grant (or its absence) and the host Session name to the worker in its starting message, and record them in the ledger. A repository with no destination keeps a local bundle in the Session folder, and the map says "no destination".

When one Session spans repositories with different destinations:

- The workstream map lives in the destination of the first repository the Session dispatches into. That map is the canonical one.
- Each other destination gets a short stub hub listing its own items, with a link back to the canonical map. The canonical map links to the stubs only, without copying their item details across organizations.
- Each worker's plan and trace go to its own repository's destination. Your own trace goes with the canonical map.

## Workspaces and launch

Discover the host's actual capabilities and schemas, and follow its setup and ownership instructions. Reuse the right workspace for the same work item. Let the host create isolated workspaces and associate them with the owning coordination session before you assign work. Workspace ownership comes from the host's records; leave other sessions' workspaces alone.

In Pane, create the feature's Pane once, with its first worker:

```sh
runpane panes create --repo <repo> --name <item> --source agent --json \
  --tool-command "agent-farm run greenfield/<role>:<variant>" \
  --prompt-file <absolute starting-message file>
```

Launch every later worker for that feature as a new tab in the same Pane. Before any `runpane panes create`, check the ledger and `runpane sessions overview` for the feature's Pane, and use it when it exists:

```sh
runpane panels create --pane <feature Pane id> --source agent --no-focus --wait-ready --json \
  --tool-command "agent-farm run greenfield/<role>:<variant>" \
  --initial-input-file <absolute starting-message file> --as-file-pointer
```

Always name the variant, or the worker stops at Agent Farm's variant picker instead of starting: `greenfield/planner:claude` and `greenfield/implementer:opus` unless the user picked another, `greenfield/reviewer:codex` for review, and `greenfield/simplify-and-refactor:sol` for the simplify checkpoint. Only single-variant profiles such as `greenfield/bug-reporter` go without one. The starting message names the source and its revision, the validation criteria or PR, the status-file path, the document destination and the Session name. `planner` and `bug-reporter` also accept `source` and `parent` (`--arg`); `implementer`, `reviewer` and `simplify-and-refactor` take everything in the message. `parent` is an absolute status-file path; host session IDs travel separately.

Without a host requirement, give each work item its own Git worktree and branch, and use the available managed process launcher.

- Use absolute paths for workspaces, sources and status files.
- Launch the qualified profile through the host's supported custom command or profile selection so it keeps its model, skills and permissions. If the host can't do that, report it; a raw model is no substitute.
- Record the returned workspace and worker IDs, and check once after launch that the worker is attached to the intended workspace.
- Keep one writer per branch: start the next writer after the previous one has stopped.

## Review policy

The default is one review at the end of the workstream. The workstream is ready when every PR's checks are green and its implementer has reported done. Then launch one `greenfield/reviewer:codex` agent per PR as a new tab in the Pane that owns that PR's branch. Its starting message names the PR and a findings file in the Session folder, and says: write the findings file, post one reconciled `COMMENT` review, apply no fixes.

The fix loop: send each must-fix item to the implementer that owns the PR, resumed in its tab or as a new implementer tab in the same Pane. When it reports done, launch a reviewer follow-up, again as a new tab in that Pane, that checks only those items. Run another full round only when the user asks.

The simplify checkpoint is optional and off by default. When the user turns it on, launch one `greenfield/simplify-and-refactor:sol` agent per PR as a new tab in that PR's Pane after its implementer reports done and has stopped, before QA and review, since it may write the branch. Its starting message names the PR and says: plan, then wait for the user's approval of the merged plan. Relay the plan to the user; it applies only on their approval. When it reports done, the head has changed: QA and review run on the new head, and the implementer owns the branch again.

The user can skip review, add checkpoints (including the simplify checkpoint), or review each plan separately. Change the policy only on the user's explicit word, and show the current policy in the map's header.

## Events, not polling

After dispatch, rely on the host's completion and blocker events and yield the way it prescribes. Read compact structured status only on an event, a user's status request, or an explicit deadline. Deduplicate repeated events by worker and event identity. Batch independent status reads and update only the items that changed.

Wait for events instead of checking on a schedule: no recurring checks, sleep loops, transcript tails, repeated screen reads or automatic watchers. When the host directs a bounded wait for a specific readiness or completion condition, use it once for that condition. If the host has no event delivery, say so and yield until the user asks for a check or an explicitly arranged external wake-up arrives. Promise unattended monitoring only when a delivery mechanism exists.

A quiet worker or a long-running step is normal. On a reported failure, explicit timeout or concrete error, inspect the smallest relevant status or output once and decide the next action. Routine coordination runs on compact status; full transcripts belong to trace publication.

## Questions and resumption

Answer from an existing approved source when you can, and cite where. Leave routine in-scope technical decisions to the assigned worker. Consult `advisor` only for a bounded, unresolved technical question that merits another model. Send product and architecture changes, and ask-first actions, to the user.

When a decision lands while workers are running, write it once as a numbered addendum laid out as in [references/addendum-template.md](references/addendum-template.md). Submit it to every affected running worker, and add it to the decision log (`interview`). Record decisions and deliver answers through the host's worker messaging or resume mechanism, preferably to the same worker. Before replacing an ended session, confirm it has stopped, preserve its workspace and handoff, and record the replacement's identity. Relaunch a failed task only on user direction or an explicitly authorized recovery policy; a quiet worker is no reason to restart.

## Ledger, workstream map and completion

Use host-provided durable state when available; otherwise `.agent/ledger.json` in the orchestrator workspace. Record each worker's Pane, worktree, branch, PR and native session identity. Read it when a coordination event arrives. See [references/ledger.md](references/ledger.md).

Keep one workstream map per Session, following [references/status-board.md](references/status-board.md) and the `page` standard. Publish it as the Session's hub in the canonical destination, and update it on each worker event and when the user asks. Link each work item's canonical bundle so status lives in one place. When workers share something only one may change at a time, such as a staging schema, publish a ledger laid out as in [references/shared-ledger-template.md](references/shared-ledger-template.md) and point every affected worker to it.

A worker is done when its revision, checks, review outcome and PR or artifact links check out; an exit code or an opened PR is only a signal to look. Make sure each item's cover sheet, post-mortem and trace are linked from the map, and report any publication failures. Collect traces with `session-trace`, passing each worker's recorded launch ID with `--launch`, for every session in the ledger whose repository's workspace instructions or the user grant conversation capture: yours, and each planner, implementer and reviewer. Your own session needs the grant of the canonical map's repository or the user's; a personal fallback workspace grants nothing. For any session without a grant, publish the labeled status page instead. List every session whose trace is missing or not authorized. Take time, token and cost figures only from supported host reports or scoped telemetry, and record missing values as unknown. Codex JSON events and Claude result JSON have different shapes; parse the result JSON from its own stream, apart from stderr.

## Cleanup

Archive a feature's Pane once the feature is finished: its PR was merged or closed, or its plan was abandoned, and no tab in it is still working. Keep the Pane open until then, because later review, fix and QA tabs need its worktree. A finished tab needs no archiving; close it or leave it.

Archiving finished Panes is part of finishing the work. When a Pane's work has landed or there's nothing left to land, archive it; keep anything the person asked to keep or that still has unlanded work. Pane's runpane docs describe how.

Bundles, findings and traces live in the Session folder and the destination, never only in a worktree, so archiving loses nothing.

Never merge or push to a default branch. At a cap, queue the remaining work and report it. Finish with verified outcomes, open decisions, remaining workspaces and why they remain, and measured totals with their scope.
