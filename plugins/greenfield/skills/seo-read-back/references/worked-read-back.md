# Worked read-back: Product A, August to October 2026

Product A is an open-source developer tool for running coding agents in parallel: a new site with no brand when it started. On 2026-11-03 every merged PR from #138 to #215 was grouped into experiments and read at 3 weeks (21 days after merge) and 6 weeks (42 days) against Search Console data ending 2026-11-01. The site deploys on merge, so each experiment is dated by its merge date.

Source: "Agent-First Growth Playbook" (refreshed 2026-11-03), "Experiments since August". Site totals from the same document: 10,513 clicks on 393,526 impressions across 635 pages by 2026-11-01; October, the best month, had 2,945 clicks.

## Method used

- Existing pages: each window compared with the same number of days just before the merge.
- Control: every page that already had impressions before the baseline window, minus the experiment's own pages. Control figures read clicks / impressions.
- New pages: raw clicks and impressions, plus whether Google indexed them (URL Inspection, 2026-11-03).
- The 3-week read is early; the verdict belongs to the 6-week read.
- Too early: a window ending after 2026-11-01 carries its review date, window end plus three days.
- Groups: A launched August to September, B is the October program and launches beside it, C is late October, D is proposed.

## The table

| Experiment | PRs, ship date | 3-week read | 6-week read | Control | Verdict or reading so far |
|---|---|---|---|---|---|
| **A1** Agent-readiness pass, metadata on 86 English routes | #140 to #147, #153; 2026-08-23 | Clicks +6%, impressions +7% | Clicks -2%, impressions +9% | Clicks +13% at 3 weeks | No measurable search effect. It touched nearly every English page, so it has no clean control. It took is-agentic from 86 to 100 |
| **A2** Leaderboard `/leaderboard` | #155 to #160; 2026-08-29 | 0 impressions | 0 impressions | New page | Not a search page. First impression on day 52 |
| **A3** Remote Control use case and docs | #162, #163; 2026-09-14 | 7 clicks, 569 impressions | 14 clicks, 1,518 impressions, position 5.7 | New pages | Beat the top of its logged scenario (50 to 150 impressions a month) 5 to 7x. Weak CTR, 0.9%. Under 20 clicks: directional |
| **A4** Herdr: 4 competitor pages and 2 explainers | #166; 2026-09-15 | 361 clicks, 8,577 impressions, 4.21% | 745 clicks, 19,211 impressions, 3.88% | New pages | **Best launch on the site.** `/alternatives/herdr` has 540 of the 745 clicks |
| **B1** October rewrite: existing compare pages | #187; 2026-10-05 | Clicks -7% (191 vs 206), impressions -4% | Too early: 2026-11-19 | +40% / +35% | No lift. Without `/compare/conductor`, flat: 162 vs 166 |
| **B2** October rewrite: existing alternatives pages and hub | #187; 2026-10-05 | Clicks +34%, impressions +27%; position 5.9 to 7.8 | Too early: 2026-11-19 | +31% / +26% | Moved with the site on clicks while position slipped |
| **B3** New compare pages: Omnigent, Paseo, T3 Code | #187; 2026-10-05 | 3 clicks, 262 impressions | Too early: 2026-11-19 | New pages | Paseo not indexed. T3 Code first appeared on day 16 |
| **B4** 11 new glossary explainers | #187; 2026-10-05 | 0 clicks, 37 impressions | Too early: 2026-11-19 | New pages | 1 of 11 indexed |
| **B5** 11 existing explainers and glossary, rewritten | #187; 2026-10-05 | Clicks +71% (58 vs 34), impressions +30% | Too early: 2026-11-19 | +30% / +26% | Possible lift on a small base |
| **B6** Roundups and platform hubs | #183, #187; 2026-10-05 | Clicks +33%, impressions +17% | Too early: 2026-11-19 | +31% / +28% | Moved with the site |
| **B7** Seven agent landing pages | #183, #187; 2026-10-05 | Clicks +173% (41 vs 15), impressions +23% | Too early: 2026-11-19 | +30% / +27% | Lift, almost all on `/claude-code` (35 of 41) |
| **B8** Localized compare and alternatives, retranslated | #186; 2026-10-05 | Clicks +20%, impressions -12% | Too early: 2026-11-19 | +33% / +28% | Lagged the site |
| **B9** Handoff, cross-machine and cross-OS use cases | #196; 2026-10-06 | 1 click, 125 impressions | Too early: 2026-11-20 | New pages | 2 of 3 indexed. Directional |
| **B10** Remote-access cluster, 19 pages | #202, #206; 2026-10-09 | 134 clicks, 4,796 impressions, 2.79% | Too early: 2026-11-23 | New pages | Split. `/alternatives/mobaxterm` has 86 of the clicks. 8 of 19 indexed, none of the 6 compare pages |
| **B11** Homepage rebuild | #191, #194, #201, #203; 2026-10-09 | Clicks +37%, CTR 12.67% to 13.76% | Too early: 2026-11-23 | Clicks +32% | Moved with the site, slight CTR gain |
| **C1** `/scheduled-agents`, `/agent-notifications` and their docs | #214; 2026-10-28 | Too early: 2026-11-21 | Too early: 2026-12-12 | New pages | All four indexed within 3 days |
| **C2** Conversion changes: hero proof line, install block, phone install link | #210, #212, #213; 2026-10-27 to 10-28 | Too early: 2026-11-20 | Too early: 2026-12-11 | Read in the install funnel, not search | The install-attribution job (#211) failed every run, so attributed installs were not written |
| **D1** Internal-link test, 6 unindexed pages against 6 matched controls | Proposed 2026-11-03, not shipped | Review from 2026-11-17 | | Matched pairs | Designed record in the experiment-record reference |

**Not search experiments.** Download fixes (#154, #161), the repository owner move (#169), build and link fixes (#178 to #180), telemetry and install attribution (#208, #209, #211). Docs refreshes for each release (#138, #164, #167, #192, #193, #199, #200, #204, #205) have no single ship date to read against; over the whole period docs clicks went from 31 to 62 per 28 days and docs CTR from 1.16% to 2.23%.

**What the period says.** The two wins were new "[name] alternatives" pages for tools people were already searching for (A4, and MobaXterm in B10). The October program (B1 to B8), about 95 pages rebuilt by hand, mostly moved with the site at 3 weeks, which fits #187's own note that URLs, titles and H1s did not change. Most new pages in that program were not indexed.

## The same table in the due script's terms

Each row is one record with `live` set to its ship date. On 2026-11-21 the due script would show:

| Record | 21-day read | 42-day read |
|---|---|---|
| A1 to A4 | done 2026-11-03 | done 2026-11-03 |
| B1 to B8 (ship 2026-10-05) | done 2026-11-03 | due since 2026-11-19, not written back: "(slipped from 2026-11-19)" when done |
| B9 (ship 2026-10-06) | done 2026-11-03 | due since 2026-11-20 |
| B10, B11 (ship 2026-10-09) | done 2026-11-03 | too early, review 2026-11-23 |
| C1 (ship 2026-10-28) | due since 2026-11-21 | too early, review 2026-12-12 |
| C2 (ship 2026-10-27) | due since 2026-11-20 | too early, review 2026-12-11 |
| D1 | not shipped | not shipped |

So the next read-back on this product starts with eleven due reads: B1 to B9 at 42 days and C1 and C2 at 21 days.

## What this read-back changed

- It reversed a reading. The refresh first blamed the readiness pass (A1) for falling AI-assistant visits; the follow-up investigation found the drop began the week of 2026-08-02, three weeks before the pass merged, on the Conductor and Superset pages. Every line blaming the pass was corrected.
- It withdrew a credited cause. Faster indexing had been credited to IndexNow; Google does not read IndexNow, and 24 of the 41 pages shipped 2026-10-05 to 10-10 were still unindexed on 2026-11-03. That finding produced D1.
- It found silent data failures while reading: analytics recorded nothing from 2026-09-09 to 10-05, CI refused jobs from 2026-10-27 to 10-31, and the install-attribution job failed every run. Each read now names the data gaps inside its window.
