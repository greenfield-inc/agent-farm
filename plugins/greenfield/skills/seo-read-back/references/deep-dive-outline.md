# Deep dive outline

The section structure of a product's growth deep dive, in order. It follows the deep dive written for Product B, a B2B healthcare SaaS with a free plan, on 2026-11-03: every acquisition PR read against Search Console, analytics and two scanners, with every merged PR in the window classified (Source: "Product B growth deep dive" (2026-11-03)). Structure only; that product's numbers stay out.

Each section says what it holds. A section with nothing to report stays, with one line saying why.

## Title and scope line

`<Product> growth deep dive, <start month> to <end month> <year>`

One italic line: what was read (how many merged PRs, their number range and dates), which sources (Search Console, the analytics tool, scanners), the pull date, and the last final day of Search Console data (about three days before the pull).

If an earlier write-up exists, one paragraph names it, its data end date, its main claims, and says this document re-checks each one.

## 1. The short version

Five numbered findings, each a bold one-sentence claim followed by its numbers and windows. Typical findings: the year-over-year change and how much came from pages other than the homepage; how much brand carries; how much of the visibility is now AI answers; what Google declines to index; which launches worked best.

Then **Decision for the person**: the three or four actions proposed for the next month, as one question with an answer-by date.

## 2. The product's growth in five minutes

The founder summary, written so any founder can copy it. Plain words, no internal names, every term explained once. The evidence follows in later sections.

- **What happened**: three or four phases, each one sentence of what was built and when.
- **Result**: the headline numbers, and what can and cannot be credited (for example, pages and sign-up changes that shipped together share the credit).
- **What it proves**: five to seven numbered lessons, each a plain claim with one number.
- **The method, step by step**: six to eight numbered actions a reader can take on their own product this month, each naming the tool and the screen (Search Console, URL Inspection, the sign-up survey, the AI report).

## 3. Evidence rules

- What *Shipped*, *Measured* and *Plausible* mean in this document.
- How changes are dated: merge date, or live date from deploy runs when deploys are manual, with one worked example.
- Host and URL folding: one host, `www` and trailing slashes and `/index.html` folded, `#fragment` rows dropped (with their lifetime impressions and clicks).
- Two kinds of total: property totals, page-level sums (run higher), query-level sums (run lower, because Google withholds rare queries), with the share of clicks the query report holds.
- Anything transcribed by hand (Google AI-feature impressions) and why.
- Analytics limits: when each event starts, gaps, what ad blockers drop, which counts are floors.

## 4. What it earned

- **By month**: clicks, impressions, CTR and position, with the same month a year earlier where it exists.
- **By page family**: lifetime and last 28 days, homepage as its own row.
- **Top pages**.
- **The new-page cohort**: pages launched in the window, how many Google showed, and when.

## 5. What people search for

- **Branded and non-branded**: shares of query-attributed clicks, and homepage against other pages.
- **CTR by intent**: one row per intent (free plan, pricing, alternatives, comparison, compliance or how-to, definition), with impressions, clicks and CTR. This table usually explains more than any experiment.

## 6. Experiments

- **Method**: the windows (21 and 42 days), the baseline (the same number of days before), the control (every page with impressions before the baseline, minus the experiment's pages and, when brand dominates, the homepage), how new pages are read, too-early labels, and the 20-click directional rule.
- **One table per period**: experiment, PRs and live date, 3-week reading, 6-week reading, total to date, reading. Too-early cells carry their review date.
- **What the period says**: three or four bullets: what beat the control, what moved with the site, and any planned experiment that never went live.

## 7. Indexing

Which batches Google indexed and which it left out, from URL Inspection, with the inspection date. Pages linked before they existed and what Google recorded for them.

## 8. AI search

- **Google's AI features**: AI-feature impressions by month as a share of web impressions, and the pages Google uses most, labelled as transcribed.
- **AI assistants in analytics**: visits by month per assistant, landing pages, and how referrers are counted.
- **The sign-up survey**: the AI share by month, against tracked AI, with the denominator and the date the option list changed.
- **Agent-readiness scanners**: each scanner's score and scan date, then the gaps both agree on, each checked against the live site. Close with one line: a scanner measures whether an agent could use the site, not whether agents cite it.

## 9. Funnel

From first visit to sign-up and activation, by source, with the windows each event covers.

## 10. Earlier claims re-checked

A table: each claim from the earlier write-up with its data date, and its status now: **Held**, **Held and grew**, **Weakened**, **Revised**, **Unverifiable here**, **Small**, or **Still open**, each with the number that decided it.

## 11. Playbook

What worked, what did not, and the rules this evidence supports, each rule with the experiment that supports it.

## 12. Roadmap

Ranked next actions, each with its evidence, time estimate and review date.

## 13. How to reproduce

The exact pulls: Search Console dimensions and pagination, URL Inspection, the analytics queries and their limits (query month by month, always set an explicit row limit), how live dates were found, and the scanner commands. Name the tools; never include keys or account ids.

## Appendix: coverage

Opens with one sentence: "Every change to the public site since <start> was looked at. None were sampled." Then:

- **Merged PRs**: the total in the window, and how many are in the timeline, how many touched a public surface with no acquisition effect (each with a reason), and how many changed only product code.
- **Commits**: the exact `git log --first-parent --since=<start>` command, the default-branch head it ran on, the public paths it covered and why those paths hold every public page, and the commit count.
- **Reconciled**: how many commits belong to timeline PRs, how many have no acquisition effect (by kind), the direct commits by name, and the commits matched to PRs through the GitHub API.
- **Found in reconciliation**: surprises, such as a PR reverted before any deploy.
- **Not readable from git**: redirects held outside the repository, PRs merged into side branches, shared components that change many pages without a per-page diff.
- **Headline numbers re-verified**: which numbers a separate script recomputed from the raw pulls, and what it corrected.
- **Not checked**: every source and question left out (citations by AI assistants, other search engines' webmaster tools, backlinks, revenue, data before a given date, experiment rows computed once and not re-run).
- Where the commit-level list and raw pulls live: the run's private bundle, never the repository.

## Appendix: acquisition PR timeline

Every merged PR in the window that changed the public site, SEO, content, schema, indexing, agent-discovery surfaces or the sign-up funnel: number, title, merge date, and a "First live" column per public surface (website, docs, developer docs, help site). A blank means no public surface.
