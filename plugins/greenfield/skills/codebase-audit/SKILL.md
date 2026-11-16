---
name: codebase-audit
description: Audit a whole codebase for polish and publish one visual map of it - architecture, size and attention per part, polish scores, a timeline from first commit to today, the person's stated priorities checked against the code, and 25 verified quick wins plus 25 bigger investments. Use for "what is unpolished in X", "map this codebase", "where should I spend time on this product", "run the polish audit on <repo>", or when joining or taking stock of a product.
---

# Codebase audit

Produce one self-contained HTML page that shows a person where a codebase is strong, where it is thin, and what to do about it. The page comes from `assets/template.html`, filled by `scripts/build.py` from six JSON files. Research agents produce the findings; you compute the numbers, curate, verify and build.

Read [references/data-contract.md](references/data-contract.md) before writing any JSON, and [references/research-briefs.md](references/research-briefs.md) before launching any researcher.

## Inputs to settle first

- **The repo and branch.** Clone it fresh into a scratch folder named `*.noindex`. Every researcher reads that clone and is forbidden `checkout`, `reset`, `clean`, `stash` and `pull`.
- **The person's priorities.** Ask what feels unpolished and which parts they care about, or take them from notes or voice memos they point to. These become the focus parts, the "Your priorities" cards and the weighting of the 50.
- **Research model and how many agents.** Ask; default to 10 to 15 researchers.
- **Where to publish.** Default to a local file opened beside the person; the document destination when the person or workspace names one.

## Steps

1. **Measure.** Write a bucket config that cuts the repo into 40 to 90 parts (one per app, package, screen group or service) and run `scripts/metrics.py <repo> <config.json> <data>/metrics.json`. It gives size, tests, commits in 30, 90 and 365 days, first and last change, and commits per month.
2. **Research, in parallel.** Write the shared brief to a file and give each researcher the path plus its slice. Slices: one per product surface (aim for 8 to 12), plus cross-unit consistency, plans versus reality (specs, TODOs, test and CI health), the timeline, the architecture map, and feasibility of the person's ideas when they have any. Each writes its report to disk early and updates it as it goes.
3. **Consolidate scores.** One score from 1 to 5 per bucket into `scores.json`, with a one-sentence reason. Prefer the deep slice report over a cross-cutting one. Leave unassessed parts `null`.
4. **Curate the 50.** One agent on the strongest model merges every opportunity list, picks 25 quick wins (under half a day) and 25 investments (days to weeks), weights the person's priorities up, caps any one area at 6 per list, and opens each cited file to confirm the claim. It writes `top50.json` and a notes file of what failed verification.
5. **Write `hand.json` yourself**: the findings, the lowest-polish table, the priority cards with the person's own words, idea verdicts, glossary, method notes and page text. Lead with 3 to 5 findings that would change where the person spends time.
6. **Build**: `scripts/build.py <data> <out.html>`.
7. **Review it as the reader.** Run `scripts/shoot.sh <out.html> <shots>` and read every crop. Then have a fresh agent cold-read the page text and crops. Fix and repeat until a cold read finds no number that disagrees with another.
8. **Publish** where the person chose, and open it beside them.

## Rules that make the page trustworthy

- Every number that appears twice agrees: scores in prose match the tables, counts match the rows, sizes match the charts. Compute prose numbers from the data.
- One name per thing across the page. Folder names appear only in file paths.
- Say what was not done: nothing run on hardware, parts not assessed, estimates marked as estimates.
- A score judges what a user or developer experiences. When craft and experience differ, score the experience and say so in the reason.
- Charts read without hovering: label every part scoring below 3, and name unlabeled tiles under the chart.
- Plain words. Define unfamiliar terms in the glossary. Keep commit hashes and build tags out of prose.
- The person sees the page only after your own review and one cold read.

## Running researchers

- Interrupting the session stops every running background researcher. Tell the person, and keep each brief in a file so a relaunch is one line.
- A researcher's score is a judgement. Its file and line citations are what you verify.
- Give the timeline and architecture researchers the JSON shapes from the data contract, so their output drops into the build.
