# Gap page

`index.html` is the hub of the bundle, rendered with `page`. Build it from `research/reconciled.json` and `research/sources.json` only: the page adds structure, never claims. It has five sections, in this order.

## 1. Bottom line

- Status chip: `ranked`, `waiting on decisions` or `blocked`.
- 3 to 5 bullets: how many open items, how many promises are owed and how soon, the biggest mismatch, and the biggest coverage gap.
- The coverage drawing: an inline SVG with one column of sources, one of lanes, and one of results, arrows from each source to the lane that read it, and each lane marked complete (accent), thin (warn, dashed) or failed (bad, dashed).
- The frame in one line: topic, window, ranking key, ground truth.

## 2. Top 10 to do next

One card or table row per item, ranked: `G-` ID, title, entities, rank value (or "unknown"), deadline, state with its evidence, and source links. Owned items do not appear here.

## 3. Full gap table

Every reconciled item that was not dropped, one row each, with `id="<G-id>"` on the row so `index.html#G-001` resolves. Columns: ID, title, entities, type, state, mismatch, rank value, deadline, owner, verification, sources.

It must read complete with JavaScript off. Add grouped views below it as `details` sections, each listing the item IDs and titles that belong:

- by `state`
- by `mismatch` (only items with one)
- **proposed record fixes**, from `record_fixes`: record, field, current value, proposed value, evidence, and status (proposed, approved or rejected). Always shown when there are any
- when the topic produces them: **promises owed** (`promised_not_started` and `started` promises, by deadline), **shipped but not announced** (`shipped` items no source says were told to the asker), and **tracker hygiene** (stale or mismatched tracker entries)

Next to every rank value filled from primary evidence rather than the record, show its source, so the reader sees which values were reconciled.

A small script may add sorting or filtering on top. The page must not depend on it.

## 4. Coverage detail

A table of every `sources.json` entry: source, kind, account it reads as, status, lanes that read it, and, for anything not `ok`, what was unavailable and why, with the exact error. Below it, the reconciler's `gaps` list. Each `unavailable` source names the sign-in step that would fix it.

## 5. Decisions

A link to `decisions.html` with the number of open questions, and, once the person has chosen items, the hand-off command for each.

## Before sharing

Run `page`'s checks: drawings and headings orient the reader, it renders with JavaScript off, nothing is fetched, and it reads in light and dark. Then check every `#G-` anchor the page and `decisions.html` link to exists.
