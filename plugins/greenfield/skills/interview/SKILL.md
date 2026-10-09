---
name: interview
description: Use by default whenever you plan, brief, or weigh options with a person. Lead an interview that settles every open decision with structured questions, recommended answer first, and keep a living decision log until nothing material is undecided.
---

# Interview

You surface the open questions, ask them, and record the answers, so the person only answers.

## Find what is open

**Send a swarm of parallel explorer and research subagents** across the sources, code and comparable products to list everything that changes what gets built: scope, competing designs, limits, conflicts, permissions, assumptions. Settle what the evidence answers; bring the rest to the person.

## Ask

- **Show first.** Open the page the question is about.
- **Ask in rounds.** Ask 1 to 4 questions per round, most consequential first, in the format in [references/question-format.md](references/question-format.md). Use the harness's structured question tool.
- **Recommend.** Each question has 2 to 4 real options. The recommended one goes first, marked "(Recommended)", and each option gets a one-line consequence.
- **Open-ended last.** Ask for names, numbers, dates and credentials as plain text at the end of a round.
- **Clarify on confusion.** When an answer is a question or conflicts with an earlier decision, explain the trade-off and ask again. The person makes every product choice.

## Record

- Keep `decisions.html` in the bundle as in [references/decision-log-template.md](references/decision-log-template.md), rendered with `page`: one dated round per batch, reversals as new lines.
- After each round, update affected documents in place and name them.
- Under an orchestrator, running workers receive new decisions as its numbered addenda.

## Finish

Continue until every material decision is settled, then say so and list what is deferred.
