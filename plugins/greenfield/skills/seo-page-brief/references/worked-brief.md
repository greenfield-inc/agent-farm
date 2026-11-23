# Worked brief: an alternatives page

A filled brief for a made-up product, written the way the strategist hands it to the writer. Example Co makes an open-source status page tool with a free self-hosted edition and a hosted plan. Rivalsoft is a hosted status page service that raised its price on 2026-11-01. Northwind Status, Contoso Uptime and Fabrikam Beacon are made-up alternatives. Every number about Example Co and its rivals is invented; every number about Product A is real and cited.

The brief follows the alternatives page recipe Product A's writer brief used for its 54-page alternatives program ("Alternatives pages for the gap analysis", 2026-11-16 to 2026-11-17). The table after the brief gives the Product A evidence behind each choice.

---

## Brief: /alternatives/rivalsoft

**Status:** approved by the person 2026-11-21 for building. This brief is not permission to publish: the writer opens a draft PR and the person merges.
**Strategist:** seo-strategist run of 2026-11-20 · **Ranked page item:** #4 "Rivalsoft price change: alternatives page" (this week)

### 1. Query and intent

| Query | Impressions | Clicks | Position | Landing page now |
|---|---|---|---|---|
| rivalsoft alternatives | 1,180 | 9 | 14.2 | / (homepage) |
| rivalsoft vs example co | 410 | 22 | 3.1 | /compare/rivalsoft |
| rivalsoft free plan | 260 | 0 | 31.0 | / (homepage) |
| self hosted rivalsoft | 140 | 3 | 11.8 | /docs/self-hosting |

Source: the connected Search Console tool, query and page dimensions, 28 days to 2026-11-19 (data lags about 3 days). "rivalsoft alternatives" had 310 impressions in the 28 days before 2026-11-01: demand rose almost fourfold after the price change.

**Buyer job:** a team paying for Rivalsoft wants a cheaper or self-hosted status page and needs to know what it gives up by moving.

### 2. The page that owns it now

- "rivalsoft alternatives": no page owns it. Its impressions land on the homepage at position 14.2. A new page is the right move.
- "rivalsoft vs example co": owned by /compare/rivalsoft (position 3.1, a hands-on page from June). The new page leaves this query to it and links to it; it does not target it.
- "self hosted rivalsoft": owned by /docs/self-hosting. The new page links to it.

### 3. What ranks now

Searched 2026-11-20, logged out, US English:

1. Rivalsoft's own pricing page.
2. A review site's "Top 10 Rivalsoft alternatives" listing, dated 2025-06, still showing the old $29 price.
3. Northwind Status's "Rivalsoft vs Northwind" page.
4. A forum thread "Rivalsoft price increase" (2026-11-03).
5. A 2024 listicle of status page tools.

AI Overview: shown. It names Northwind Status and "Contoso Pulse" (the old name of Contoso Uptime). Transcribed from the results page on 2026-11-20; Search Console's API does not report it.

**Gap:** no result written after the price change compares hosted and self-hosted options or says what each costs now.

### 4. Facts the page may use

Copied from `.seo/facts.md` (excerpt below). Only rows marked approved go on the page.

Example Co (own product, checked against v3.2.0 on 2026-11-20):

| Claim | Source | Date | Owner | Approval | Allowed wording | Stated on |
|---|---|---|---|---|---|---|
| Self-hosted edition is free | LICENSE (MIT) and docs/self-hosting at v3.2.0 | 2026-11-20 | Product lead | approved 2026-11-20 | "The self-hosted edition is free and MIT-licensed." | /pricing, /docs/self-hosting |
| Hosted plan price | /pricing source and billing config at v3.2.0 | 2026-11-20 | Product lead | approved 2026-11-20 | "Hosted plans start at $12 a month." | /pricing, /compare/rivalsoft |
| Imports Rivalsoft incidents and components | Importer code and docs/migrate at v3.2.0 | 2026-11-20 | Engineering lead | approved 2026-11-21 | "Imports your Rivalsoft components and incident history." | docs/migrate |
| SAML SSO | Roadmap doc | 2026-11-20 | Product lead | rejected: roadmap, not shipped | none | none |
| "99.99% uptime" | Homepage demo widget | 2026-11-20 | Product lead | rejected: illustrative number in a demo | none | / (demo only) |
| "The only open-source status page" | Earlier draft copy | 2026-11-20 | Product lead | rejected: false, Fabrikam Beacon is open source | none | none |

Rivalsoft (competitor, re-check on drafting day and before ready):

| Claim | Source | Date | Owner | Approval | Allowed wording | Stated on |
|---|---|---|---|---|---|---|
| Starter plan $39 a month since 2026-11-01, was $29 | Rivalsoft pricing page and its changelog entry of 2026-10-15 | 2026-11-20 | Strategist | approved 2026-11-21 | "Rivalsoft's Starter plan costs $39 a month (up from $29 on November 1, 2026)." | /compare/rivalsoft (says $29: stale, fix in this PR) |
| Free plan ended 2026-11-01 | Rivalsoft pricing page FAQ | 2026-11-20 | Strategist | approved 2026-11-21 | "Rivalsoft no longer has a free plan." | none |
| Has SAML SSO | Rivalsoft docs; its tracker issue was closed as shipped on 2026-11-12 | 2026-11-20 | Strategist | approved 2026-11-21 | "Rivalsoft supports SAML SSO on its Business plan." | /compare/rivalsoft (says "no SSO": stale, fix in this PR) |
| Hosted in EU region | A 2025 review-site listing | 2026-11-20 | Strategist | rejected: secondary source; Rivalsoft's docs do not say | none | none |

Contoso Uptime (renamed from Contoso Pulse on 2026-10-14; contoso-pulse URLs redirect):

| Claim | Source | Date | Owner | Approval | Allowed wording | Stated on |
|---|---|---|---|---|---|---|
| Free tier: 10 monitors | Contoso Uptime pricing page | 2026-11-20 | Strategist | approved 2026-11-21 | "Contoso Uptime (formerly Contoso Pulse) has a free tier with 10 monitors." | /alternatives/contoso-pulse |

Northwind Status and Fabrikam Beacon have their own sections in the ledger, read the same way.

**Stale claims:** two found on /compare/rivalsoft, fixed in the same PR (see "Stated on").

### 5. Proof with permission

- One customer quote from a team that moved off Rivalsoft in October, with permission granted in writing by the customer's founder on 2026-11-18 (support ticket reference in the ledger). Metric in the quote: "cut our status page bill to zero", defined as their Rivalsoft invoice before and their self-hosted cost after; attribution limit: one team.
- Screenshots: Example Co only, from a hands-on run of v3.2.0. No screenshots of the other three tools: nobody ran them.

### 6. Structure

1. H1: "Rivalsoft alternatives". Two-sentence answer first: what changed at Rivalsoft and which option fits which team.
2. At-a-glance table: price today, free option, self-hosting, SSO, incident import, for Example Co and the three others, each figure from the ledger with its checked date under the table ("Figures checked 2026-11-20").
3. Example Co first, then exactly three other real tools: Northwind Status (hosted, free tier), Contoso Uptime (formerly Contoso Pulse; free tier), Fabrikam Beacon (self-hosted, open source). Each card opens with where that tool beats Rivalsoft and where Rivalsoft still wins.
4. "Stay with Rivalsoft if" box, before the next one: you need SAML SSO today, or you want a vendor to run it with no setup.
5. "Pick Example Co if" box: you can self-host, or you want hosted for $12 a month and your Rivalsoft history imported.
6. FAQ, four questions people search: "Is Rivalsoft free?", "Can you self-host Rivalsoft?", "How do I move my status page off Rivalsoft?", "Does Rivalsoft support SSO?".
7. Tested line: "We ran Example Co v3.2.0. We didn't install or run Northwind Status, Contoso Uptime or Fabrikam Beacon; their facts come from their own pages, checked 2026-11-20."

No FAQPage markup: since August 2023 Google shows FAQ rich results only for authoritative government and health sites, and the visible answers serve readers. JSON-LD: the site's standard `Article` block, with Contoso Pulse as an `alternateName` where Contoso Uptime is described.

### 7. Title and description

- Title: "Best Rivalsoft Alternatives in 2026 (Free, Self-Hosted)" (55 characters). It leads with the query and ends with what the searcher resolves.
- Description: "Rivalsoft now costs $39 a month and has no free plan. Four alternatives, two of them free, with what each does better and where Rivalsoft still wins." (149 characters)

### 8. Internal links

Links in, from pages that already earn traffic (impressions, 28 days to 2026-11-19, connected Search Console tool):

| Linking page | Impressions | Anchor |
|---|---|---|
| /status-page-for-startups | 2,300 | "Rivalsoft alternatives" |
| /docs/self-hosting | 1,150 | "moving from Rivalsoft" |
| /pricing | 890 | "compared with Rivalsoft and others" |
| /alternatives (hub) | 640 | "Rivalsoft" |
| /compare/rivalsoft | 410 | "other Rivalsoft alternatives" |

Five linking pages with 100+ impressions, 5,390 impressions in total. Plus the sitemap entry and a line in `llms.txt`.

Links out, all returning 200 on 2026-11-20: /docs/self-hosting, /docs/migrate, /pricing, /compare/rivalsoft.

Not linked: /migrate/rivalsoft (planned, returns 404 today). Its link is added by the PR that ships it.

### 9. Rewrite guardrails

New page, so none for it. In /compare/rivalsoft, change only the two stale claims (price and SSO) and add the link; its URL, title, headings, anchors, table and JSON-LD stay as they are.

### 10. Measurement and the experiment it starts

The writer adds `.seo/experiments/2026-11-21-rivalsoft-alternatives.md` in the same PR:

```
---
id: 2026-11-21-rivalsoft-alternatives
hypothesis: A dated alternatives page for Rivalsoft, linked from five pages with traffic, takes "rivalsoft alternatives" from the homepage at position 14.2 to page one.
pages: [/alternatives/rivalsoft, /compare/rivalsoft]
read_21:
read_42:
status: running
---
```

- What changed: new /alternatives/rivalsoft; two fact fixes and one link on /compare/rivalsoft.
- Baseline: the four queries above, 28 days to 2026-11-19, connected Search Console tool.
- What stays unchanged: every other page's title, headings and links during the window.
- Control: the other alternatives pages that ship no change in the window, read over the same days before and after.
- Confounders: the Rivalsoft price change is still driving new demand, so the control and the query's total impressions both matter; any further Rivalsoft news is dated in the record.
- Scenario (a hypothesis, not a forecast): Product A's alternatives pages ran 4.26% CTR (28 days to 2026-11-01), and its first page on a newly searched name reached 8.6% CTR at position 2.6. Product A took 8 to 12 weeks to its first signal as a new site; Example Co's site is established, so the 4 to 6 weeks seen on Product B is the closer guide.
- Day 7: inspect the URL with the connected Search Console tool. Not fetched by day 7: check the inlinks before anything else.
- Stop, continue, expand at the 42-day read: expand (ship /migrate/rivalsoft) when the page is on page one with CTR above 2%; continue when indexed and climbing; stop and open an investigation when it is not indexed. Under 20 clicks, the read is directional only.

### 11. Acceptance checks

Each claim matches its approved ledger row; one H1; title, description and canonical as above; JSON-LD matches visible content; every link returns 200; the table and both boxes read on a 390 px screen; the site's build and its claims and link checks pass. Competitor rows re-checked on the day the PR is marked ready.

### 12. Open decisions

None. The person approved the customer quote's use on 2026-11-21.

---

## Why the recipe looks like this

| Recipe choice | Product A evidence |
|---|---|
| An alternatives page, not a new compare page | Alternatives pages earned 1,070 clicks at 4.26% CTR against compare pages' 309 at 1.85% in the 28 days to 2026-11-01 (3.5 to 1); lifetime 4.38% against 2.28%. Competitor-name pages brought 49% of all clicks in that window. |
| Compare pages only from a hands-on run | Of 9 new compare pages shipped from 2026-10-05, 2 were indexed. The 54-page program built no compare pages, because the site's compare pages are hands-on with screenshots and nobody ran those tools. |
| Move fast on a new or newly searched name | The first Herdr pages were in Google the same day: 361 clicks at 3 weeks, 745 at 6; "herdr alternatives" reached 8.6% CTR at position 2.6. After Conductor's 2026-11-04 announcement, /alternatives/conductor took 119 clicks on 9,571 impressions (Oct 20 to Nov 17). |
| Product first, then exactly three real tools | The writer brief's rule for all 54 pages, so each page stays a short decision, and the glance table stays readable. |
| "Stay with <tool> if" before "Pick <product> if" | Concede first: the honest-copy rule from "SEO Strategy" (2026-07-17) and the foundations rewrite's "page rules every money page follows" (2026-09-10). Product A's page for people leaving it named five real reasons, each confirmed by its own docs (PR #241, 2026-11-15). |
| Resolution in the title | Of five May 2026 compare-title rewrites, only the resolution-framed one hit target (3.14% then 3.95% CTR); titles with an em-dash suffix stayed under 1%. |
| Five linking pages with 100+ impressions | Product A's indexed new pages had a median 7 inlinks, 5 of them from pages with 100+ impressions; the unindexed had 3, 2 of them from such pages ("Why new pages are not indexed", 2026-11-03). |
| No link to /migrate/rivalsoft yet | Product B linked pages days before they existed; Google's 404 went unrecrawled for months. |
| Every competitor fact from a primary source, dated | The four PRs had 9, 13, 11 and 6 Must-Fix findings, mostly wrong facts from desk research; Conductor's shutdown copy was overturned by a release nine days later. |
| "Formerly" naming for a renamed tool | The Superset to Paradev rename kept the old slugs that rank and said "Paradev (formerly Superset)" at first mention, in titles and in meta descriptions ("Superset is now Paradev, PR #242", 2026-11-15). |
| Windows and Linux variants as their own pages, when the demand exists | Each variant gets its own angle. `/alternatives/conductor-windows` reached 86 clicks on 899 impressions in 30 days at position 1.4 and 309 lifetime clicks through 2026-11-01; `/alternatives/humanlayer-windows`, built with no demand, earned 0 clicks on 25 to 32 impressions. Check the query's impressions before cloning a variant. |
| A shut-down or pivoted tool gets a page written for people leaving, with dates | The 54-page program gave Omnara, Ona, Stagewise, Vibe Kanban and DevPod pages for leavers, each with the dates of the shutdown or change; a tool with no site left (1code) got no page. |
| "We didn't install or run it." | The writer brief's tested line, so a reader knows which facts are hands-on. |
| Visible FAQ, no FAQ markup | Google limited FAQ rich results to government and health sites in August 2023; the recipe's four or five FAQs are the questions people search ("Is <tool> free?"). |

Sources: "Alternatives pages for the gap analysis" (Session item, 2026-11-16 to 2026-11-17: writer brief, own-product facts file, fact sheets, claims tables, findings for four PRs); "Growth, phase by phase" (v2, 2026-11-04), Phases 2 and 3; "Why new pages are not indexed" (investigation, 2026-11-03); "Content Briefs" (2026-05-07 to 2026-05-14); "SEO Strategy" (2026-07-17); "Superset is now Paradev, PR #242" (2026-11-15); the Product A landing pages redo (data Oct 20 to Nov 17, 2026).
