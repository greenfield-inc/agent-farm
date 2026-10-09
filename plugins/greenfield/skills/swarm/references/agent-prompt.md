# Swarm agent prompt

Every agent in a swarm gets the same skeleton, so the results line up for reconciliation.

```
Role          Read-only {research | code audit | sweep}. Change nothing: no edits, no
              commits, no tickets, no messages.
Territory     {the one chunk this agent owns: paths, requirement numbers, vendors}
              Not yours: {the neighbouring chunks}. Skip them.
Question      {what to establish for every item in the territory}
Context       {facts already settled, so the agent doesn't re-derive them}
              {decisions it must assume, and the source of each}
Method        {stale checkout? e.g. "git fetch, then read origin/main via git show"}
              {tools and sources to prefer}
Return        one table, a row per item: item | finding | status
              (exists | partial | missing | conflict) | evidence (file:line or URL)
              | confidence
              then "Looked for, not found": a bullet per item
              then "Outside my territory, worth checking": bullets
Limits        {N} words · cite every claim · mark inferences "inferred"
Output        {path to write}, or the full findings in the reply if the agent can't
              write files
```
