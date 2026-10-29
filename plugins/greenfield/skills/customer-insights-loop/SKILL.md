---
name: customer-insights-loop
description: "Turn a product's own usage data into a batch of reviewed pull requests. Asks how hands-on the person wants to be, corrects the numbers, ranks product directions with mockups and competitor context, settles every pick in one sitting, then builds the picks in parallel and hands back all PRs with a merge order. Use for 'what should we build next, and build it', 'use our analytics to find what to fix', or before a long unattended run."
---

# Customer insights loop

You take one product from its own data to a batch of reviewed pull requests. You run stages 0 to 4 yourself with read-only helpers; stage 5 is `orchestrate-sessions` as it ships; stage 6 hands everything back at once. All research goes into one bundle in the document destination the repository's workspace instructions name, following `page`, and the Session's status page links it.

Read the product's code from a copy at a pinned commit. Read every data source read-only. Read secrets from the environment at use and never print them.

## 0. Autonomy

Before stage 1, ask how hands-on the person wants to be, with these three options, and record the answer in the ledger as `autonomy`. Stop at every checkpoint the answer keeps. Confirm it in the picks sitting before the fan-out.

| Level | What runs without the person | Where it stops |
| --- | --- | --- |
| Fully automatic | Plans proceed to build, in-scope findings are fixed, PRs return together | This question, the picks, blocking questions, the merge word |
| Review plans first | Research, directions, builds after approval, fixes | Adds: each plan before its implementer starts |
| Choose checkpoints | Everything not checked | Any of: after research (stages 1 and 2 done), after directions, per plan, per PR |

In the same round, ask for the study questions and the competitors to compare, offering stage 2's default set as the recommended answer. With no answer, wait: read no data and launch no helper or worker until the person answers.

```json
"autonomy": { "level": "fully automatic | review plans first | choose checkpoints",
              "checkpoints": ["after research", "after directions", "per plan", "per PR"],
              "set_by": "<who answered>", "time": "<ISO time>" }
```

## 1. Ground truth

Follow [references/ground-truth.md](references/ground-truth.md). Every number anyone sees from this run comes from its corrected query set.

## 2. Studies

Run one read-only helper per study question with `swarm`: `investigator` for questions the data and code answer, `researcher` for competitors and the market. Add one per competitor the person names or a quick search finds. The default question set is activation, power users, reliability, the website or funnel, and instrumentation gaps. Every study reuses stage 1's query set and links the queries it ran. Lay out each report as [references/directions.md](references/directions.md) says.

## 3. Directions

Write one directions page laid out as in [references/directions.md](references/directions.md). Give each direction one illustrative Today and Proposed mockup, using `ui-mockup`'s HTML method; full mockup rounds belong to each pick's planner later. Rank by impact the product's own data shows, then competitive gap, then effort, adjusted by the priorities the person states.

## 4. Picks

With `interview`, settle in one sitting: the directions page's decisions, which directions to build, the concurrency cap, and the autonomy confirmation. Record every answer as a D-n.

## 5. Fan-out

Hand each pick to `orchestrate-sessions` as one work item. Its starting message links its direction card and the D-n that apply. Under fully automatic, the starting message records the person's pre-approval of plans and `Human review: none` as their explicit choice, and the planner writes that review line on the cover sheet; under the other levels, the normal approval gates stand.

**Quiet until handoff.** Under fully automatic, message the person only for a blocking question, a health failure the run cannot recover from (the host still down after three wake-ups, or too little disk to launch any pick), and the handoff. Start the watcher without asking. Everything else `orchestrate-sessions` would bring to the person (out-of-scope and approach/scope findings, thrash pauses, post-mortem issues, the `pr-understanding-check` offer) waits for the handoff with its recommended answer, and the PR it belongs to counts as waiting on the person. The status page stays current throughout.

## 6. Handoff

Follow [references/handoff.md](references/handoff.md): every PR comes back together, with a merge order and everything left open.
