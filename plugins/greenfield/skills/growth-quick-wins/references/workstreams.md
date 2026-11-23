# Workstream catalog

Propose a workstream when a probe on this product shows the gap. Each entry gives the outcome, the trigger, the evidence from the two cases (see [principles.md](principles.md)), the first step, the measure, and when to review. Sizes: S is under a day, M is up to a week, L is several weeks.

## Alternatives family (M, ongoing)

- Outcome: a "<competitor> alternatives" page for every competitor buyers choose between, linked from a hub in the menu or footer.
- Trigger: P12 or P13 shows competitors with search demand and no page; S2 shows `alternative` or competitor-name queries landing nowhere.
- Evidence: Product A's compare plus alternatives pages took 49% of all clicks and 59% of non-homepage clicks over the 28 days to 2026-11-01 (44% and 69% in the 28 days to 2026-08-11), and alternatives ran 4.26% against 1.85% for compare pages ("Agent-First Growth Playbook" (refreshed 2026-11-03), readings 1 and 2); Product B's alternatives family was its best by click rate (1.7%).
- First step: list competitors named by every assistant in P14 and by Search Console; ship two pages by hand.
- Measure: clicks and click rate per page against the vs pages; index status at 7 days. Review at 3 and 6 weeks.

## Platform-gap pages (S per page, weekly check)

- Outcome: an exact-match page ("<competitor> alternative for <platform>") live within days of a rising competitor shipping without that platform.
- Trigger: P21 or P13 shows a competitor with rising demand that lacks a platform the product supports (Windows, Linux, mobile, a browser).
- Evidence: Product A's `/alternatives/conductor-windows` set the template: 24 clicks at 11.8% in its first window, then 0 to 899 impressions and 86 clicks in 30 days at position 1.4 on "conductor alternative for windows". It works only when four factors hold together: a rising competitor brand, a real platform gap, an exact-match page shipped early, and the product truly filling the need. Each failure broke one: humanlayer-windows earned 0 clicks on 25 to 32 impressions (brand too small), superset-linux 0 clicks (demand too small), emdash-windows was never built (the gap closed first). conductor-linux drew 105 impressions and 9 clicks, about a ninth of the Windows demand, so a Windows gap is worth about 9x a Linux gap.
- First step, the playbook: about weekly, check for launches (Hacker News, X, YC, GitHub trending); verify the gap from the competitor's install docs the same day; score demand (P21, or S5b at Search tier); ship the exact-match page from the template with its wiring (links from pages with traffic, sitemap, hub); open an experiment record; after a month, harvest the head terms the page ranks 8 to 15 for.
- Measure: impressions and clicks on the exact query at 7, 21 and 42 days.

## Event response (S, within two days of the event)

- Outcome: pages live the day after news that moves demand: a competitor shutting down, pricing changing, or a platform change buyers search for.
- Trigger: a competitor's announcement, or news about a platform the product depends on.
- Evidence: Product A shipped `/use-your-claude-subscription` the day after Anthropic's credit news (May 14); it earned 84 clicks on 6,338 impressions from Oct 20 to Nov 17. After Conductor announced its wind-down on 2026-11-04, `/alternatives/conductor` earned 119 clicks on 9,571 impressions and `/compare/conductor` 72 on 3,835 (Oct 20 to Nov 17), against 42 clicks for `/compare/conductor` in the 28 days to Nov 1. Product A's response plan grouped new page slugs by intent, wrote one brief per page, added a comparison chart, and included a rename.
- First step: within two days, one post, the pages for people leaving (alternatives, migration, comparison), and a waitlist or sign-up that records which page each sign-up came from. Cite the primary announcement, claim nothing unchecked, and never invent a transition length.
- Measure: impressions on the competitor's name plus "alternative", and sign-ups by source page, weekly for six weeks.

## Free and pricing intent pages (S to M)

- Outcome: a page aimed at "free <category>" when a free plan exists, an indexable pricing page, and "is <competitor> free" answered.
- Trigger: P3 or P8 finds pricing hidden or missing; S2 shows free or pricing queries landing on the homepage.
- Evidence: Product B's free-plan searches ran 4.11%, about 7x any other intent, and nearly all their clicks landed on the homepage.
- First step: confirm the free plan's limits, then write the page with the price table first.
- Measure: cluster click rate at 30 and 60 days; sign-ups by landing page.

## Best-of list (S)

- Outcome: one honest "best <category> (year)" page, 8 to 10 products with prices and who each suits, the product ranked on merit.
- Trigger: P13 or P14 shows third-party lists cited for "best <category>".
- Evidence: Product B's category shopping queries ran 0.08 to 0.13% with only an explainer to land on. Low click ceiling; the value is being the list assistants cite.
- First step: draft the table with sourced, dated prices.
- Measure: position on "best <category>"; citations in the probe.

## One price everywhere, and correct what others say (S to M)

- Outcome: one price and one set of plan facts on every page, llms.txt and structured data, and third-party pages corrected to match.
- Trigger: P9 finds pages disagreeing; P14 or P15 finds assistants or third-party pages stating a wrong, retired or "quote only" price.
- Evidence: what P9, P14 and P15 find on this site. Assistants repeat whichever version of a fact they find, so a pricing page hidden by `noindex` or a retired price on a competitor or review page becomes a wrong answer.
- First step: make the site's own pages agree (P9), then email each third-party owner the correction with a link to the pricing page.
- Measure: the citation probe's wrong-fact count per month; each third-party page re-read at 30 days.

## Citation probe (S, monthly)

- Outcome: a monthly record of whether assistants name the product, for which questions, and with which facts.
- Trigger: always, unless one exists.
- Evidence: Product A's AI-referred pageviews halved (19.5 a day in July to 9.5 a day Oct 6 to 31) and its AI-assistant sessions fell from 9.48 a day (Jun 24 to Aug 22) to 5.29 (Oct 6 to Nov 2), with no site change that explained it ("Agent-First Growth Playbook" (refreshed 2026-11-03)); only a probe tells lost citations from lost referrers.
- First step: 20 to 30 buyer questions, four assistants, logged out; log named or not, cited URLs, wrong facts, and a screenshot.
- Measure: share of questions where the product is named, month over month.

## Agent-readable facts (S to M)

- Outcome: true, current facts for agents: llms.txt with when to use and when not to, a Markdown price list, Organization data, and Markdown on money pages.
- Trigger: P16 to P18 gaps that fit the buyer; any file that promises what the site does not serve.
- Evidence: Product A scored 87 on Ora and 100 on is-agentic and its AI visits still fell; Product B's agents.md promised endpoints that did not exist. Facts first, polish last.
- First step: fix wrong or missing facts; then Markdown on the pages that earn clicks.
- Measure: P17 coverage; probe citations; AI referrer landings.

## Entity and brand name (S)

- Outcome: search engines and assistants tell the product apart from other things with its name.
- Trigger: P13 shows the site below #1 for its own name, or P18 finds no entity and a name shared with another product or a common word.
- Evidence: Product B ranked 8th to 10th for its own name in the scanner's searches, among many businesses sharing the word. Product A's name is a common English word, and the scan flagged no entity.
- First step: Organization, WebSite and SoftwareApplication JSON-LD with `alternateName` and `sameAs`; a Wikidata item; an FAQ line saying the product is not the other one; a footer "Not affiliated with ..." line when a same-named product exists.
- Measure: rank for the bare name and the citation probe's answer to "what is <product>".

## Indexing hygiene (S, then a standing check)

- Outcome: every new page indexed within two weeks.
- Trigger: S5 shows unindexed recent pages; P1 to P6 find orphans, noindex money pages, one build-date `lastmod`, redirect chains, or early links.
- Evidence: 24 of Product A's 41 new pages unindexed with 2 vs 5 inbound links from traffic pages; Product B's early links left 404s for five months.
- First step: a link test: two links from high-traffic pages to half the unindexed pages, the other half left as a control.
- Measure: indexed count at 7 and 28 days, treated vs control.

## Build gates: claims, links, dates (S to M)

- Outcome: the site's build fails before a wrong claim, a broken link or a stale date ships.
- Trigger: P9 or P15 finds a wrong fact the site itself published; P4 or P5 finds broken internal links or links to unbuilt pages; F1 shows links committed before their pages.
- Evidence: a third product's SEO plan (2026) shipped these gates: a claims check that fails on banned claims, gated claims without a tag, a gate marked shipped without evidence, and placeholder prices, with a rendered check that crawls every sitemap URL plus llms.txt and llms-full.txt; an internal-link check that fails when a pillar page has fewer than 2 contextual inbound links or fewer than 5 linking pages, when a hub misses a page, or when an internal link does not return 200; dates stored in one file; a fact sheet per changed page with claim, source URL, quote and verified date. Product B's links to unbuilt pages left 404s for five months.
- First step: the internal-link check (links resolve and point at built pages), then the claims check over prices.
- Measure: failures caught per month; zero 404s from internal links in S5.

## Source survey and split (S)

- Outcome: a sign-up question "How did you hear about us?" on day one with each AI assistant as its own option, the first-touch source saved onto the sign-up, answers cross-tabbed with first touch; reports split brand vs non-brand and homepage vs the rest.
- Trigger: F2 finds no survey or a single AI option; P19 finds no form asking; S1 shows brand dominance.
- Evidence: in Product B's survey, about a quarter of answers each month named an AI assistant while tracking credited about 4%: 4x to 5x more. Only about 1 in 7 of those had an AI first touch. Before the AI option existed, about 2% typed it in.
- First step: add the field to the sign-up or quote form.
- Measure: AI share by assistant per month, next to tracked AI share.

## Experiment log (S, standing)

- Outcome: one record per change with live date, pages, baseline, expected effect, control pages, and 3-week and 6-week reads, failures included.
- Trigger: F3 finds none, or recent launches cannot be told apart.
- Evidence: Product B's early title verdict reversed at 6 weeks; Product A's 95-page rewrite moved with the site.
- First step: log every change in this audit's quick wins as it ships.
- Measure: past-due reviews closed each month.

## Localization of winners (M)

- Outcome: the best alternatives pages in locales that already convert, and no new locale until a leaking one is understood.
- Trigger: A3 or S2 by country shows a locale converting, or competitors' sitemaps (P12) carry localized versions of pages that win.
- Evidence: Product A's localized pages earned 193 clicks in their first 28 days, then 231 clicks on 17,081 impressions (1.35%) in the 28 days to Nov 1: impressions grew 2.3x while clicks barely moved. Korean ran 4.94%, and the first Korean win, `/ko/alternatives/cmux-windows`, earned 19 clicks at 13.38% against 2 for the English page in the 28 days to 2026-08-04 ("SEO Briefing", Product A, 2026-08-05) and 282 lifetime clicks at 15.8% through 2026-11-01; Spanish leaked at 0.31% on 6,427 impressions and German at 0.16% on 1,830. Translated definitions earned nothing. Product A's later changes still translated pages into all 11 locales while new alternatives pages shipped English-only; the evidence settles it as localize winners and stop translating the catalog.
- First step: diagnose any leaking locale first; then translate two winners into the converting locale.
- Measure: click rate per locale against the English original.

## Conversations and community (M, ongoing)

- Outcome: the product present in threads where buyers ask people.
- Trigger: S4 or P13 shows "reddit" or "forum" queries, or threads naming competitors rank for buyer questions.
- Evidence: Product A's "conductor vs competitors reddit" had 150 impressions and 0 clicks, and no page can win it. Unproven on both cases.
- First step: a weekly sweep of at most 5 threads with drafted replies a person posts.
- Measure: tagged clicks and sign-ups from threads.

## Others the evidence can call for

- **Own your alternatives page**: "<product> alternatives", written before a competitor writes it (P13).
- **Conversational pages**: one page whose H1 is a 5+ word question from S4, judged at 30 to 60 days.
- **Vertical pages**: "<category> for <vertical>" where impressions exist.
- **Competitor launch watch**: ship a new competitor's alternatives page within a week of its name appearing.
- **Measurement repair**: one conversion event matched across systems; alerts on silent pipelines.

## Rules for any workstream

- Keep URLs that already earn traffic. A move resets indexing and can drop clicks for weeks.
- Source every competitor claim with a dated primary link, and keep each competitor page removable in one change.
- Extend a page that already ranks for a term instead of adding a page that splits it (S6).
- Ship 5 to 15 hand-written pages per batch; a single new competitor page ships on its own.

## Time estimates

From work sessions on both products, one person with an agent:

| Work | Time |
| --- | --- |
| Title, meta, or first-paragraph fix | 10 to 30 min |
| Redirect, canonical, footer link, sitemap fix | under 1 h |
| Alternatives page for a new competitor | about 1.5 h |
| A batch of 9 compare and 3 alternatives pages | about 3 h |
| Landing page with FAQ, structured data, llms.txt, robots | about 4 h |
| Analytics install and first events | about 3 h |
| Agent-readiness pass across a site | about 7.5 h |
| Translating a site into 10 locales | about 9 h |

Cheap with high return: alternatives pages for new competitors, internal links, titles on brand-only pages, the survey question. Expensive with low return: large rewrites, translation of everything, readiness polish, big template batches. The slow part is waiting 3 to 12 weeks for signal.

Sources: "Growth, phase by phase" (v2, 2026-11-04); "Agent-First Growth Playbook" (updated 2026-11-03); Product A's platform-gap playbook (2026-07-15) and Conductor event-response plan (2026-11-04), both in its repository and work sessions; "Product B growth deep dive" (2026-11-03); "Product B sign-up survey answers" (2026-11-03); "Work sessions behind the growth work" (2026-11-03).
