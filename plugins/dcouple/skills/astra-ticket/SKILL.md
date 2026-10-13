---
name: astra-ticket
description: Take a work item through Astra planning, Sol implementation, concurrent checks and focused reviews, optional Sol QA, and a final current-head PR review.
---

# Astra Ticket

Input: one work-item reference from any source; for example, a GitHub issue
URL or `owner/repo#number`, a Linear issue URL or key (`ENG-123`), or a Grain
brief link. Read and update the item with the tools its source provides
(for example, GitHub tools or `gh`, Linear MCP tools, or Grain tools); the
workflow below is the same for every source. A source with no tooling is
still valid: read it however you can and report back to the user.
When a tracker item links a Grain brief, read both, and send status, comments,
and PR links to the source that owns the item.

## Execution contract

- Verify the parent is `gpt-6-astra` using authoritative runtime/session metadata. Defaults and user assertions are not proof; stop if different or unverified.
- Use `gpt-6.1-sol` at `low` for every child except QA, which uses `gpt-6.1-sol` at `medium`. Verify support and set model/effort explicitly. Never substitute models.
- Give every child its role, ticket/plan, exact base and head SHA, workspace, skill paths, overrides, evidence destination, and output contract. Instruct every child never to archive any thread and never to merge. Only the parent may archive completed children.
- Keep one code writer and one serialized fix queue. Reviewers and evidence collectors do not edit code, commit, push, rebase, or change PR readiness. Finish branch preparation before freezing the validation SHA.
- Run independent work concurrently, using waves when slots are limited. Preserve separate reviewer contexts and assignments; do not collapse them into a single omnibus review or promise a fixed completion time.
- Keep a check/evidence ledger with command or review identity, SHA, result, and link/path. Reuse passing checks on the same SHA. On later SHAs, rerun affected checks and record why unaffected evidence remains applicable; never label an old result as a new run.
- Isolate checks and QA that mutate dependencies, generated output, native modules, app data, or ports. Isolate them inside the feature's worktree with separate ports, `PANE_DIR`/app user-data, and build output, or serialize conflicting operations; avoid Node/Electron ABI and build-output collisions. Never create another worktree or Pane on this machine for a check or QA lane; cross-machine QA follows Cross-OS Workspaces.
- Read bundled sibling skills and criteria relative to this skill. These workflow overrides take precedence; report missing requirements.

## 1. Establish intent and prepare the branch

Read the item and its comments from its source, current code, and relevant task artifacts in repo `TMP/` or `tmp/`, `$TMPDIR`, and `/tmp`. Check stale context against current evidence.

As Astra, follow `simple-plan`'s planning steps and `create-ticket`'s intent guidance. Offer `ui-mockup` for UI work and carry approved designs into the plan. Preserve the user's mockup/design decisions before implementation. Update the linked brief with intent, approach, tradeoffs, acceptance criteria, and checks; save detailed specs under task-specific `tmp/`.

Reuse Socrates' verdict while its premise and evidence hold. Otherwise dispatch fresh Sol Low [Socrates](../create-ticket/references/socrates.md). Resolve material questions with the user before coding; if existing behavior meets the outcome, finish with evidence and guidance. This workflow waives `simple-plan`'s routine approval pause once premise findings are resolved; it does not waive unresolved intent or design decisions.

Delegate implementation and fixes to Sol Low workers. Sequence dependent work. Use `prepare-pr` with explicit code/branch-preparation and draft-PR overrides; finish commits/rebase, push, and open/update the draft PR. Freeze the resulting head SHA and base for the batch. The PR may begin with an honest provisional description; its final prose and evidence are prepared below.

For deterministic low-risk copy, translations, docs, formatting, metadata, or simple config, explicitly skip the three focused internal reviews and default QA to skipped unless requested. Retain applicable checks, affected-flow tests, feedback handling, final-head CI, and the final review gate below. Assess actual risk, not file extension alone.

## 2. Start independent validation lanes

For other work, ask asynchronously whether to run end-to-end QA and state it starts after 60 seconds without a reply. Yes starts QA; no skips it. Use a timed, interruptible wait while independent lanes work; a pending question is not silence until the deadline. If timed input is unavailable, await the answer before dispatching QA, without holding up independent work.

Launch these independent assignments against the frozen SHA. The parent may monitor CI and collect automated feedback directly rather than spending child slots on polling. With limited slots, start latency-heavy checks/QA early, then fill freed slots with the remaining lanes:

- **Checks and CI, Sol Low:** run applicable repository checks and monitor required CI. Own the shared check ledger; reviewers consume its evidence instead of each repeating lint/build/test. Reviewers may request a specific missing check.
- **QA, Sol Medium, if authorized/defaulted:** use `pr-test-automation` to exercise relevant flows in an isolated environment and capture screenshots and reports. For OS-sensitive changes or cross-platform claims, use [Cross-OS Workspaces](../pr-test-automation/references/cross-os-workspaces.md), including parent-owned agent launches. Return tested SHA, failures, blockers, unverified platforms, and verified evidence links. QA does not fix code; route fixes to the parent queue. Override the delegated skill’s PR-description, comment, and shared-workspace publication steps: return draft QA Markdown plus captured media/report paths to the parent without publishing. The serialized publication owner saves the artifacts, verifies their links, refreshes the current PR body/comments, and applies the QA handoff with the final prose, preserving unrelated human edits.
- **PR prose and evidence, Sol Low:** use `prepare-pr`'s writing guidance to draft the final description, visuals, and evidence index from the ticket, diff, and available results. Override its branch/build/readiness actions for this lane. Reuse QA screenshots; do not run duplicate UI QA or capture a second screenshot set for prose. Mark pending results honestly and finalize when evidence arrives. Keep draft edits local for one serialized publication owner.
- **Correctness and data, fresh Sol Low reviewer:** inspect changed algorithms, state transitions, lifecycle/concurrency, persistence, migrations, and data loss/corruption risks. Return concrete defects and missing evidence within this scope.
- **Integration and security, fresh Sol Low reviewer:** inspect cross-module/API/IPC contracts, caller wiring, compatibility, platform/runtime behavior, permissions/trust boundaries, and security implications of changed paths.
- **Intent and test coverage, fresh Sol Low reviewer:** compare issue, approved plan/design, and acceptance criteria with actual behavior; inspect missing integration, user-visible regressions, edge cases, and whether tests prove the outcome. Consume QA evidence as it arrives without rerunning QA.
- **Automated feedback collection, Sol Low:** inspect all human/bot reviews, inline threads, check results, and expected automated-review runs; correlate each with its SHA. Distinguish completed zero-findings review from missing, pending, failed, or stale review. Return findings and review status, not a speculative pass.

Use configured roles and the bundled `review/SKILL.md` and `CRITERIA.md` for focused reviewers. Override broad duplicate checks and out-of-scope review duties with the assignments above. Each reviewer receives raw evidence and returns its own assessment before seeing peer conclusions. Report reviewed SHA, scope, findings with file/line and impact, and unresolved uncertainty. Focused reviewers return findings to the parent by default. If authorized to post a scoped review, always use `COMMENT`, regardless of account identity; never post `APPROVE` or `REQUEST_CHANGES` from a focused lane. Whole-PR judgments belong to the final holistic gate, and the PR author must still use `COMMENT` there.

## 3. Reconcile and fix once

Astra reconciles the batch: deduplicate findings, resolve conflicts against evidence, distinguish blockers from suggestions, and create one ordered fix queue. This replaces the mandatory extra serial Astra code review; the parent still owns judgment and readiness.

Delegate fixes to one Sol Low writer at a time. After each coherent fix set, push and record the new SHA. Rerun affected checks, have Sol retest affected flows when QA evidence is invalidated, and return material fixes to the relevant reviewer scope. A tiny local fix does not restart all three reviews; broaden only for changed contracts, scope, or concrete unresolved risk. New failures return to the same queue. Keep at most three remediation passes for the agreed scope. If findings persist or work expands, report the remaining blocker/decision instead of restarting an unbounded loop.

Refresh the final PR prose from verified results and reuse the same evidence links. Preserve the requested prose cold-read from `prepare-pr` as a bounded writing check, not another code review. Serialize publication and verify saved content.

## 4. Require a final holistic result on the final head

Once internal fixes, affected validation, and QA or its explicit skip are complete, mark the PR ready when appropriate. This transition may trigger automated review: inspect the resulting run and wait for its terminal result before handoff.

Require the expected automatic PR reviewer to assess the complete final diff at the current head SHA. Record reviewer/run identity, SHA, terminal status, and result. A verified completed review with zero findings is a result; no comment, an old review, a pending run, or a failed run is not. If the completed result predates fixes, request/wait for the current-head result through the supported mechanism.

If expected automation is absent or unavailable, explicitly use one fresh independent Sol Low holistic reviewer on the final diff, ticket/plan, and validation evidence; label this fallback and its reason. If neither a verified automatic result nor this fallback can be obtained, report the final gate blocked. Do not silently waive it. This final fallback also applies to the low-risk path when automatic review is unavailable.

Route actionable final-review or human/bot findings through the same fix queue. After further code changes, refresh affected validation and obtain a final holistic result for the new head. Do not repeat the whole focused batch unless the changed scope warrants it.

Before handoff, read the current head, required CI, and all feedback again. Claim ready only when required checks pass on that head, actionable feedback is resolved, and the final holistic gate has a verified result. If checks/review remain pending after five minutes, report their exact state and continue waiting where feasible; elapsed time never counts as success. Do not merge.

## Artifacts and handoff

When Grain is connected, reuse one canonical task workspace in `Development Artifacts/<org>/<repo>` unless the user chose another destination. Verify organization, folder, audience, and links; preserve workspace ID and shared folder, retain local copies, and pass storage rules to every child. Rename for the PR without replacing identity. Save QA media/reports there instead of release assets and verify publication. Without Grain, continue with the called skills' local/tracker and durable-publication contracts. Report failed or unavailable capture/publication honestly.

Extend the same intent brief with final before/after behavior, decisions, verified results, and reciprocal PR/evidence links. Return PR URL, tested/reviewed SHAs, QA/check/final-review status, the same verified evidence links, and open findings; separate future improvements from blockers. Open Grain last when connected. Only after confirming an authorized or existing merge, mark the Grain task complete and move it to the configured completed destination when supported; preserve identity/shares and report failures.
