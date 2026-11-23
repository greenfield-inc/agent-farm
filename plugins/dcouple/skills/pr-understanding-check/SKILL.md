---
name: pr-understanding-check
description: Optional check, offered when a pull request or a feature's set of pull requests is ready for the person's review, or when a plan is ready and before the person approves it for building. Map what is new and what it builds on as an iceberg, quiz the person one question at a time, and publish an interactive iceberg in Grain where every piece is colored by how well they understand it and opens into a plain-language deep dive. On a plan or brief it also reviews the plan, tables first, and interviews the person on each finding. Use when an orchestrator or implementer offers it and the person says yes, or when the person asks for it ("quiz me on this PR", "plan understanding check", "review this plan").
argument-hint: "[PR number, branch, a feature's PRs, or a plan or brief path or link]"
---

# PR understanding check

An opt-in check on one of two targets, run only when the person says yes. Work goes on while the person declines or has not answered. On a plan the person checks, approval follows the interview.

- **A PR.** Offer it once, when a pull request is finished (checks, agent review and QA done) and before the person's own review. For a feature built across several pull requests, map them as one iceberg.
- **A plan.** Offer it once on the plan cover sheet, after the plan is written and before the person approves it and building starts. Run it on a brief only when the person asks for a check before planning.

The person ends up knowing what the work changes, what it rests on, and where to look. The page keeps that map for later, and its colors show what is still unclear. Every "For a plan" rule applies to a brief too and replaces the PR rule.

## 1. Map the iceberg

For a PR, read the PR body, its ticket or plan, the diff against its base, and the review and QA notes. For a plan, read it in full with the files it links, its brief, its decision log, its mockups and any linked research, then the code it names on the target repository's default branch. Back every claim with a file:line, commit or query.

For a plan, the iceberg maps the proposal instead of a diff: above water is each piece the plan asks for, and below water is the code it builds on today. Check every hotspot against both the plan and the code; a hotspot the code shows the work needs but the plan leaves out is a finding.

- **Above water.** Each new piece, one plain sentence each.
- **Below water.** For each new piece, the existing system it builds on, by name. A piece with nothing below it created its own pattern: mark it and treat it as a decision.
- **Decisions.** Each design choice: the option taken, the alternative, the trade-off, and who it affects in the real world. When data can size the impact (for example, how many admins have muted chats today), run a read-only query or analytics lookup with access you already have and give the number; without access, name the query that would.
- **Hotspots.** Check every row and record what the PR or plan does, or "Not touched":
  - Data source: where new UI gets its data, and whether that is a new query.
  - Hierarchy: which preference or permission wins when two apply.
  - Deploy and old clients: what older app builds and a half-deployed fleet see.
  - Schema and data: every schema or data-migration change (new, altered or dropped columns, tables, indexes, constraints, backfills), and where each is applied or backfilled so far (for a plan, where it would be).
  - Infra: crons, workers, queues, Terraform, new env vars or secrets.
  - Added after the plan (PR only): everything in the diff the ticket or plan did not name.
- **Simplify.** For every new table or column, whether data that already exists could serve it on read ("compute before you store"). Schema the feature could drop, helpers that duplicate existing ones (search for them), and settings or layers nobody asked for. Name the simpler shape.

Explain from the foundation, not the code: each new piece in one sentence that names the existing system it builds on, and the whole PR or plan in one such sentence at the top of the report. Example: "BloomText already has per-user and per-chat notification settings; mentions adds two columns to them."

## 2. Review the plan (plan or brief only)

For a plan, turn the map into findings before the quiz. Keep each finding to one decision, with file:line evidence from the default branch. Skip what the decision log already settled unless the code contradicts it. Report only findings that would change the plan.

1. **Tables first.** Every new table, column, index, cache, cron or stored state gets the Simplify check. For every new or changed query, name the index that serves it, the rows it reads at today's scale, and whether it runs on a hot path (app open, every send, every page load), and propose the cheaper shape.
2. **Reuse.** Existing primitives, commands, components or tasks the plan rebuilds.
3. **Simplify.** The smallest shape that still meets every required behavior, and what each cut removes.
4. **Traps.** Deploy order, old clients, environments that share production data, migrations and flags.
5. **Contradictions.** Each place the plan disagrees with the code or with the decision log.

Each finding carries a severity (`must`, `should` or `consider`), its evidence, a proposal, what it removes, and its interview card: the question in one plain sentence that names the plan and says what changes, a why of one or two sentences with the cost and evidence, and 2-4 options with the recommended one first, ending in "(recommended)". Typical options: "Fold into the plan", "Keep as planned", "Decide later".

## 3. Quiz the person

- Show only the tip: the above-water list.
- Ask one question at a time and wait for the answer. When the harness has an option-card tool (Pane's `notify`), ask each question as a card titled `<target> quiz n/N: <question>`, with 3-4 answers, one of them right, plus "Not sure". Otherwise ask in the conversation. Examples: "Why was this built this way?", "What does this build on?", "When the chat is muted and someone mentions you, who wins?"
- Give every question its why: the production consequence of a wrong answer. Example: "Why does a stalled upload start a cron that sends the message for the patient? Why it matters: it is new infra that acts on a user's behalf, and Facebook and Microsoft apps finish the upload in the background with no cron."
- Ask about every new table, column and index first, so the person understands each one or cuts it. Then the other hotspots, then decisions, then simplification. Size the question count, and stop early when the person asks:
  - Small, under 800 changed lines: 3-5 questions.
  - Medium, 800-2,000 lines: 5-8 questions.
  - Large, over 2,000 lines: 8-12 questions.

  Changed lines are additions plus deletions in the PR's own diff against its base branch, leaving out tests, lockfiles, and generated or vendored files. A stacked PR is not charged for its parent's lines. For a feature across several PRs, size the combined diff.

  For a plan, size by scope: count its new pieces plus the hotspots it touches. Up to 5 is small, 6-10 medium, over 10 large.
- Save the map as JSON (the fields in step 7) before the first question: beside the plan as `understanding-check-<plan file name>.json`, or for a PR in `tmp/understanding-check-<number>.json`, so each target keeps its own map. Record each answer in it as it arrives, so an interrupted quiz resumes at the next unanswered question.
- Judge each answer as right, partly right, wrong, or unsure. For partly right, wrong or unsure, give the correct map with its evidence (on cards, at the top of the next card, plus one closing card after the last question), then ask the person to explain it back in one sentence and record what they say. A note the person adds to a card counts as their explanation.
- When an answer shows the map is wrong, correct the map and say so.
- For a PR, record each decision the person makes (cut a column, remove a cron) as an action item under Before you merge. Change code only when the person asks.

## 4. Interview on the findings (plan or brief only)

After the quiz, ask one card at a time, titled `<target> review n/M: <question>`:

1. A tables card: each new table, column and index in plain words, asking whether to keep each one, with the options "Yes, keep them (recommended)", "Explain one to me", and "Cut or merge something".
2. Each finding from step 2, most severe first, with its question, why and options.

Then fold the answers in before the next stage starts: edit the plan (or the brief), and when the work keeps a decision log, add one entry with the quiz score (right, partly, wrong, unsure) and each answer, grouped as fold-ins, simplifications taken, kept as planned, and judgment calls. Each answer is also an action item on the page, under Before building (for a brief, Before planning).

## 5. Color the map

After the quiz, give every piece, existing system, decision and hotspot one color for how well the person understands it now:

- **Green, well understood:** answered right without help, or explained it correctly unprompted while answering another question (say which in its reason).
- **Yellow, partly understood:** partly right, or wrong and then explained it back correctly.
- **Red, still ambiguous:** wrong or unsure even after the correction, or the code itself leaves the answer unclear (an open question, two paths that disagree).
- **Grey, not asked:** no question touched it or any tested item it concerns.

In the JSON these are `green`, `yellow`, `red` and `untested`; a hotspot the work does not touch is `untouched`, shown as "Not touched". Each quiz question lists the item ids it tested in its `about`. An item takes the worst color of the questions that list it; partly right counts as yellow even when the person did not explain it back. A decision or hotspot that no question tested takes the worst color of the items it concerns. Write one sentence on why each item got its color.

## 6. Write the deep dives

Write these after the quiz, so the quiz is not an open book. Every piece, existing system, decision and hotspot gets a deep dive that opens when the person clicks it:

- **In plain words:** what it is and why it exists, for a middle schooler: an everyday comparison, then what really happens. Start from what already exists, never from code.
- **How it connects:** the real path through the code as numbered steps, each with its file:line. The page draws the piece and its neighbors from the edges you record.
- **In this codebase:** the real names (tables, columns, functions, services) and how it fits the systems below it.
- **Where it lives:** file:line links to the PR's head commit, or for a plan, to the default-branch commit you read.
- **Trade-offs:** what was chosen, what it was chosen over, the gain, the cost, and who feels it, with the number when data can size it.
- **What to watch:** what could break, and what to check by hand.

For a plan, a new piece has no code yet: its `where` cites the plan section that asks for it plus the existing code it will touch, and its `flow` is the planned path through existing code, marked as planned.

Every item needs `plain`, `codebase` and `where`, except a hotspot the PR or plan does not touch, which needs only `plain`. Add `flow` wherever there is a code path to follow, `tradeoffs` for decisions and for pieces that made one, and `watch` wherever something could break. Go deepest where understanding is weakest: red and yellow items, hotspots the work touches, and pieces with their own pattern get every section in full. Green and grey items still get every section that applies, in a few sentences each. Simple words never mean vague claims: every step and claim still cites file:line or evidence, and a diagram shows the real path, not a generic sketch.

## 7. Publish the iceberg

Copy [references/iceberg-template.html](references/iceberg-template.html) and replace only the JSON in its `understanding-check-data` block; the page builds the iceberg, colors, deep dives, quiz, and action items from it. Its sample data is [references/worked-example.md](references/worked-example.md); replace all of it and drop `"sample": true`. Inside JSON strings, write every `<` as `\u003c` so a value such as `</script>` cannot end the block early. The page inserts every value as text, so write plain text; `backticks` become inline code. The page uses JavaScript to draw the clickable map; otherwise it follows html-explainer's colors, type and components.

The JSON holds:

- `pr`: `title`, `url`, `repo` (`owner/name`), `number`, `base`, `head` (the short SHA; links use the full one), `date`, `person`. For a feature across several pull requests, use the feature as `title`. For a plan or brief, set `pr.kind` to `plan` or `brief`, `url` to it, `head` to the commit you read, and leave out `number` and `base`; the page then labels itself for that target.
- `prs` (top level, optional): for a feature across several pull requests, a list of `label` and `url` for each.
- `summary` (top level, not inside `pr`): the one sentence from the foundation.
- `items`: one per piece, each with `id`, `kind` (`new`, `existing`, `decision` or `hotspot`), `label`, `understanding` (`green`, `yellow`, `red`, `untested` or `untouched`), `colorWhy`, `ownPattern` (true for a new piece with nothing below it), `about` (for a decision or hotspot, the ids it concerns), and the deep dive: `plain` and `codebase` (lists of paragraphs), `flow` (`step`, `ref`), `where` (`ref` as `path:line`, `url` as `https://github.com/<repo>/blob/<full head SHA>/<path>#L<line>`, optional `note`), `tradeoffs` (`chose`, `over`, `gain`, `cost`, `who`) and `watch`.
- `edges`: `from` a new piece `to` the existing system it builds on.
- `quiz`: each question in order with `q`, `why`, `options` and `correct` (the index of the right one) when asked on cards, `answer` (what the person said or picked), `verdict` (`right`, `partly`, `wrong` or `unsure`), `correction`, `explainedBack`, and `about` (here, the item ids the question tested).
- `findings` (for a plan, step 2's findings with each answer; the page shows them through `actions`).
- `simplify` (`opportunity`, `simpler`, `status`) and `actions` (Before you merge items, or for a plan, one string per finding, such as `[must] Keep the IP on socket refresh. Picked: fold into the plan.`).

Publish it as a private grain:

- Link the page from the PR body. For a plan, link it from the plan cover sheet; for a brief, from the brief.
- On a rerun, find the earlier page through that link and update it in place; ask again only about what changed since that run, and keep the earlier answers.
- When the PR already links a Grain workspace for this PR (`prepare-pr` creates one), clone it, add the page as `understanding-check.html`, push, and link `https://rungrain.com/w/<id>?file=understanding-check.html`. For a plan or brief that lives in a Grain workspace, add the page there the same way as `understanding-check-<plan file name>.html`, so plans sharing a workspace keep separate pages.
- Otherwise create an HTML grain named `<repo>#<number> understanding check`, or `<plan title> plan understanding check`, in the folder `Development Artifacts/<org>/<repo>` (`grain_artifact`). On a rerun, update the same grain (`grain_artifact_update`) rather than creating another.
- Open the published page, click a red item and a green one, and check that the deep dives open and the colors match the quiz. Without a browser tool, say the page was not checked.
- When Grain tools are missing or sign-in fails, write the page to `tmp/understanding-check-<number or plan name>.html` at the repository root and give the person its path. Post a Markdown comment on the PR, or append a section to the plan, with the summary, each item with its color and its plain-words explanation, the quiz, and the action items.

Report the link, the quiz score, the red and yellow items, the action items, and the answers you corrected.
