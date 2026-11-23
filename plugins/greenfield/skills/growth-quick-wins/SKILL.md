---
name: growth-quick-wins
description: "Audit any product's search and AI discovery from its URL and return one ranked HTML page: 25 to 50 quick wins and 10 to 15 larger workstreams, each backed by a measured number or a live check. Use for 'what are our quick wins', 'audit this site's growth', 'low-hanging fruit for <url>' or 'growth plan for <product>'."
---

# Growth Quick Wins

Given a URL or product name, produce one self-contained HTML page with:

1. **25 to 50 quick wins**, grouped into this week, next two weeks and this month, ranked inside each group, and opened by the top 10.
2. **10 to 15 workstreams** for larger improvements.

It works from the public site alone and gets sharper with Search Console, analytics, the site's repository or a sign-up survey. The page states the tier it ran at.

The method lives in these files:

- [references/principles.md](references/principles.md): what decided growth on two products, with their numbers.
- [references/probes.md](references/probes.md): every check, its exact command or query, and the result that triggers an item.
- [references/intent-gradient.md](references/intent-gradient.md): click rates by search intent, for sizing payoff.
- [references/workstreams.md](references/workstreams.md): the workstream catalog and time estimates.
- [assets/page-template.html](assets/page-template.html): the output page.
- [references/worked-page.html](references/worked-page.html): a finished page built from Product A's 25 quick wins.

The `seo-evidence` skill holds the evidence rules and the corrections list ([corrections.md](../seo-evidence/references/corrections.md)). Every item on the page follows both.

## 1. Set the access tier

Find the product's site, then check which sources this session can read: the connected Search Console / analytics tool, the site's repository, a sign-up survey export, and any SEO tool. When the repository has `.seo/access.md`, start from the tier and sources it records and re-check each one. Name the tier on the page:

| Tier | Has | Adds |
| --- | --- | --- |
| Public | The live site only | Live checks, sitemaps, robots, competitor sitemaps, results pages, third-party pages, the readiness scan, the citation probe |
| Search | + Search Console | Queries, click rates, index status, AI-feature impressions |
| Analytics | + an analytics tool | Landings, referrers, conversions, tracking gaps |
| Full | + the site's repository or a sign-up survey | Launch dates, the link graph from source, self-reported sources |

Work with what exists. Missing access becomes a quick win ("get read access to Search Console") or a limit stated on the page, never a guess.

## 2. Understand the product

Write a few lines: what it is, who buys it, its prices, whether it has a free plan, and its 3 to 8 real competitors. Find competitors where buyers find them: the product's own comparison pages, results for "<category>" and "<product> alternatives", review sites and third-party lists.

## 3. Gather evidence

- Run every probe in [references/probes.md](references/probes.md) that the tier allows. Read every page in the sitemap and every page the crawl reaches, not a sample. For a large site, split the probes across read-only agents with `swarm`.
- Save raw output (headers, HTML, sitemaps, exports, scanner JSON) under a dated scratch folder, with the time of each read. Write answers from search tools and assistants to a log file there too.
- Base every claim on raw output. When a summarizing fetch tool and a raw `curl` disagree, the raw page wins.

## 4. Turn findings into items

- One finding, one item. Each quick win states the action, the evidence, a time estimate, one category (Indexing, Pages, AI discovery, Measurement or Cleanup) and a review date. Corrections sent to third-party sites count as AI discovery.
- Evidence is a number with its source and date, or a live check with the URL and what it returned. Tag each with its source: Live, Search Console, Analytics, Repo, Survey, or Case (a number from the references).
- A live check that something is missing is evidence. A survey item backed by "no form asks the source question" is a Live item.
- An item whose only evidence is a case number is a hypothesis. Mark it "Hypothesis", name the probe that would confirm it, and rank it last in its group.
- The review date is when the item's effect can first be read. Index check: the expected ship date plus 7 days. Search reading: the ship date plus 21 days, plus 3 more because Search Console lags about 3 days. A fact fix: the next citation probe. A setup item: the day it should be done.
- Each workstream states the outcome, why (evidence), rough size, first step, how to measure it, and a review date. Draw from [references/workstreams.md](references/workstreams.md) and add any the evidence calls for.
- Write for the product's team: plain words, the exact URL, the exact change. Define a term the first time it appears.

## 5. Rank

- Groups: this week holds items under 2 hours; next two weeks holds pages and fixes up to a day; this month holds the rest and recurring checks.
- Inside a group, rank by payoff per hour: the traffic at stake (impressions times the intent's click rate from the gradient) divided by the time.
- At the Public tier there are no impressions. Rank in this order instead: wrong facts buyers or assistants see, money pages search engines cannot see, measurement that later readings depend on, missing high-intent pages, cleanup.
- Keep 25 to 50 quick wins. Below 25, say which probes the tier could not run. Above 50, fold the weakest into a workstream or drop them.
- The top 10 are the ten highest-payoff items across all groups.

## 6. Write the page

Fill [assets/page-template.html](assets/page-template.html): the header with product, date, tier and sources; the top 10; "what explains most of this"; the quick wins by group; the workstreams; "checked and left out on purpose"; the limits of this run; and the second pass from step 7. [references/worked-page.html](references/worked-page.html) shows the finished shape. Save it as the `page` skill's bundle rules say.

## 7. Rerun and gap-check

Run a second pass over the same site and data before anyone else reads the page:

- Re-run the probes whose result produced an item or a "left out" line, and every Public probe the first pass skipped.
- List every issue the evidence shows, one line each, as covered (with its item number) or left out (with why).
- List what the first pass got wrong or missed, with the fix made. When it found nothing, write "nothing" and name the checks that came back clean.
- Check the page against the common audit errors: a noindexed money page outside the sitemap (P3), a price conflict that was already fixed (P9), two scanner scores mixed up (P16), agent files recommended to a site whose buyers do not use agents (P17), and advice to move URLs that already earn traffic.

Put the second pass on the page in its own section.

## 8. Verify, then review

- Re-check every "missing", "broken", "not indexed", "no price", "no links" or "returns 404" claim live, after the page is written. Drop or correct each claim the recheck does not reproduce.
- Re-read every price, count and score against its source and confirm it is today's value, not an older audit's.
- Confirm each scanner score carries its own scanner's name and scan date.
- Confirm every AI-layer item (Markdown, llms.txt, agents.md, MCP) fits what the site sells and what it serves today.
- Apply the corrections list in `seo-evidence` to every item.
- Have the cold-reader child read the page as a first-time visitor, and fix what confuses it.

The page then goes to review before the person sees it: the reviewer role (seo-reviewer) runs the claims check on it. After the review's findings are fixed, publish the page to the document destination the repository's workspace instructions name (with none, keep the local file and give its path) and hand it to the person.

## After the person picks

Each picked quick win or workstream that adds or changes a page becomes a brief through `seo-page-brief`, and each shipped change gets an experiment record through `seo-experiments`. This skill writes only the page.

Provenance: ported on 2026-11-21 from greenfield-inc/skills#187 at commit ac05069 (2026-11-04). Changed on port: publishing goes to the document destination; the rerun and gap-check step and the review step were added; corrections point to `seo-evidence`; the second case is ratios only and the customer method is generalized with no case attached; the top 10, review dates per item and the worked page were added; the first dry run's fixes are kept.
