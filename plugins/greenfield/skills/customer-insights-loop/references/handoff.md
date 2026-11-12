# Handoff and merge train

When every pick's review loop has closed or waits only on the person, write the two sections below as one handoff page in the Session artifact, following `page`. Ask the person to approve the merge order as one question (in the host's Approvals where it has them, in your chat elsewhere), with that page in its `files`; the status page shows it only by its Q-id. Then tell the person once that the batch is ready, with the handoff page's link.

## Merge order

List every PR in the order it should merge, each with why it sits there: what it depends on, which branch it stacks on, and which files it changes that another PR also changes. Put PRs that touch nothing shared first.

## Left open

List every finding left unfixed and every non-blocking question the run held back, each with its PR, its disposition (accepted, deferred to a follow-up, waiting on the person) and why.

## The merge train

Merge only on the person's word, and only the PRs they name.

1. Before each merge, tell the person the PR's state in one line (draft, CI, review).
2. Merge the PRs in the handoff's order.
3. After each merge, retarget any PR stacked on the merged branch to the default branch, and send each overlapping or stacked PR's implementer, one writer per branch: merge the base in, without force-pushing, keep both behaviors, go green, report. When a conflict needs a product decision, it stops with a question instead.
4. A base merge that resolved conflicts in code gets a follow-up review of those lines, as `orchestrate-sessions`' fix loop runs it; a clean base merge needs none. Merge that PR only once it is green and its review is current.

## Release and cleanup

On the person's word, release by the repository's own documented release process; when it documents none, ask how. Then clean up as `orchestrate-sessions` says.
