# Worked investigations

Three read-only investigations run on 2026-11-03 for Product A (an open-source developer tool for running coding agents in parallel), each answering one question. They are the model for a diagnosis report. Numbers are copied from the originals; competitor names and page paths are real.

Sources: "Conductor query clicks: evidence tables" (2026-11-03); "Why AI-assistant visits to Product A fell after the agent-readiness pass" (2026-11-03); "Why new pages are not indexed" (2026-11-03); "SEO: GSC Findings and Diagnosis" (Product A, data pulled 2026-05-07); "Growth, phase by phase" (v2, 2026-11-04), "What surprised us".

What the three have in common:
- Each started from one sentence in a growth document and tested it.
- Each ruled data issues in or out before reading the numbers.
- Each compared a broken group against a working one: other competitor query families, other landing pages, indexed against unindexed pages from the same batch.
- Each named where the change sits separately from why, with different confidence for each, and ended with one measurement that would settle it.

---

## 1. Rank held while the clicks went to an AI Overview card

**Question.** Why did queries containing "conductor" lose clicks from August to October 2026 while impressions held?

**Evidence.** Search Console, web search type, `data_state` final, queries matching `conductor`, 2026-06-01 to 11-01, weeks from Monday.

| Week | Clicks | Impressions | CTR | Avg position |
|---|---:|---:|---:|---:|
| 07-27 | 59 | 1,043 | 5.7% | 4.3 |
| 08-17 | 41 | 1,096 | 3.7% | 5.1 |
| 09-07 | 33 | 1,380 | 2.4% | 5.5 |
| 09-14 | 25 | 1,076 | 2.3% | 4.1 |
| 10-12 | 15 | 911 | 1.6% | 5.9 |
| 10-26 | 11 | 1,226 | 0.9% | 4.4 |

- Impressions held; CTR fell in two steps, the week of 08-17 and the weeks of 09-07 to 09-14. Desktop carries the decline, and every large country fell together (United States 3.4% to 0.4%), so it is not a country or device mix shift.
- Most of the loss is one URL. On all conductor queries, `/compare/conductor` earned 134 clicks on 4,049 impressions from 08-12 to 09-13, then 19 on 1,665 from 09-14 to 10-04 and 20 on 1,652 from 10-05 to 11-01: about 115 of the roughly 120 clicks lost per four weeks.
- On the query "conductor alternatives", `/compare/conductor` went from 45 clicks on 634 impressions at position 1.5 (08-12 to 09-13) to 4 on 246 at 2.4 (09-14 to 10-04). Daily: 1 to 4 clicks a day through 09-10, then 2 clicks on 255 impressions from 09-11 to 09-30. A single step around 09-11 to 09-14.
- Demand fell too: "conductor alternatives" went from about 640 impressions in August to 342 from 10-05 to 11-01.
- Controls, weekly CTR on queries containing each name: cmux held at 5.8% to 8.4% in late October; Superset fell later and less (1.1% to 5.1%); Herdr launched 09-14.
- The `searchAppearance` dimension returned no rows: Search Console does not expose AI Overview appearances.
- Live results page, 2026-11-03 (signed in, `gl=us`, may be personalized): an AI Overview on top naming Product A first, with `/compare/conductor` as its third source card; organic first result a competitor's "Best Conductor Alternatives 2026" list dated 08-22; then a Reddit cluster; then `/alternatives/conductor`. `/compare/conductor` had no blue link on page one.

**Hypotheses, ranked.**
1. `/compare/conductor` lost its blue link and now appears mainly as an AI Overview source card. Fits the single September step, the position holding near 1.8, and the click-through collapse. Medium-high.
2. New competitor list pages crowded the results: one published 08-22, the week of the first step, and four more followed through 11-02. Likely explains the August step and some lost demand. Medium.
3. Fewer people search the exact phrase. Explains about half the drop on "conductor alternatives", not the CTR collapse. Real, partial.

**Confirming trace.** The cliff is one URL on one date (09-11 to 09-14) → its reported position stayed near the top → the live page shows that URL only as an AI Overview source card, with no blue link → a source card is counted as a top position and rarely clicked → clicks fell at flat rank and flat impressions.

**Ruled out.**
- A site-wide CTR change: cmux held through the September step (control).
- Our own changes: PR #141 (08-22) added a `<main>` element and breadcrumb, PR #166 (09-14) added a related link; neither changed title or description. The hand rewrite (#187, 10-04) came after the cliff (timing).
- Overlap between our own pages: `/alternatives/conductor` improved from position 7.1 to 3.4 and kept 6 to 10 clicks; `/alternatives/conductor-windows` dropped out of the query. Neither took the lost clicks.
- Competitor news: no rebrand, shutdown, domain change or Windows release for August to October.

**Root cause, medium-high confidence.** Google moved `/compare/conductor` from a normal result into an AI Overview source card in mid-September. Search Console still reports a top position, so "if rank holds, traffic holds" was wrong: when rank holds and clicks drop, look at the live results page first.

**Settling measurement.** A dated, signed-out, United States results page for "conductor alternatives", repeated a few times, recording whether `/compare/conductor` has a blue link or only the card; or August to October history from a rank tracker that records AI Overviews. If the blue link disappeared around 09-11 to 09-14 while the card remained, the cause is confirmed.

---

## 2. AI-assistant visits fell before the work that was blamed

**Question.** Did AI-assistant visits fall because of the agent-readiness pass (PRs #140 to #147, merged 2026-08-22 and 08-23, plus #153 on 08-26), as the growth playbook stated?

**Data issues, ruled in or out first.**
- Analytics recorded nothing from 09-09 to 10-05 after a burst of 800,000 to 900,000 events a day: every event type stopped together, which looks like an ingestion or quota cutoff. That window is excluded from every period; it removes all channels equally, so it cannot change AI's share.
- An empty read-key secret in CI: used only by a read job, so ingestion was unaffected. Ruled out.
- Analytics code, consent and bot filtering: the provider file was unchanged since 07-11 apart from comments, and there is no consent banner. Ruled out.
- The unit: the playbook counted pageviews. The site records pageviews on client navigation and keeps the external referrer for the whole session, so pageviews weight deep sessions. The investigation counted sessions by first landing page instead.

**Evidence.** Analytics sessions by first landing page; an assistant classifier on referring domain or `utm_source` (chatgpt or openai, claude.ai, perplexity, gemini, copilot). Periods: A 06-24 to 08-22 (60 days, before the pass), B 08-23 to 09-08 (17 days), C 10-06 to 11-02 (28 days).

| Assistant | A sessions a day | B | C |
|---|---:|---:|---:|
| ChatGPT | 5.97 | 2.88 | 3.71 |
| Claude | 1.02 | 0.65 | 0.14 |
| Perplexity | 1.22 | 0.65 | 0.61 |
| Gemini | 1.22 | 0.76 | 0.82 |
| All AI | 9.48 | 4.94 | 5.29 |
| All site | 248 | 296 | 418 |

- AI share of sessions: 3.8%, then 1.7%, then 1.3%.
- The drop sits on compare and alternatives landings: 4.0 a day, then 1.7, then 0.7 (down 83%). Homepage landings recovered to 77% of baseline (3.8, 1.8, 2.9) and other landings to 94% (1.7, 1.5, 1.6). Each assistant's compare landings fell 71% to 84%.
- Conductor pages, AI landings a day: 1.97, 0.76, 0.32. Google landings on the same pages: 21.7, 22.1, 8.1. Weekly, AI landings on Conductor pages halved in the week of 08-02 (from 21 to 9) while Google landings on them peaked at 172 to 188 a week.
- Search Console site clicks rose 70% over the window, from 387 in the week of 07-05 to 750 in the week of 10-25.

**Hypotheses, ranked.**
1. Assistants stopped citing or linking the Conductor and Superset compare and alternatives pages, starting around 08-02 and deepening through October. High confidence on where the drop sits; medium on why.
2. Claude stopped sending referrers or links in October: its sessions went 1.02, 0.65, 0.14 a day, and Claude has no tag fallback. Cannot be separated from hypothesis 1, because 49 of its 61 period-A sessions landed on compare pages. Low to medium.
3. ChatGPT dropping its referrer: from the week of 10-04, every ChatGPT session arrived as direct with `utm_source=chatgpt.com`, and referrer-only sessions went to zero. Real, and hides at most 15% to 20% of ChatGPT sessions.

**Confirming trace.** AI landings on Conductor pages halved the week of 08-02 → three weeks before the pass merged on 08-22 → the pass served Markdown to agents only on `/` and `/docs`, the landings that recovered → the compare pages that collapsed got the same HTML before and after → the drop shows in ChatGPT's tagged sessions, which referrer stripping cannot hide → assistants stopped sending visitors to those pages.

**Ruled out.**
- The readiness pass as primary cause: timing (the fall began three weeks earlier) and where the drop sits (on pages the pass did not change).
- Site-side referrer stripping: Google referrers still arrived in October (signal that survives).
- Lost AI clicks hiding in direct: direct, untagged landings on compare pages stayed flat at about 50 to 80 a week.
- Domain, redirect or canonical changes: live probe showed `www` still 308-redirects to the apex and canonicals are self-referential; a browser user agent gets HTML and an assistant user agent gets Markdown, with no cache bleed.
- Seasonality or site-wide decline: Search Console clicks up 70%, sessions a day 248 to 418 (control).
- A Bing ranking loss (ChatGPT search partly rides on Bing): Bing, DuckDuckGo and Yahoo compare landings held at 4 to 11 a week before the gap and 9 to 20 after it.
- One assistant driving it: all four fell 71% to 84% on compare landings.
- A dated assistant-side change: a 2025 report shows ChatGPT referrals to brand sites fell about 52% as citations concentrated on Reddit and Wikipedia, which proves the mechanism exists; no dated report for July to October 2026 was found.

**Root cause, medium confidence.** AI assistants stopped citing and linking Product A's Conductor and Superset comparison pages, starting about three weeks before the readiness pass. The pass coincides with the decline and did not cause it. Product A scored 100 on an agent-readiness scanner in August; the score did not cause the fall and did not prevent it.

**Settling measurement.** A citation probe: ask ChatGPT, Claude, Perplexity and Gemini the Conductor and Superset alternative questions ("best Conductor alternative", "Conductor for Windows") in fresh sessions and log which URLs each cites. If the compare pages are absent where they used to be cited, hypothesis 1 holds. To separate citation loss from referrer loss for Claude, click one of the product's citations in claude.ai and read the referrer the analytics tool records. Both became the measurer's AI answer panel and its ten-minute click test.

---

## 3. Pages that were never indexed

**Question.** Why were 24 of the 41 English pages Product A shipped from 2026-10-05 to 10-10 still not indexed on 11-03?

**Evidence.** URL Inspection on all 41 pages on 11-03; Search Console page and query data 08-01 to 11-01; a crawl from the homepage with a Googlebot user agent (218 English pages) recording depth, inlinks, canonical, robots meta, `X-Robots-Tag`, main-text word count and five-word-shingle overlap with the closest sibling in the batch.

| Group | Pages | Median inlinks | Inlinks from pages with 100+ impressions | Impressions of the linking pages | Words | Overlap with closest sibling |
|---|--:|--:|--:|--:|--:|--:|
| Indexed | 17 | 7 | 5 | 4,424 | 729 | 0.16 |
| Not indexed | 24 | 3 | 2 | 433 | 664 | 0.15 |

- Every unindexed page was "Discovered, currently not indexed" or "URL is unknown to Google". Both mean Googlebot never fetched the page, so Google has not judged its content. "The sitemap is enough" was wrong: a sitemap tells Google a page exists, and Google decides whether to fetch it.
- The 11 new "what is" pages were reached only from `/glossary`, which links to 78 pages and earned 366 impressions in three months. The new remote-access compare pages hung off a small cluster.
- Clean on every page: status 200 to a Googlebot user agent, `index, follow`, no `X-Robots-Tag`, self-referencing canonical, allowed by robots.txt, present in a sitemap Google downloaded between 10-25 and 11-02 with 0 errors, 500 to 900 words of server-rendered text, time to first byte 0.05 to 0.4 seconds.

**Hypotheses, ranked.**
1. Weak links in: the unindexed pages hang off pages with little search traffic. Medium, about 60%.
2. New pages chasing queries existing pages already win: "paseo" already landed on `/compare/remote-development` (738 impressions), which fits `/compare/paseo` staying unknown despite 13 strong links in; "termius" and "multiplexer" also went to older pages. Explainer topics such as harness router, design mode and agent skills had 0 impressions site-wide. Plausible.
3. Sitemap dates: 635 of 722 sitemap URLs carried the same `lastmod`, 2026-10-27, a build date, so the date told Google nothing. Minor.

**Confirming trace.** Indexed and unindexed pages had the same word count and the same text overlap → they differed in the search traffic of the pages linking to them (4,424 against 433 impressions) → Google had never fetched the unindexed ones, so content could not be the cause → links from pages with traffic decide which new pages Google fetches.

A natural experiment on Product B (a B2B healthcare SaaS with a free plan) confirmed the mechanism with high confidence (about 80%): a batch of pages shipped linking only to each other earned no impressions for two weeks; about three in four of the batch's pages that ever earned an impression got their first within four days of a later PR that linked them from crawled hub pages. On the same site, URL Inspection's referring URL named a calculator page that had linked to four pages six days before they shipped; Google got 404 on them and had not returned in 157 days, because their sitemap date was older than the failed visit.

**Ruled out.**
- Near-duplicate content: overlap 0.16 against 0.15, and Google had not read the pages anyway.
- Server speed or crawl capacity: time to first byte under 0.4 seconds.
- Noindex, canonical, robots.txt, missing sitemap entries, client-side-only text: all checked live and clean.
- Translated pages soaking up crawling: 13 of 20 sampled localized URLs were indexed, and they earned 36,762 impressions.

**Exceptions, listed.** `/docs/importing` had strong links and was not indexed. Of three use-case pages with identical links, two were indexed and one was not.

**Root cause, medium confidence (about 60%).** Two large batches hung off pages with little search traffic, several aimed at searches that existing pages already won. Links from pages with traffic decide indexing; content similarity does not.

**Settling measurement.** Link 6 of the 12 unindexed explainer and compare pages from pages with real search traffic, such as `/compare/conductor` and `/alternatives/herdr`, hold the other 6 back as controls, and re-inspect all 12 on a fixed review date two weeks out.

### An earlier indexing scare, for contrast

In May 2026 Search Console reported 0 of 31 pages indexed. The cause was a sitemap submitted under `http://` instead of `https://`, and the split between `www` and the apex was index lag after a redirect, not a code bug. Check how the sitemap was submitted before diagnosing the pages. Source: "SEO: GSC Findings and Diagnosis" (Product A, data pulled 2026-05-07).
