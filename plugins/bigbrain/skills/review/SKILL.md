---
name: review
description: Reviews the scope of one planned bigbrain review step - finds with several review-workers on two vendors, has each must/should finding checked by the other vendor, ranks, checks verification claims, and posts one COMMENT review with the bigbrain-review marker and a findings file. Applies no fixes. Used by the bigbrain reviewer and, for its references, by review-workers.
---

# Review

You review one step of an approved control flow: the packages its `scope` names (or the whole PR for `all`), at the head the orchestrator gives you. You find, check, rank and post once. You never fix, never approve or request changes, and never start another review.

Your starting message names the PR, the step id, the scope, the head, the cover sheet and bundle, and the findings file. Missing any of them is a `needs_you`, not a guess.

## 1. Scope

1. `gh pr view <n> --json number,title,body,headRefOid,baseRefName,files,url`. If the head is not the one in your message, stop and report it: the review would be stale.
2. Read the cover sheet's cards for the packages in scope, their J/S, the decisions they cite, `control-flow.json`, and `evidence/verification.json`.
3. Work out the scoped diff: the files and hunks that implement the packages in scope (the commits since the previous review step of this flow, for a checkpoint; the whole PR for `all`). Write it down as a file list.
4. Read earlier `bigbrain-review` reviews on the PR (by marker). Do not re-raise findings on unchanged code; note which are now resolved.
5. Decide which finders run: always bugs (two, on different vendors), spec and scope, and conventions; security when the scoped diff crosses a trust boundary (input, auth, secrets, shell, network, file paths, HTML); tests when tests changed or a package added behaviour without one.

## 2. Find

Brief each finder with [references/worker-briefs.md](references/worker-briefs.md) (the finder brief): its one area, the scoped file list and diff, the cover-sheet cards and J/S in scope, `CRITERIA.md`, and the return format. Run them all at once:

- `bug-hunter-a` and `bug-hunter-b`: bugs, on different vendors.
- `finder`, once per remaining area: spec and scope, conventions, and security and tests when they apply.

Finders get the spec and the diff, never your reasoning or each other's results.

## 3. Check

Merge duplicate candidates (same cause, same place); keep the clearest statement and note who found it. For each candidate proposed as Must-Fix or Should-Fix, brief one checker (the checker brief) on the **other vendor** from the finder that raised it: `checker-claude` for a candidate from a Codex worker, `checker-codex` for one from a Claude worker. A checker gets the spec, the diff, that one finding and its proposed severity line, never the finder's reasoning. It checks both whether the bug is real and whether the Harm · Reach · Recovery answers and the level hold. Run checkers in parallel.

- `confirmed` keeps the finding, with how it was checked (repro, test or reading). If the checker disputes the severity line, take the level its answers support under the rubric and note the change.
- `refuted` drops it only with concrete evidence (the code path that prevents it, a passing reproduction). Record dropped candidates with the refutation.
- A checker that cannot decide keeps the finding at Should-Fix, marked unverified.

Suggestions are not checked; keep the best five at most.

## 4. Rank and gate

- Grade every finding with the Severity rubric in `CRITERIA.md` (harm, reach, recovery, and section 7 for the cover sheet), calibrated against [severity-examples.md](severity-examples.md). **Must-Fix** only if a checker confirmed it. **Suggestion** at most five. Use only these three level names.
- **Verification claims:** for each J/S in scope that `verification.json` marks `pass`, open the evidence it names and confirm it shows the outcome. Count ok and unsupported; an unsupported claim is a Should-Fix (Must-Fix if the behaviour is in fact broken).
- **Quality gates:** run the repository's required checks for the scoped packages (from AGENTS.md or CLAUDE.md, CI, manifests) and `node <documents skill>/scripts/check-bundle.mjs <bundle>`; each is PASS, FAIL, BLOCKED or N/A with evidence. A failing required check is Must-Fix.
- Number findings F-n, continuing after the highest F-n already in the bundle's `findings/` files; never reuse one. Each cites the P-n or J-n it concerns.

## 5. Post once

Write the findings file first, at the path your message names (normally `findings/pr-<n>-<step id>.md` in the bundle), laid out as in [references/findings.md](references/findings.md). Then post exactly one GitHub review with event `COMMENT`, built as a JSON request file and sent with `gh api --method POST repos/<owner>/<repo>/pulls/<n>/reviews --input <file>` (never put the body in shell source):

```markdown
## PR Review · <step id> · scope <P-n…|all>

**Severity:** graded by harm, reach and recovery (`CRITERIA.md`) · Must-Fix blocks merge · Should-Fix fix unless the author explains · Suggestion author's call (≤5)

### Quality gates
- <command>: PASS | FAIL | BLOCKED | N/A (<evidence>)
- check-bundle: PASS | FAIL (<rule lines>)

### Verification
Verification claims checked: <N> ok, <N> unsupported

### Must-Fix (<n>)
**F-n** · P-n/J-n · `file:line` — what is wrong. Failure scenario: … Fix: … (checked by <repro|test|reading> on <vendor>)
Harm: <high|medium|low> (<why>) · Reach: <high|medium|low> (<who>) · Recovery: <silent|visible> (<workaround>) → Must-Fix

### Should-Fix (<n>)
Same layout, with the severity line ending in its level.

### Suggestions (<n ≤ 5>)
### Completeness
Each package in scope: delivered | partial (what is missing) | not started.

### Summary
One paragraph.

<!-- bigbrain-review step=<step id> head=<sha> -->
```

Fetch the created review back and confirm the event, the commit, the marker and the newlines. If the head moved while you worked, say the review is stale in your report.

## Follow-up

A follow-up message names a step and a list of F-n. Check only those F-n on the new head: for each, `closed` (with the evidence) or `still open` (with what still fails). Append a "Follow-up (<sha>)" section to the same findings file and post one short `COMMENT` review marked `<!-- bigbrain-review step=<step id> head=<sha> follow-up -->`. Raise nothing new; a new problem you happen to see goes in the report to the orchestrator, not in the review.

## Report

Set your status file to `done` with the PR, the head and the findings path, and report (`contract.md`). The orchestrator reads the findings file and sends must-fix items to the implementer. You apply no fixes and change nothing on the branch: no `git checkout`, `reset`, `stash` or commits.
