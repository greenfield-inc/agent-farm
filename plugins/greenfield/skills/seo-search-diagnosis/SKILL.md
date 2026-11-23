---
name: seo-search-diagnosis
description: "Diagnose one unexplained change in search or AI traffic (a click drop, a fall in AI-assistant visits, pages that never get indexed) with ranked hypotheses, a confirming trace and a stated confidence. Read-only: it reports the cause and the measurement that would settle it, and proposes no fixes."
---

# Search diagnosis

One question per run. Find where the change sits and why, with numbers, and hand the report to the strategist, who decides what to do.

Three worked investigations with real numbers are in `references/worked-investigation.md`: clicks lost while rank held, AI-assistant visits that fell before the change blamed for it, and pages that were never indexed. Read the one closest to your question before starting. The corrected beliefs behind them are in `seo-evidence`.

## Rules

- Read-only. Change no code, page, config, redirect, sitemap or Search Console setting, request no indexing, and merge nothing. Work in a read-only clone of the site's repository.
- Report facts and their sources. Fixes, even obvious ones, belong to the strategist.
- Never print or copy a key. If a data source will not connect, stop and report it; never estimate the missing numbers.
- Every number carries its source, window and the query or filter that produced it.

## Steps

### 1. State the question

Write the change as one sentence: metric, window, segment and where it was reported. "Clicks on queries containing 'conductor' fell from 5.7% CTR to 0.9% between the weeks of 07-27 and 10-26 while impressions held" is a question. "SEO is down" is not; split it and take the first part.

### 2. Rule known data issues in or out first

Before reading the numbers as real, check the instruments:
- **Data jobs fail silently.** Look for days where every event type stops together, and for scheduled jobs with failed runs. Product A's analytics recorded nothing from 2026-09-09 to 10-05 after a burst of 800,000 to 900,000 events a day, and its install-matching job failed all seven runs; both were found weeks late. A dark window is excluded from every period; it never explains a change in share.
- **Tracking changes.** Read the git history of the analytics setup, consent banner, bot filtering and proxy, and the dates each event's definition changed. A changed definition breaks the series at that date.
- **Referrer stripping.** ChatGPT stopped sending its referrer in October 2026; its visits arrive as direct with `utm_source=chatgpt.com`. The tag survives the stripping, so count tagged visits. On Product A this hid at most 15% to 20% of ChatGPT sessions. Test whether lost visits reappeared as direct on the same landing pages.
- **The event definitions.** Know what the metric counts. Pageviews in a single-page app weight deep sessions; sessions by first landing page are steadier. A button click is not a delivered sign-up.
- **Search Console limits.** Data lags about three days, dates are Pacific time, query rows omit anonymized queries, and AI Overview appearances are not exposed (`searchAppearance` returns no rows for them).

### 3. Write the hypotheses before digging

Start from this minimum list and add the ones the question suggests. Rank them by what you already know.

| Hypothesis | First check |
|---|---|
| Measurement | Step 2. |
| Our own change | First-parent git log of the site's default branch in the window: PR, date, pages touched, whether titles, URLs or headings changed. |
| Platform change | Web search for a dated report (search engine update, assistant citation or referrer change). A report from another year shows the mechanism exists; it does not date this change. |
| Seasonality or site-wide | Site totals for the same windows. If the site grew while the segment fell, it is not seasonal. |
| One segment | Split by URL, page family, query family, country, device and, for AI traffic, by assistant. A drop carried by one URL or one family points at that segment. |
| Search-results presentation | Rank held and clicks fell: look at the live results page. An AI Overview can take the click while Search Console still reports a top position. |
| Migration or moved URLs | Count how many lost landing clicks sit on URLs that now redirect elsewhere. A drop can come from moved URLs while every ranking holds. |
| Indexing | URL Inspection on every affected page. "Discovered, currently not indexed" and "URL is unknown to Google" both mean Googlebot never fetched the page, so Google has not judged its content. Check the sitemap was submitted under the right protocol and host: Product A's early "0 of 31 indexed" came from an `http://` sitemap submission. |

### 4. Compare broken against working, and before against after

- **Broken against working**: indexed pages against unindexed pages from the same batch; the falling query family against sibling families (other competitor names); the falling landing pages against the site's other landings; one assistant against the others.
- **Before against after**: fixed windows on either side of the suspected date, the same length where possible, by week, so the step shows when it happened.

### 5. Close hypotheses with evidence

Use the strongest closer available for each hypothesis:
- **Timing**: a decline that began before the change blamed for it was not caused by it.
- **Controls**: a sibling segment that held through the step rules out a site-wide cause.
- **Signals that survive the suspected gap**: tagged referrals survive referrer stripping; Search Console clicks survive an analytics outage.
- **Live probes**: fetch the page with a browser user agent and with a crawler or assistant user agent; read status, canonical, robots meta and `X-Robots-Tag`; look at the live results page for the query, noting the date, country and whether you were signed in. A page blocked in robots.txt hides its noindex header from Google, because Google never fetches the page to read it: check the two together. A third product left robots.txt off its share host on purpose for this reason (PR "Share links noindex", 2026-11-05).
- **URL Inspection status**: coverage state, last crawl, Google-selected canonical and referring URLs. The referring URL can name the page that sent Google to a 404.
- **Natural experiments**: dates in the record where one cause changed alone, such as pages that earned their first impressions within days of a PR that linked them from crawled pages.

### 6. Gather evidence in parallel

When the question splits into independent evidence questions (Search Console by query family, analytics by assistant, URL Inspection on a page list, the site's git history), follow `swarm`: give each to the investigator child with one question, a fixed window and the query to run, and have it follow `gather-evidence`. Pull Search Console through the connected Search Console tool with `data_state` final and matched windows, and analytics through the connected analytics tool, counting sessions by first landing page. Reconcile the answers against each other before ranking.

## Report

Lead with the answer in two sentences, then these sections. Keep the body to 400 to 600 words and put full tables in an appendix. Render it with `page` when a person will read it.

1. **Question**: the one sentence from step 1.
2. **Evidence**: the numbers, each with its window, source and the query that produced it.
3. **Hypotheses, ranked**: each with its confidence and the evidence for and against.
4. **Confirming trace**: the chain from cause to observed number, step by step.
5. **Ruled out, and why**: each closed hypothesis with the closer that closed it.
6. **Root cause with confidence**: high, medium-high, medium or low, and where the drop sits separately from why when the two have different confidence.
7. **The one measurement that would settle it**: the cheapest probe or test, with what each outcome would mean.
8. **Exceptions**: cases that do not fit the explanation, listed.

No fixes and no action list. Source for the method: "Growth, phase by phase" (v2, 2026-11-04), "What surprised us"; the three investigations of 2026-11-03 cited in `references/worked-investigation.md`; the search diagnosis in a customer workflow starter (confidential, method only, 2026-11).
