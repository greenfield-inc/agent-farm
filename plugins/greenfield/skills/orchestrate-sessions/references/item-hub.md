# Item page

Every work item's front page: a planned item, a quick fix, a tweak or a PR the Session picked up. The renderer writes it as `items/<id>.html` beside the status page, in the same run, from the item's entry in the status JSON ([status-board.md](status-board.md)). Never hand-write it or edit the file; change the JSON and render again. Its card on the overview opens it.

```
Breadcrumb     the Session's title (back to the overview) › the item's group › the item
Eyebrow        its kind (Planned, Quick fix, Tweak, Picked-up PR) and group
Title          the item's name
Cover          Asked for        what the person asked for, in their words   (asked)
               What changes     what the plan package or PR changes        (changes)
               Where it stands  its state label and its next step          (stateLabel, next)
Card           the item's card from the overview, with its rail and fix rounds
Everything     Waiting       first, for each open question on it: "Q-n waits in Approvals", linked, never its wording
for this item  Plan or Task  a planned item's cover sheet and brief, linked, never copied; otherwise the starting message
               Pull request  the PR, its checks and the PR's own artifact
               QA, Review    the QA record and the findings, with the outcome or why there is none
               Decisions     every D-n about the item
               Depends on    when it waits on another item
               Worker        the worker's tab
               Trace, Post-mortem   once the review loop closes, or "no issues hit"
               Evidence      anything else it relied on
Siblings       the other items in its group, as chips
Navigation     ← previous and next → within the group, and "↑ Back to overview"
```

Plan or Task, Pull request, QA, Review, Worker, Trace and Post-mortem always show: with a link, with a short reason ("none: D-30", "not yet"), or "Not recorded" when the JSON leaves them empty, so a gap looks like a gap. Fill `refs` from the workers' status files, the findings files, the traces and the post-mortems as each appears, link only files that exist, and render again; the page is current whenever the overview is.
