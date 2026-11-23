---
name: seo-content-drafting
description: "(execution) Create new SEO content: blog posts, landing pages, comparison pages based on the content strategy. Use when the user wants to create new content for SEO: blog posts, landing pages, comparison pages, or category pages. Usually follows seo-content-strategy. Examples: 'write the blog posts', 'create the landing pages', 'draft the comparison page', 'fill the content calendar'."
---

# SEO Content Drafting

Create new content based on the approved content strategy. Blog posts, landing
pages, comparison pages, explainer pages, category pages.

## Prerequisites

- **Writing process**: Follow `seo-writing-framework` for every piece of content. This is the most important prerequisite. Research real examples, draft with reference, reader hat, edit, run the `good-writing-fundamentals` gate, score.
- **Strategy**: `.seo/strategy.md` should exist from a prior seo-content-strategy run.
- **Voice guide**: Must exist in the repo (`AGENTS.md` or `VOICE.md`).

If strategy or voice guide is missing, tell the user to run the prerequisite skill first.

## Goal

Create publication-ready content that:
1. Targets specific keywords from the strategy
2. Matches the founder's voice (reference the voice guide)
3. Includes proper SEO metadata, JSON-LD, and OG images
4. Has author byline with headshot and dates
5. Links to related docs, explainer pages, and glossary terms
6. Includes external authority links for E-E-A-T
7. Passes the humanity test (first-timer can understand it)

## Steps

### 1. Read the strategy and voice guide

Read `.seo/strategy.md` for what to create and why.
Read the voice guide for how to write it.
Identify which content items are approved for creation.

Ship in small batches: 5 to 15 pages per batch, one topic each, with the answer
in the first paragraph. Small single-topic batches beat a big template batch:
a single-topic batch earned about 4x the clicks of a templated batch in six
weeks, and almost half of the template pages never appeared in Google.

**Success criteria**: Clear list of content to create with target keywords and intent.

### 2. Research each topic

For each piece of content:
- WebSearch the target keyword to see what currently ranks
- Read the top 3 results to understand what the audience expects
- Identify gaps in existing content (what they don't cover)
- Find authoritative sources to reference (E-E-A-T)
- Check if the site has related pages to link to

**Success criteria**: Each topic has research notes, competitive context, and source links.

### 3. Draft content

Write each piece following the site's patterns:
- Match existing component structure (check how other pages are built)
- Use the voice guide for tone and style
- Include proper metadata: title with brand suffix, description with differentiators
- Add JSON-LD schema (Article for blog, WebPage for landing). Add FAQPage markup only on a government or health site that Google treats as authoritative: Google limited FAQ rich results to those sites in August 2023, so on other sites FAQ markup earns no rich result
- Create OG image files if the site has a programmatic banner system
- Add AuthorByline component with "Last updated" date
- Use `<Term>` component for glossary words if the site has one

For blog posts:
- Add to the posts array in the correct chronological position
- Set appropriate date (current date or backdated per strategy)
- Include author field

For landing pages:
- Create page.tsx in the appropriate app directory
- Add to footer navigation if it's a primary page
- Add to sitemap if manually maintained
- Check deploy workflows (CI/CD, CDN invalidation, cache purge configs) for per-page entries that new URLs need. Cloud CDN and similar services often require explicit path invalidation for each new trailing-slash URL.

**Success criteria**: Each piece of content is complete with metadata, schema, OG images, byline, and internal/external links.
**Rules**:
- Never keyword-stuff. Write for the reader, optimize for the search engine second.
- Every external link should go to a real, authoritative source
- Titles under 60 characters including brand suffix
- Descriptions include platform/differentiator keywords
- Dates in human-readable format (Month Day, Year)

### 4. Internal linking pass

After all content is drafted, do a linking pass:
- New pages link to relevant existing docs, explainers, and glossary
- Existing pages that mention concepts covered by new pages get links added
- Footer or navigation updated if new pages are primary surfaces
- Footer navigation MUST be updated for new pages, unless the run is scoped to named pages (an SEO writer building one brief), in which case it is listed as a follow-up. Otherwise do not defer this to a separate authority pass. Put each new page in the footer column that matches its type (for example alternatives pages with comparisons, solutions pages under solutions).
- Check if the project has CDN invalidation entries in deploy workflows (e.g., `.github/workflows/*-deploy.yml`) and add entries for every new page URL.
- Glossary updated with any new terms introduced

Add a link to a page only once that page is live and returns 200. A link to a
page that does not exist yet costs months: one site linked several pages days
before they shipped, Google fetched them as 404, and it had not recrawled them
more than five months later. Add the links from existing pages in the same deploy as the new
pages, or after it.

**Success criteria**: Every new page links to at least 2-3 existing pages. Existing pages link back where relevant. Every linked page is live.

### 5. Build, verify, deploy

Run the production build to catch errors.
Create a PR with a summary of all content created, target keywords, and the strategy context.

**Success criteria**: Build passes. PR merged or pushed.

### 6. Get new URLs indexed

After merge and deploy, work through every new or significantly changed URL.

**Google**: Google discovers pages through links and sitemaps. Link each new
page from pages Google already crawls and that earn search traffic, and keep
the sitemap current. On day 7 after deploy, check every new URL with Search
Console URL Inspection (through the connected Search Console tool when it
offers inspection). For each URL that is not indexed, give the person the
direct URL Inspection link so they can click "Request Indexing": the Search
Console API inspects URLs but cannot request indexing. Use the Google Indexing
API only for the content types Google allows it for (job postings and
livestream videos).

**Bing and other IndexNow engines**: if the site has an IndexNow key file in
`public/`, submit a batch POST to `https://api.indexnow.org/IndexNow` with the
host, key, keyLocation and urlList. IndexNow reaches Bing, Yandex and the other
participating engines. Google does not read IndexNow.

**Success criteria**: Every new URL is linked from a crawled page with traffic,
inspected on day 7, and each miss is listed with its URL Inspection link.
Report which URLs were inspected, their status, and any IndexNow response.

### 7. Record experiments

Record each change as an experiment, one file per experiment in
`.seo/experiments/`, named `YYYY-MM-DD-short-name.md`. When the experiment
record format is bundled with you, follow it in full (it adds confounders, the
minimum window, expectations and the stop, continue or expand rule). At least,
each record states:
- The hypothesis, in one sentence
- The pages it changes
- The baseline: its source and date window, taken from `.seo/data/` at the time of the change
- What stays unchanged, so the read can rule other causes out
- The control: comparable pages left alone
- Two reads, at 21 and 42 days after the change ships

Open each record with frontmatter: `id` (the file name without `.md`),
`hypothesis`, `pages`, `live` (the ship date, only when deploys happen by
hand), `read_21` and `read_42` (empty until each read is done), and
`status: running`.

Commit the experiment records alongside the content changes and push, so
later runs can measure them. Raw pulls under `.seo/data/` and `.seo/archive/`
stay out of commits; a record cites only the aggregate numbers it needs.

**Success criteria**: Every content action has an experiment record with a
hypothesis, baseline, control and read dates. `.seo/` is committed and pushed.
**Artifacts**: List of new URLs with their day-7 inspection status, and the
URL Inspection links for each page still not indexed.
