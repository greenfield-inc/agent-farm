# Shared ledger template

A Markdown file in the Session folder for any resource that only one worker may change at a time, such as a staging database schema, a shared test account, or seeded fixtures. Prefer a host lock when the host has one. Use a ledger when the history needs to be visible.

```
# {Resource} ledger: {Session}

Rules ({date}, approved by {who})
- Allowed: {for example additive DDL only: new tables, columns, indexes}
- Not allowed without the person: {for example drops, renames, production}
- One change at a time across all workers: if a row says `applying`, wait
- To change: append a row as `applying`, make the change, set `done` or
  `failed` with a note, then report to the Session

| UTC time | Worker / lane | PR or package | Change summary | Status |
|---|---|---|---|---|
```
