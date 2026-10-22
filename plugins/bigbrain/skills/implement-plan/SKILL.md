---
name: implement-plan
description: Executes an approved bigbrain control-flow.json one step at a time - preflight, build and verify steps, checkpoint handshakes at review steps, the QA loop through the verifier, the PR step - filling verification.json and writing the post-mortem. Also runs the quick-fix route when the starting message is a quick fix. Used by the bigbrain implementer.
---

# Implement plan

You build what the approved cover sheet says by running its `control-flow.json`, in order. You are the one integrator on the branch: builders may write chunks of a build step for you, but only you edit shared files, integrate and commit. The orchestrator owns every review and design step, and reviews every PR before it is ready; the person is reached only through `needs_you` (`contract.md`). The step types and review-point rules are in the `documents` skill's `references/control-flow.md`.

Two modes, chosen by your starting message:

- **Control flow** (the normal case): the message names an approved cover sheet and its `control-flow.json` at a revision. Everything below applies.
- **Quick fix** (D-25 route, starting message variant "Quick fix" in `contract.md`): no cover sheet and no control flow. See [Quick fix](#quick-fix).

## Start

1. Set your status file to `running`, `step: "preflight"`, `source` = the cover sheet path `@rev N`.
2. Read the cover sheet, `control-flow.json`, `evidence/verification.json` and the decision log. Check that `control-flow.json` has `approved_by` and the cover sheet is `approved` at the same revision; if not, report `blocked` with that as the question. Never build from an unapproved revision.
3. Start the Surprises log: the `surprises` list in `verification.json` (append-only). Every time reality differs from the plan (an assumption was wrong, a check could not run as written, a decision you had to make), add one line with what, why and the evidence.

## Preflight

Before writing any code, make sure every step can run:

- Every S-n command runs (or fails for the expected reason) in this worktree; dependencies install; the app starts.
- Every J-n can be driven: the routes, fixtures, accounts, viewports and themes the `qa` settings and journeys need exist or can be made locally.
- The approved mockups in `qa.mockups` exist in the bundle.
- `check-bundle <bundle> --stage approve` passes.

Record each result in the status file's `preflight` notes and the Surprises log. A flow that cannot run is a `needs_you` now, before coding (kind `question`, with what is missing and the options: provide it, change the check through a new plan revision, or accept it as undetermined). Keep building the parts that do not depend on it.

## Steps

Run the steps in order. Before each one, set `step` to its id in your status file. Load only the skills that step needs: the step's `skills` list, else the default below.

| `do` | Default skills | What you do |
| --- | --- | --- |
| `build` | `tdd`, `quick-verify`, `codebase-design` when an interface or seam is in question, `investigate` when something breaks unexpectedly | Build the package's outcome, test-first at the seams the cover sheet's checks imply, yourself or split across builders (below). Run the cleanup checklist (below) before each commit, then commit in small, focused commits on the feature branch and push. |
| `verify` | `quick-verify` | Prove the listed flows. S-n: run the command yourself and keep the output. J-n, or any step with `spawn: "verifier"`: brief the verifier (below). Write the results into `verification.json`. |
| `qa` | (the verifier brings `verify-app` and `design`) | The QA loop below. |
| `pr` | `prepare-pr`, `excalidraw-pr-diagrams`, `babysit-pr` | The PR step below. |
| `review`, `design` | none | The checkpoint handshake in `contract.md`: commit, push, run `check-bundle`, set `state: checkpoint` with `{ step, scope, head }`, report, and change nothing on the branch until `continue:`. Fix exactly the F-n a `review: … → fix` message sends, then check in again. You never start a reviewer or a designer. |

Use `explorer` for large read-only questions about the codebase (with file:line answers). Never give `explorer` or `verifier` write work; `builder` is the only helper that edits.

## Cleanup before each commit

Before each commit in a build step, clean up the lines this change adds or edits, following the repository's own conventions:

- Remove dead code and commented-out code.
- Name magic values (a constant or a well-named variable, where the repository would).
- Merge duplicated logic into one function or existing helper.
- Give each new TODO its context (an issue or a reason), or remove it.

Leave code the change does not touch alone, even when it has the same problems; at most, note it as a follow-up in the post-mortem's action items. This is not a separate pass: there is no simplify step, no stop for the person, and no behaviour change. Builders follow the same checklist on their own files, and you apply it again to the integrated diff before committing. Quick fixes follow it too.

## Builders

In a `build` step, and only there, you may split the package across up to three `builder` subagents running at once. QA fixes and review fixes stay with you, one at a time.

1. **Split by file ownership.** Cut the work into chunks that touch disjoint files and do not need each other's output. Chunks that share a file, or where one needs what another produces, run one after the other, or you do them yourself. Write the split down (in the Surprises log or your notes): each builder, its chunk, and the exact files it owns.
2. **Keep the shared files.** Lockfiles, manifests, generated files, migrations, index or barrel exports, and any file two chunks would touch are yours: edit them yourself, before or after the builders. Installs, code generation and migrations are yours too.
3. **Brief each builder** with the chunk's outcome, the files it owns, the tests it may run, and what the other chunks are doing (the brief format in `contract.md`). Builders never commit, check out, stash, install or migrate.
4. **Check each diff before integrating.** Start the builders from a clean tree (commit your own edits first). When they return, compare `git status --porcelain` with the files you assigned, and each builder's reported list with its own files. A changed file nobody owns, or a builder touching a file it does not own, is a stray. Save the whole diff first (`git diff > <scratch file>`), then undo the stray: `git restore <file>` for a tracked file nobody owns, delete a new untracked file nobody owns. When the stray hit another builder's file, restoring it also drops that builder's work, so redo both chunks yourself, serially, using the saved diff as reference. Redo the straying builder's chunk yourself in every case.
5. **Integrate, then verify and commit.** Make the shared edits, run the cleanup checklist on the integrated diff, run the package's checks and the step's `verify` only after all chunks are in, then commit in focused commits yourself.

Anything the plan leaves open that is a product, design, scope or approval question goes to the person as a `needs_you`; keep building what is not blocked. Routine technical choices are yours: record the consequential ones in the Surprises log and the post-mortem's critical decisions. A change to a check, a step or the scope is not yours to make: ask for a new plan revision through a `needs_you`.

## verification.json: narrow writes

You and the verifier may set only `verdict`, `method`, `evidence`, `commit` and `round` on a row, and append to `mockup_fidelity`, `jank`, `fix_log`, `assumed`, `surprises` and `open_items`, plus `tested` and `qa.rounds_used`. Never add, remove or reword a row; `check-bundle` fails if you do. Evidence is a bundle-relative path (`evidence/qa/round-1/J-2-empty-phone-dark.png`) or a short quoted result. A check you could not run is `undetermined`, never `pass`.

After each verify or QA step, render `evidence/verification.html` from the JSON with the `documents` skill's `verification` template, then run `check-bundle`.

## The QA loop

`qa.max_rounds` (or the step's `max_rounds`) caps the rounds; the default is 3. For round N = 1, 2, …:

1. **Brief the verifier** with the round number; the app and how to start it; the commit; the flows the step lists, as written in `control-flow.json`; the approved mockups and their must-match screens; the viewports and themes; the jank checklist in `design-quality.md`; the PR's changed files; and the evidence folder `evidence/qa/round-N/`. The verifier maps the changed files to the screens they render and checks every changed screen in its empty, long-content/overflow, loading and error states (the jank checklist), even when no journey visits it. A screen or state it cannot reach is `undetermined` with the reason. The verifier checks independently and returns results with evidence; it does not see your reasoning.
2. **Record** every result in `verification.json` (rows, `mockup_fidelity`, `jank`) with `round: N`.
3. **Fix** each fail that is safe and easy: small, inside what the PR already changes, and altering no product decision, data schema, dependency, authentication, or anything in production. Find the cause, fix it with a test where one fits, commit it as its own small commit, and add a `fix_log` entry (`round`, `finding`, `cause`, `fix_commit`, `rechecked: false`). Any other fail is not yours to fix here: it goes to step 5 as an open item.
4. **Next round** rechecks every fail from this round and every flow a fix could have touched; set `rechecked: true` and `fixed_in_round` when it passes.
5. **Stop** when a round has no fails, or at `max_rounds`. A fail still open at the cap, or one that is not safe and easy (outside the PR's changes, owned by someone else, touching a product decision, schema, dependency, auth or production, or against a constraint), becomes an `open_items` entry and a `needs_you` (kind `question`: accept it, extend the rounds, or change the plan). Never mark it pass.

Watch for thrashing: a fix that breaks something fixed earlier, or the same area failing in two rounds. Log the cycle in the Surprises log; on the second occurrence, stop changing that area and investigate the cause before another round.

## The PR step

1. Run `check-bundle <bundle> --stage done`. A pending row means a step did not run: go back and run it, or record it as undetermined with the reason.
2. Use `prepare-pr`, and open the PR as a draft: it stays draft until the end review leaves no Must-Fix open. The first line is an imperative, standalone summary. The body follows the bigbrain PR layout: why (SC-n delivered), concepts and approach (D-n), walkthrough by P-n, validation (the J/S verdict summary, QA rounds used, a link to the verification page) and limitations. Add a size note when more than about 1,000 lines changed, saying why it is not split. Skip `prepare-pr`'s offer of another simplify pass and its `cold-read` step.
3. Use `babysit-pr` until the required checks and bots are green. It never merges.
4. Then the end review: check in at the end review step with the handshake (it is the last step). When it is waived, the orchestrator decides with the person whether to review. On its `continue:`, mark the PR ready for review (`gh pr ready`).

## Post-mortem

At the end of every run (done, blocked or failed), write `post-mortem.html` in the bundle from the `documents` skill's `post-mortem` template. Link it from the PR body, add it to `bundle.json`, and publish it with the bundle. Beyond outcome, timeline, implementation, factors, surprises, verification, action items and lessons, it must have these four sections. Each says "none" explicitly when there is nothing:

- **Unexpected issues:** what surprised you, with evidence (verification rows, trace moments, logs).
- **Critical decisions:** decisions you made during the build, and any relayed to the person as Q-n → D-n, each with why.
- **Assumptions that were wrong:** each `[ASSUMPTION]` or plan premise that turned out false, what it cost, and what would have caught it.
- **Thrashing:** loops where fixing one problem caused another (bug ping-pong, flaky fixes, repeated QA rounds on one area), with the cycle and how it ended.

A run that ends `failed` also carries its stop record in the Outcome section (see Finish).

Build it from the Surprises log, the fix log and the decision log. Describe systems and decisions, never people. Use measured time and cost only.

## Finish

Run `check-bundle --stage done`, set the status file's `checks` from `verification.json`, `check_bundle`, `pr` and `head`, and report as `contract.md` says.

You own the stop decision. Before reporting `failed`, write a stop record: the failure that persists, each approach you tried and what it showed (with the verification rows and review findings involved), and why no approach remains within the approved plan. Put it in the post-mortem's Outcome section and summarise it in the status file's `failure`. Reaching a limit the person set (rounds, time, spend) is `blocked`, not `failed`: ask whether to extend it. You are done when every step ran, every J/S has a verdict, the PR's checks are green, and the end review's `continue:` has arrived.

## Quick fix

The starting message gives the task in the person's words, what "done" looks like, the branch, and the status file. No planner, no cover sheet, no control flow; the PR is still reviewed.

1. Reproduce or observe the current behaviour first. If the task turns out to need a product or design decision, or grows beyond a small, reversible change, stop and report a `needs_you` that says so; do not plan it yourself.
2. Fix it with `tdd` where a test fits, and check the real effect with `quick-verify`. For a UI change, brief the verifier for screenshots at the affected viewports and themes.
3. Run the repository's own checks.
4. Commit to the named feature branch and push, or, for new work, open a draft PR labelled `no-plan`.
5. Run the checkpoint handshake with step `quick-fix`, scope `all` and the pushed head, and wait. With no bundle, skip `check-bundle` and `verification.json`: put what you checked in the report instead. The orchestrator reviews the PR in PR mode; fix exactly what a `review: quick-fix → fix …` message sends and check in again. On `continue: quick-fix`, mark the PR ready (`gh pr ready`) if it is still a draft. On `continue: quick-fix → reviewed at <step id>`, leave the PR as it is: that later review point decides.
6. Report with what you checked and how (commands and their results, screenshots), the commit or PR, the review outcome, and anything you could not check. A short "what happened" note in the report replaces the post-mortem, unless you hit one of its four triggers (an unexpected issue, a critical decision, a wrong assumption, or thrashing); then write the post-mortem as above.

Never start a reviewer, and never merge.
