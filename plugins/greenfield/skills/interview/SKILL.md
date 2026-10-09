---
name: interview
description: Use by default whenever you plan, brief, or weigh options with a person. Lead an interview that clears every ambiguity and open decision, asking structured questions with a recommended answer first, and keep a living decision log. Use until nothing material is undecided.
---

# Interview

The person shouldn't have to read your documents to find your questions. You find them, you ask them, and you write the answers back where they belong.

## Find what is open

After reading the sources and the code, list everything that would change what gets built: unclear scope, competing designs, unknown limits, conflicts between documents, permissions you need, and assumptions you would otherwise make silently. Answer from the code or a quick check whatever you can. Only the rest goes to the person.

## Ask

- Show the page that question is about before you ask: the options page, mockup, diagram, or cover sheet section.
- Follow [references/question-format.md](references/question-format.md) on every model. Use the harness's structured question tool when it has one (multiple choice, with the person able to type their own answer). Ask 1 to 4 questions per round, grouped by topic, most consequential first.
- Every question has 2 to 4 real options. Put your recommendation first and label it "(Recommended)". Give each option a one-line consequence, not a feature description.
- Keep open-ended questions (names, numbers, dates, credentials) for the end of a round, as plain text.
- When an answer is confusing or contradicts an earlier decision, say so plainly and re-ask with the trade-off spelled out. Never quietly pick for the person.
- If they ask why, or ask to see something, show a short page (`architecture-diagram`, a trade-off table, or a mockup) and then re-ask.

## Record as you go

- Keep one `decisions.html` in the work's bundle, laid out as in [references/decision-log-template.md](references/decision-log-template.md) and rendered with `page`. Add one dated "Round N" section per batch of answers: what was decided, in a sentence each, plus links. Never rewrite earlier rounds; a reversal is a new line that names what it replaces.
- After each round, update every affected document in place (brief, options, cover sheet) and say which ones changed.
- When workers are already running on earlier decisions, the orchestrator sends them the new decisions as a numbered addendum (its numbered addenda).

## Finish

Keep going round by round until no material ambiguity is left, then say so in one line and name what is deliberately deferred. A session with nothing to ask finishes in one round.
