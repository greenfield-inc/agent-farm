# Lane prompt

Every lane gets this skeleton, extended from `swarm`'s agent prompt ([../../swarm/references/agent-prompt.md](../../swarm/references/agent-prompt.md)), so every lane file has the same fields. Fill each `{…}`, save the result to `research/prompts/<lane>.md`, and send exactly that text.

```
Role          Read-only lane "{lane}". Read and report only.
Forbidden     Never create, update, comment on, reply to, send, react to, label,
              assign, close, merge, archive or delete anything in any system.
              Never change sign-in or connection settings. Never write any file
              except {bundle}/research/{lane}.json.
Topic         {the frame's topic, verbatim}
Window        {YYYY-MM-DD} to {YYYY-MM-DD}
Source(s)     {sources.json id(s)}: {kind}, reads as {account}. {scope note}
Tools         {the exact tools or commands to use for this source}
Territory     {what this lane owns}. Other lanes own: {lane: territory, ...}
Seeds         {items the person named; names, accounts and terms to watch for}
Ground truth  code on the default branch > system of record for money or volume
              > verbatim source > tracker or CRM field > AI summary (a lead only)
Rank inputs   {rank_by}: record the value for each item in value_inputs, with
              its source, or null. Never estimate. A CRM, tracker or billing
              value is a claim: record it as found; the reconciler checks it
              against primary evidence. When this lane reads primary evidence
              of a value (a quote sent, a number said on a call), record that
              too, with its own source.
Method        {how to read: every transcript in full, not its summary; git fetch
              then git show origin/<default>:<path>; one record at a time}
Auth          If a tool fails to authenticate, stop. Write the lane file with
              that source "unavailable" and the exact error, and return.
Output        Write {bundle}/research/{lane}.json in the shape below, and nothing
              else. Then return at most 120 words: counts, the 3 most important
              items, and anything unavailable.
```

## The lane file

Every lane writes the same fields. Unknown values are `null`, never omitted.

```json
{ "lane": "", "generated": "", "window": { "from": "", "to": "" },
  "sources_read": [ { "source": "<sources.json id>", "account": "", "status": "ok|partial|unavailable", "count": 0, "error": null } ],
  "items": [ {
    "id": "<lane>-<n>",
    "entity": { "name": "", "kind": "customer|org|team|person|system" },
    "type": "request|bug|promise|deliverable|integration_need|decision|risk|other",
    "title": "", "description": "", "date": "YYYY-MM-DD",
    "last_activity": "real last activity, not a bulk 'updated' stamp",
    "evidence": [ { "source": "", "ref": "url|file:line|record id", "account": "",
                    "kind": "verbatim|record|code|summary", "quote": "", "speaker": "", "at": "" } ],
    "deadline": null, "blocks": null, "owner": null,
    "claimed_status": "what the source itself says, or null",
    "value_inputs": { "<rank_by input>": { "value": null, "source": null } } } ],
  "searched_absent": [], "worth_checking_elsewhere": [] }
```

## Annotated example item

A made-up item from a conversations lane, with a note on each field. The names are placeholders.

```jsonc
{
  "id": "calls-3",                        // <lane>-<n>, unique within the lane
  "entity": { "name": "Example Co", "kind": "customer" },
  "type": "promise",                      // we said we would do something
  "title": "Export appointments to CSV",
  "description": "Asked for a CSV export of appointments; we said it would ship this month.",
  "date": "2026-10-02",                   // when it was said, not when it was logged
  "last_activity": "2026-10-09",          // last real follow-up, not a bulk sync stamp
  "evidence": [
    { "source": "calls",                  // the sources.json id
      "ref": "https://recorder.example/meetings/123#t=14:05",
      "account": "ops@example.com",       // whose account read it
      "kind": "verbatim",                 // verbatim | record | code | summary
      "quote": "We'll have the CSV export out before the end of the month.",
      "speaker": "Our account manager",
      "at": "2026-10-02T15:14:05Z" }
  ],
  "deadline": "2026-10-31",               // only when a source states one
  "blocks": null,                         // what it holds up, if a source says
  "owner": null,                          // only when a source names one
  "claimed_status": null,                 // what the source says, e.g. "done" in a tracker
  "value_inputs": { "monthly revenue": { "value": null, "source": null } }  // unknown, not guessed
}
```

`searched_absent` lists what the lane looked for and did not find ("no transcript for the 2026-10-05 meeting"). `worth_checking_elsewhere` lists leads for other lanes or a new lane.

An item whose only evidence has kind `summary` is a lead: keep it, and say in `description` that it is unverified.
