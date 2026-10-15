---
name: open-pr
description: Use when packages are done and a draft pull request must be opened or its description updated. Never merges.
---

# Open PR

## Commit and push

1. If you are on the default branch, create a branch before committing anything. Look at `git status` first. Stage only files this work changed, never everything at once. Leave unrelated changes alone and mention them. A secret or credential in the diff is a stop: do not commit it, and tell the person.
2. One commit per work package where practical, each with a message that says what changed and why. Clean-up is its own commit.
3. Fetch and rebase onto the base branch. Resolve mechanical conflicts. Ask about any conflict that changes meaning.
4. Run the build and the plan's whole-feature check after the rebase.
5. Push the branch. Force-pushing is on the ask-first list. After your own rebase of your own branch, `--force-with-lease` is acceptable. Nothing stronger, and never on a shared branch.
6. If a pull request already exists for the branch, update that one.

## Open it as a draft

Open the pull request as a draft and keep it a draft until the review is accepted. Never merge. Link the brief, the plan cover sheet, and the issue or bug report.

When the work had no plan, because the source was a one-line task, add the label `no-plan`, creating it if the repository lacks it, and make the first line of the description "No plan was written for this change." If you cannot add a label, the first line is enough.

## The description

Write for a reader with no context. Lead with why, then what, then the proof.

```
## Why
The problem, for whom, and the outcome wanted. One short paragraph, from the brief.

## What changed
The approach in plain language, then the changes in dependency order:
what each part does and why it is there. Before and after examples where they help.
Decisions that were locked in the plan, with the link.

## How it was verified
Each check: command, journey, or visual, with its result and the evidence.
Link qa's screenshots and videos. Say plainly what is undetermined or left to a person.

## Assumptions and limits
Small choices made along the way. Known gaps. Anything deferred, with its trigger.

## Review
Reviewers' verdicts, must-fix items and how each was resolved, disputed items, open notes.

## Clean-up
What was removed after review, what was left and why, and where the evidence lives.
```

Every claim in the description must be true of the current commit. Evidence gathered on an earlier commit supports only what did not change since: say which commit each check ran on, and never write a pass you did not see. If the brief does not say why the work was wanted, say the motivation was not supplied. Keep any sections or closing lines the repository requires. Read the pull request back after saving it and check the links work. If it is large, say so at the top and suggest how to read it.

## After a failed run

Keep it a draft. Put a failure summary at the very top: what is still open with evidence, what was tried, which checks are undetermined and why, and the likely cause. Leave the evidence in place.
