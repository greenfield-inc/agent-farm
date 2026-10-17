# Addendum template

A decision that lands while workers run goes out once, as a numbered file in the Session folder (`addenda/NN-<topic>.md`), to every worker it affects. Correct an addendum with the next number.

```
Plan addendum {N} ({date}): {topic}
Affects       {work items or lanes}; others skip it
Decisions     D-n {decision in one sentence, with its reason}
              D-n {a reversal names the D-n it supersedes}
Do            revise your plan or work to match, then report again
Source        decision log entries D-n …, from Q-n …
```

Send `addendum: <absolute path>` to each affected worker with the host's message mechanism, confirm each delivery (taken or queued), and add it to the map's addenda log. A change to an approved control flow is not an addendum: it goes to the planner as a new revision.
