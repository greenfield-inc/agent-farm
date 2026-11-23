# Writing the standup brief

The reader is about to talk at standup. They are context switching, overwhelmed, may have ADHD, and don't remember yesterday. They read the closed page in ten seconds and open a toggle only when asked a question. `example.html` beside this file is an example brief with fictional work; match its shape and tone.

## The page, top to bottom

1. **Title:** `Standup · <Day> <M/D>`.
2. **Today:** one call-out line naming the single most important thing and its deadline. "Today: approve the 6 Northwind plans. Reports is late."
3. **Where the main work stands:** one row of stage boxes for the biggest workstream, done stages ticked, the current one outlined with "you are here" under it. One muted line under it says what the row covers.
4. **Timeline:** one block per workstream along a time axis, in the order it was worked, labelled in a few words ("Northwind plans", "Support triage"). The person reads it as "I started with X, then Y".
5. **What moved:** at most five lines, one per workstream, each `<strong>Workstream:</strong> outcome.` and under eight words. Each line is a `details` toggle with no list bullet beside the arrow. Opened, it shows two to four muted lines: what happened, and what's next.
6. **Blockers:** only what stops the person, each line naming who unblocks it ("Sam: review the mockups he cares about.").
7. **Goals by end of day:** the person's picks from the goals card, in their words. A send list names each recipient.
8. **Links:** the trackers and artifacts to show on screen.

## Write it this way

| Instead of | Write |
|---|---|
| One bullet per step: "Reviewed Northwind mockups, round 2", "Briefed all six" | One line per workstream: "Northwind: all 6 planned. Waiting on me." |
| Restating something settled before the cutoff: "Calling: design approved" (approved earlier) | Leave it out. Only news since the cutoff. |
| A plan's internal to-do as a blocker: "Need GitHub admin for the merge rule" | Only what blocks the person today, with who unblocks it. |
| Goals the skill guessed | Goals the person picked from the card. |
| Jargon or IDs: "D-103 folded into rev 2.1" | Plain outcome: "Reports plan fixed after the quiz." |
| A long paragraph inside a toggle | Two to four short lines. |

## Goals card

Offer three or four goal sets on one options card. Each option's label names the set in a few words, and its detail lists the goals, because the card shows only labels and details. Recommended first. Build sets from open work: plans awaiting approval, today's deadlines, open asks, drafts waiting to send. Put the pick and any note in the Goals list.

## Before sharing

- Read the closed page as the reader above: every line makes sense with no other context.
- Every "What moved" line traces to an event since the cutoff.
- The timeline order matches the event times.
- Screenshot it in light and dark, and check that no bullet sits beside a toggle arrow and nothing overflows at phone width.
