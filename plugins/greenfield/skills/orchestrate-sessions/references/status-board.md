# Workstream map

One HTML page per Session for the person, published as the Session's hub and updated in place on each worker event and when the person asks.

```
Header            Session name, started, last updated, review policy (default: on "ready" or
                  at a plan's end; any override, who gave it and when), validation
                  default (deferred unless the person switched it to full),
                  workers running / queued / done, total cost and elapsed time

Needs you         the first section, and impossible to miss: one row per open Q-n
                  (Q-n | feature | role | question | recommended answer | files |
                  what is waiting on it), then plans waiting for approval, failed
                  workers with their failure summary, workers blocked with what is
                  missing, and review findings waiting on the person; "none" when empty

Order of work     inline SVG dependency graph: one node per work item, arrows for
                  "must land before", nodes coloured by stage (planning, awaiting
                  approval, implementing, PR open, in review, done, blocked),
                  grouped into waves of what can run in parallel; mark the critical
                  path. Draw it with `architecture-diagram`'s kit

Merge hot spots   file or area | work items touching it | landing order

Shared ledgers    one row per shared resource only one worker may change at a time
                  (for example the staging schema): ledger file link | rules

Addenda           N | date | decision | work items it was sent to

Lanes             one row per work item:
                  item | repo | Pane | profile | stage | plan | PR | checks (required CI:
                  green, failing or pending) | QA (passed, failed, not run) | review
                  (reviewed at <sha>, in review, not reviewed, with open Must-Fix count)
                  | unreviewed | validation (the ledger's `validation`, and what is
                  pending) | trace | destination ("no destination" when the repo names none)
                  unreviewed: "N commits since the last review at <sha>, not reviewed",
                  counted with `git rev-list --count <last reviewed head>..<PR head>`;
                  "never reviewed" with no reviewed head; "none" when they match

Other hubs        for a Session that spans destinations: a link to each stub hub,
                  with no item details copied across

Decisions log     time | item | question | answered by (brief, advisor, person) | answer

Cleanup log       time | Pane | archived, or kept with the reason Pane gave

End of run        what was done and why
                  what needs your review
                  Panes and worktrees still open, and the reason for each
                  traces collected, and any session whose trace is missing or
                  not authorized by its repository or the person
```

The last reviewed head is the ledger's `last_reviewed_head` for that PR. When the ledger has lost it, use the head in the newest `<!-- greenfield-review head=<sha> -->` marker on the PR's reviews, and record it.

Draw the graph as self-contained inline SVG with a text list of the same order beside it, readable in light and dark themes. A stub hub in another destination holds only its own items, the review policy, and a link back to the canonical map.
