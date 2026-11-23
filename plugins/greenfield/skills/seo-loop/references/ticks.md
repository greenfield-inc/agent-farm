# Scheduled ticks

A scheduled run is a tick. The loop is one long-lived orchestrator session per product, in its own host Session, and the host's scheduled runs send it the tick message. Nobody watches it: each tick works out what it is from the repository, working memory and the host, does only that, and ends with one line. The person hears from the loop only through the host's approvals and the pages they link, and their answers come back to this same session.

## Recognize a scheduled run

The run's message starts with the fixed phrase `Scheduled SEO loop tick`. That phrase is the signal; the host's environment does not mark scheduled runs. Any other start is a person's.

## Run a tick

1. **Another tick still working?** A tick message that arrives while an earlier tick in this session is still working gets one line, "Another tick is working: <what it is doing>.", and the earlier tick carries on.
2. **Pre-check.** After `git fetch origin`, run `node <seo-experiments skill directory>/scripts/due.mjs --check --repo <repo> --ref origin/<default branch>`. Keep its `memory`.
3. **Load working memory** ([memory.md](memory.md)), append this tick with `finished: null`, and reconcile it with the repository. Read the host's inbox for reports and answers that arrived while this session was down.
4. **Classify the tick**, taking the first row that applies:

| # | When | The tick |
| --- | --- | --- |
| 1 | an approval from an earlier tick is still unanswered | asks nothing new and dispatches nothing new; its line names the question and how long it has waited, and it still collects finished workers |
| 2 | an answer came back that no run has acted on | acts on it: picks become briefs and writers, access answers go into the next `.seo/` PR, an approach choice is recorded |
| 3 | items in flight | collects the finished ones and sends each to its next step (review, the person, the investigator) |
| 4 | a read came back with an unexplained drop | starts one investigator item per drop, without asking |
| 5 | reads are due | one measurer item per due read, as section 1 says; a read already in flight is not dispatched again |
| 6 | the review date has passed | the review (below), then the picks approval |
| 7 | a needed source is missing | one access approval, asked once per product |
| 8 | nothing due, no review due, nothing waiting | the quiet tick |
| 9 | anything else | one approval saying what it found, with options |

Rows 3 to 5 run together in one tick. A missed or skipped tick changes nothing: every due date is computed from the repository.

**The quiet tick** asks nothing and dispatches nothing. Its line is "Nothing due. Next: <next_due>."

**The review.** Before a full review, compare its expected cost with what changed since the last one. When no read has come back and nothing material moved (no new merged change, no drop), skip it, say so in the line, and set memory's `review_skipped_until` to one cadence later; until then the review counts as not due. Otherwise run steps 3, 7 and 8 of section 2, then put the picks to the person.

5. **Keep going while it pays.** A tick that dispatched work watches it as `orchestrate-sessions` says, until each item reports, blocks or is handed to the person. An approval is posted without blocking the session; its answer arrives as the host delivers it and is acted on then, as row 2.
6. **End.** Fill the tick's entry and write memory. Write the tick's line as the status page's summary and as the tick's last message: what this tick was, what it did, what it waits on, the next due date, and the cost of this tick and of the month so far when the host reports them. For example: "Read due: dispatched the 42-day read of 2026-10-06-retitle-pricing. Waiting on: nothing. Next: 2026-12-01. Cost $0.41 (month $3.10)."

Under a scheduled run, autonomy is fully automatic up to the picks unless `.seo/access.md` saves another level. Nothing merges and nothing is shared or published beyond the private document destination.

## Questions as approvals

Every question goes to the person through the host's approvals as one card with 2 to 4 options, exactly one recommended and listed first, each option saying what happens if chosen, and the page it concerns linked. Record its approval id in memory. A question already open is never asked again; when its facts change, update that approval in place with what changed.

| Question | Options, recommended first |
| --- | --- |
| Picks | the recommended set (up to three items, named); the next-best set; "open the ranked page and choose"; "nothing this review". The context says a short reply such as "not <item>, because …" declines an item with its reason |
| Missing source | connect it (how, and what it unlocks); continue at the current tier |
| Autonomy | fully automatic up to the picks; review pages first; choose checkpoints |
| Cover sheet | approve; revise (what to change); drop the workstream |
| Merge | merge now; leave it as a draft; close it |
| Three losses in a row | the different lever the loop names; investigate first; pause new experiments and keep measuring |
| Loop setup | weekly check; daily check; no loop |
| Anything else | what the tick found, with its options |

## Remember the picks

Record every item offered with its outcome: picked, declined (with the reason when given) or not picked. A declined item is not recommended again unless the product's own evidence changed since it was declined; then the card says what changed. An item not picked twice drops below every item never offered. Pass the picks history to the strategist with every ranked page.

## Change approach on repeated failure

The product's own results outrank the shipped case evidence.

- Two experiments of the same kind (title rewrite, new page family, internal links, schema) read as Failed or "moved with the site" on this product: the strategist stops proposing that kind and says so on the next ranked page, citing the reads.
- Three experiments in a row read that way: the tick picks nothing and sends one approval naming the pattern, with the options in the table above.

Record each change of approach in memory's `approach` with its evidence.

## Cost

Record each tick's cost from the host when it reports one. With no budget saved, cost never blocks. When `.seo/access.md` saves a monthly `budget`, a tick that would pass it asks first, with "continue this month" and "pause until next month".

## Set up the loop

At the end of a first run started by a person, when the host offers scheduled runs and neither memory nor `.seo/access.md` records a loop decision, ask once (the loop setup approval). An idle tick costs one short turn, so say that on each option. Before creating, look for a scheduled run whose Session already runs this profile on this repository, and adopt it. On weekly or daily, set it up with the host's commands, then read it back and record its id, Session, schedule and next run:

1. **The Session:** a new host Session named `SEO loop: <site>`, whose agent is `agent-farm run greenfield/seo-orchestrator:claude --directory <repo>`.
2. **The first tick:** send that Session the message below once, so it starts with its memory and a conversation.
3. **The schedule:** a scheduled run on that Session with the message below, weekly on Monday at 09:00 local (`0 9 * * 1`) or daily at 09:00 (`0 9 * * *`). Stagger sites by an hour or more so full reviews do not coincide.
4. **Unattended permissions:** when the host says the Session's agent must restart before unattended runs, restart it once (it resumes the same conversation).

The message: `Scheduled SEO loop tick for <url>. Follow seo-loop's Scheduled ticks.`

Save the decision in memory's `loop` and, in the next `.seo/` PR, a `loop` line in `.seo/access.md` (`loop: weekly`, `loop: daily` or `loop: none`), with no machine paths. A run that finds either never asks again. "No loop" is saved the same way. When the host has no scheduled runs, skip the question and print the agent command, the message and the schedule above.

When the person asks to change or remove the loop, change it in the host, read it back, and update memory and the `loop` line together.

Several sites: one loop and one Session per product repository, each with its own folder and approvals, schedules staggered. A product with no repository keeps no `.seo/` state and gets no loop.
