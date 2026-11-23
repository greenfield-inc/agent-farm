# Corrections

Every belief this work held and later found wrong. Each entry gives the wrong belief, what is true, the evidence with its number, the source by title and date, and what you do instead. A belief listed here never reappears as advice in a page, brief, record or review. The reviewer checks every output against this list.

Product A is an open-source developer tool for running coding agents in parallel (real numbers). Product B is a B2B healthcare SaaS with a free plan (ratios only). "A third site" and "the customer workflow starter" are the same customer engagement: its method is used, and none of its names, numbers or domains. One entry cites a document-sharing product for a general fact about crawling.

## The ones agents repeat most

### 1. Google does not read IndexNow

- **Believed:** pinging IndexNow on every deploy cut Product A's wait to appear in Google from 54 days to 1.
- **True:** IndexNow reaches Bing, Yandex and the other engines that take part. Google does not take IndexNow submissions. Faster indexing came from growing site authority and links from crawled pages.
- **Evidence:** CI submitted all 41 English pages Product A shipped 2026-10-05 to 10-10; URL Inspection on 2026-11-03 showed 17 indexed and 24 never fetched. Four pages shipped 2026-10-28, while every IndexNow run was refused over a failed account payment, were indexed within 3 days with no submission. Median days to first impression had fallen from 54 (pages shipped by May 8) to 1 to 3 as the site gained authority.
- **Source:** "Agent-First Growth Playbook" (Product A refresh, 2026-11-03), reading 4, marked "Broke"; "Growth, phase by phase" (v2, 2026-11-04), Phase 4.
- **Do instead:** for Google, link each new page from a page that already earns search traffic, run URL Inspection at day 7 and request indexing for misses, and keep sitemap `lastmod` accurate per page. Submit to IndexNow only as a Bing step, and say so. Use the Google Indexing API only for the content types Google allows it for. Never credit IndexNow for a Google result.

### 2. Scanner scores measure agent readiness, not citations or AI traffic

- **Believed:** a higher is-agentic or Ora score means assistants cite the site more or send more visitors.
- **True:** a scanner scores whether an agent *could* find, read and use the site. It does not measure whether assistants cite it or send anyone. The score did not predict AI traffic in either direction.
- **Evidence:** Product A reached is-agentic 100/100 (scan dated 2026-08-31) and Ora 87/100 (2026-11-03), and its AI-assistant pageviews fell from 606 in July to 247 in October (5.2% to 1.4% of pageviews). Product B scored is-agentic 64/100 (scan dated 2026-08-23) and Ora 65/100 (2026-11-04), and its AI-assistant visits about doubled from May to October. A first pass on a third site reported Ora's score under is-agentic's name.
- **Source:** "Growth, phase by phase" (v2, 2026-11-04), Principle 6; "Agent-First Growth Playbook" (2026-11-03), "Where Product A stands with AI agents"; "Product B growth deep dive, April to November 2026" (2026-11-03), "Agent-readiness scanners".
- **Do instead:** report each score with its scanner's name and its scan date (is-agentic can return a cached scan older than your run). Call it readiness. Measure AI discovery with AI referrals by assistant, the sign-up survey and an answer panel. Never set a score as a goal.

### 3. Agent-file and Markdown advice must match the buyers and what the site serves

- **Believed:** every site should add an agents.md, Markdown copies and an MCP card.
- **True:** these help only when the site's buyers use agents and the site actually serves what the file promises. A file that describes an endpoint the site does not serve is a broken promise, and scanners count it against the site.
- **Evidence:** Product B's /agents.md described MCP and OAuth that no endpoint serves. Product A served Markdown only for `/` and `/docs`, and its /.well-known/mcp card described a local stdio server, so both scanners reported a failed handshake. A first pass on a third site recommended an agents.md, a developer file that site's buyers did not need; the gap check removed it.
- **Source:** "Product B growth deep dive, April to November 2026" (2026-11-03), "Agent-readiness scanners"; "Agent-First Growth Playbook" (2026-11-03), "Where Product A stands with AI agents"; the third-site gap check (2026-11-03), method only.
- **Do instead:** recommend agent files only when the buyers use agents (developer tools, API products, buyers who research through assistants) and name the evidence. Check what the site serves with `curl -H 'Accept: text/markdown'` and an agent user agent before you call anything missing. Remove or fix promises the site does not keep before adding new files.

### 4. A dated audit is not the live site

- **Believed:** the numbers and problems in an existing audit describe the site today.
- **True:** an audit is a snapshot. Sites fix things, prices change, pages move.
- **Evidence:** a first pass on a third site repeated a price conflict from a dated audit that the live site had since fixed, and missed a money page that was marked noindex, absent from the sitemap and unlinked from navigation. The second pass, which checked every sitemap URL live, found both.
- **Source:** the third-site gap check (2026-11-03), method only.
- **Do instead:** label every number you take from an audit as the audit's, with its date. Re-check every "missing", "broken", "conflicting" or "not indexed" claim live and record the check date. The live check wins.

### 5. Moving indexed URLs resets them

- **Believed:** moving comparison posts to a cleaner path is a safe structural fix.
- **True:** a ranking URL carries its history. Moving it makes Google judge the new address again, and the old address loses its clicks. The address was not what limited those pages.
- **Evidence:** on a third site, a first pass advised moving comparison posts out of `/blog/`; the second pass reversed it after finding that a post already moved had lost its clicks at the old address, with no evidence the new one recovered them. Product A keeps old slugs that rank when a competitor renames, and writes "New (formerly Old)" on the page. Product B's deliberate move of help articles onto docs pages with canonicals did shift signals as designed: the old pages lost 61% of impressions at three weeks against a 33% fall in the control.
- **Source:** the third-site gap check (2026-11-03), method only; "Product B growth deep dive, April to November 2026" (2026-11-03), Experiments.
- **Do instead:** keep ranking URLs and link to them. When a move is unavoidable, redirect each old URL to its intent-equivalent new one, record the move as an experiment with its live date, and read it at 3 and 6 weeks.

### 6. AI-feature impressions are not in the Search Console API

- **Believed:** Search Console's API returns AI Overview and AI Mode appearances.
- **True:** the Generative AI features report exists only in the Search Console screen, and it shows impressions only, with no clicks or queries.
- **Evidence:** requests for the search types `aiOverview`, `aiMode` and `generativeAi` returned `400 INVALID_ARGUMENT`; a `searchAppearance` query on Product A's Conductor queries returned no rows.
- **Source:** "Product B growth deep dive, April to November 2026" (2026-11-03), Evidence rules; "Conductor query clicks: evidence tables" (2026-11-03), section 5.
- **Do instead:** transcribe the report from the screen and label it, as [data-sources.md](data-sources.md#ai-feature-impressions) describes. Never present an API pull as covering AI features.

### 7. Date an AI-visit drop before blaming the latest change

- **Believed:** making the site agent-ready would bring more AI visitors, and when AI visits fell after the readiness pass, the pass looked like the cause.
- **True:** the drop began three weeks before the pass, on pages the pass did not change. The pass did not cause it and did not prevent it.
- **Evidence:** Product A's AI-assistant sessions were 9.48 a day (06-24 to 08-22), 4.94 (08-23 to 09-08) and 5.29 (10-06 to 11-02). AI landings on compare and alternatives pages fell from 4.0 a day to 0.7 (-83%), with each of ChatGPT, Claude, Perplexity and Gemini down 71% to 84%; AI landings on the homepage and other pages recovered to 77% and 94%. Weekly AI landings on Conductor pages halved in the week of 08-02, from about 21 to 9. The readiness pass merged 08-22 and 08-23 and changed Markdown on `/` and `/docs` only, the landings that recovered. Root cause, medium confidence: assistants stopped citing and linking the Conductor and Superset comparison pages.
- **Source:** "Why AI-assistant visits fell after the agent-readiness pass" (2026-11-03); "Growth, phase by phase" (v2, 2026-11-04), "What surprised us".
- **Do instead:** before naming a cause, plot the drop by week, by assistant and by landing page, find the week it began, and lay the site's change dates beside it. A change can cause only what starts after it, on the pages it touched.

### 8. Tagged referrals survive referrer stripping

- **Believed:** when an assistant stops sending a referrer, its visits vanish into Direct and cannot be counted.
- **True:** visits that carry a UTM tag keep it after the referrer is gone. Count AI visits by referrer or by `utm_source`.
- **Evidence:** from October 2026 ChatGPT visits to Product A arrived as direct with `utm_source=chatgpt.com`; referrer-only ChatGPT sessions went to zero from the week of 10-04. Counting the tag kept them, and the referrer loss hides at most 15% to 20% of ChatGPT sessions. Direct, untagged landings on compare pages stayed flat, so lost AI clicks did not reappear as Direct.
- **Source:** "Why AI-assistant visits fell after the agent-readiness pass" (2026-11-03), "Referrer stripping".
- **Do instead:** classify AI visits by referrer or `utm_source`, and test whether lost visits reappear as Direct before claiming they did. Tag every outbound link you control.

## Search and indexing

### 9. If rank holds, traffic holds

- **Believed:** a steady average position means steady clicks.
- **True:** Google can move a page from a blue link into a source card under its AI Overview. Search Console still reports a top position while the clicks go.
- **Evidence:** /compare/conductor earned 134 clicks on 4,049 impressions from 08-12 to 09-13, then 19 on 1,665 in the next three weeks: about 115 of the roughly 120 clicks lost per four weeks across all Conductor queries. "conductor alternatives" fell from 45 clicks in four weeks to 4 in three. Weekly CTR for the query family (every query containing "conductor") went from 5.7% to 0.9% while position stayed between 3.4 and 6.2 and impressions held. Control query families (cmux) held. A live results page on 2026-11-03 showed the page as the third source card in the AI Overview with no blue link. Medium-high confidence (one logged-in results page).
- **Source:** "Conductor query clicks: evidence tables" (2026-11-03); "Agent-First Growth Playbook" (2026-11-03), reading 7.
- **Do instead:** read a query family's clicks and its rank separately. When rank holds and clicks drop, look at the live results page first (logged out, on more than one day) and compare against a control family.

### 10. The sitemap is enough, and more pages mean more traffic

- **Believed:** listing a page in the sitemap gets it indexed.
- **True:** a sitemap tells Google a page exists; Google decides whether to fetch it. "Discovered, currently not indexed" and "URL is unknown to Google" both mean Googlebot never fetched the page, so Google has not judged its content.
- **Evidence:** 24 of 41 Product A pages from 2026-10-05 to 10-10 were never fetched, though each returned 200, was indexable, and sat in a sitemap Google downloaded without errors. Indexed pages had a median of 5 inlinks from pages with 100+ impressions; unindexed pages had 2. Product A's sitemap gave 635 of 722 URLs the same build-date `lastmod`, so it carried no freshness signal. Product B's templated batch linked only to itself and drew no impressions until other pages linked in.
- **Source:** "Why new pages are not indexed" (2026-11-03); "Growth, phase by phase" (v2, 2026-11-04), Principle 3.
- **Do instead:** link every new page from a page with search traffic, set page-accurate `lastmod`, inspect every new URL at day 7, and treat "not fetched" as a links problem before you rewrite content.

### 11. Linking to a page before it is live is harmless

- **Believed:** links to pages shipping next week cost nothing.
- **True:** Google can follow the link first, record a 404, and not come back for months.
- **Evidence:** a Product B calculator linked four compliance pages 6 days before they existed. Google got 404 on 2026-05-30 and had not recrawled 157 days later, though all four return 200; one targets the site's top compliance query.
- **Source:** "Growth, phase by phase" (v2, 2026-11-04), "Linking ahead caused months of errors"; "Product B growth deep dive, April to November 2026" (2026-11-03), Indexing.
- **Do instead:** add a link only after its target is live. On a site that deploys by hand, live means deployed, not merged. If it already happened, request indexing for the targets and link them from pages with traffic.

### 12. "0 of 31 indexed" was not a code bug

- **Believed:** an early report that none of 31 pages were indexed, and a split between `www` and the bare domain, meant the site was broken.
- **True:** the sitemap had been submitted with an `http://` address, and the `www` split was index lag after a redirect.
- **Evidence:** Product A's first diagnosis, data pulled 2026-05-07.
- **Source:** "SEO: GSC Findings and Diagnosis" (Product A, 2026-05-07).
- **Do instead:** check the submitted sitemap's exact URL and protocol, and the redirect's age, before you diagnose the code. [data-sources.md](data-sources.md#url-inspection) lists the checks.

### 13. A blocked crawl hides a noindex header

- **Believed:** blocking a host in robots.txt keeps its pages out of Google.
- **True:** Google must fetch a page to see its `noindex`. A robots.txt block stops the fetch, so a blocked URL can still be indexed from links, without its content.
- **Evidence:** a document-sharing product added `X-Robots-Tag: noindex` to every response on its share host and left robots.txt off that host on purpose, so Google could read the header.
- **Source:** that product's share-link noindex PR (merged 2026-11-05) and its recorded decision.
- **Do instead:** to keep pages out of the index, serve `noindex` and let Google crawl them. Use robots.txt for crawl load, never for removal.

### 14. A traffic drop can be a URL migration

- **Believed:** lost landing-page clicks mean lost rankings.
- **True:** clicks can move with a migration. Count how many lost landing clicks sit on URLs that now redirect elsewhere before you diagnose ranking.
- **Evidence:** the customer workflow starter keeps migration as one of five explanation classes in every search diagnosis, because redirected URLs carry lost landing clicks that look like a ranking loss. Method only; no numbers ship.
- **Source:** the customer workflow starter's search-diagnosis method (2026), method only.
- **Do instead:** keep five explanations apart (demand, ranking, results-page presentation, migration, measurement), and reconcile redirects with their real migration dates before you call a ranking loss.

## Pages and content

### 15. Localization was not the fastest-growing family

- **Believed:** translation was the fastest-growing channel, after 193 clicks in its first 28 days (10.7% of site clicks).
- **True:** the early wins came from a few Korean and Chinese pages, not from the locale layer.
- **Evidence:** in the 28 days to 2026-11-01 Product A's localized pages had 231 clicks on 17,081 impressions (1.35%): impressions 2.3x, clicks flat. Spanish 6,427 impressions and 20 clicks; German 1,830 and 3. Korean held at 4.94%. An earlier snapshot page still says "fastest"; do not quote it.
- **Source:** "Agent-First Growth Playbook" (2026-11-03), reading 3, marked "Broke".
- **Do instead:** grow only locales whose own pages earn clicks; diagnose a locale with impressions and no clicks before adding pages in it.

### 16. Pages under 1% CTR are not necessarily failing

- **Believed:** a page under 1% CTR is a failure to fix or prune.
- **True:** Product B's lowest-CTR definition and compliance pages are among the pages Google quotes most in AI answers. Whether those answers name the product is still unmeasured.
- **Evidence:** one Product B compliance page had AI-feature impressions equal to 57% of its web impressions at about 0.5% CTR; one definition page, 53% at about 0.1%. AI-feature impressions reached 34% of web impressions in September and October.
- **Source:** "Growth, phase by phase" (v2, 2026-11-04), "The 'weakest' pages are what AI quotes most"; "Product B growth deep dive, April to November 2026" (2026-11-03), AI search.
- **Do instead:** judge definition and compliance pages by AI-feature impressions and an answer panel as well as CTR. Never prune on CTR alone.

### 17. A hand rewrite of about 95 pages did not lift them

- **Believed:** rewriting about 95 pages by hand would lift them.
- **True:** page type mattered far more than polish. With URLs, titles and headings kept, the search result barely changed, and the pages moved with the site.
- **Evidence:** Product A's October program (#183, #186, #187): rewritten compare pages lost 7% of clicks at three weeks while untouched pages gained 40%; rewritten alternatives pages rose 34% against a control of 31%. Without the control it would have read as a win.
- **Source:** "Agent-First Growth Playbook" (2026-11-03), "Experiments since August", B1 and B2; "Growth, phase by phase" (v2, 2026-11-04), Principle 8.
- **Do instead:** read every rewrite against untouched pages. Spend effort on the page type and the query's intent first.

### 18. Blog posts do not bring search readers

- **Believed:** blog posts would bring readers from search. Early foundation plans scheduled posts for search.
- **True:** neither product's blog earned meaningful search traffic.
- **Evidence:** Product A's blog: 37 lifetime clicks on 5,293 impressions (0.70%). Product B's blog: under 0.1% CTR.
- **Source:** "Growth, phase by phase" (v2, 2026-11-04), "Blogs brought almost no search traffic".
- **Do instead:** put search effort into pages that answer a decision (alternatives, free plan, a tool the buyer already uses). Write blog posts for launches and distribution, and never forecast search traffic from them.

### 19. FAQ markup is not a growth tactic, and llms.txt does not affect Google

- **Believed:** FAQPage markup earns rich results, and llms.txt improves Google visibility.
- **True:** in August 2023 Google limited FAQ rich results to well-known, authoritative government and health sites, so most sites no longer get them; check Google's current documentation before promising any rich result. Google does not use llms.txt for ranking; it is a file for agents.
- **Evidence:** Google Search Central blog, "Changes to HowTo and FAQ rich results" (2023-08-08); public statements by Google Search staff (2025) that Google Search does not read llms.txt.
- **Source:** Google Search Central (2023-08-08), public documentation.
- **Do instead:** keep visible FAQ answers where they answer real questions. Add FAQ markup only for visible content and never promise a rich result from it. Present llms.txt as agent readiness only.

## Measurement

### 20. The data jobs were not running

- **Believed:** analytics, attribution and ping jobs were running.
- **True:** four jobs failed silently and were found late.
- **Evidence:** Product A's analytics recorded nothing from 2026-09-09 to 10-05 after an 800,000 to 900,000 events-a-day burst (likely a quota cutoff); the install-matching job failed all 7 runs on an empty secret; IndexNow CI was refused 10-27 to 10-29 over a failed payment; site changes merged on 07-17 reached production only on 08-05 after a silent deploy-hook failure.
- **Source:** "Growth, phase by phase" (v2, 2026-11-04), "Tracking broke quietly"; "Why AI-assistant visits fell after the agent-readiness pass" (2026-11-03).
- **Do instead:** check freshness before you read any number, as [data-sources.md](data-sources.md#check-freshness-before-every-read) describes, and put an alert on every data job.

### 21. A sign-up event counted users, not organizations

- **Believed:** a "signup completed" analytics event counts new customers.
- **True:** it fired per user, so it overcounted organizations about 4x. Net-new sign-ups are organizations.
- **Evidence:** Product B's analytics notes; its deep dive counts net-new organizations with a server-side event typed `net_new`.
- **Source:** "Product B growth deep dive, April to November 2026" (2026-11-03), Evidence rules.
- **Do instead:** read each event's definition and the date it changed before you count with it.

### 22. A download event covered 3% to 4% of downloads

- **Believed:** the `download_started` event counts downloads.
- **True:** it covered only 3% to 4% of GitHub downloads. The all-downloads total is a marketing number; human installs is the internal one.
- **Evidence:** Product A's analytics and attribution notes.
- **Source:** "Analytics and Attribution" (Product A, May 2026).
- **Do instead:** name which count you use and why, and reconcile an event against the system of record before you trust it.

## Research and review

### 23. Vendor and competitor facts from desk research go stale within days

- **Believed:** facts gathered once about competitors and vendors hold for the life of a page.
- **True:** they were often wrong at the start, and many changed within days.
- **Evidence:** a check on 2026-11-05 found Claude Code artifacts can be public with no sign-in, contradicting research from the day before; one project had 4 GitHub stars, not about 3,400; Anthropic paused a subscription change; Windsurf became Devin Desktop; Superset renamed to Paradev with licence and price changes in late October; Conductor's shutdown copy of 2026-11-04 met "Conductor is back" (0.94.2) on 2026-11-13. Product A's 54-page alternatives program drew 6 to 14 must-fix factual errors per PR, including pages saying the product lacked features it ships.
- **Source:** Product A competitor fact re-checks (2026-11-04 to 11-18) and the alternatives program's review findings (PRs #257 to #260, November 2026).
- **Do instead:** keep a fact ledger with a source and verified date per claim, re-check every competitor fact on the day the page ships, and put a "figures verified on <date>" line on pricing comparisons.

### 24. A review finding can itself be wrong

- **Believed:** a reviewer's must-fix is correct because a reviewer raised it.
- **True:** reviewers can misread the code or the docs.
- **Evidence:** Product B reviewers called a documented import limit a must-fix error; the fix report showed the lower cap always applies first, so the reviewers had it backwards.
- **Source:** a Product B review round's fix report (2026).
- **Do instead:** confirm each finding against the code or the live page before acting on it, and record the check.
