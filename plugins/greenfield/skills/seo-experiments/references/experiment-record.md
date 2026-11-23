# Experiment record: template and filled examples

The template first, then four records filled from real work:

1. [A rewrite of about 95 pages that moved with the site](#1-a-95-page-rewrite-that-moved-with-the-site) (Product A): why every read needs a control group.
2. [An internal-link test with matched controls, six against six](#2-an-internal-link-test-six-against-six) (Product A): a designed record before it ships.
3. [The July bets, mixed and failed](#3-the-july-bets-mixed-and-failed) (Product A): scenario-labelled expectations and Failed results.
4. [A title test that was split or confounded](#4-a-title-test-split-or-confounded) (Product B, ratios only): one test, two readings.

Product A is an open-source developer tool for running coding agents in parallel, a new site with no brand at the start. Product B is a B2B healthcare SaaS with a free plan, an established brand.

## Template

File: `.seo/experiments/<YYYY-MM-DD>-<slug>.md`, dated the day the record is opened.

```markdown
---
id: <YYYY-MM-DD>-<slug>
hypothesis: <one sentence>
pages: [/path-one, /path-two]
live:                   # set when the change went live on a different day from the commit that adds this file
read_21:
read_42:
status: running         # running | read | closed
---

# <Short name>

## Hypothesis
If <change> helps <searcher> do <job>, then <signal> should improve on <pages> within <window>.

## What changed
<The exact change. PRs and merge commits.>

## Pages
| Page | Type | Indexed at ship |
|---|---|---|

## Baseline
Source: <the connected Search Console / analytics tool>, pulled <YYYY-MM-DD>.
Window: <YYYY-MM-DD> to <YYYY-MM-DD> (the 21 and 42 days before ship, or zero for new pages).
| Page or group | Clicks | Impressions | CTR | Position |
|---|---|---|---|---|

## What stays unchanged
<On these pages and on the control, until the 42-day read.>

## Control
<Every page with impressions before the baseline window, minus this experiment's pages (and the homepage when brand dominates), or a list of matched pairs.>

## Confounders
<Other launches in the window, seasonality, data gaps, competitor news, page age.>

## Minimum window
42 days. <Longer, and why, if it applies.>

## Expectations
- Scenario: <range>, anchored to <a comparable already measured>.
- Guess: <...>

## Stop, continue, expand
- Stop and revert if <...> at 42 days.
- Continue if <...>.
- Expand to <...> if <...>.

## Checks
- [ ] by <YYYY-MM-DD>: URL Inspection on every new URL; request indexing for misses.

## Results
### 21-day read, done <YYYY-MM-DD> (window <date> to <date>, baseline <date> to <date>)
<Numbers for pages and control, each with source and pull date. The closing data point, quoted. Reading.>

### 42-day read, done <YYYY-MM-DD> (window <date> to <date>, baseline <date> to <date>)
<Numbers, closing data point, verdict: Worked, No lift, Moved with the site, Mixed or Failed, with the reason. The stop, continue or expand decision.>
```

## 1. A 95-page rewrite that moved with the site

Product A rewrote about 95 existing comparison, alternatives, explainer and landing pages by hand in one program and shipped it on 2026-10-05. URLs, titles and H1s stayed the same, so the search result snippet barely changed. Read alone, the alternatives pages rose 34% in three weeks: a win. Against the control they moved with the site. This record was written after the fact during a read-back, so it sets `live`.

Source: "Agent-First Growth Playbook" (refreshed 2026-11-03), "Experiments since August", rows B1 to B8; "Growth, phase by phase" (v2, 2026-11-04), "A big rewrite moved with the site"; Work sessions investigation (2026-11-03).

```markdown
---
id: 2026-10-05-october-rewrite
hypothesis: Rewriting the existing comparison and explainer pages by hand lifts their clicks beyond the site's own growth.
pages: [/compare/*, /alternatives/*, /what-is-*, agent landing pages, localized compare and alternatives]
live: 2026-10-05
read_21: 2026-11-03
read_42:
status: running
---
```

**What changed.** A hand-written compare frame and rewritten body copy across about 95 pages, plus retranslated localized pages (#183, #186, #187, merged 2026-10-05). URLs, titles and H1s unchanged (#187's own note).

**Control.** Every page with impressions before the baseline window, minus each group's own pages. Each group therefore has its own control figure.

**Confounders.** New pages shipped the same week (#187 new compare pages, #196 use cases, the 19-page remote-access cluster on 10-09); `/compare/conductor` lost its blue link to an AI Overview source card around 2026-09-11, inside the baseline.

**21-day read, done 2026-11-03** (window 2026-10-05 to 2026-10-26 against the 21 days before; Search Console pulled 2026-11-03, data to 2026-11-01). Control figures are clicks / impressions.

| Group | Pages | Clicks | Impressions | Control | Reading |
|---|---|---|---|---|---|
| B1 | Existing compare pages | -7% (191 vs 206) | -4% | +40% / +35% | No lift. Without `/compare/conductor`, flat: 162 vs 166 |
| B2 | Existing alternatives pages and hub | +34% | +27% | +31% / +26% | Moved with the site; average position slipped 5.9 to 7.8 |
| B5 | 11 explainers and glossary | +71% (58 vs 34) | +30% | +30% / +26% | Possible lift on a small base |
| B6 | Roundups and platform hubs | +33% | +17% | +31% / +28% | Moved with the site |
| B7 | Seven agent landing pages | +173% (41 vs 15) | +23% | +30% / +27% | Lift, 35 of the 41 clicks on `/claude-code` |
| B8 | Localized compare and alternatives | +20% | -12% | +33% / +28% | Lagged the site |

Closing data point: "Rewritten comparison pages lost 7% of clicks at three weeks while untouched pages gained 40%."

**42-day read.** Runnable from 2026-11-19 (window end 2026-11-16 + 3 days). Not written back as of 2026-11-21: the next review shows it as due and, once done, marks it "(slipped from 2026-11-19)".

**What it teaches.** The burst that shipped it (2026-10-04 to 10-09, with the remote-access cluster and the homepage rebuild) took 7 work sessions and 22 hours, and the rewrite produced no lift beyond the site at three weeks. A big rewrite that keeps the snippet unchanged changes little in search; its value, if any, shows in trust, conversion or citations, which need their own measurement.

## 2. An internal-link test, six against six

Product A found 24 of 41 pages shipped 2026-10-05 to 10-10 still unindexed on 2026-11-03, hanging off low-traffic hubs. This record tests whether links from pages with traffic are the lever. It was designed on 2026-11-03 and had not shipped by 2026-11-21, so the due script lists it as "not shipped".

Source: "Agent-First Growth Playbook" (refreshed 2026-11-03), "D1, the proposed internal-link test".

```markdown
---
id: 2026-11-03-internal-link-test
hypothesis: Two contextual links from pages with 1,000+ impressions get an unindexed page crawled and shown, where its matched control stays unseen.
pages: [/what-is-a-control-plane, /what-is-acp, /what-is-an-ade, /compare/warp, /compare/wezterm, /remote/ssh-config-launcher]
live:
read_21:
read_42:
status: running
---
```

**Pages and control.** Six pairs from the 24 unindexed October pages, matched on page type and inlink count. A coin flip within each pair picks the treated page when the PR is opened; the `pages` field above lists the first of each pair until then.

| Pair | Page | Page |
|---|---|---|
| 1 | `/what-is-a-control-plane` | `/what-is-an-agent-multiplexer` |
| 2 | `/what-is-acp` | `/what-is-design-mode` |
| 3 | `/what-is-an-ade` | `/what-is-a-harness-router` |
| 4 | `/compare/warp` | `/compare/vscode-remote-ssh` |
| 5 | `/compare/wezterm` | `/compare/remote-desktop` |
| 6 | `/remote/ssh-config-launcher` | `/alternatives/mobile-ssh-apps` |

**Left out.** `/docs/importing` (already 44 inlinks) and pages whose target query an existing page already wins (`/compare/paseo`, `/compare/termius`, `/what-is-a-software-factory`).

**What stays unchanged.** Everything else on both sides, including the sitemap.

**Baseline.** Zero impressions and "not indexed" for all 12 pages (URL Inspection, 2026-11-03).

**Stop, continue, expand.** With six per side, only a large gap counts. 4 or more treated pages crawled against 1 or fewer controls says links are the lever: expand to the other unindexed pages. A smaller gap says links alone are not enough: look at query overlap and demand next.

**Checks.** The original design inspected all 12 pages on 2026-11-17, or two weeks after the links merge if later. In this format that is a quick check: `- [ ] by <merge + 14 days>: URL Inspection on all 12; count crawled per side`. The 21- and 42-day reads count first impressions and clicks per side.

## 3. The July bets, mixed and failed

Product A's single-file log, `.seo/experiments.md`, recorded each bet with date, type, target, baseline with its window, action, expected impact labelled a scenario, and review date, and wrote results back, including Failed. These are its results as of 2026-08-05. Imported into the folder format, each row becomes a record with `live` set to its ship date.

Source: Product A SEO experiments log (`.seo/experiments.md`, entries 2026-06-14 to 2026-08-05).

| Bet | Expectation | Result | Verdict |
|---|---|---|---|
| `/alternatives/conductor` retitled "Conductor Alternatives & Competitors (2026)" | CTR lift on the head term | Clicks 40 to 106; "conductor alternatives" 9 to 46 clicks, position 7.6 to 4.42 (July to 2026-08-05) | Worked: intent matched the title |
| Claude Squad brand-pool rewrite | CTR lift | CTR 1.74% to 2.11%, impressions -33% | Mixed |
| New `/alternatives/crystal` | Scenario: 50 to 150 impressions a month | 23 impressions; Crystal demand itself fell from 654 to 251 impressions | Failed: demand shrank |
| Platform hubs | More impressions | About 3x impressions in a month (888 vs 287); low CTR on the Windows hub | Mixed |
| Five-page CTR rewrite, 2026-06-25 | Scenario: 2% to 3% combined CTR | Combined CTR about 0.47% to 0.62%; `/worktrees` 0.13% on 2,988 impressions; `/worktree-tools` 0.2% to 0.55% | Failed for `/worktrees` and `/compare/crystal`; one win |
| `/alternatives/humanlayer-windows` | Clicks from a platform gap | 0 clicks on 25 to 32 impressions | Failed: no demand |
| Platform batch: cmux-windows, cmux-linux, superset-linux | Clicks per page | cmux pages earned clicks; superset-linux 0 clicks | Split; superset-linux Failed |

The log's own lesson: verify impression demand before cloning a winning page pattern.

**What slipped.** The reviews due 2026-08-11, 08-15, 09-04 and 09-10 were never written back. Several earlier checks were run before their window and recorded as "inconclusive". On import, each unwritten review becomes a due or slipped read; none gets a guessed result.

## 4. A title test, split or confounded

Product B rewrote the titles and meta descriptions of a set of pages on 2026-06-26, read them early, and reverted half. The log read it as a split result. A later read against a control found every group beat the control and called the test confounded, because the pages were only four to six weeks old and still ramping. Ratios only.

Source: "Product B growth deep dive" (2026-11-03), Experiments and "Earlier claims re-checked".

| Group | 3 weeks: clicks vs control | 6 weeks: clicks vs control |
|---|---|---|
| All pages in the test, from 2026-06-26 | +18% vs -16% (34 points ahead) | +115% vs -8% |
| Reverted half, from 2026-07-09 | +38% vs +10%; impressions -42% vs -10%; position 7.6 to 10.1 | +15% vs -24% |
| Kept half, from 2026-07-09 | +40% vs +7% | +80% vs -16% (96 points ahead) |

- **The early decision.** The revert was decided before half of the planned window had passed.
- **The confounder.** Young pages rise on their own while Google settles their rank, so a pre-and-post baseline on them is not clean. Set a minimum page age before a title test, or use matched controls of the same age.
- **What held either way.** No page in the test rose above 1.1% CTR. The intent of the query capped the click rate, and titles did not change it.

Record it with both readings in Results and the verdict "Confounded: kept titles beat reverted titles at six weeks; neither crossed the intent ceiling".
