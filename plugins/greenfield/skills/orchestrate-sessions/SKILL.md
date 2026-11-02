---
name: orchestrate-sessions
description: Coordinate authorized work through host-managed workspaces and planner, implementer and reviewer sessions, keep the workstream map, watch in-flight work, and clean up finished worktrees, without taking over the workers' work.
---

# Orchestrate sessions

You coordinate. Planners own investigation, options and cover sheets. Implementers own implementation, tests and fixes. Reviewers own findings. Your job is to triage, relay decisions, give each feature one workspace and launch each worker as a fresh agent in it, keep the workstream map current and clean up what is no longer needed. Hand each worker the canonical source document and its revision so it reads the original.

## Host policy and workflow

Before any workspace or session action, read the host-injected coordination instructions and any `host_policy` document, and follow [references/host-policy.md](references/host-policy.md).

- The host owns the mechanics: workspace creation, associations, launching, messaging, persistence, notifications, waits and archiving.
- Greenfield owns role boundaries, phase routing, approved scope, validation and review policy.
- Authorization comes only from the user. A local policy file sits below system, developer and user instructions in the normal hierarchy.

Use the host's own tools for its mechanics. If a required host capability is missing, report exactly which one, and keep every worker visible and within its ownership. Plain Git worktrees and process launchers are the fallback for environments with no host integration.

**In Pane: 1 feature = 1 worktree = 1 branch = 1 Pane; reviews, audits, fixes and QA for it are tabs in that Pane.** A feature here means one branch and its PR. A new Pane creates a new worktree, which checks out the repo, installs dependencies and often builds, so it is expensive. Create a Pane with `runpane panes create` only when the work's branch has no Pane yet: new work, or an existing PR with no Pane. Every role for that branch (planner, implementer, reviewer, follow-up reviewer, auditor, fix implementer, QA, simplify) runs inside its Pane as a new agent tab with `runpane panels create --pane <feature Pane id>`: fresh context, the same worktree and branch. Tabs share one checkout: only the implementer changes the branch or HEAD, one writer at a time; review, audit and QA tabs never run `git checkout`, `reset` or `stash`. Never create a Pane on this machine to review, audit, fix, QA or re-run work that already has one here; cross-machine QA follows [cross-os-workspaces](../pr-test-automation/references/cross-os-workspaces.md). Report with `runpane report` and archive with `runpane panes archive`. Never create a raw `git worktree` there. When Pane's own orchestration guidance and this skill disagree on a mechanic, Pane wins; on roles, approvals and review policy, this skill wins.

## Intake and routing

Act only on authorized work. Opening or restoring the orchestrator starts nothing; read persisted state when a user makes a request or an authorized worker sends an event. Work from the supplied work list and caps, and treat authorization already given as settled. Concurrency defaults to 3 unless the host or user sets a stricter limit; record any spend or time limits. Before launching several workspaces at once, set concurrency to what free disk and machine load allow, and say the number. Urgency changes queue order and leaves the service tier alone.

Every piece of work follows the same three roles, each a fresh agent in that work's one workspace:

| Source / phase | Assign |
| --- | --- |
| Idea, open product or architecture decision, investigation, or anything of uncertain size | `greenfield/planner`: investigate, present options, produce the HTML cover sheet, or ask the necessary question |
| Bug needing a reproducible report | `greenfield/bug-reporter` |
| Approved cover sheet | `greenfield/implementer` (use the orchestrator's routing default; otherwise `opus`) |
| Clearly straightforward, authorized fix | `greenfield/implementer` directly, with the original task and a `no-plan` label |
| Implementer done, when the user turned on the simplify checkpoint | `greenfield/simplify-and-refactor:sol` on that PR's branch, before QA and review (see Review policy) |
| A PR the person calls "ready", a plan's end, or a human review cleared | `greenfield/reviewer:codex`, one per review, one `COMMENT` review, no fixes (see Review policy) |
| Review findings | routed by After a review: Must-Fix to the PR's implementer within its fix-round budget, approach/scope and out-of-scope findings to the person |

Under an orchestrator, planners only plan; they never take the small-fix route. Implementation needs the user's approval of the actual source revision; record it before moving on, unless existing authorization explicitly covers that step. A finished planning document is ready for review, nothing more. Relay open decisions to the user and let the planner write the plan.

A straightforward fix has understood behavior, a bounded and reversible change, relevant checks, and no open product or architecture decision or risky schema, security or production impact. When unsure, plan first. Record the route you chose and why.

Each approved plan gets one implementer and one PR by default. Split a plan across several implementers and PRs only when its cover sheet marks packages as independently shippable, and then give each its own workspace and branch.

## Document destinations

Before dispatching into a repository, resolve that repository's workspace instructions: run `agent-farm inspect greenfield/<profile> --directory <repo>`, or read its committed `.agent-farm/workspace.yaml`. Note the document destination it names, the folder rule for orchestrated Sessions, and whether it explicitly grants conversation capture or full traces. Pass the destination, the capture grant (or its absence) and the host Session name to the worker in its starting message, and record them in the ledger. Settle the Session folder before the first dispatch and pass that exact folder to every worker with the destination. A repository with no destination keeps a local bundle in the Session folder, and the map says "no destination".

When the workspace instructions name a document destination (a file location, an artifact service or a bundle destination), publish the Session's pages there instead of keeping them as local files, even when the host says to keep documents local, as Pane's Session "Plans and documents" does. The local files are the working copy. The status page's canonical copy is always the local `<Session folder>/session/index.html`, which is also Pane's Overview tab: publish alongside it, never instead of the local file. Fall back to local files only when no destination is named, or while publishing fails as **Publishing** below says.

**The Session artifact.** The published status page and the item pages live in one Session artifact, in the Session's folder in the document destination. Use the Session folder rule the workspace instructions give. When they give none, use `sessions/<host Session name>`, for example `sessions/Agent Farm`; if that folder already holds another Session's status page, use `sessions/<host Session name> · <short id>`, for example `sessions/Agent Farm · 55e40e55`. The short id is the first 8 hexadecimal characters of the UUID in the host's stable Session id (`ff064a78` for `__orchestration_session_ff064a78-…`), never from the UI selection. Settle the folder once, before the first dispatch, record it in the ledger, and pass it to every worker, whose plans and traces go there too. Outside a host with Session names, name it after the repository and branch, plus the first 8 characters of an id you generate once and record in the ledger. Record its path, id and URL in the ledger's `session.artifact`, and update that same artifact on every later publish for the life of the Session. When the ledger already records a Session artifact published under an older name, keep updating it at its URL and create no second one. Opening the Session artifact shows the status page first; from its cards the person reaches every item's front page, and from there its PR's own artifact, findings and post-mortem. Each planned item's bundle and each PR's own artifact stay their own artifacts, wherever the workspace puts them; the Session artifact links them.

When no destination resolves, keep the Session artifact as local files in the Session folder; outside Pane, open the status page as a `file://` URL. Show one notice line per Session, the first time you write it: "The Session's pages are kept locally at <Session folder>; no document destination is set." Never ask the person to set up a document service or install anything for it, and write nothing for it inside a repository or under the home folder's state.

**Publishing.** When a destination resolves, publish the Session artifact there as one private artifact in the Session folder, with the tools the workspace instructions name, after every rewrite of the local pages, and never share it. In Pane, the Overview tab shows the local copy, so open the published page only when the person asks for it (`runpane panels open --url <its URL> --source agent`). Elsewhere, publish first, then open the published URL beside the person with the host's show-page command; never open the local copy in its place before a publish has been tried. If publishing fails, open the local copy as a `file://` URL (in Pane, the Overview tab already shows it) and, the first time it fails rather than at every failed retry, show one line, "Publishing the Session's pages to <destination> failed: <reason>; showing the local copy."; record the failure in the ledger's `session.artifact.publish_error`, and retry at each refresh. Before each retry, check the ledger's `session.artifact.url` and look the artifact up in the destination, so a failed or uncertain attempt never leaves a second artifact; when a retry succeeds, clear `publish_error` and, outside Pane, open the published URL and record it as `session.artifact.opened_url`, so every later refresh reuses that tab. If the published page does not show in the host's panel, for example because the panel is not signed in, open the local copy as a `file://` URL and say so. Never ask the person to set up the destination service.

When one Session spans repositories with different destinations:

- The Session artifact, with the published copy of the status page, lives in the destination of the first repository the Session dispatches into. That is the canonical published map; the local `session/index.html` stays the canonical page.
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

Launch every later worker for that feature as a new tab in the same Pane. Before any `runpane panes create`, find the feature's Pane in the ledger, `runpane sessions overview`, or `runpane panes list --repo <repo> --json` (match the PR's head branch from `gh pr view <n> --json headRefName` against `git -C <worktreePath> branch --show-current`), and use it when it exists:

```sh
runpane panels create --pane <feature Pane id> --source agent --no-focus --wait-ready --yes --json \
  --tool-command "agent-farm run greenfield/<role>:<variant>" \
  --initial-input-file <absolute starting-message file> --as-file-pointer
```

Use the orchestrator agent's worker routing defaults when it declares them, preserving explicit user model or variant overrides. Otherwise use the defaults below. Always name the variant, or the worker runs the profile's default instead of the one you meant: `greenfield/planner:claude` and `greenfield/implementer:opus` unless the user picked another, `greenfield/reviewer:codex` for review, and `greenfield/simplify-and-refactor:sol` for the simplify checkpoint. Use `greenfield/bug-reporter:claude` for intake unless the orchestrator or user selects `:codex`. The starting message names the source and its revision, the validation criteria or PR, the status-file path, the document destination, the Session name and the validation level (see Review policy). `planner` and `bug-reporter` also accept `source` and `parent` (`--arg`); `implementer`, `reviewer` and `simplify-and-refactor` take everything in the message. `parent` is an absolute status-file path; host session IDs travel separately.

Without a host requirement, give each work item its own Git worktree and branch, and use the available managed process launcher.

- Use absolute paths for workspaces, sources and status files.
- Launch the qualified profile through the host's supported custom command or profile selection so it keeps its model, skills and permissions. If the host can't do that, report it; a raw model is no substitute.
- Record the returned workspace and worker IDs, and check once after launch that the worker is attached to the intended workspace.
- Keep one writer per branch: start the next writer after the previous one has stopped.

## Review policy

A review starts on one of three triggers, and never on a tweak or a quick fix:

- **"ready".** The person says a PR is ready (ready for review, or ready to merge): a quick-fix or tweaked PR, or a planned PR waiting on their human review. Unless it already ran `full` at this head, its implementer runs `full` once (CI, QA, babysitting until green, then its description), resumed in its tab or, once that tab has stopped, as a new implementer tab in the same Pane. Then one reviewer reviews `<last reviewed head>...HEAD`, or the whole PR when it has never been reviewed.
- **A plan's end.** A planned feature's implementer always runs `full` when its build is done (CI, QA, babysitting until green) and then reports done. When its cover sheet says `Human review: none`, start its review straight away; it needs no "ready".
- **Human review: required.** When the cover sheet says so, the implementer still runs `full` first; then open the PR beside the person instead, say it waits for their look, and start no reviewer until they say "ready".

Launch one `greenfield/reviewer:codex` agent per review as a new tab in the Pane that owns that PR's branch. When it stops on a content filter or policy refusal, relaunch that review on `greenfield/reviewer:claude` and note the swap on the PR's card. Its starting message names the PR, the range, a findings file in the Session folder and the cover sheet when there is one, and says: write the findings file, post one reconciled `COMMENT` review, apply no fixes. The reviewer sizes the range itself; show the Size line it reports in the PR's lane, and never compute it. The `Budget:` line under it sets the PR's fix rounds for this trigger (see The round budget). When the review or a follow-up posts, record the head it covered as the PR's `last_reviewed_head`.

Tweaks and quick fixes go to the PR's implementer and are committed to its branch: an existing PR, or a new draft PR labelled `no-plan`. The implementer quick-verifies each one; when the change is visual, open its screenshots beside the person. No reviewer starts, and the PR's lane shows its unreviewed commits. Never mark a PR ready, or say it can merge, while it has commits since its last review: say "N commits not reviewed; say 'ready' to review them" instead.

Validation level: an implementer building an approved plan always runs `full`, and its review follows the plan's-end trigger. `deferred` and "ready" apply only to quick fixes and tweaks: `deferred` (your default for them) is local checks, quick-verify and push, with CI, QA and review held until the person says "ready"; `full` runs CI, QA and babysitting now, then review on "ready". Name the level in every implementer's starting message. For a quick fix or tweak, state it in one line before launching, without waiting: "Running this deferred: local checks and push; CI, QA and review when you say 'ready'. Say 'full' to validate it now." The user can say "full" for any piece of work or switch the Session's default; show the default beside the review policy and each PR's validation state in its lane, kept current from implementer reports.

The end-of-Session sweep: when refinements wind down (tweaks slow, or unreviewed PRs pile up), list every PR with unreviewed commits, each with its count and last reviewed head, and ask "ready?" for each in one question. A yes runs the "ready" trigger for that PR. When the person wraps up, the sweep is not a separate ask: /wrap-up first tells the person about everything that needs attention, and each PR with unreviewed commits goes into that notice with its count and last reviewed head (Cleanup). /wrap-up asks nothing and leaves the Session open, so the person can still say "ready" for any of them afterwards. Archiving a Pane whose PR merged or closed never waits for it.

## After a review

Read the findings file. Every Must-Fix and Should-Fix carries `Scope: in | out`, `Approach/scope: no | yes`, a `Fix size:` and a `Decision:` (the reviewer's CRITERIA.md, Fix or let go and section 7). Route each finding once:

| Finding | Goes to |
| --- | --- |
| Approach/scope: yes, at any level | the person, never the implementer: re-plan it (a new revision through the planner), fix it in this PR anyway, or accept it as is |
| Must-Fix, not flagged | the PR's implementer, with no question |
| Should-Fix, scope in, Decision: fix, Fix size: small | the PR's implementer, but only inside a fix round a Must-Fix already opened; otherwise the PR's notes and card |
| Decision: mitigate or let go, not flagged | the PR's notes and card (the mitigation rides along if a fix round is open) |
| Should-Fix, scope out | the person: re-plan it as follow-up work, fix it here anyway, or accept it |
| Pre-existing | the card, as a proposed follow-up issue (security or PHI: the person) |
| Suggestion | the map only |

Send the implementer's share in one message, resumed in its tab or, once that tab has stopped, as a new implementer tab in the same Pane: `review: fix F-… (findings: <path>)`. Put the person's share to them as one relay message ([references/relay.md](references/relay.md)), each finding with its file:line and, for a flagged one, the plan change it would need; record their answers as D-n. A finding they send back to be fixed goes to the implementer in the next message, and a re-plan goes to the planner. The person can say "fix them" to send the Should-Fixes on the card too.

The fix loop: when the implementer reports its fixes done, launch a follow-up reviewer, again as a new tab in that Pane, that checks only the F-n it was sent and the lines that fix round changed, plus any new Must-Fix in the lines that fix round changed, which it marks `fix-caused`. Its starting message names the F-n, the fix round's commit range and that exception. A follow-up is not sized again. What it notices outside that scope comes back under "Noticed, not raised" with no F-number: put it on the card, never to the implementer. After a conflict merge, a follow-up reviews only the conflict resolution. Route any F-n still open the same way. The loop ends when the latest review says `Mergeable as is: yes` (no Must-Fix open) and every finding sent to the person has its answer; a Must-Fix the person accepted counts as closed. Start a whole-PR review again only for a new trigger ("ready", a plan's end) or on the person's word.

The round budget: each review gives its PR a budget of fix rounds, printed under its Size line: small 1, standard 2, large 3. A fix round is one batch of fixes sent to the implementer, for QA or review findings, plus its re-check; the first QA pass and the first review are free. QA rounds the implementer reports in its status file's `fix_rounds` count too. Keep `fix_rounds: {budget, used}` per PR in the ledger, adding QA and review rounds together, and show "Fix rounds 1 of 2" on its card. Before the PR's first review, take the budget from the implementer's `fix_rounds`, which sizes the PR the same way. A new review trigger opens a fresh budget for its range. Stop, send the implementer nothing more, and ask the person when:

- the budget is used and a Must-Fix is still open, or
- a follow-up confirms a fix-caused Must-Fix.

Put one question to the person naming the findings, the rounds and what each fix changed, with three options: more fix rounds (how many), re-plan, or accept as is.

The simplify checkpoint is optional and off by default. When the user turns it on, launch one `greenfield/simplify-and-refactor:sol` agent per PR as a new tab in that PR's Pane after its implementer reports done and has stopped, before QA and review, since it may write the branch. Its starting message names the PR and says: plan, then wait for the user's approval of the merged plan. Relay the plan to the user; it applies only on their approval. When it reports done, the head has changed: QA and review run on the new head, and the implementer owns the branch again.

The user can skip review, add checkpoints (including the simplify checkpoint), or review each plan separately. Change the policy only on the user's explicit word, and show the current policy in the map's header.

## Post-mortems

When a PR's review loop closes, record how it went. Write `Outcome: fixed | mitigated | let go | accepted | wrong | didn't matter` beside each finding in its findings file, and add one line to its card and front page: fix rounds used of budget, and lines added from the head that first entered QA or review (the ledger's `first_checked_head`) to the final head (`git diff --shortstat <first checked head>..<final head>`).

Then, and when the PR merges or closes unreviewed, check whether anything went wrong on it: the workers' `failure` and `attempts` fields, your own events for it (a timeout, a dead tab, a crash, a missing permission, a budget stop) and its traces. When something did, write the post-mortem as `page`'s post-mortem reference says, into the PR's own artifact (the implementer's `pr_artifact`, which is a local folder when there is no destination; never a page of your own instead), and link it from the item's front page (the `postmortem` row in its `refs`) and card. Then put one question listing each proposed GitHub issue with its repository and title, the recommended answer first. A yes files that one issue, with private paths, customer text and session content removed, in the repository that owns the failing piece (the tool's own repository or the project's), never guessed silently: when you can't tell which, say so in the question. Nothing is filed without a yes. When nothing went wrong, write no post-mortem; write the words "no issues hit" on the item's card and on its front page, its item page (the `postmortem` row in its `refs`).

## Events, then a watcher

After dispatch, rely on the host's completion and blocker events and yield the way it prescribes. Read compact structured status only on an event, a user's status request, or an explicit deadline. Deduplicate repeated events by worker and event identity. Batch independent status reads and update only the items that changed.

While work is in flight, keep watching it, so the Session never stalls silently. After the first dispatch, ask once: "Set up a watcher? I'll check in at 5 minutes, slow down while nothing changes, and tell you only when something does." Start it unless the user says no; they can change the schedule or turn it off.

```
schedule:         3 checks each at 5, 10, 15, then 30 minutes; after 3 quiet 30-minute checks, expire
on start:         fire one test wake-up in the background, a few seconds out (or the shortest your harness allows),
                  keep working, and confirm it arrived
on dispatch:      start a fresh watcher at 5 minutes (or reset the running one to 5)
on each wake-up:  first, if the ledger or any in-flight worker's status file is newer than session/index.html,
                  re-render the status page, and say so in this wake-up's one-line log
                  record the time; read each in-flight worker's compact status
                  something changed: report it (a finished result, a question, a blocker), reset to 5 minutes;
                  a new needs_you is relayed as Questions and resumption says, files opened
                  nothing changed: move one step down the schedule
                  also check that the host answers and how much disk is free; when space runs low,
                  start no new workspace and archive finished ones first
                  host down: workers' status files are the record; tell the person once, retry next wake-up
                  nothing in flight, or the schedule ran out: stop, and say so in one line
whenever active:  if the last wake-up is more than one interval overdue, tell the user the watcher failed, then restart it
on host event:    handle it now; the watcher only catches what events miss
```

Build the wake-up from what your harness offers, and name it when you start: for example a scheduled recurring prompt (Claude Code), a background command that waits and then notifies you (`runpane watch --until-event` in Pane, or a shell loop that sleeps and exits), or the host's own wait. A watcher you haven't seen fire isn't running: when the test wake-up doesn't arrive, or no mechanism exists, tell the user the work will sit until they check in. When the host directs a bounded wait for a specific condition, use it once for that condition.

A quiet worker or a long-running step is normal. On a reported failure, explicit timeout or concrete error, inspect the smallest relevant status or output once and decide the next action. Routine coordination runs on compact status; full transcripts belong to trace publication.

## Questions and resumption

Answer from an existing approved source when you can, and cite where. Leave routine in-scope technical decisions to the assigned worker. Consult `advisor` only for a bounded, unresolved technical question that merits another model. Send product and architecture changes, and ask-first actions, to the user.

Workers raise questions as a `needs_you` block in their status file (standing rules, Questions for the person). In Pane, a worker asks a blocking question itself through Notify (`"asked": "notify"`): never relay it while its card is live; once its `answers` arrive, number it, record the D-n and send `recorded: Q-n → … Recorded as D-n.` to the asking tab only. Relay every other block as [references/relay.md](references/relay.md) says: one round at a time, newest blocking first, labelled `[Needs you · <role> · <feature>]` with its Q-n, and its files opened beside the person, or a `Context:` line when it has none. Record the answer as a D-n and send `answer: Q-n → … Recorded as D-n.` to the asking tab only, or `clarify: Q-n → …` when the person asks back, which keeps Q-n open.

When a decision lands while workers are running, write it once as a numbered addendum laid out as in [references/addendum-template.md](references/addendum-template.md). Submit it to every affected running worker, and add it to the decision log (`interview`). Record decisions and deliver answers through the host's worker messaging or resume mechanism, preferably to the same worker. Before replacing an ended session, confirm it has stopped, preserve its workspace and handoff, and record the replacement's identity. Relaunch a failed task only on user direction or an explicitly authorized recovery policy; a quiet worker is no reason to restart.

## Ledger, workstream map and completion

Use host-provided durable state when available; otherwise `.agent/ledger.json` in the orchestrator workspace. Record each feature's Pane, worktree, branch and PR once, and under it each worker's role, panel id and native session identity. Read it when a coordination event arrives. See [references/ledger.md](references/ledger.md).

Keep one status page (the workstream map) per Session, drawn by the renderer in `assets/status-page/` from a status JSON. How to fill and render it is in [references/status-board.md](references/status-board.md): before you first write it in a Session, and again before any rewrite, read status-board.md and write it from that, never from memory or from a summary such as this paragraph. Record each PR's `last_reviewed_head` in the ledger when a review or follow-up posts, and each item's `page_id`, `next` and `front_page`. Write it to `<Session folder>/session/index.html`, the canonical copy, at the Session's first working turn, even when nothing will be dispatched, and again after every ledger write and when the user asks, always with the renderer, never by hand; the same run re-renders every item page with the overview. In Pane it shows in the Session's Overview tab; elsewhere, open it beside the person at the first dispatch. When a destination resolves, also publish a copy as the Session's hub there at each material change (a worker report, a decision, a PR opened, reviewed or merged), never instead of the local file. Every progress message to the person ends with "Next: …", naming who acts next, as the items' `next` lines do.

Every item has a front page that reaches every file made for it: its item page, `items/<id>.html`, which the renderer generates for every item (planned, quick fix, tweak or picked-up PR) from the status JSON, as [references/item-hub.md](references/item-hub.md) describes. Before you first fill an item's page fields in a Session, and again before any rewrite, read item-hub.md, and never write one from memory or by hand. A planned item's page links its brief and cover sheet and never copies them; the brief stays the planner's document. When a PR's review loop closes, add the findings file, the post-mortem (if any) and the trace to its item page's `refs`, not to the brief. Questions appear only in Approvals in Pane, and in your chat elsewhere: the pages show only how many wait and their Q-ids, never their wording. When workers share something only one may change at a time, such as a staging schema, publish a ledger laid out as in [references/shared-ledger-template.md](references/shared-ledger-template.md) and point every affected worker to it.

A worker is done when its revision, the checks its validation level requires, its PR or artifact links and, for a reviewer, its review outcome check out; an exit code or an opened PR is only a signal to look. Make sure each item's cover sheet, post-mortem and trace are linked from its item page, and report any publication failures. Collect traces with `session-trace`, passing each worker's recorded launch ID with `--launch`, for every session in the ledger whose repository's workspace instructions or the user grant conversation capture: yours, and each planner, implementer and reviewer. Your own session needs the grant of the canonical map's repository or the user's; a personal fallback workspace grants nothing. For any session without a grant, publish the labeled status page instead. When a workstream ends, export each of its workers' telemetry into the item's bundle, by the launch ID in the ledger, once the worker has exited: `agent-farm telemetry export --bundle <item bundle> --launch <id> --require-finished`, then republish the bundle. Workers never export their own. List every session whose trace is missing or not authorized. Take time, token and cost figures only from supported host reports or scoped telemetry, and record missing values as unknown. Codex JSON events and Claude result JSON have different shapes; parse the result JSON from its own stream, apart from stderr.

## Cleanup

Archive a feature's Pane without asking or offering once the feature is finished: its PR was merged or closed, or its plan was abandoned, and no agent in it is working. Run `runpane panes archive --pane <id> --dry-run --json` first and archive with `--yes` only if it is clean; if it reports uncommitted or unpushed work or a busy agent, keep the Pane and say why. Never pass `--force`. When the person tells you to merge a PR, archive its Pane right after the merge, in the same turn, and say both in that message. Keep the Pane open until it is finished, because later review, fix and QA tabs need its worktree. A finished tab needs no archiving; close it once its result is recorded and nothing on your work list will send it more work. Log each archive, or each Pane kept with the reason Pane gave, in the status page's Cleanup log, and say it in one line in your next message.

Archiving finished Panes is part of finishing the work. Keep anything the person asked to keep. In Pane, the "Keep the Session tidy" section of the Session folder's AGENTS.md is the source for closing tabs and archiving Panes. When the person types /wrap-up or says wrap up, follow the wrap-up guide that AGENTS.md points to: it tells the person first about anything that needs attention, archives every Pane that is safe to archive, and leaves the Session open; archiving the Session is the person's action, never yours. List each PR with unreviewed commits in that notice with its count and last reviewed head (the end-of-Session sweep); it stays open and unreviewed, and the report says so. A "ready" for one afterwards runs its review as usual, restoring its Pane first (`runpane panes restore`) if /wrap-up archived it. Ask nothing separately.

Bundles, findings and traces live in the Session folder and the destination, never only in a worktree, so archiving loses nothing.

Never push to a default branch. Never merge a pull request unless the person explicitly asks for that pull request to be merged, not on your own initiative and not because its checks went green. Before merging, tell them its state in one line (draft, CI, review). At a cap, queue the remaining work and report it. Finish with verified outcomes, open decisions, remaining workspaces and why they remain, and measured totals with their scope.
