# Lessons by phase

How two products grew through Google and AI answers in 2026, in the order the work happened. Each phase says what to do, what each product did, how long it took, what it earned and after what lag, where the evidence disagreed with the plan, and a checklist to copy.

Main source: "Growth, phase by phase" (v2, 2026-11-04), the cross-product evidence base. It distils two deep dives: "Agent-First Growth Playbook" (Product A refresh, 2026-11-03) and "Product B growth deep dive, April to November 2026" (2026-11-03). Other sources are named where they are used. Search data runs through 2026-11-01 unless a line says otherwise.

How to read the numbers:

- **Product A** (an open-source developer tool for running coding agents in parallel) is shown with real numbers.
- **Product B** (a B2B healthcare SaaS with a free plan) is shown as ratios and percentages only.
- CTR is clicks divided by impressions. "28 days" means the 28 days to 2026-11-01. "Lifetime" means from first data to 2026-11-01.
- "Likely, not proven" marks readings the data suggests but does not prove. Treat them as hypotheses when you apply them.
- These numbers describe two sites. On a new product they are Case evidence: label any item that rests only on them "Hypothesis" and rank it last, as the evidence rules in the skill say. They tell you what to test first; the new product's own data decides.
- A "family" in the page tables is a page type (alternatives, compare, homepage). A "query family" is every query containing one name.

## The short version

1. **People click when they still have a decision to make.** Product A's "[tool] alternatives" pages earn 4.26% CTR (28 days). Product B's free-plan searches earn 4.11% (90 days). Definitions and yes/no questions get answered on Google's own page and earn under 1% on both sites.
2. **Ship 5 to 15 pages at a time, one topic each, and be first on a new name.** Product A's pages for a new competitor, Herdr, drew 745 clicks in six weeks from one 77-minute session. Product B's single-topic batch out-earned its templated batch about 4 to 1 at six weeks, and almost half the templated batch never appeared in Google.
3. **Link every new page from a page that already gets search traffic, then check it a week later.** Of 41 Product A pages shipped 2026-10-05 to 10-10, Google indexed 17 by 2026-11-03 and never fetched the other 24. Links from pages with traffic separated the two groups; word count and similarity did not.
4. **Much of the growth shows up only as people searching your name.** 87% of Product B's query-attributed clicks are brand searches. Since July, 25% to 28% of its new sign-ups each month say an AI recommended it, while tracking credits AI with about 4%.
5. **Log every bet with a baseline and a review date, and write down the losses.** Product A's log showed a hand rewrite of about 95 pages lost 7% of clicks at three weeks while untouched pages gained 40%. Without the comparison it would have read as a win.

## The two products

| | Product A | Product B |
|---|---|---|
| Start | New domain, launched under its name 2026-02-26; a category with no agreed name; no audience | Known brand, rework from 2026-04-22; the marketing site had only a homepage and a pricing page |
| Size by November | 722 sitemap URLs | A full marketing site, help center and developer docs |
| Search result | 10,298 Google clicks, 2026-02-26 to 11-01 (property total); 2,945 in October, the best month | Clicks +81% for the 28 days to 11-01 against a year earlier; October clicks to pages other than the homepage about 7x October 2025 |
| Where clicks land | About a quarter on the homepage (2,688 of 10,513 page-level clicks) | 76% of organic search visits land on the homepage; 87% of query-attributed clicks are brand searches |

Product A's monthly clicks, the whole arc (property totals, from "Agent-First Growth Playbook", 2026-11-03):

| Month | Feb (from 26th) | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Clicks | 3 | 25 | 29 | 191 | 1,002 | 1,782 | 2,041 | 2,175 | 2,945 |
| Impressions | 19 | 386 | 821 | 4,065 | 28,646 | 53,294 | 63,050 | 77,402 | 103,237 |
| CTR | 15.79% | 6.48% | 3.53% | 4.70% | 3.50% | 3.34% | 3.24% | 2.81% | 2.85% |

Lifetime: 10,298 clicks on 334,447 impressions. Page-level sums run higher (10,513 clicks, 393,526 impressions) because one search can show several of the site's pages. The climb began in May, 8 to 12 weeks after the first pages. Growth slowed to +15% in August and +7% in September, then rose 35% in October, mostly from Herdr and the remote-access cluster: pages first seen after 2026-08-11 earned 771 of the 2,833 clicks in the 28 days to 11-01 (27%).

## Work sessions rebuilt from git

Growth took short sessions. Waiting for Google was the slow part. Source: "Work sessions behind the Product A and Product B growth work" (2026-11-03).

**Method.** Take every human commit on every branch (bot commits dropped) plus each merged PR's open and merge time. Events less than 2.5 hours apart form one session; a session runs from its first event to its last, so real working time is somewhat longer. With a 2-hour or 3-hour gap the counts change by about 10% and the picture holds. Tag each session with the phases its commits touched, and split a multi-phase session's hours evenly. Use this method to rebuild any product's history before you write its deep dive.

| | Product A | Product B |
|---|---:|---:|
| Growth sessions | 69 over 8 months | 80 over 6 months (one person; the co-founder's 15 counted separately) |
| Hours, first to last event | 126 | 125 |
| Median session | 66 minutes | 44 minutes |
| Sessions under an hour | 32 of 69 | 45 of 80 |

Hours by phase (sessions touching a phase overlap, so they do not sum to the totals; Product B counts both people):

| Phase | Product A sessions | Product A hours | Product B sessions | Product B hours |
|---|---:|---:|---:|---:|
| 0 Foundations | 7 | 6.6 | 5 | 1.5 |
| 1 Landing and pillar pages | 8 | 14.4 | 6 | 9.9 |
| 2 Templates | 13 | 20.9 | 28 | 31.3 |
| 3 Batches | 18 | 26.8 | 41 | 44.6 |
| 4 Indexing and agent layer | 21 | 41.0 | 20 | 20.8 |
| 5 Measure | 21 | 16.0 | 29 | 27.8 |
| Sign-up flow | 0 | 0 | 53 | 74.8 |

The bursts that carried the most work on Product A:

| Dates | Sessions | Hours | What shipped |
|---|---:|---:|---|
| Feb 26 to 28 | 3 | 11.1 | Positioning notes, the landing page, JSON-LD, FAQ, llms.txt, robots.txt, 9 compare pages, 3 alternatives pages, the category explainer |
| Apr 3 | 1 | 5.7 | A 33-page docs site, then rewritten as a walkthrough (55 PRs) |
| Jul 11 to 14 | 4 | 9.1 | 50 pages in 10 languages, 500 new URLs |
| Aug 22 to 23 | 2 | 7.5 | Agent-readiness pass, is-agentic 86 to 100 |
| Sep 14 | 1 | 1.3 | Herdr pages, the best launch on the site |
| Oct 4 to 9 | 7 | 22.0 | About 95 pages rewritten by hand, new compare and use-case pages, the 19-page remote-access cluster, homepage rebuild |

Product B's biggest burst was 4 sessions and 7 hours over three days in late August, which shipped 66 new URLs. One Product A session of 5.5 hours built 44 pages on a branch that was never merged: count it as work, credit it with nothing.

Use this when you plan: a batch of pages is one or two sessions of agent work. Budget the calendar for the 3 and 6 week reads, and spend the hours on picking the right pages.

## Where the real order differed from the plan

The whiteboard plan is Phase 0 to Phase 5 in order. The evidence differed in five places:

1. **The competitor sitemap study came months after the first pages.** Product A wrote positioning on day one and mapped competitors' sitemaps in June. Product B benchmarked a competitor's sitemap in August.
2. **Comparison pages came before pillar pages.** Product A shipped 9 comparison pages on day three; its category hubs came ten weeks later.
3. **Each template shipped with its first batch.** Phases 2 and 3 were the same PRs at first. Later batches reused the template.
4. **The files AI tools read went in on day one.** Phase 4 started with Product A's first landing page.
5. **Measurement started early on Product B and late on Product A.** Product B recorded sign-up sources the day before its first new page went live. Product A added analytics in week 10. Product B also spent more time on its sign-up flow than on any single phase.

What to copy from this: do the sitemap study first (it is a few hours), ship the template with its first real pages, put the agent-readable files in on day one, and connect measurement before the first page ships.

## Phase 0: Foundations

**What you do.** Write one short page: who it is for, the pain, the one-line pitch, the category name, and how you differ from each competitor. List direct competitors and the tools your buyers already use for the job. Open each competitor's /sitemap.xml and count URLs by type (compare, alternatives, docs, FAQ, blog, changelog); mark the types they have and you lack. Search the 20 questions buyers ask most and note which pages rank and whether Google answers on its own page. Save it all in one file that every brief and agent prompt reads.

**What each product did.**

- Product A, Feb 19 to 20: first landing page and message in two sessions of 10 and 7 minutes. Feb 26: positioning and a competitive landscape inside the evening session that rebuilt the site. Jun 25: the full map in the repository's foundations file: 19 competitors, 9 competitor sites crawled, a 20-query results audit, URL counts per competitor (one had 450+ URLs with 52 compare pages, another 288). Aug 24: repositioned around a free product.
- Product B: the brand and message already existed. Its first SEO change (Apr 25) started from a competitor check: it ranked on page 1 for its core terms and got almost no clicks, because its title tag was only the brand name while competitors' titles named the benefit. Aug 13: one competitor's sitemap had about 30x Product B's URL count, including one-question FAQ pages and tag pages for "[competitor] alternative" searches.

**Time.** Product A: 7 sessions, about 7 hours. Product B: 5 visible sessions, under 2 hours (earlier work lived in another repository).

**What it earned.** Nothing you can count directly. The map told both products which pages to build; Product A's June map is named as the basis of that day's content batch.

**The first diagnosis was demand, not ranking.** Product A's first read ("SEO: GSC Findings and Diagnosis", data pulled 2026-05-07): 41 clicks on 952 impressions in 28 days, 4.3% CTR at average position 4.25. The site ranked well for a tiny query pool. The June results audit found it ranking for 4 branded queries and 0 of 16 category queries. About 10% of compare-page impressions were brand co-occurrence, so the expected upside from title rewrites was about 2x, not 5 to 10x. Diagnose demand before you rewrite titles.

**Demand without Search Console.** For a list of candidate competitor pages, "Alternatives page gap analysis" (Product A, checked 2026-11-15) measured demand by GitHub stars, repo creation date and Hacker News points, graded fit Full, Partial or Weak, and said plainly that search volume was not measurable. 47 of its 64 products got pages.

**Evidence vs. the plan.** On both products the sitemap study came months after the first pages. Do it first. It lists page types you would otherwise find by trial.

**Copy this.**

- One file: audience, pain, pitch, category name, one row per competitor.
- Every competitor's sitemap, counted by page type, with your gaps marked.
- Your top 20 buyer questions, who ranks for each today, and whether Google answers on its own page.
- Your current titles checked against competitors' titles.
- Before any title work, the brand and non-brand split, so you know whether the problem is demand or ranking.

## Phase 1: A landing page, then pillar pages

**What you do.** Put the one-line pitch, the audience and the install or sign-up step at the top of the homepage. Give the homepage a title that names the benefit as well as the brand. Keep every word in the page's HTML: content behind tabs or loaded by scripts does not exist for Google or AI tools. Write one pillar page per term you want to own, a hub per page family, and real docs on your main domain.

**What each product did.**

- Product A: Feb 26, site rebuilt for the new name with an FAQ in one 4-hour session. Feb 28, a neutral definition page for the category. Apr 3, a 33-page docs site in one 5.7-hour evening. May 8, six category hubs linked from the homepage. Oct 9, homepage rebuilt around real product demos.
- Product B: Apr 25, homepage and pricing got real titles and descriptions (live May 6). May 14, help docs moved onto the site. Jul 9, a pillar page with explainers, a glossary and an author page. Oct 11, homepage redesign.

**Time.** Product A: 8 sessions, about 14 hours. Product B: 6 sessions, about 10 hours.

**What it earned, and when.**

| Change | Result | Lag |
|---|---|---|
| Product A homepage | Top page: 2,688 lifetime clicks, 13.51% CTR in the 28 days to 2026-11-01 | Almost nothing for 10 weeks: 25 clicks in March, 29 in April. The climb began in May |
| Product A homepage title, brand plus category ("<Brand> by <Company> \| Open-Source Agent Manager") | 14.57% CTR at position 3.94 over 24 days, against 10.31% at 4.48 before; brand clicks 92 to 170; homepage impressions down 36.5% ("SEO Briefing", 2026-08-05) | 24 days |
| Product A hub /terminal-multiplexers | A top-10 page with 228 lifetime clicks | Weeks |
| Product A homepage rebuild (Oct 9) | Clicks +37% against a control of +32%; CTR 12.67% to 13.76%: moved with the site, slight CTR gain | 3 weeks |
| Product B homepage title fix | Average position 9.9 to 7.8 and no measurable click lift (homepage clicks +0% against a control of +78% at three weeks) | 3 to 6 weeks |
| Product B help docs on the main domain | Ranked near position 4.6 from launch | Immediate |
| Product B pillar and explainers | Few clicks (0.27% CTR to November); among the pages Google quotes most in AI answers | 6 weeks |
| Product B homepage redesign | Held its clicks (-4%) at three weeks while older pages fell 24% | 3 weeks |

**Pillar pages help AI answers and internal links more than clicks.** Product B's pillar set was among its most-quoted pages in AI answers with few clicks; Product A's hub is a top-10 page mainly as a link source. Judge a pillar by what it links to and by AI-feature impressions as well as by its own clicks.

**Time to first signal (likely, not proven).** Product A, a new site: 8 to 12 weeks after the first pages (/compare/conductor shipped Feb 28, first impression Apr 23). Product B, a known brand: 4 to 6 weeks. From zero, expect about two months before any read means anything, and set review dates on that basis.

**Evidence vs. the plan.** Product A's landing page and first comparison pages shipped in the same three days; its pillar hubs came ten weeks later.

**Copy this.**

- Homepage: one-line pitch, audience, install or sign-up at the top, a benefit in the title.
- View the page source and confirm every word of content is in it.
- One pillar page per category term, linking to every page in its family.
- Docs at a path on your main domain.

## Phase 2: A template for each kind of page

**What you do.** Pick page types from the Phase 0 gaps. The ones that worked: "[competitor] alternatives", "[you] vs [competitor]", one page per tool the buyer already uses, use cases or verticals, compliance checks ("is X compliant"), explainers, and translated pages. Write the template once: answer in the first paragraph, a comparison table, an FAQ, a named author, a "last reviewed" date, a source for every claim about someone else. Keep the list of pages in one config file so an agent adds a page by adding a row. Ship the template with its first 5 to 15 real pages. Have a person check every fact.

**What each product did.**

- Product A: Feb 28, 9 compare pages, 3 alternatives pages and the category explainer in one 2.8-hour session. May 10, a page per coding agent it runs. May 15, a trust layer: byline, last-reviewed date and sources on every competitor claim. Jun 17, competitor-by-operating-system pages ("Conductor for Windows"). Jun 24, glossary and explainers. Jul 11 to 14, 50 pages in 10 languages. Sep 13, use-case pages. Oct 4, a hand-written frame, then about 95 pages rewritten and translated.
- Product B: verticals and comparisons from one config file (5 of each), a cost calculator, compliance-check pages, a niche alternatives page, question pages ("can I ... between sessions?"), and two templates that filled a large batch.

**Time.** Product A: 13 sessions, about 21 hours, 13 PRs. Product B: 28 sessions, about 31 hours.

**What it earned, by page type.** Product A, from "Agent-First Growth Playbook" (2026-11-03):

| Family | Lifetime clicks | Lifetime CTR | Last 28 days CTR |
|---|---:|---:|---:|
| Alternatives | 2,915 | 4.38% | 4.26% (1,070 clicks) |
| Homepage | 2,688 | 11.62% | 13.51% |
| Compare | 2,026 | 2.28% | 1.85% (309 clicks) |
| Other marketing (hubs, use cases) | 1,306 | 1.35% | 1.72% |
| Localized | 800 | 1.96% | 1.35% |
| Explainers and glossary | 267 | 0.80% | 0.87% |
| Docs | 198 | 1.55% | 2.23% |
| Agent landing pages | 160 | 1.19% | 1.77% |
| Blog | 37 | 0.70% | 0.74% |

Product B, CTR by what the searcher is trying to do (90 days to 2026-11-01, query-level data):

| Intent | CTR |
|---|---:|
| Free plan | 4.11% |
| Alternatives or vs | 0.55% |
| Compliance check ("is X compliant") | 0.50% |
| Category head term | 0.19% |
| Competitor name alone | 0.11% |
| Definitional ("what is ...") | 0.10% |
| "Best ..." lists | 0.08% |
| Conversational, 9+ words | 0.00% |

Free-plan queries are the only intent above 1%; some phrasings reach 11%, and nearly all their clicks land on the homepage because no page targets them. Lag: Product A's February compare pages took 8 to 12 weeks to show. Product B's first ten pages had about a tenth of their November click total at six weeks.

**Alternatives pages beat compare pages.** In the 28 days to 2026-11-01 Product A's alternatives pages out-clicked compare pages 3.5 to 1 at 4.26% against 1.85% CTR, and they lead the homepage on lifetime clicks. Compare pages accumulate impressions; alternatives pages convert them. Start with the alternatives template.

**Competitor-name pages are the engine.** Compare plus alternatives were 49% of all Product A clicks and 59% of non-homepage clicks in the 28 days to 2026-11-01, and 44% and 69% in the 28 days to 2026-08-11 ("Agent-First Growth Playbook" (refreshed 2026-11-03), reading 1).

**Intent sets the CTR ceiling, the cleanest proof.** Over the same 90 days (2026-05-14 to 08-11), Product A's 16 compare pages earned 2.30% CTR and Product B's 21 vs pages earned 0.35% on impressions within 6% of Product A's: a 6.6x gap. Product B's pages had more polish (a short answer up top, sources for every claim, a byline). Product A compared itself with tools buyers were choosing between. Many of Product B's pages named consumer tools buyers already use for another job, so the reader wanted "is this allowed?" and Google answered it on the results page. Pick queries by what the reader must still decide.

**Definitions get seen, not clicked.** Product A explainers: 0.87% CTR (28 days); Product B definitions: 0.10% (90 days). Of Product A's 14 new definition pages in October, Google indexed 1 by Nov 3. Build definitions for AI answers and internal links, never for clicks.

**Translation won early, then stalled.** The first 28 days of Product A's ten-language site brought 193 clicks, 10.7% of site clicks. By the 28 days to 11-01, localized pages had 231 clicks on 17,081 impressions (1.35%): impressions grew 2.3x and clicks barely moved. Korean holds (90 clicks at 4.94%; /ko/alternatives/cmux-windows has 282 lifetime clicks at 15.8%). Spanish has 6,427 impressions and 20 clicks (0.31%); German 1,830 impressions and 3 clicks. The early wins came from a few Korean and Chinese pages. "Which languages should the docs be translated into?" (Product A, pulled 2026-11-15, 90 days to 11-12) found the same for docs: Korean pages 8.5% CTR, Spanish 0.2% on 10,644 impressions, German 1 click on 2,006; South Korea sent 214 of its 286 clicks to Korean pages (75%), while Germany (201 clicks), France (107) and Brazil (101) landed almost only on English.

**Evidence vs. the plan.** Templates and the first batch were one step. The type of page mattered far more than its polish.

**Copy this.**

- Start with the "[competitor] alternatives" template: it had the highest CTR of any content page type on both sites.
- One config file per page type; an agent adds rows.
- Answer first, table, FAQ, author, date, sources.
- A person checks every fact. Product A caught 13 wrong facts in one batch; Product B caught a competitor's price listed at well over its real plans.
- Translate only into a locale whose pages already earn clicks; fix a locale with impressions and no clicks before adding pages in it.

## Phase 3: Publish in small batches

**What you do.** Ship 5 to 15 pages per batch, one topic each. Watch your Search Console queries and the news for new competitor and tool names, and ship their alternatives page that week. Link each new page from a page that already gets search traffic, and only after it is live. Log each batch with its live date and review dates at 3 and 6 weeks. Keep every competitor page removable in one change.

**What each product did.**

- Product A: May 25 to Jun 2, five more agent pages with sources and bylines. Jun 13 to 25, a Conductor page rewrite, platform alternatives pages, title tests. Sep 14, the Herdr pages, soon after that competitor launched, in one 77-minute session. Oct 9, a 19-page remote-access cluster on SSH clients, a category new to the site. Oct 28, scheduled-agents and notifications pages.
- Product B: two batches of 6 comparison pages in May; a 7-page vertical set in June; 13 single-topic pages and 5 question pages over Aug 26 to 27; a large templated batch the next day whose pages linked only to each other; an 18-page vertical hub in September.

**Time.** Product A: 18 sessions, about 27 hours, 12 PRs. Product B: 41 sessions, about 45 hours, 35 PRs.

**What it earned, and when.**

| Batch | Result | Lag |
|---|---|---|
| Product A, Herdr (4 competitor pages, 2 explainers, PR #166) | In Google the day it shipped. 361 clicks on 8,577 impressions (4.21%) at three weeks; 745 on 19,211 (3.88%) at six. "herdr alternatives": 124 clicks at 8.6% CTR from position 2.6 (28 days) | Same day |
| Product A, remote-access cluster (19 pages, new category) | 134 clicks on 4,796 impressions (2.79%) in three weeks, 86 of them on /alternatives/mobaxterm. Google indexed 8 of 19, none of the 6 compare pages | 3 weeks |
| Product A, /alternatives/conductor-windows (platform gap) | Impressions the day it shipped; first window 204 impressions, 24 clicks, 11.8% CTR; then 899 impressions and 86 clicks in 30 days at position 1.4 on "conductor alternative for windows" | Same day |
| Product A, /use-your-claude-subscription, shipped the day after a vendor's pricing news (May 14) | 84 clicks on 6,338 impressions from Oct 20 to Nov 17, months later | Durable |
| Product A, a remote-control use case and its docs page (Sep 14) | Logged expectation 50 to 150 impressions a month; 1,518 impressions and 14 clicks at six weeks, 5 to 7x the top of the range, at a weak 0.9% CTR | 6 weeks |
| Product B, 13 single-topic pages | 12 of 13 seen at three weeks; at six weeks about 4x the clicks of the templated batch; its best batch since June | 3 to 6 weeks |
| Product B, a large templated batch linking only to each other | Almost half never appeared. The rest got their first impressions only after two later PRs linked to them (Sep 9 and Sep 22); 20 of the 26 pages that ever had an impression got the first one between Sep 23 and Sep 26 | Waited for outside links |
| Product B, 7-page vertical set | Indexed within about 10 days | 10 days |
| Product B, 18-page vertical hub | All indexed within a day, then flat after week 3 | 1 day, then stalled |

**A new-category cluster earns on its one fresh name.** The remote-access cluster's clicks sat almost entirely on one alternatives page for a tool people were already searching for; most of its other pages stayed unindexed.

**The platform-gap page set a template, with limits.** Product A's Windows gap page worked because four things held: a rising competitor brand, a real platform gap, an exact-match page shipped early, and a product that truly fills the need. The same template earned nothing when one was missing: a competitor brand too small (0 clicks on 25 to 32 impressions), too little demand (0 clicks), or a gap the competitor closed before the page shipped. A Linux gap drew about a ninth of the Windows demand. Check all four, and the demand, before you clone it ("Platform-Gap Page Playbook", Product A, 2026-07-15).

**Evidence vs. the plan.** Publishing never became a separate later phase. It ran from May to the end of October in short bursts, and the one-session launches on new names beat the big batches.

**Copy this.**

- 5 to 15 pages per batch, one topic each, answer in the first paragraph.
- A new competitor name in your data or the news: ship its alternatives page that week.
- Link each new page from a page with search traffic, and only after it is live.
- Log the live date. Review at 3 and 6 weeks.

## Phase 4: Get indexed, and make the site readable to AI tools

**What you do.** Sitemap, a robots.txt that lets AI crawlers in, JSON-LD on each page type. An llms.txt file and Markdown copies of pages, generated from the same source as the site so they never go stale. A one-line install or sign-up an agent can copy. Seven days after each launch, run every new URL through Search Console's URL Inspection and request indexing for any that are not in. Scan the site with is-agentic.com and ora.ai once, fix the top gaps that match what your buyers use, and move on.

**What each product did.**

- Product A: Feb 26, JSON-LD, FAQ, llms.txt and an AI-friendly robots.txt in the first evening. Apr 3, llms.txt and sitemap generated from content. Jun 16 to 26, a one-line npm or PyPI install, a machine-readable product contract, an answer endpoint, and sitemap pings on every deploy. Aug 22 to 23, an agent-readiness pass in one 7-hour session (is-agentic 86 to 100).
- Product B: first robots.txt, sitemap and JSON-LD in April; llms.txt, Markdown docs, a sitemap index and an indexing check script in May; agent-readiness pages and files in July; a sitemap fix in August that restored pages Google could not read.

**Time.** Product A: 21 sessions, about 41 hours, 23 PRs, the most of any phase. Product B: 20 sessions, about 21 hours.

**What it earned.**

| Change | Result |
|---|---|
| Product A indexing speed | Median days from ship to first impression: 54 for 29 pages shipped by May 8; 3 for 51 pages May 9 to Jun 25; 1 for 5 pages from Jun 26. Growing site authority explains this; Google does not read IndexNow (see the corrections) |
| Product A October launch (41 pages, Oct 5 to 10) | 17 indexed by Nov 3; 23 "Discovered, currently not indexed"; 1 "unknown to Google". Google never fetched the 24 |
| Product A pages by type shipped since Oct 5, indexed by Nov 3 | New explainers 1 of 14; new compare pages 2 of 9; new alternatives 3 of 4; setup guides, use cases and product pages 9 of 11; docs 6 of 7 |
| Product A agent-readiness pass | No measurable search effect: clicks +6% against a control of +13% at three weeks, -2% at six. It touched nearly every page, so there is no clean control |
| Product A AI-assistant visits | Already falling three weeks before the readiness pass (medium confidence: assistants stopped sending visitors to the Conductor and Superset compare pages) |
| Product A answer endpoint | Content gaps fixed (a docs fix took 8 test queries from 0 to 8 correct matches), but real assistant use unproven: 78 query events and 85 bare landings in two weeks, 2 from ChatGPT and 1 from Perplexity |
| Product B scanners | is-agentic 64, Ora 65; AI-assistant visits about doubled from May to October anyway |
| Product B pages linked before they existed | Google got "not found" on May 30 and had not come back 157 days later |

**What separated indexed from unindexed pages** (Product A, 41 pages shipped Oct 5 to 10, medians; "Why new pages are not indexed", 2026-11-03):

| | Inlinks | Inlinks from pages with 100+ impressions | Impressions of the linking pages, Aug to Oct | Words | Five-word overlap with the closest sibling |
|---|---:|---:|---:|---:|---:|
| Indexed (17) | 7 | 5 | 4,424 | 729 | 0.16 |
| Not indexed (24) | 3 | 2 | 433 | 664 | 0.15 |

Every page returned 200 with `index, follow`, a self canonical, server-rendered text and fast responses, and sat in a sitemap Google downloaded without errors. The unindexed glossary pages were linked almost only from a glossary that itself earned about 366 impressions in three months. Content length and similarity were the same in both groups. Cause, medium confidence: Google had not scheduled a crawl for pages linked only from pages it rarely visits. A planned test (six treated pages against six matched controls, two links each from pages with 1,000+ impressions) was set to review from 2026-11-17.

**Google skips whole page types that lack links.** The pages Google declined were the cheapest to produce, definitions and head-to-head compares, shipped in large batches. New pages that target a query an older page already wins also did not win it ("paseo" kept going to an older compare page with 738 impressions).

**AI answers and assistants.**

- Product B's AI-feature impressions rose from 14% of its web impressions in June to 34% in September and October (transcribed from the Search Console UI). Its definition and compliance pages appear in AI answers at the highest rates and earn the fewest clicks: one definition page had 53% as many AI-feature impressions as web impressions, at about 0.1% lifetime CTR. Whether those answers name the product is unmeasured.
- Product A's Perplexity referrals rose from 2 to 24 pageviews (May 10 to 12) after compare-page rewrites. Visitors landed on the cited compare pages and category hubs, never on llms-full.txt or the homepage. Measure AI discovery on the pages assistants cite.

**Evidence vs. the plan.** Product A started this on day one and spent the most hours here. Scanner scores did not predict AI traffic on either site; links from pages with traffic predicted indexing.

**Copy this.**

- Sitemap, robots, JSON-LD and llms.txt on the first day, generated from source.
- URL Inspection on every new page at day 7; request indexing for misses and link them from pages with traffic.
- Never link to a page before it is live.
- One scanner pass, then stop. Treat agent readiness as insurance.

## Phase 5: Measure at 3 and 6 weeks, then keep, kill or double down

**What you do.** On day one: Search Console, analytics that save each visitor's first source onto their sign-up, and a "How did you find us?" question with an option for ChatGPT or another AI. Keep an experiment log in the repository: change, live date, baseline, review dates, result. At 3 and 6 weeks, compare each bet against pages you did not touch. Undo what lost; build more of what won. Alert on every data job.

**What each product did.**

- Product A: May 7, analytics added in week 10, after the first pages. Jun 13, installs linked back to the web visitor. Jun 25, search data and the experiment log committed to the repository. Jul 15 and Aug 5, overdue experiments read and written down, failures included. Nov 3, every PR since August read at 3 and 6 weeks.
- Product B: sign-up source tracking the day before the first new pages went live. Jun 26, Search Console connected, the experiment log started, 8 titles rewritten as a test. Jul 8, an AI option added to the sign-up question. Jul 9, the losing titles reverted and the winners kept.

**Time.** Product A: 21 sessions, about 16 hours. Product B: 29 sessions, about 28 hours.

**What it earned.**

| Finding | Numbers |
|---|---|
| Product B: the survey shows AI that tracking hides | From July to October, 25% to 28% of sign-up answers each month name an AI; tracking credits AI with about 4%, so self-reported AI runs 4 to 5x tracked AI. Only about 1 in 7 AI answerers had an AI first touch; most arrived as organic search or direct. Before the option existed, about 2% wrote AI in |
| Product A: a hand rewrite of about 95 pages moved with the site | Rewritten compare pages: clicks -7% at three weeks while the control rose 40%. URLs, titles and headings stayed the same, so the search result barely changed |
| Product A: a June five-page title rewrite | Combined CTR about 0.47% to 0.62% against a 2% to 3% scenario; /worktrees stayed at 0.13% on 2,988 impressions (read 2026-08-05); /worktree-tools was the one win (0.2% to 0.55%) |
| Product A: May compare-title rewrites | Of five, only the one that led with what the searcher resolves hit target: /compare/superset 3.14%, then 3.95%. The others stayed between 0% and 1.43% |
| Product A: a head-term retitle that matched intent | /alternatives/conductor retitled "Conductor Alternatives & Competitors (2026)": clicks 40 to 106; "conductor alternatives" 9 to 46 clicks, position 7.6 to 4.42 (July to Aug 5) |
| Product B: an 8-title test | Half the rewrites did worse and were reverted. Kept titles beat reverted titles at six weeks. No page in the test rose above 1.1% CTR; the pages were young and still ramping, so the test is confounded |
| Product A: data jobs failed silently | Analytics recorded nothing from Sep 9 to Oct 5; the install-matching job failed all 7 runs. Both were found late |

**Title rewrites rarely fix an intent-capped page.** Retitles worked where the query already carried a decision (an alternatives head term, a compare page reframed around the resolution). On definitional or "is it allowed" pages nothing crossed the intent's ceiling. Check the intent's CTR before you spend a rewrite.

**Search is not the whole funnel.** Product A to 2026-06-15: visit to download 13.5%, download to first launch 18.7% against a 25% to 40% norm for signed apps, week-1 retention 35.4%, week-4 15.1%. A click is the start of the funnel; read the steps after it before you call a page a win. Conversion work is outside these skills for now.

**Evidence vs. the plan.** Product B measured before its first new page went live. Product A started in week 10 and missed its first months. Neither has run the check that matters most for AI answers: asking the assistants and seeing whether they name you.

**Copy this.**

- Day one: Search Console, first-source tracking, "How did you find us?" with an AI option.
- An experiment log with a review date on every row.
- Judge at 3 and 6 weeks against untouched pages; the verdict belongs to the 6-week read.
- An alert on every data job.

## Alongside the phases: the sign-up lane

Not in the original plan, and Product B's largest block of time: 53 sessions and about 75 hours, most of them the co-founder's. It shipped a trial-first sign-up with the required contract accepted inside the form, a book-a-demo step for sign-ups that skip paid checkout, and emails that recover abandoned sign-ups. Net-new sign-ups grew about 40% from August to October. The pages and the sign-up changes shipped together, so neither gets sole credit.

Likely, not proven: a known brand gains more from a smoother sign-up than a new one does, because its demand already arrives as brand searches.

## The monthly loop

Run this once a month after Phase 5 is in place. At most three moves a month.

1. **Pull Search Console and split it two ways.** Brand searches against everything else, and the homepage against every other page. Compare with last month and the same month last year.
2. **Close last month's bets first.** For each bet past its review date, write the result next to its baseline, including "Failed".
3. **Check last month's pages are indexed.** URL Inspection on each. Link the missing ones from pages with traffic.
4. **Read the AI side.** Search Console, Performance, Generative AI features. Then ask ChatGPT, Claude, Perplexity and Gemini the questions your pages answer, and note whether you are named.
5. **Find the gaps.** Searches with impressions and no page, and competitor names new to your data. For pages that rank but rarely get clicked, ask whether Google already answers the question.
6. **Pick at most three moves.** Each with a baseline, an expected effect labelled as a guess, and a review date at least 3 weeks out.
7. **Check your data is still flowing.** Analytics, sign-up sources, scheduled jobs. A gap found a month late cannot be filled.

Why split brand and homepage: people who search your name click at high rates, and many new pages at lower rates pull the average down while clicks grow. Product A's site CTR fell from 4.70% in May to 2.85% in October while monthly clicks grew from 191 to 2,945. Product B's fell from 4.81% in January to 1.95% in July while clicks rose.

## Principles that held for both

| Principle | Product A | Product B |
|---|---|---|
| 1. People click when they still have a decision to make | Alternatives 4.26% CTR, explainers 0.87% (28 days) | Free plan 4.11%, definitions 0.10% (90 days) |
| 2. Small batches on one topic, and be first on a new name | Herdr 745 clicks in six weeks; 1 of 14 October definition pages indexed | Single-topic batch about 4x the templated batch at six weeks; almost half the templated batch never shown |
| 3. A page counts once Google has indexed it, and links get it there | 17 of 41 October pages indexed; the other 24 never fetched | Pages linked before they existed: not recrawled in 157 days |
| 4. Report the homepage and brand searches separately | Site CTR 4.70% to 2.85% while clicks grew 15x | Site CTR 4.81% to 1.95% while clicks rose; 87% of clicks are brand |
| 5. AI answers show you without sending clicks; measure them on their own | A compare page moved into an AI Overview source card; its query's clicks fell from 45 to 4 at a steady reported rank | AI-feature impressions reached 34% of web impressions |
| 6. Make the site easy for agents to read, as insurance | is-agentic 100, Ora 87; AI visits fell anyway | is-agentic 64, Ora 65; AI visits about doubled |
| 7. Ask every sign-up how they found you | No survey yet, so fewer AI recommendations cannot be told from hidden referrers | 25% to 28% name an AI against about 4% tracked |
| 8. Write every bet down with a baseline and a review date | 95-page rewrite -7% against a +40% control | Half the title changes reverted; none crossed 1.1% CTR |

## Where the two products differed

| | Product A | Product B | What it means for you |
|---|---|---|---|
| Starting point | New site, no brand | Known brand earning steady brand clicks | A new site picks its search terms. A rework inherits the terms its market already uses |
| Where clicks land | About a quarter on the homepage | 76% of search visits on the homepage; 87% of clicks are brand | On a rework, new-page gains hide inside brand totals. Split them out |
| What people search | "herdr alternatives", "mobaxterm alternative" | "is [tool] compliant", "what is [term]" | The mix of questions sets your click ceiling more than page quality does |
| Time to first signal | 8 to 12 weeks after the first pages | 4 to 6 weeks | Likely, not proven: an existing site gets indexed and ranked sooner. From zero, expect about two months |
| Where the hours went | Agent layer and indexing (about 41 hours) | Sign-up flow (about 75 hours), then batches (about 45) | Time went where each product's buyers already were |
| AI visits | Fell, on two compare pages, before the readiness work | About doubled with mediocre scanner scores | Scanner scores and AI visits move independently |

## Settled questions

Places where the sources disagreed, and the reading these skills follow.

- **Localization: expand or stop.** An August briefing said expand where demand is proven; November showed impressions growing 2.3x with flat clicks, and only Korean earning (4.94% on localized pages, 8.5% on Korean docs). Meanwhile later PRs still translated into all 11 locales. Reading: stop expanding. Keep and grow the locales whose own pages earn clicks (Korean here), diagnose rank and snippets in a locale with impressions and no clicks (Spanish, German) before adding pages there, and ship new page types in the main language first.
- **One scanner pass, then stop, or keep fixing scanner gaps.** "Growth, phase by phase" says one pass, then stop; Product A's roadmap still listed scanner items (an MCP card the scanners read as a failed handshake, WebMCP, an agent resource catalog). Reading: one pass. After it, fix a scanner gap only when it is a broken promise (a file describing an endpoint the site does not serve) or when the site's buyers use agents and the fix serves them. Never fix a gap to raise a score: on both sites the score did not predict AI visits.
- **Herdr: 745 clicks or 650.** Both are right and measure different things. 745 is all six Herdr pages at six weeks after PR #166 (of which /alternatives/herdr had 540). 650 is /alternatives/herdr alone, lifetime to 2026-11-01, about seven weeks. Quote the scope and window with the number.
- **Agent readiness: principle or insurance.** An August showcase made "your reader is also a program" a growth principle; November's evidence made it insurance. Reading: insurance. Put the cheap layer in on day one, generated from source (llms.txt, JSON-LD, Markdown where buyers use agents, a copyable install), and judge AI discovery by AI referrals, the sign-up survey and an answer panel, never by the readiness score.

## Who does what

Agents do the labor: pull competitor sitemaps and count page types, draft pages from a written template, generate sitemaps, llms.txt and structured data, pull and split the numbers each month, run index checks, fill in the experiment log.

People keep the judgment: what the product is and who it is for, whether a page should exist, whether every claim is true today, which bets to make, and when to call one failed.

## Sources

- "Growth, phase by phase" (v2, 2026-11-04): phases, principles, the monthly loop, where the products differed, the five order differences.
- "Agent-First Growth Playbook" (Product A refresh, 2026-11-03): monthly totals, families, nine readings, experiments since August, agent readiness.
- "Product B growth deep dive, April to November 2026" (2026-11-03): CTR by intent, experiments, indexing, AI-feature impressions, the sign-up funnel.
- "Work sessions behind the Product A and Product B growth work" (2026-11-03): sessions and hours by phase.
- "Why new pages are not indexed" (2026-11-03): the indexed against unindexed comparison.
- "SEO: GSC Findings and Diagnosis" (Product A, data pulled 2026-05-07); "SEO Briefing" (Product A, 2026-08-05); "Platform-Gap Page Playbook" (Product A, 2026-07-15); "Content Briefs" (Product A, 2026-05-07 to 05-14); the answer-endpoint experiment readout (Product A, 2026-07-08).
- "Alternatives page gap analysis" and "Which languages should the docs be translated into?" (Product A, 2026-11-15).
