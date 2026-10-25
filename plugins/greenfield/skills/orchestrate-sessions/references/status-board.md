# Session status page

One HTML page per Session for the person (the workstream map), published as the Session's hub. It always says what is next. It is written and opened beside the person at the first dispatch with the host's show-page mechanism, without asking. Update it in place at each material change (a worker report, a decision, a PR opened, reviewed or merged) and when the person asks; it is refreshed in the same tab, never opened in another. The local copy carries `<meta http-equiv="refresh" content="60">` so an open copy reloads itself every minute.

```
Header            Session name, started, last updated, review policy (default: on "ready" or
                  at a plan's end; any override, who gave it and when), validation
                  default (deferred unless the person switched it to full),
                  workers running / queued / done, total cost and elapsed time

Next step         one line under the header, not a section: the single most useful
                  next action in the Session and who takes it ("You: answer Q-4", "Implementer: fixing F-2 on PR #12"),
                  the same line your last progress message ended with

Needs you         the first section, and impossible to miss: one row per open Q-n
                  (Q-n | feature | role | question | recommended answer | files |
                  what is waiting on it), each row linking where its context lives
                  (its files, or its "Context:" line), then plans waiting for
                  approval, failed workers with their failure summary, workers
                  blocked with what is missing, and review findings waiting on the
                  person; "none" when empty

Items             one card per work item still in flight, in the order of work.
                  The card's title is the item's name and links its front page:
                  its brief when it has a bundle, otherwise its hub
                  ([item-hub.md](item-hub.md)). The card shows:
                  stage | repo | Pane | profile | plan | PR | checks (required CI:
                  green, failing or pending) | QA (passed, failed, not run) | review
                  (reviewed at <sha>, in review, not reviewed, with open Must-Fix count)
                  | unreviewed | validation (the ledger's `validation`, and what is
                  pending) | destination ("no destination" when the repo names none)
                  unreviewed: "N commits since the last review at <sha>, not reviewed",
                  counted with `git rev-list --count <last reviewed head>..<PR head>`;
                  "never reviewed" with no reviewed head; "none" when they match
                  links, as they exist: the PR's own artifact, findings, post-mortem
                  (or "no issues hit" once its review loop closed cleanly), trace
                  Next: <the item's next step and who takes it>

Order of work     only when at least one item depends on another (an item's
                  `depends_on` in the ledger); otherwise leave the section out.
                  Inline SVG dependency graph: one node per work item, arrows for
                  "must land before", nodes coloured by stage (planning, awaiting
                  approval, implementing, PR open, in review, done, blocked),
                  grouped into waves of what can run in parallel; mark the critical
                  path. Draw it with `architecture-diagram`'s kit

Merge hot spots   only when items depend on each other; otherwise leave it out.
                  file or area | work items touching it | landing order

Shared ledgers    one row per shared resource only one worker may change at a time
                  (for example the staging schema): ledger file link | rules

Addenda           N | date | decision | work items it was sent to

Done              every completed item's card (PR merged or closed, plan abandoned),
                  with its outcome and the same links, newest first; a card moves
                  here and is never removed

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

Link only pages that exist, with relative links inside the Session artifact, and check each local link before publishing. The ledger's `next` and `front_page` for each item feed its card.

The last reviewed head is the ledger's `last_reviewed_head` for that PR. When the ledger has lost it, use the head in the newest `<!-- greenfield-review head=<sha> -->` marker on the PR's reviews, and record it.

Draw the graph as self-contained inline SVG with a text list of the same order beside it, readable in light and dark themes. A stub hub in another destination holds only its own items, the review policy, and a link back to the canonical map.
