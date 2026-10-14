---
name: teach
description: Checks how well the person understands a feature's pull requests - maps them as an iceberg with evidence, quizzes the person one question at a time through the orchestrator relay, grades each answer, and publishes the learning page and the interactive iceberg. Never blocks merging. Used by the bigbrain teacher.
---

# Teach

An opt-in check the orchestrator offers once per feature, when its PRs are ready for the person's review. The person ends up knowing what the work changes, what it rests on, and where to look; the learning page keeps that map, coloured by what is still unclear. You talk to the person only through the relay: every question is a `needs_you` (`contract.md`), and their words come back as `answer: Q-n → …`.

Your starting message names the PRs, the bundle, the cover sheet and your status file.

## 1. Map the iceberg

Read the PR bodies, the cover sheet and decision log, the diff against each base, the verification page, and the findings files. Back every claim with a file:line, commit or query; use `explorer` only for a large diff. Before a question depends on how a library or provider behaves, check its docs or code.

- **Above water:** each new piece, one plain sentence, citing its P-n.
- **Below water:** for each new piece, the existing system it builds on, by name. A piece with nothing below it made its own pattern: treat it as a decision.
- **Decisions:** the option taken, the alternative, the trade-off and who it affects, citing the D-n when the decision log has it.
- **Hotspots:** for each, what the PRs do, or "Not touched": data source, hierarchy (which setting or permission wins), deploy and old clients, schema and data, infra (crons, workers, queues, env vars, secrets), and anything added after the plan.
- **Simplify:** schema, helpers, settings or layers the feature could drop, with the simpler shape.

Write the whole feature in one sentence from the foundation up ("Jot already styles every page from CSS variables; dark mode adds a second set of values and a header switch").

## 2. Quiz through the relay

- Rank candidate questions by how likely the situation is in real use times the harm of a wrong answer; drop the unrealistic. Hotspots first, then decisions, then simplification. Size the count to the change: 3–5 under 800 changed lines, 5–8 up to 2,000, 8–12 above (tests, lockfiles and generated or copied files excluded).
- Send **one question at a time** as a `needs_you` of kind `quiz`: the question, its `why` (the production consequence of a wrong answer), no options and no recommended answer, and the files to open in `files` (a diff excerpt saved under `learning/`, a mockup, the cover-sheet card). For a UI change without screenshots, save a text mockup and attach it. Wait for the answer; keep building the map meanwhile.
- Grade each answer: right, partly right, wrong or unsure. For partly right or wrong, the next `needs_you` (kind `quiz`) carries the correction with its evidence in `why`, and its question is for the person to explain it back in one sentence. Record what they say. A correct follow-up question counts as the explain-back.
- When an answer shows the map is wrong, correct the map and say so in the next message.
- When the person waves a kind of question off as obvious, ask no more of that kind. Stop early when they ask to.
- After each graded answer, add an `fyi` line for the map (question, verdict) so the orchestrator can show progress without interrupting.
- A finding that needs a decision (fold in now, file an issue, or accept) is a `needs_you` of kind `choice` with two to four options, the recommended first, each with its trade-off and rough size; that answer becomes a D-n. You never change code: a fold-in goes back through the orchestrator to the PR's implementer.

## 3. Colour the map

After the quiz, give every piece, existing system, decision and hotspot one colour for how well the person understands it now: **green** (right without help), **yellow** (partly right, or wrong then explained back), **red** (still wrong or unsure, or the code itself is ambiguous; an item they knowingly accepted stays red with "Accepted risk:" and the reason), **grey** (not asked). In the data these are `green`, `yellow`, `red`, `untested`, and `untouched` for a hotspot the PRs do not touch. An item takes the worst colour of the questions that tested it. One sentence on why each item got its colour.

## 4. Deep dives

After the quiz, so it is not an open book, every item gets: **in plain words** (an everyday comparison, then what really happens), **how it connects** (numbered steps with file:line), **in this codebase** (real names), **where it lives** (links to the head commit), **trade-offs** for decisions, and **what to watch**. Go deepest on red and yellow items and on touched hotspots. Simple words never mean vague claims.

## 5. Publish

All under `learning/` in the bundle:

1. **`learning/data.json`**: the iceberg data, in the shape [references/worked-example.md](references/worked-example.md) shows (`pr`, `prs`, `summary`, `items`, `edges`, `quiz`, `simplify`, `actions`), with each quiz entry's `q` prefixed by its Q-n and each item citing the P-n, D-n and F-n it relates to.
2. **`learning/iceberg.html`**: copy [references/iceberg-template.html](references/iceberg-template.html) and replace only the JSON in its `understanding-check-data` block with `data.json` (write every `<` inside strings as `<`). It is the interactive map and needs JavaScript.
3. **`learning/learning.html`**: the checked page, from the `documents` skill's `learning` template: the one-sentence summary, the iceberg as a static drawing with every item and its colour, the deep dives, the quiz with each Q-n, verdict and correction, simplification, and "Before you merge" (fold in, issue, accept). It links to `iceberg.html` for the interactive view.

Add both pages to `bundle.json`, run `check-bundle`, and publish with the bundle; keep it private. Link the learning page from each PR body. Open the iceberg and click a red item and a green one to check the deep dives open and the colours match the quiz; without a browser tool, say it was not checked.

Then set your status to `done` with the learning page's path, the red and yellow items, and the action items, and report. The orchestrator shares the link and adds the red items to the map's "Needs you". The check never blocks merging. On a rerun, update the same pages and ask only about what changed.
