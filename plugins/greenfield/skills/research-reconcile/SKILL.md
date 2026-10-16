---
name: research-reconcile
description: Use when the person wants a broad, read-only sweep of every reachable source on a topic (calls, notes, CRM, billing, chat, email, tickets, trackers, code) to find everything asked for, promised, started or shipped, reconciled against ground truth into one ranked gap page. Triggers on "go through everything", "what are we missing", "reconcile X against Y", "what did we promise". Ends with the person's decisions, never with implementation.
---

# Research, reconcile, rank

Read-only lanes each own one source and write one JSON file in one shared shape. A fresh reconciler tries to break their findings against ground truth. You rank what survives, render one gap page, and ask the person what the evidence cannot settle, one question at a time.

This skill owns the content and the file shapes. `swarm` owns how the territory is split and checked, `page` owns how pages look, and `interview` owns how questions are asked.

## The bundle

One bundle per sweep, at the root `page` sets ([../page/references/bundle.md](../page/references/bundle.md)): the `docs` argument, then the workspace destination, then `tmp/greenfield/`.

```
<root>/<slug>/
  index.html            the ranked gap page (the hub)
  decisions.html        interview rounds, open questions, deferred items
  trace.html  bundle.json
  research/
    sources.json        every source: kind, account, probe, status, scope note, lanes, attempts
    prompts/<lane>.md   the exact prompt each lane received, saved before dispatch
    <lane>.json         one per lane, written only by that lane
    reconciled.json     frame, coverage, items, conflicts, dropped
```

The saved prompts are the lane registry: a lane exists when its prompt file exists. The field-by-field shapes are in [references/lane-prompt.md](references/lane-prompt.md) and [references/reconciler-prompt.md](references/reconciler-prompt.md). They are the contract every sweep shares, so do not add, rename or drop fields.

## 1. Frame

Settle these from the request and the launch context, then say them back in one short block before any lane starts. Ask only for what you cannot infer.

- **Topic:** what "done" means, for example "every open ask, promise and bug for this product in the window, against the default branch". From the `topic` argument or the message.
- **Window:** absolute dates (`YYYY-MM-DD` to `YYYY-MM-DD`). Convert "last two weeks" against today's date.
- **Ranking key:** the `rank_by` argument, such as revenue per account, patient volume, deadline, or deals blocked. It has no default: if it is missing, ask. Name where each number will come from.
- **Ground truth,** in this order unless the person says otherwise: code on the fetched default branch; then the system of record for money or volume; then a verbatim source (a transcript, a message, an email); then a tracker or CRM field; then an AI summary, which is only a lead.
- **Seeds:** items the person already named. They are where to start, not the whole answer.
- **Bundle:** its path, and the destination it publishes to.

Write the frame into `research/reconciled.json` later; until then it lives in your reply and in each saved prompt.

## 2. Inventory sources

List every reachable source before any lane starts, using [references/source-discovery.md](references/source-discovery.md). For each one, from the main session:

- Run one cheap read probe, and record the account it reads as ("who am I"). A connector signed in as one teammate silently misses everyone else's data; write that in its scope note.
- Write it to `research/sources.json` with status `ok`, `partial` or `unavailable`, and the exact error when a probe fails.
- Offer the person a sign-in step for every `unavailable` source now, then re-probe. If they decline or nobody is watching, the source stays `unavailable` and the gap page says so.

## 3. Fan out

Split by source following `swarm`: one lane per source or per concern, never two lanes on one source unless the second is a deliberate pass with a different method. Plan 5 to 10 lanes. Typical lanes, as examples only:

| Lane | Finds |
| --- | --- |
| Conversations (a call recorder, meeting notes) | requests, complaints, promises, quotes, volumes |
| Second pass on conversations | commitment and pain language in full text; older open promises |
| Value (billing, a CRM) | value per account, open deals, CRM promises and tasks |
| Async messages (chat, email) | asks and promises outside calls |
| Support and backlog (tickets, a tracker) | bugs, themes, open issues |
| Product state (code, pull requests, prior bundles) | shipped, in flight, deferred, current behaviour with file:line |
| Started, not finished | each half-built topic: on the default branch, on a branch, abandoned, not started |
| Tracker against code | tracker items matched to pull requests and branches; stale and untracked |

For each lane:

1. Write its prompt from [references/lane-prompt.md](references/lane-prompt.md) and save it to `research/prompts/<lane>.md` **before** dispatch. Each lane gets exactly the text saved.
2. Launch every lane in one batch, in the background, as your read-only lane subagent. Run at most 10 at once; queue the rest and start one as each finishes.
3. Record in `sources.json` which lanes read each source.

While lanes run, keep talking with the person. Relay each finished lane in two or three lines as it lands. Never paste a lane file into your context; read its summary and, later, the reconciled file.

**Adding a lane mid-run.** When the person, or a finished lane's `worth_checking_elsewhere`, asks for another concern, write one more prompt under `research/prompts/` and launch one more lane. Do not stop or restart the others. Every saved prompt is in the coverage.

**When a lane reports an auth failure.** Re-probe that source from the main session. If the probe works, rerun only that lane, once. If it fails again inside the subagent, read that source yourself from the main session into the same `<lane>.json` shape. If the main-session probe fails too, mark the source `unavailable` with the error and offer sign-in. Record every attempt in `sources.json`.

## 4. Reconcile

When every lane has finished or been recorded as failed, launch one fresh reconciler subagent with [references/reconciler-prompt.md](references/reconciler-prompt.md), saved first to `research/prompts/reconciler.md`. It reads every lane file and `sources.json`, re-opens sources to verify, and writes `research/reconciled.json`.

On a rerun (a lane added late, or a second sweep into the same bundle), give it the previous `reconciled.json` so matching items keep their `G-` IDs.

## 5. Rank and render

- Score each open item by the ranking key. Deadlines, then items that block something, break ties. A missing value is `unknown`, never guessed; unknowns sort after known values and become questions.
- Items the person already assigned to someone are `owned_by_person_decision`: list them, do not rank them as work to plan.
- Render `index.html` with `page`, laid out as in [references/gap-page.md](references/gap-page.md). Every item row carries `id="<G-id>"` so `index.html#G-001` resolves.
- Update `bundle.json` and publish to the destination as `page` describes.

## 6. Ask

Run `interview` with **one question per round**, recommended answer first. Ask about priority conflicts, owners, items whose state is unknown, unknown ranking values, and scope cuts. Record every round in `decisions.html` and revise the gap page in place.

When the person chooses items to take forward, end with one command per chosen item:

```sh
agent-farm run greenfield/planner --arg source=<absolute bundle path>/index.html#<G-id>
```

Moving on to planning is the person's call. This skill never files tickets, edits trackers or implements.

**Headless** (no person watching): skip the interview. Write every open question to `decisions.html`, recommended answer first, and end `blocked` with the first question, pointing at `decisions.html`. Log every default you chose as an assumption.

## Rules

- **Read-only.** Never create, update, comment on, send, react to, label, assign, close or merge anything in any external system. Write only into the bundle.
- An AI summary is a lead. It never verifies an item on its own: find the transcript, record or code it summarises.
- Never guess a number, date or owner. Mark it unknown and ask.
- Quote evidence with its source, a reference, and the account that read it.
- Keep raw dumps out of your own context. Lanes write files and return short summaries.
