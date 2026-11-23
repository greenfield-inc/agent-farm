# Principles

What decided growth on two products, as rules an audit applies to any site. The full phase-by-phase account and the corrections list live in the `seo-evidence` skill; this file keeps what an audit needs to size and rank items.

- **Product A** is an open-source developer tool for running coding agents in parallel. In its first eight months it earned 10,298 search clicks on 334,447 impressions (Search Console property totals, 2026-02-26 to 2026-11-01); 635 of its pages had impressions, and its sitemap listed 722 URLs by 2026-11-03. Source: "Growth, phase by phase" (v2, 2026-11-04); "Agent-First Growth Playbook" (refreshed 2026-11-03).
- **Product B** is a B2B healthcare SaaS with a free plan, run by a small team, that rebuilt its organic acquisition over six months and grew its page count about 90x. Only ratios are given for it.

## 1. Links from pages that earn traffic decide indexing

Google indexes a new page when a page it already values links to it. Sitemaps and ping services do not substitute.

- Product A: of 41 pages shipped Oct 5 to 10, 17 were indexed by Nov 3 and 24 had never been fetched. Indexed pages had a median of 7 inbound links, 5 of them from pages with 100+ impressions, and their linking pages totalled 4,424 impressions. Unindexed pages had 3, 2 and 433. Word count (729 vs 664) and 5-word shingle overlap (0.16 vs 0.15) were the same, so content did not decide it.
- Product B: a template batch whose pages linked only to each other got no impressions until two later changes linked to it from crawled pages; about three quarters of the batch pages that ever showed got their first impression within days of those links. Clusters whose hub Google crawled were indexed; the rest were not. Every orphan page, present only in the sitemap, stayed unindexed.
- Google does not read IndexNow (Bing and Yandex do). Product A's 41 pages were submitted through IndexNow and most stayed unindexed; pages shipped with no submission indexed in 3 days once linked well.

Audit: P4 link graph, S5 index coverage. Quick win: two links from high-traffic pages to each unindexed page, with matched pages left alone as a control.

## 2. Ship the page before the link, and check it at 7 days

A link to a page that does not exist yet teaches the crawler a 404 that lasts.

- Product B: one page linked to several pages days before they shipped. Google fetched 404s and had not returned months later. The top query among those pages kept its impressions with no page to land on.
- Product B also had merged changes that never deployed. Merged is not shipped.

Audit: P5, S5, F1. Quick wins: request indexing and bump `lastmod` on pages last crawled as 404; a build check that fails on links to unbuilt pages; a URL Inspection pass 7 days after every launch.

The routine both products converged on: batches of 5 to 15 pages, one topic each, the answer in the first paragraph; link each page from a page with search traffic only after it is live; URL Inspection on every new URL at day 7 and request indexing for the misses; keep every competitor page removable in one change.

## 3. Intent sets the click ceiling

Searchers click when they still have something to do: compare options, find a free plan, see a price. See [intent-gradient.md](intent-gradient.md).

- Over the same 90 days (2026-05-14 to 08-11), Product A's compare pages earned 2.30% and Product B's vs pages 0.35% on near-equal impressions, a 6.6x gap, although Product B's pages had more polish.
- Two rounds of title rewrites on Product B left every page under 1.1%. Titles are not the limit on a page the results page already answers.

Audit: S2 intent buckets, P10 page families. Rank Pages items by impressions at stake times the bucket's click rate.

## 4. Competitor-name pages are the repeatable engine

A page whose URL and H1 are "<competitor> alternatives", for a competitor buyers actually choose between, earns more than any other non-brand family.

- Product A: compare plus alternatives pages took 49% of all clicks and 59% of non-homepage clicks in the 28 days to 2026-11-01, and 44% and 69% in the 28 days to 2026-08-11. In the 28 days to 2026-11-01 alternatives pages out-clicked compare pages 3.5 to 1 (1,070 clicks at 4.26% against 309 at 1.85%). Source: "Agent-First Growth Playbook" (refreshed 2026-11-03), Part 1, readings 1 and 2.
- Product A: the Herdr pages took one 77-minute session to build, were in Google the same day, and earned 361 clicks at 3 weeks and 745 at 6. `/alternatives/herdr` alone is second only to the homepage, and "herdr alternatives" runs 8.6% at position 2.6. Being first on a new competitor name wins.
- Product A: editing an existing page to target "conductor competitors" (2,155 impressions at position 18.6) did not move it. A page whose URL and H1 are the query does better than retargeting another page.
- Product B: alternatives was its best family by click rate (1.7%) while "vs" pages stayed near 0.4%.

Audit: P12 competitor sitemaps, P13, P14. Ship a new competitor's page within a week of it appearing in search data.

## 5. Write specific pages a few at a time

Large template batches get held back, and template pages wait until outside pages link in (principle 1).

- Product B: a batch of hand-written single-topic pages earned about 4x the six-week clicks of a template batch almost four times its size. The single pages reached first impression almost at once; the batch took a median of about four weeks, and 46% of it was never shown.
- Product A: of 14 short definition pages shipped in one batch in October, Google indexed 1.

Audit: P11. Ship 5 to 15 hand-written pages at a time; pause a template family until the last batch is indexed and linked from pages outside it.

## 6. AI answers carry visibility without clicks

AI features now show a large share of a site's search visibility and send few clicks. The only ways to see them are Search Console's AI report, asking the assistants, and asking sign-ups.

- Product B: AI-feature impressions rose from 14% to 34% of web impressions in five months. Its most-quoted definition page has over half its impressions in AI features and about 0.1% click rate.
- Product A: `/compare/conductor` lost its blue link to an AI Overview around Sep 11 and became a source card; its queries lost two thirds of their clicks at the same rank.
- Product A: pageviews referred by AI assistants fell from 19.5 a day in July to 9.5 a day from Oct 6 to 31, and claude.ai pageviews from 44 in August to 5 in October (monthly totals). Counted as sessions, AI-assistant visits were 9.48 a day (Jun 24 to Aug 22), 4.94 (Aug 23 to Sep 8) and 5.29 (Oct 6 to Nov 2), and Claude sessions 1.02 to 0.14 a day. Source: "Agent-First Growth Playbook" (refreshed 2026-11-03), "Where Product A stands with AI agents". Only a citation probe separates lost citations from lost referrers.

Audit: P13, P14, S7, S8, A1. Judge explainer pages by AI views, not clicks. Open money pages with a 40 to 60 word direct answer, since that is what the Overview quotes.

## 7. Ask sign-ups; tracking undercounts AI

- Product B: once its sign-up survey offered an AI option, about a quarter of answers each month (25 to 28%, every month since) named an AI assistant, while first-touch tracking credited AI with about 4%: self-reported AI ran 4x to 5x tracked AI. About 1 in 7 of those sign-ups had an AI first touch; most arrived as organic search or direct. Buyers ask an assistant, then search the brand.
- A single "AI" option cannot say which assistant to work on. Split it.

Audit: F2. Quick wins: add the question, or split the option by assistant; cross-tab answers against first touch.

## 8. Split before judging

- Product B: brand queries carried 87% of query clicks and about 3/4 of organic sessions landed on the homepage. Non-homepage clicks still grew 7x year over year against +30% for the homepage.

Audit: S1. Report brand vs non-brand and homepage vs the rest before crediting any page work.

## 9. Agent readiness is real and separate from citations

Make the facts machine-readable and true, then stop.

- Product A scored 87 on Ora (scan of 2026-11-03) and 100 on is-agentic (a cached scan dated 2026-08-31) while its AI visits fell. Scores measure readiness, not citations or traffic.
- Product A served Markdown only on `/` and `/docs` while compare and alternatives pages held 5,101 of 10,513 lifetime page-level clicks (through 2026-11-01).
- Product A's `/.well-known/mcp` described a local server; scanners POST to it, get a 405, and flag a broken handshake.
- Product B's agents.md described an MCP server and OAuth endpoints that did not exist. Scanners count that as a broken promise.
- Product B ranked below several other businesses for its own name in the scanner's searches, a generic-name collision with no entity.

Audit: P16, P17, P18. Fix wrong or missing facts first (price, when to use, entity), then Markdown on money pages. Recommend developer items (agents.md, MCP, OAuth) only when the product sells to developers.

## 10. One fact, everywhere

Assistants repeat whichever version of a price they find. A price that differs across pages becomes a wrong answer. A pricing page hidden by `noindex` leads AI answers to say prices are not public, and third-party pages keep repeating a retired price until someone asks them to change it.

Audit: P8, P9, P15. Read today's pages before reporting a conflict.

## 11. Log every change and read it twice

- Product A: rebuilding about 95 pages in October without changing URLs or titles moved with the rest of the site at 3 weeks.
- Product B: a title test judged early looked like a win; at 3 and 6 weeks against untouched pages, the answer changed.
- Product A: analytics recorded nothing from Sep 9 to Oct 5, and an attribution job failed every run on an empty secret. Nobody noticed for weeks.

Audit: F3, A2. Quick wins: an experiment log with baselines, control pages, and 3-week and 6-week reads; an alert when any measurement pipeline goes quiet for a day.

## 12. Localize winners, not the catalog

- Product A: `/ko/alternatives/conductor` ran a 29.4% click rate in the localized pages' first 28 days (Jul 15 to Aug 11, after the Jul 14 launch), and `/ko/alternatives/cmux-windows` held 282 lifetime clicks at 15.8% through Nov 1. Korean pages still ran 4.94% in the 28 days to Nov 1, while Spanish ran 0.31% on 6,427 impressions and German 0.16%. Localized definitions earned nothing.

Audit: A3, S2 by country. Localize proven alternatives pages into locales that already convert; diagnose leaking locales before adding any.

## 13. Some queries want people

- Product A: "conductor vs competitors reddit" showed 150 impressions and earned 0 clicks. Its social posts drew 14 of 738 views in 55 days. Product B's community share in its survey was under 1%.

Audit: S4 queries containing "reddit" or "forum". Treat it as a workstream with drafted replies a person posts, and measure it like any other bet.

Sources: "Growth, phase by phase" (v2, 2026-11-04); "Agent-First Growth Playbook" (updated 2026-11-03); "Product B growth deep dive" (2026-11-03); "Why new pages are not indexed" (2026-11-03); "Conductor query clicks" (2026-11-03); "Why AI-assistant visits to Product A fell" (2026-11-03); "Product B sign-up survey answers" (2026-11-03).
