# Reconciler prompt

One fresh reconciler runs after the lanes. Fill each `{…}`, save the result to `research/prompts/reconciler.md`, and send exactly that text.

```
Role          Read-only reconciler. Your job is to break the lanes' findings.
Forbidden     Never create, update, comment on, reply to, send, react to, label,
              assign, close, merge, archive or delete anything in any system.
              Never write any file except {bundle}/research/reconciled.json.
Frame         topic {…}; window {from} to {to}; rank_by {…}; ground truth
              code on {default branch} > system of record for money or volume
              > verbatim > tracker or CRM field > AI summary (a lead only)
Inputs        {bundle}/research/sources.json, every {bundle}/research/<lane>.json,
              and the saved prompts in {bundle}/research/prompts/
Prior IDs     {path to the previous reconciled.json, or "none"}
Steps         1. Dedupe across lanes into one item list. Each item cites every
                 lane item it merges (lane_items).
              2. Reuse a prior G- ID when an item matches a prior one; give new
                 items the next free number. Never renumber.
              3. Verify: re-open the source for every item that could reach the
                 top 10, and confirm quote, date and number. Mark verified,
                 reported (not re-opened), downgraded (partly holds) or dropped
                 (does not hold), with a note. Summary-only evidence cannot be
                 verified on its own.
              4. Set each item's state against ground truth. Run git fetch and
                 read the default branch with git show / git grep; cite file:line,
                 PR, branch or tracker ref. Flag every tracker-versus-code
                 mismatch.
              5. Reconcile systems of record before ranking. For every CRM,
                 tracker or billing value an item's state or rank depends on,
                 check it against primary evidence (calls, sent quotes, code on
                 the default branch, billing). Where the record is missing a
                 value or contradicts the evidence, use the evidenced value and
                 add a record_fixes entry. Never write to the record.
              6. Attach the rank value, reconciled as in step 5, with its
                 source; otherwise unknown: true.
              7. Hunt coverage gaps: accounts with value but no asks, meetings
                 with no transcript, promises with a date but no owner, sources
                 that were unavailable, lanes that came back thin.
              8. List conflicts between lanes, and between lanes and ground truth.
Output        Write {bundle}/research/reconciled.json in the shape below. Return
              at most 150 words: item counts by state, how many verified,
              downgraded and dropped, and the biggest coverage gaps.
```

## reconciled.json

```json
{ "frame": { "topic": "", "window": { "from": "", "to": "" }, "rank_by": "", "ground_truth": [], "seeds": [] },
  "coverage": [ { "source": "<sources.json id>", "account": "", "lanes": [], "status": "complete|thin|failed", "note": "" } ],
  "gaps": [ { "kind": "value_no_asks|meeting_no_transcript|promise_no_owner|source_unavailable|thin_lane|other", "detail": "" } ],
  "items": [ {
    "id": "G-001",
    "title": "", "entities": [], "type": "",
    "lane_items": ["calls-3", "crm-12"],
    "verification": "verified|reported|downgraded|dropped", "verification_note": "",
    "state": "shipped|shipping|started|promised_not_started|not_started|unknown",
    "state_evidence": "default-branch file:line, PR, branch or tracker ref",
    "mismatch": null,
    "owner": null, "owned_by_person_decision": false,
    "rank": { "key": "<rank_by>", "value": null, "source": null, "unknown": true },
    "deadline": null, "blocks": null, "score": null } ],
  "record_fixes": [ {
    "id": "F-001", "items": ["G-001"],
    "system": "<sources.json id>", "record": "url|record id", "field": "",
    "current": null, "proposed": null, "kind": "missing|contradicted",
    "evidence": [ { "source": "", "ref": "", "kind": "verbatim|record|code", "quote": "" } ],
    "status": "proposed" } ],
  "conflicts": [ { "items": [], "detail": "", "resolved_by": null } ],
  "dropped": [ { "lane_item": "", "reason": "" } ] }
```

States: `shipped` is on the default branch; `shipping` is an open pull request; `started` is a branch or partial code; `promised_not_started` is a promise with no code; `not_started` is an ask with no promise and no code; `unknown` needs a question. `mismatch` says what disagrees, for example "tracker says done, default branch has no handler", or is `null`. `rank.source` names the primary evidence when a record was missing or contradicted. A `record_fixes` entry is only a proposal: its `status` stays `proposed` until the person approves or rejects it in `decisions.html`, and nothing in the sweep writes it. Evidence of kind `summary` cannot support a fix. Dropped items stay in `dropped` with the reason, so a rerun does not bring them back silently.
