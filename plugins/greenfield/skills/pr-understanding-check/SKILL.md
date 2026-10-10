---
name: pr-understanding-check
description: Optional check, offered when a pull request or a feature's set of pull requests is ready for the person's review. Map what is new and what it builds on as an iceberg, quiz the person one question at a time, and publish an interactive iceberg page where every piece is colored by how well they understand it and opens into a plain-language deep dive. Use when an orchestrator or implementer offers it and the person says yes, or when the person asks to understand a PR before reviewing it ("exit interview", "quiz me on this PR", "do I understand this PR?").
argument-hint: "[PR number, branch, or a feature's PRs]"
---

# PR understanding check

An opt-in check. Offer it once, when a pull request is finished (checks, agent review and QA done) and before the person's own review, and run it only when they say yes. It never blocks merging. For a feature built across several pull requests, map them as one iceberg. The person ends up knowing what the work changes, what it rests on, and where to look. The page keeps that map for later, and its colors show what is still unclear.

## 1. Map the iceberg

Read the PR body, its ticket or plan, the diff against its base, and the review and QA notes. Back every claim with a file:line, commit or query.

- **Above water.** Each new piece, one plain sentence each.
- **Below water.** For each new piece, the existing system it builds on, by name. A piece with nothing below it created its own pattern: mark it and treat it as a decision.
- **Decisions.** Each design choice: the option taken, the alternative, the trade-off, and who it affects in the real world. When data can size the impact (for example, how many admins have muted chats today), run a read-only query or analytics lookup with access you already have and give the number; without access, name the query that would.
- **Hotspots.** Check every row and record what the PR does, or "Not touched":
  - Data source: where new UI gets its data, and whether that is a new query.
  - Hierarchy: which preference or permission wins when two apply.
  - Deploy and old clients: what older app builds and a half-deployed fleet see.
  - Schema and data: every schema or data-migration change (new, altered or dropped columns, tables, indexes, constraints, backfills), and where each is applied or backfilled so far.
  - Infra: crons, workers, queues, Terraform, new env vars or secrets.
  - Added after the plan: everything in the diff the ticket or plan did not name.
- **Simplify.** Schema the feature could drop, helpers that duplicate existing ones (search for them), and settings or layers nobody asked for. Name the simpler shape.

Explain from the foundation, not the code: each new piece in one sentence that names the existing system it builds on, and the whole PR in one such sentence at the top of the report. Example: "The chat app already has per-user and per-chat notification settings; mentions adds two columns to them."

## 2. Quiz the person

- Show only the tip: the above-water list.
- Ask one question at a time and wait for the answer. Examples: "Why was this built this way?", "What does this build on?", "When the chat is muted and someone mentions you, who wins?"
- Give every question its why: the production consequence of a wrong answer. Example: "Why does a stalled upload start a cron that sends the message for the user? Why it matters: it is new infra that acts on a user's behalf, and other messaging apps finish the upload in the background with no cron."
- Ask hotspots first, then decisions, then simplification. Aim for 3 questions on a small PR and up to 8 on a large one, and stop early when the person asks.
- Judge each answer as right, partly right, wrong, or unsure. For partly right or wrong, give the correct map with its evidence, then ask the person to explain it back in one sentence and record what they say.
- When an answer shows the map is wrong, correct the map and say so.
- Record each decision the person makes (cut a column, remove a cron) as an action item under Before you merge. Change code only when the person asks.

## 3. Color the map

After the quiz, give every piece, existing system, decision and hotspot one color for how well the person understands it now:

- **Green, well understood:** answered right without help, or explained it correctly unprompted while answering another question (say which in its reason).
- **Yellow, partly understood:** partly right, or wrong and then explained it back correctly.
- **Red, still ambiguous:** wrong or unsure even after the correction, or the code itself leaves the answer unclear (an open question, two paths that disagree).
- **Grey, not asked:** no question touched it.

In the JSON these are `green`, `yellow`, `red` and `untested`; a hotspot the PR does not touch is `untouched`, shown as "Not touched". Each quiz question lists the item ids it tested in its `about`. An item takes the worst color of the questions that list it; partly right counts as yellow even when the person did not explain it back. A decision or hotspot that no question tested takes the worst color of the items it concerns, or stays grey when those are grey too. Write one sentence on why each item got its color.

## 4. Write the deep dives

Write these after the quiz, so the quiz is not an open book. Every piece, existing system, decision and hotspot gets a deep dive that opens when the person clicks it:

- **In plain words:** what it is and why it exists, for a middle schooler: an everyday comparison, then what really happens. Start from what already exists, never from code.
- **How it connects:** the real path through the code as numbered steps, each with its file:line. The page draws the piece and its neighbors from the edges you record.
- **In this codebase:** the real names (tables, columns, functions, services) and how it fits the systems below it.
- **Where it lives:** file:line links to the PR's head commit.
- **Trade-offs:** what was chosen, what it was chosen over, the gain, the cost, and who feels it, with the number when data can size it.
- **What to watch:** what could break, and what to check by hand.

Every item needs `plain`, `codebase` and `where`. Add `flow` wherever there is a code path to follow, `tradeoffs` for decisions and for pieces that made one, and `watch` wherever something could break. Go deepest where understanding is weakest: red and yellow items, hotspots the PR touches, and pieces with their own pattern get every section in full. Green and grey items still get every section that applies, in a few sentences each. Simple words never mean vague claims: every step and claim still cites file:line or evidence, and a diagram shows the real path, not a generic sketch.

## 5. Publish the iceberg

Copy [references/iceberg-template.html](references/iceberg-template.html) and replace only the JSON in its `understanding-check-data` block; the page builds the iceberg, colors, deep dives, quiz, and action items from it. Its sample data is [references/worked-example.md](references/worked-example.md); replace all of it and drop `"sample": true`. Inside JSON strings, write every `<` as `\u003c` so a value such as `</script>` cannot end the block early. The page inserts every value as text, so write plain text; `backticks` become inline code. The page needs JavaScript to draw the clickable map, the one place it departs from the `page` standard; it follows that standard's colors, type and components.

The JSON holds:

- `pr`: `title`, `url`, `repo` (`owner/name`), `number`, `base`, `head` (the short SHA), `date`, `person`. For a feature across several pull requests, use the feature as `title` and add `prs`, a list of `label` and `url`.
- `summary` (top level, not inside `pr`): the one sentence from the foundation.
- `items`: one per piece, each with `id`, `kind` (`new`, `existing`, `decision` or `hotspot`), `label`, `understanding` (`green`, `yellow`, `red`, `untested` or `untouched`), `colorWhy`, `ownPattern` (true for a new piece with nothing below it), `about` (ids a decision or hotspot concerns), and the deep dive: `plain` and `codebase` (lists of paragraphs), `flow` (`step`, `ref`), `where` (`ref` as `path:line`, `url` as `https://github.com/<repo>/blob/<full head SHA>/<path>#L<line>`, optional `note`), `tradeoffs` (`chose`, `over`, `gain`, `cost`, `who`) and `watch`.
- `edges`: `from` a new piece `to` the existing system it builds on.
- `quiz`: each question in order with `q`, `why`, `answer`, `verdict` (`right`, `partly`, `wrong` or `unsure`), `correction`, `explainedBack`, and `about` (the item ids it tested).
- `simplify` (`opportunity`, `simpler`, `status`) and `actions` (Before you merge items).

Publish it as a private page:

- Save it as `understanding-check.html` in the work's bundle, following the `page` standard, and publish it to the document destination your workspace instructions name. In an orchestrated Session it goes in that Session's folder of the destination, linked from the workstream map. Keep it private; never create or widen a share. With no destination, keep the local bundle and give the person its path.
- Link the page from the PR body, or for a feature across several PRs, from each PR's body.
- On a rerun, find the earlier page through that link and update it in place; ask again only about what changed since that run, and keep the earlier answers.
- Open the published page, click a red item and a green one, and check that the deep dives open and the colors match the quiz. Without a browser tool, say the page was not checked.
- When publishing fails, keep the local page, tell the person, and post a Markdown comment on the PR with the summary, each item with its color and its plain-words explanation, the quiz, and the action items.

Report the link, the red and yellow items, the action items, and the answers you corrected.
