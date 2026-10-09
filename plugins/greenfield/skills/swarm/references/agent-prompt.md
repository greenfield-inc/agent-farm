# Swarm agent prompt

Every agent gets the same skeleton, so results line up for reconciliation.

```
Role          Read-only {research | code audit | sweep}. Read and report only.
Territory     {the one chunk this agent owns: paths, requirement numbers, vendors}
              Neighbouring chunks belong to other agents: {list}
Question      {what to establish for every item in the territory}
Context       {settled facts and decisions to assume, each with its source}
Method        {how to read: e.g. "git fetch, then git show origin/main:<path>"}
              {sources to prefer}
Return        one table, a row per item:
              item | finding | exists | partial | missing | conflict | evidence
              (file:line or URL) | confidence
              then "Searched, absent" and "Worth checking elsewhere"
Limits        {N} words · cite every claim · mark inferences "inferred"
Output        write to {path}, or return the full findings in the reply
```
