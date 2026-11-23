---
name: seo-foundations
description: "(greenfield) Map the product, the competitors, the search landscape, the page types that win, and the places outside the site where buyers and agents find products. Use when starting SEO from scratch, onboarding a new site, planning the page set for a site that does not exist yet, or when the agent doesn't know what the product is, who the competitors are, or what to rank for. This is the zeroth step before seo-briefing and any content pass. Examples: 'start SEO from scratch', 'who are our competitors', 'what should we rank for', 'what pages should the site have', 'SEO foundations'."
---

# SEO Foundations

Figure out what you're selling, who you're competing with, what people
actually type, which page types win those queries, and where else a buyer
or an agent finds a product. This is the starting point for everything else,
and it has to be complete without the user telling you what to look for.

Run it once when starting SEO on a site, and again after a competitor's
pricing changes, a competitor shuts down or is acquired, or the product's
scope moves. It works whether or not a site exists yet. After it, the other
SEO skills (briefing, strategy, readability, authority, drafting) and the
content pass have the context they need.

Do it first. On both measured products the competitor sitemap study came
months after the first pages, and it listed page types each would otherwise
have found by trial. It is a few hours of agent work. Source: "Growth, phase
by phase" (v2, 2026-11-04), Phase 0.

## Goal

Produce, with every number cited and every fact dated, five files in the
product's repository:

1. `.seo/foundations.md`: the entry every later SEO skill reads first.
   Identity, competitors, search landscape, content map, starting point,
   messaging notes, the naming rule, method caveats, and links to the four
   files below.
2. `.seo/keyword-map.md`: query families, representative queries, intent,
   demand evidence, who holds each query today, and the page that owns it.
3. `.seo/competitor-map.md`: who ranks for what, sitemap counts by page type,
   page structures worth matching, weak spots, and a corrections table for
   anything the repository's own docs got wrong.
4. `.seo/page-inventory.md`: every page to exist at launch, with slug, the
   one query it owns, a one-line angle, priority, build order, and the top
   ten by expected value.
5. `.seo/discovery-checklist.md`: every surface outside the pages, what each
   needs from the product, and the order to do them.

The working data behind all of it (competitor crawls, search-result maps,
demand pulls, surface checks) goes in `.seo/data/`. Before writing anything,
start your own branch and open a draft PR for it; write `.seo/` only there,
never on the default branch.

Rules for every step: cite every number or claim with the URL or file it
came from; date everything; write "no cited volume" or "not checked"
instead of guessing; treat vendor self-reports as marketing; never treat
one search tool's ordering as a live result page (say which tool produced
the ordering and re-check the top opportunities in a browser before
writing briefs).

## Steps

### 0. Inputs, and the case with no site

Read whatever exists: `.seo/` if the repository has it, the site, the
README and design docs, the product, pricing, and roadmap docs, and any prior
research. If the SEO evidence base is available (its corrections list and
lessons by phase), read the corrections first: they record which earlier
advice the measured data overturned.

Record which sources are connected (the connected Search Console / analytics
tool, an SEO tool such as Ahrefs, Bing Webmaster Tools) in a manifest, the
way `seo-data-pull` writes one. With no site there is nothing to pull, and
the manifest says so. With no live site, say so in every file and work from
the docs and the competitors; the page inventory then doubles as the site's
first page plan.

With a live site, read the numbers before diagnosing anything. Clicks,
impressions, CTR and average position over 28 days, plus a 20-query result
audit (branded and category queries). Low clicks at a good position means a
small query pool: a demand and page-count problem, and more pages on new
queries are the fix. Product A's first diagnosis read exactly that way: 41
clicks on 952 impressions at 4.3% CTR, average position 4.25, in the 28
days to 2026-05-07, ranking for 4 branded queries and 0 of 16 category
queries. Source: "SEO: GSC findings and diagnosis" (2026-05-07), and
"Agent-First Growth Playbook" (refreshed 2026-11-03).

**Success criteria**: a manifest of inputs and connected sources, including
what is missing, and for a live site the first diagnosis with its numbers.

### 1. Understand the product

Crawl the website, or read the docs when there is none. Answer:

- What does this product do? (one sentence)
- Who is it for? (a specific buyer, not "developers"; if the product is
  agent-facing, name the agent as a reader too)
- What triggers the search, and what job is the buyer doing?
- What problem does it solve? (the pain, not the feature)
- What makes it different? (the wedge) What proves it?
- What words does the product use for its own concepts? These become the
  glossary and the copy's vocabulary.
- What is shipped, what is planned, what is reserved? Keep a "what we don't
  have yet" list. It is the honesty line every page respects.
- The naming rule: are there companies, providers or products this product
  must never name in public copy (an upstream vendor under contract, a
  white-label supplier, a partner under embargo)? Find it in the repository,
  the contracts or brand docs, or the brief, and ask the person when nothing
  says. Record the rule with its source. Everything else may be named:
  alternatives, versus and pricing pages need the competitors' names.

Classify the product, because the page-type order in step 5 depends on it:
developer tool or infra, B2B SaaS, vertical SaaS, consumer, marketplace or
data product, API-first or agent-first. A product often fits two of these.

If the messaging is unclear, note it. Unclear messaging means the content
skills won't produce good pages either, and the user may need to fix
positioning first.

**Success criteria**: a plain-language identity (category, primary user,
trigger and job, pain, wedge, proof, boundary, vocabulary, ship status,
what we don't have yet) and the naming rule with its source.

### 2. Discover competitors

Where you look depends on who the product is for. Don't default to GitHub
and Reddit for everything. Start by asking: how does the target buyer
actually find and evaluate products like this? List the tools buyers use
for the job today as well as direct rivals.

**First, figure out the discovery channel.** Based on the audience from step 1:

- **Developer tools, infra, open source**: GitHub trending and topics,
  awesome-lists, niche subreddits, Hacker News (Show HN and Ask HN), Product
  Hunt, dev communities on X and Bluesky, package registries.
- **Agent-first or API products**: MCP registries and directories, AI client
  directories, `llms.txt` directories, awesome-agent lists, skills
  registries, "for AI agents" and "MCP" queries. Competitors here are often
  adjacent categories (data APIs, scrapers, automation tools) that rank for
  the same words.
- **B2B SaaS**: G2, Capterra, GetApp, comparison blogs, "best X for Y"
  listicles, LinkedIn, industry newsletters.
- **Vertical SaaS**: the competitors may be agencies, freelancers, or manual
  workflows. Industry forums, trade publications, Facebook and LinkedIn
  groups, niche subreddits, events.
- **Consumer**: app stores, TikTok, Instagram, YouTube reviews,
  "alternatives to X" searches, influencer recommendations.

**Then search those channels.** Generate 10 to 15 queries a real buyer would
type: the category, "[problem] tool", "[known tool] alternative", "how to
[job]", "[product type] for [audience]". Record who shows up. Keep a list of
rivals that surface unprompted and are not in the user's list; they matter
for the map even when they are small.

**Keep dead and acquired tools.** A project with no recent commits, a
product that shut down, or one that was acquired and stopped sign-ups leaves
users who search for a replacement. Record each as a migration target with
the date and the source for its status, and leave it out of the active
competitor count. Product A's demand gap report flagged an acquired
competitor that stopped sign-ups and set a shutdown date for its cloud
product as likely the largest short-term search spike in its category.
Source: "Alternatives page gap analysis" (2026-11-15).

**Narrow the wedge.** At each level of narrowing (from "AI design tool" to
"AI staging photos for recently sold homes") ask who the competitors are,
whether the messaging lands, where this audience goes, and who refers
buyers (consultants, communities, directories).

**The messaging test.** Run the buyer queries blind, without the product's
name. If the competitors you expect show up, positioning matches how buyers
search. If the product appears in none of them, ranks low for its own name,
or few of the founder's named competitors surface, the messaging does not
match how buyers search. Record the counts (product present in N of M
queries, M of the founder's competitors surfaced) and flag it as a
positioning gap before content work starts.

**The adjacent-category trap.** Check whether a neighbouring category owns
your words. Product A's category term "agent manager" was not established:
the results for "what is an agent manager" were entertainment-industry
pages. Source: "SEO Foundations" for Product A (2026-06-25). Record which
phrasings are ambiguous; every page on those phrasings disambiguates in its
first screen.

At zero-to-one, keyword volumes from SEO tools are less useful than
discovery patterns; they become valuable once there is traffic to optimise.

**Success criteria**: 5 to 10 active competitors with the channel that
surfaced each, the unprompted rivals, the migration targets, the ambiguous
phrasings, and the messaging test with its counts.
**Human checkpoint**: confirm or add competitors, unless the user already
named them in the brief. If they must add many that did not surface, record
that as a messaging gap.

### 3. Map what competitors are doing

Start with the sitemap study: open each competitor's `/sitemap.xml` (and its
sitemap index) and count URLs by type (compare, alternatives, vs, per-source
or per-integration, glossary, docs, FAQ, blog, changelog, use cases,
audiences, free tools, tag pages, user-made pages). Mark the types they have
and you lack. Then count who made the pages: Herdr's sitemap had 981 URLs,
896 of them user-made (577 under `/mods/`, 319 under `/layouts/`) against 8
team blog posts, while Product A's 830 URLs were all written in-house.
Source: "Draft issues: publishing from Product A" (2026-11-15). A competitor
whose users publish pages scales differently from one whose team writes
them; say which kind each is.

What the study finds: Product A's June map found one competitor with 450+
URLs and 52 compare pages and another with 288. Product B benchmarked a
competitor with about 30 times its URL count, including one-question FAQ
pages and tag pages built for "[competitor] alternative" searches. Source:
"Growth, phase by phase" (v2, 2026-11-04), Phase 0.

When you have research children, fan out one per competitor in parallel,
each writing one file under `.seo/data/competitors/`; otherwise work through
them in turn. For each competitor record:

- **Site structure**: the sitemap counts above, the full slugs for
  comparison, alternative, source, audience, and agent pages (those are the
  ones you will compete with), and the URL patterns they do not have (a 404
  on `/glossary`, `/about`, `/changelog`, `/<x>-vs-<y>`).
- **Titles and H1s** of the money pages, the keyword each targets, and your
  own titles beside them. Product B ranked on page 1 for its core category
  queries and got almost no clicks because its title tag was only its
  brand name; competitors' titles named the benefit. Source: "Growth, phase
  by phase" (v2, 2026-11-04), Phase 0.
- **Blog**: post count, date range, cadence over the last six months,
  authors, visible dates and "updated" labels, batch-refresh patterns.
- **E-E-A-T**: author pages, bios, logos, testimonials, review badges,
  original research, structured data (curl the HTML and grep for
  `application/ld+json`).
- **Agent surfaces** (for any product a model might buy): `/llms.txt`,
  `/llms-full.txt`, `/.well-known/mcp.json` or server cards, OpenAPI,
  machine-readable pricing, MCP registry entries, AI-crawler rules in
  `robots.txt`, an npm or PyPI CLI, a skills library. This is the baseline a
  new product must match before it can out-do anyone.
- **Pricing**: every tier with monthly and annual, limits, overages,
  add-ons, what is tier-gated; where two of their own pages disagree, say so.
  Note price history where third parties document it.
- **Weak spots**: missing page types, undated pages, stale numbers, copy
  drift between pages, claims that don't survive a check, thin templates.
- **Structures worth matching**: the skeleton of their best alternatives
  page, best vs page, best per-source page, best agent page, and free tools,
  section by section.

Then write a corrections table: every place the repository's own docs are
behind what the sites show today. Do not edit those docs from this skill;
list the corrections for the user.

**Success criteria**: one dated, cited crawl file per competitor and a
competitor map that says who owns which query and why, with sitemap counts
by type and maker.

### 4. Map the search landscape

Fan this out by query family. The families below are product-agnostic;
substitute the product's own nouns. For each query record rank, domain,
title, page type, whether the holder is the principal, a rival, or a third
party, and whether the search engine answers on its own page (an AI answer
or a featured snippet settles the question and leaves few clicks). Note the
method's limits.

**Query families to cover, every time:**

1. Category head terms and "[category] tool / software / platform".
2. "[category] for [audience]" and "[category] for [use case]".
3. "[competitor] alternative" and "[competitor] alternatives", for every
   competitor and migration target, both forms.
4. "[a] vs [b]", for pairs buyers actually compare, including pairs that do
   not involve the product.
5. "[competitor] pricing", "[competitor] review", "is [competitor] worth it",
   "[competitor] reddit", "is [competitor] free".
6. Per-integration, per-source, per-platform, or per-format: "[thing]
   [category]" for each thing the product connects to, watches, exports to,
   or runs on (integrations for a SaaS, platforms for a consumer app, file
   formats for a converter, operating systems or frameworks for a devtool).
7. "[job] how to", "[job] with [agent or automation tool]", and "free [job]
   tool".
8. "what is [term]" and "[term] vs [term]" for the category's vocabulary.
9. "[category] API", "[category] MCP server", "[category] for AI agents",
   "[category] SDK" for anything a program might call.
10. Migration queries for every migration target: "[dead tool] alternative",
    "[tool] shut down", "[tool] price increase", "[tool] acquired".
11. Mini-tool queries: "[x] calculator", "[x] generator", "[x] checker",
    "[x] builder", "[x] estimator".

**Demand without Search Console.** Zero-to-one has no query data, so pull
these and say which ones were unreachable:

- Google autocomplete through the suggest endpoint for each seed and each
  seed plus a letter; Bing autocomplete as a second opinion.
- Google Trends relative interest between candidate terms.
- Any published volume, only with its source and date.
- Hacker News and Reddit threads asking for tools, counted and dated (the
  Algolia Hacker News search API gives points and dates).
- For developer tools, GitHub stars and repository creation date of each
  competitor and migration target (`gh api repos/<owner>/<repo>`).
- Competitor traffic estimates as a brand-demand proxy.

State in the file that search volume was not measurable when it was not.
Grade each candidate's fit with the product as Full, Partial or Weak, and
rank candidates by demand times honesty of fit. Product A's demand gap
report ranked 64 products this way from stars, creation dates and Hacker
News points, and 47 of them got pages. Source: "Alternatives page gap
analysis" (2026-11-15).

**With a live site, add two reports from the connected Search Console tool**:

- **Demand gap**: queries with impressions and no owning page, and products
  with "X alternatives" demand and no page. Product A found unbuilt pools
  such as "conductor competitors" (2,155 impressions at position 18.6) and
  "claude squad" (1,882). Source: "Agent-First Growth Playbook" (refreshed
  2026-11-03).
- **Language**: clicks and CTR by page language and country before
  translating anything. Product A's 90-day pull showed Korean pages at 8.5%
  CTR, Spanish at 0.2% on 10,644 impressions and German at 0.05%, and docs
  pages at 1.2% of all clicks, so it translated only into Korean. Source:
  "Which languages should the docs be translated into?" (2026-11-15).

**Gap tells** (a query nobody owns): a marketplace listing, a forum thread,
a GitHub issue, a Wikipedia page, or a deprecated project in the top five
means no vendor built the page.

**Beatability rules**: the principal does not defend its own "alternative"
query; the holders are short, undated, or quote stale prices; the result
page is padded with unrelated results (low volume, cheap to take but small);
the principal is dead; the query's intent fits the product better than the
current holders; the name is new and nobody has a page yet.

**Skip rules**: category mismatch; a principal that owns most slots with its
own hub; a head term owned by enterprise product pages and long listicles
when the site has no authority yet; a query an older page on the site
already wins. A new page aimed at a query an older page owns does not win
it: Product A's "paseo" queries kept landing on a compare page and
"termius" on its alternatives page, and new explainers on four terms had 0
impressions sitewide. Give the query to the older page and link to it.
Source: "Why new pages are not indexed" (investigation, 2026-11-03).

**Success criteria**: a keyword map with, per family, the queries, the
intent, the evidence, the holders, the beatability call, and the owning
page. Each query has exactly one owning page.

### 5. Page types that win, and the page inventory

Order the inventory by the page types that intercept buyers and earn links,
not by what is easiest to write. Measured CTR follows intent: people click
when they still have a decision to make. Where this order departs from older
advice (versus pages high, glossary pages for traffic), the measured
evidence below decides it. From most to least valuable for a new site:

1. **Alternatives pages**, one per competitor and migration target, singular
   and plural query. Measured best: on Product A, alternatives pages ran at
   4.26% CTR against 1.85% for compare pages in the 28 days to 2026-11-01
   (1,070 clicks against 309), and 4.4% against 2.3% lifetime. They had the
   highest CTR of any content page type on both products. Be first on a new
   name: Product A's pages for a competitor name people had just started
   searching were indexed the same day and earned 745 clicks in six weeks. Sources: "Growth, phase by
   phase" (v2, 2026-11-04), Phase 2 and Principles 1 and 2; "Agent-First
   Growth Playbook" (refreshed 2026-11-03), readings 2 and 8.
2. **Free-plan and free-tool pages** ("free [job]", "[category] free plan")
   when the product has a free tier. On Product B, free-plan searches were
   the only intent above 1% CTR: 4.11% over 90 days. Source: "Growth, phase
   by phase" (v2, 2026-11-04), Principle 1.
3. **Pricing teardowns**: "[competitor] pricing" with a dated table and the
   price history; rival pages contradict each other, so accuracy wins.
4. **Versus pages**, first-party ("us vs X"), only for pairs a buyer is
   actually choosing between, each linked from pages that already get
   search traffic. They sit below alternatives on the evidence: Product A's
   compare pages ran at half the alternatives CTR, Google indexed only 2 of
   9 new compare pages shipped from 2026-10-05, and a 19-page cluster got
   none of its 6 compare pages indexed. A vs page also leaks when the other
   name is a tool the reader already uses for a different job: over the
   same 90 days (2026-05-14 to 2026-08-11) Product A's compare pages ran
   at 2.30% CTR and Product B's at 0.35%. Third-party pairs ("X vs Y" with neither being the product)
   come last, after the site has authority. Sources: "Agent-First Growth
   Playbook" (refreshed 2026-11-03), readings 2 and 9 and the cross-case
   result; "Growth, phase by phase" (v2, 2026-11-04), Phase 3.
5. **Per-integration, per-source, or per-platform pages**, one per thing the
   product connects to, leading with the ones nobody has a page for. Check
   impression demand before cloning a winning template across platforms:
   Product A's Windows variant earned 11.8% CTR in its first window, while
   a Linux clone drew about one ninth of the demand and another earned 0
   clicks. Source: "SEO Experiments log" (Product A, 2026-06-14 to 2026-08-05).
6. **Mini tools**: calculators, builders, checkers, estimators. They rank
   for their own queries and earn links; ship the formula in the description
   and the live version behind a key.
7. **Cookbooks, playbooks, recipes, skills**: one job each, with the exact
   call, also published in the form agents install (a skills registry, a
   SKILL.md, an awesome-list entry).
8. **Audience pages**: "[category] for [audience]" where no audience-specific
   page ranks.
9. **Agent surfaces** for anything a program might buy: an MCP page, an API
   page, a "for agents" page, a page for the delivery mechanism.
10. **Guides and listicles**: the category's "best X tools" written for the
    product's actual reader, and the how-to guides the gap tells revealed.
    Expect few clicks: Product A's blog earned 37 clicks on 5,293
    impressions lifetime. Source: "Agent-First Growth Playbook" (refreshed
    2026-11-03).
11. **Glossary, definitions, docs, about, changelog**: entity coverage and
    E-E-A-T only. Definitions get seen and not clicked: Product A's
    explainers ran at 0.87% CTR, its 14 new definition pages in October had
    1 indexed by 2026-11-03, and Product B's definition searches ran at
    0.10% CTR while appearing often in AI answers. Build them
    for coverage, link them from money pages, and never count on them for
    traffic. Source: "Growth, phase by phase" (v2, 2026-11-04), Principles
    1, 2 and 5.

Alternatives, free-plan, versus, per-integration, guide and glossary pages
are ranked on measured data. Pricing teardowns, mini tools, cookbooks,
audience pages and agent surfaces are judgment from competitor studies;
record their results as experiments when they ship.

For each page in the inventory: slug, the one query it owns, secondary
queries it may list, a one-line angle, priority (P0 launch day, P1 launch
week, P2 first month, P3 later), and for status-bearing pages the ship
status the page must print. Define the priorities so they do not contradict
the rows; give a launch-day build order; name the top ten by expected value
(demand times winnability times fit) and say why each; state the
dependencies (what must exist before a page can be honest); add a wave-2
section with the next set of alternatives, pairs, tools, and cookbooks so
the plan does not stop at launch. Ship in small batches of one topic each,
each new page linked from a page that already gets search traffic: Product
B's single-topic batch earned about four times the clicks of a templated
batch, almost half of which never appeared in Google. Source: "Growth,
phase by phase" (v2, 2026-11-04), Principle 2.

**Page rules every money page follows**:

- Concede where the other product wins before saying what changes.
- Make no claim the facts don't carry: never call the product a deprecated
  tool's "successor", never claim to be the only option, and write no
  versus page for a tool nobody on the team has run hands-on.
- The answer in the first paragraph, then a comparison table.
- A dated pricing table with a "figures verified on" line, and a source for
  every claim about someone else. A person checks every fact before
  publishing: Product A caught 13 wrong facts in one batch. Source: "Growth,
  phase by phase" (v2, 2026-11-04), Phase 2.
- A named author and a visible "last reviewed" date.
- An FAQ only where readers ask real questions (from search queries, calls,
  or support), each answer standing alone. Google stopped showing FAQ rich
  results for most sites, so FAQPage markup is not a growth tactic; add it
  only as plain description of a real FAQ.
- Internal links to at least three siblings, and a link in from a page that
  already gets search traffic.
- The exact call or the exact form for anything a program can do.
- Planned status in the first screen.
- One owning query per page.
- Disambiguation from the adjacent category where the phrasing is ambiguous.
- The naming rule from step 1.

Map every page to a template the site can render from a content file
(compare, alternatives, pair, source or integration, playbook, article,
tool, glossary, docs, audience, hub). Name the pages the existing template
set is missing; a page with no template is a UI decision, not a copy
decision.

Before publishing the inventory, have the cold-reader child read it. It
reports; you decide what to fix and fix it in your own pass. The findings
that recur: a priority rule that contradicts its rows, two competing
orderings, status columns that mix access and status, a page counted
twice, queries with two owners, a page both kept and dropped, new page
kinds with no template, undefined product terms, citations with bare
filenames.

**Success criteria**: an inventory a frontend team can build from and a
founder can order from, with counts that add up.

### 6. Discovery surfaces beyond the pages

A stranger or an agent finds a product in more places than its site. List
every surface for this product type, check each live, and record what it
needs from the product (files, forms, schemas, accounts, cost,
prerequisites). Cover:

- **Files on the domain**: `llms.txt` and `llms-full.txt` in spec shape, a
  docs-level `llms.txt`, machine-readable pricing, `.well-known` files for
  MCP, OpenAPI, and API catalogs, `robots.txt` that allows AI crawlers by
  name, `.md` twins of pages, an `AGENTS.md` in each public repository (not
  on the site), a `SKILL.md` where agents install skills. These help AI
  tools read the product; `llms.txt` has no measured effect on Google
  visibility.
- **MCP registries**, for a product with an MCP endpoint, once the endpoint
  is verified in production. For each, write the listing copy and steps:
  - the official MCP Registry: a `server.json`, after production endpoint
    verification and namespace authentication;
  - Smithery: publish the hosted URL, after OAuth is verified on staging;
  - Glama: submit as a hosted connector (its repository flow expects a
    Dockerfile);
  - PulseMCP: no direct publish; it ingests the official registry;
  - cursor.directory: manual submission through its GitHub path;
  - mcp.so and the other aggregators.
- **Other registries and directories**: AI client directories (Claude
  connectors and plugins, Cursor, OpenAI, VS Code and GitHub), package
  registries, `llms.txt` directories, app stores, G2, Capterra,
  AlternativeTo and SaaSHub, Product Hunt and its auto-generated
  alternatives pages, Crunchbase, StackShare, Indie Hackers, AI-tool
  directories and their fees, automation directories (Zapier, Make, n8n),
  API directories, awesome-lists and GitHub topics with their contribution
  rules, skills registries.
- **For each**: the exact mechanism, the requirements, whether each
  competitor is listed today, and what to prepare.
- **Names**: check availability on every registry the product will publish
  to and the GitHub handle. Do not reserve names with placeholder releases;
  registry policy treats that as squatting. Claim only what a registry
  supports (an npm org for a scope, a DNS record for a namespace) and
  publish real code.

Start the checklist with the actions that are free, time-sensitive, and
need no product: names, org handles, DNS records, an aged launch account.
Order the rest by phase.

**Success criteria**: a checklist with a "what [product] needs" line per
surface, using the product's own name from step 1, and a sequence tied to
the roadmap.

### 7. Write the documents

Write `.seo/foundations.md` in this shape, plus the four files from the
goal:

```markdown
# SEO Foundations: [site name]

Updated [date]. Site live: [yes / no]. Connected sources: [list, or none].

## Identity
- Category: [the name buyers use]
- Primary user: [specific audience, and the agent if it is a reader]
- Trigger and job: [what makes them search, what they are doing]
- The pain it solves: [problem]
- The wedge: [what makes it different]
- Proof: [what shows the wedge is real]
- Boundary: [what it is not]
- Words the product uses: [vocabulary]
- What we don't have yet: [planned and reserved features]
- Naming rule: [names never written in public copy, with the source; or "none"]

## Competitors
| Competitor | How we found them | Pages by type (sitemap) | Their strength | Our advantage |
|------------|------------------|-------------------------|----------------|---------------|

Migration targets: [dead or acquired tools, with dates and sources]

## Search Landscape
| Query | Who ranks | Our position | Opportunity |
|-------|-----------|-------------|-------------|

## Competitor Content Map
### [Competitor]
- Comparison, alternative, per-source and audience pages
- Agent surfaces
- Blog frequency, E-E-A-T signals
- Weak spots

## Starting Point (priority order)
1. [action]: [why this first]

## Messaging Notes
- [messaging test counts, ambiguous phrasings, adjacent-category collisions]
- [corrections the repository docs need]

## Method caveats
- [which demand sources were unreachable; which orderings came from a tool]

## Files
- Keyword map: .seo/keyword-map.md
- Competitor map: .seo/competitor-map.md
- Page inventory: .seo/page-inventory.md
- Discovery checklist: .seo/discovery-checklist.md
```

Then archive the working data into `.seo/archive/<YYYY>/<MM>/<DD>/` so the
next run can compare against it.

**Success criteria**: any agent running `seo-briefing`,
`seo-content-strategy`, or a content pass after this has the context it
needs, and every number can be traced to a file in `.seo/data/`.

### 8. Hand off to the content pass

The inventory is not the copy. When the user asks for the pages:

- The site should be content-driven: one content module per page kind, a
  template per kind, and the route registry, sitemap, and `llms.txt`
  generated from the same data. Figure out the UI first (which templates
  exist, which the inventory needs), then the content.
- Keep URLs that already rank. Moving ranking pages to a new path loses
  their clicks at the old address; link to them from new pages instead.
- Write one brief for the writers that says where the truth lives, the
  rules that never bend (the naming rule from step 1, planned means
  planned, concede first, dated numbers, no invented features), the voice,
  the depth targets per page type, the block vocabulary, and how to finish
  (typecheck, a copy-to-review file for anything invented, a done file).
- One writer per content file, in parallel, each told how to write, what to
  write, who for, and given named examples to match. Assign by file so
  writers never collide; add second-wave pages in their own files and wire
  them in afterwards.
- Regenerate screenshots and Lighthouse, have the cold-reader child read
  the money pages, and list the copy-to-review items in the PR body.
- Check indexing a week after launch with URL Inspection on each new page,
  and link the missing ones from pages with traffic.

**Success criteria**: the writer brief, one writer per content file, the
copy-to-review list in the PR body, and an indexing check date for every
new page.
