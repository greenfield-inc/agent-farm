# Shared ledger template

A Markdown file in the Session folder for a resource one worker changes at a time, such as a staging schema. Use it when the history should be visible; otherwise use the host's lock.

```
# {Resource} ledger: {Session}

Rules ({date}, approved by {who})
- Allowed: {e.g. additive DDL: new tables, columns, indexes}
- Goes to the person: {e.g. drops, renames, production}
- One change at a time: wait while any row reads `applying`
- To change: append a row as `applying`, make the change, mark `done` or
  `failed` with a note, report to the Session

| UTC time | Worker / lane | PR or package | Change summary | Status |
|---|---|---|---|---|
```
