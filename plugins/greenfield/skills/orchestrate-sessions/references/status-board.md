# Workstream map

One HTML page per Session for the person, published as the Session's hub and updated in place on each worker event and when the person asks.

```
Header            Session name, started, last updated, review policy (default: once at
                  the end of the workstream; any override, who gave it and when),
                  workers running / queued / done, total cost and elapsed time

Needs you         first and impossible to miss: plans waiting for approval, failed
                  workers with their failure summary, workers blocked with what is
                  missing, must-fix review findings, and open questions with what
                  is waiting on them

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
                  item | repo | Pane | profile | stage | plan | PR | review | trace |
                  destination ("no destination" when the repo names none)

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

Draw the graph as self-contained inline SVG with a text list of the same order beside it, readable in light and dark themes. A stub hub in another destination holds only its own items, the review policy, and a link back to the canonical map.
