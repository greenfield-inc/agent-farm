---
name: seo-page-brief
description: "Write or build from an SEO page brief: the one document a new or rewritten search page is built from, with its query, the page that already owns it, the facts it may state, its links and the experiment it starts. The strategist uses it to write briefs; the writer uses it before building any page."
---

# SEO page brief

One brief per page. The strategist writes it into the run's bundle beside the ranked page, and the writer builds only from an approved brief. Facts live in one ledger, `.seo/facts.md`, in the product's repository; the brief lists the ledger rows the page may use.

A brief is not permission to publish. The person approves the pick; the writer builds on a branch and opens a draft PR; nothing merges or goes live without the person.

[references/worked-brief.md](references/worked-brief.md) is a filled alternatives-page brief for a made-up product, with a fact ledger excerpt and the Product A numbers behind each choice. Copy its shape.

## Before writing a brief

1. **Re-pull.** Use the connected Search Console tool for the last 28 days of the target query and its close variants. A number copied from an older brief does not count.
2. **Find the page that already owns the query.** Look up which URL gets the query's impressions today. A new page loses to the older page that already owns the query: on Product A, "paseo" kept going to /compare/remote-development (738 impressions) and new explainers aimed at owned queries earned 0 impressions sitewide ("Why new pages are not indexed", investigation, 2026-11-03). When an older page owns it, the brief improves that page, or the new page takes a different query. Without Search Console, search the site's own pages and sitemap for the query and say the check was public-only.
3. **Read what ranks now.** Search the query live and record the top results with their date, page type and the angle each takes. Note whether an AI Overview shows; Search Console's API does not report AI Overview appearances, so transcribe it from the results page and label it as transcribed.
4. **Read the foundations.** `.seo/foundations.md` and the documents beside it (keyword map, competitor map, page inventory) say what the product is, who it competes with and which page types exist. When the product keeps an identity file with a "what we don't have yet" list, every item on that list is a claim the page must not make.
5. **Choose one buyer job and one intent.** Name the job the searcher is trying to finish. The strategist's quick-wins method keeps the intent and click-rate table; the short version on Product A (28 days to 2026-11-01): alternatives pages 4.26% CTR, compare pages 1.85%, explainers 0.87%. Intent sets the ceiling more than polish does, so pick the page type the intent supports before anything else.

## The brief

Write each field. A field with no answer says why, and a missing fact goes to its owner as a question; it is never filled with an estimate.

1. **Query and intent.** The target query, its 28-day impressions, clicks and position (source and window), close variants, and the buyer job in one sentence.
2. **The page that owns it now.** The URL with the query's impressions, or "none" with how that was checked. The decision: new page, or change to the owner.
3. **What ranks now.** The dated results list from step 3 above, and the gap this page fills.
4. **Facts the page may use.** The ledger rows by claim, each with its source, date, owner, approval and allowed wording copied from `.seo/facts.md`. Only rows with approval `approved` go in the page. See "The fact ledger" below.
5. **Proof with permission.** Each customer quote, logo, screenshot or metric with its publication permission (who granted it and when), the metric's definition and denominator, and its attribution limits. Screenshots come only from a hands-on run. No permission, no proof.
6. **Structure.** The decision path, in order: what the user does, what they get, fit and exclusions, setup and timing, real examples, cost with stated assumptions, proof, the next step. Length is whatever resolves the decision. Name the headings, any table and the FAQ questions people actually search. Structured data only for content visible on the page; valid markup earns no rich result by itself. In August 2023 Google limited FAQ rich results to well-known, authoritative government and health sites (Google Search Central, 2023-08-08), so on other sites a visible FAQ is for readers.
7. **Title and description.** See "Titles" below. Give the exact strings with their character counts.
8. **Internal links.** The pages that link in and the pages it links to. See "Links" below.
9. **Rewrite guardrails** (rewrites only). What stays fixed and what the brief changes. See "Rewrites" below.
10. **Measurement and the experiment it starts.** The experiment record the writer adds in the same PR, in the format `seo-experiments` owns: hypothesis, pages, baseline source and window, control, what stays unchanged, and the 21 and 42 day reads. State the expected result as a scenario with its source, never as a forecast. Time to first signal was 8 to 12 weeks for Product A as a new site and 4 to 6 weeks for Product B ("likely, not proven").
11. **Acceptance checks.** Every claim matches its ledger row; title, description, canonical and one meaningful H1; visible content matches any structured data; every link returns 200; the decision path works on a phone; any form delivers in a test environment the person authorized; the site's own check suite passes.
12. **Open decisions.** Each question for an owner, with who owns it. The brief is ready when the person has approved it and every fact the page uses is approved.

## The fact ledger

`.seo/facts.md` is the one file every page's claims come from. It is a research record, and a row becomes usable only when its owner approves it. One section holds the product's own facts, checked against a named version and date; one section per competitor or vendor holds theirs.

| Claim | Source | Date | Owner | Approval | Allowed wording | Stated on |
|---|---|---|---|---|---|---|
| One fact, one row | Primary source: the product's own docs, code or release at a named version; the competitor's own pricing page, docs, release notes or repository | Date the source was read | Who can approve it | approved, pending or rejected, with who and when | The exact words a page may use | Every live page that states it |

- **Primary sources only.** Agent desk research makes factual errors at scale. Product A's 54-page alternatives program had 9, 13, 11 and 6 Must-Fix findings across four PRs, plus 3 caused by a fix round and 3 more found in follow-ups: pages saying the product lacked features it ships, closed issues cited as open, shipped competitor features called missing, wrong counts and name casing. Its first own-product facts file was itself wrong and was rewritten after the first review. Check every fact against a primary source on the day; another agent's research, a review site or one of your own older pages never counts. Check an issue's state before calling it an open defect.
- **Confirm the commercial basics** for the product and each competitor: launch state, price basis, usage unit, term, platform or hardware requirements, support, integrations, privacy, limits.
- **Roadmap and illustrative numbers never count.** Roadmap talk, "coming soon" labels, future concepts from calls and sample numbers in a UI or homepage demo are not claims. A page existing does not prove a feature is generally available. When two sources conflict, the owner decides; never pick the more attractive one.
- **Claim only what ships.** Own-product rows come from released features. Anything unbuilt is labelled "proposed", "design preview" or "not yet available", never "early access". "Why people leave us" reasons use only gaps the product's own docs confirm, and a weakness the competitor shares is never a reason to leave.
- **Vendor and competitor facts go stale within days.** Date every row and re-check competitor and vendor rows on the day the page is drafted and again before the PR is marked ready; a row older than 7 days at either point is re-read. Product A saw: Conductor's shutdown copy (Nov 4 to 5) overturned by a new release on Nov 13, with only its cloud winding down; Superset renamed to Paradev with licence and price changes in late October; a "no sign-in needed" fact flipping between Nov 4 research and a Nov 5 check; a repository with 4 stars written up as about 3.4k ("Batch 1 new-name pages and fact sheets", facts verified 2026-11-05; competitor research dated 2026-11-18).
- **Stale claims.** The "Stated on" column is the stale-claims ledger. When a row changes, every page it lists gets the new wording in the same PR or a named follow-up; search the site source for the old wording too, because a page missing from the column still states it. Product A's fix for one alternatives batch also corrected an older live page that said a competitor could not create worktrees. Once per product, inventory the claims across the website, help, developer and product docs into this file; regulatory and compliance claims link their primary source.
- **Renamed competitors.** Keep the old slugs that rank; the first mention on each page, the title and the meta description say "New (formerly Old)"; later mentions say "New"; keep the old name as `alternateName` in JSON-LD and in keyword lists. Sweep every locale: Product A's Superset to Paradev rename touched 187 files in 11 locales, and review still found seven pages with the bare new name first.

## Writing rules the brief sets

### Titles

- Lead with the resolution: what the searcher gets or decides. On Product A in May 2026, of five compare-page rewrites only the resolution-framed /compare/superset hit its target, 3.14% then 3.95% CTR, against under 1% for titles with an em-dash suffix ("Content Briefs", 2026-05-10 and 2026-05-12).
- Keep titles under 60 characters and descriptions under 155. Use a colon, never an em dash. Product A's alternatives recipe allowed up to about 75 characters to fit two short reasons; when a title runs past 60, the first 60 carry the query and the resolution and the rest is optional.
- A title rewrite rarely lifts a page whose intent caps its clicks: Product A's five-page rewrite moved combined CTR from about 0.47% to 0.62% against a 2% to 3% scenario. Retitle when intent matches and the title is the gap.

### Links

- **Link in from pages that already earn traffic.** Of 41 Product A pages shipped Oct 5 to 10, the 17 indexed by Nov 3 had a median 7 inlinks, 5 of them from pages with 100+ impressions, and their linking pages totalled 4,424 impressions; the 24 unindexed ones had a median 3 inlinks, 2 from such pages, and 433 impressions on their linking pages. Word count and content overlap were the same in both groups. Name each linking page with its impressions, source and window, and add the hub, sitemap and `llms.txt` entries the site uses for the page type.
- **Link only to pages already live.** A Product B page linked several pages days before they existed; Google fetched a 404 and had not recrawled them months later, though all of them now return 200. A page that does not return 200 today gets no link; the brief lists the link for the PR that ships it.
- Keep ranking URLs. Moving a page that ranks loses its clicks at the old address; link to it instead. A redirect goes only to an intent-equivalent page, names the old URL's evidence and its destination, and never points everything at the homepage.

### Say each fact once

The first place a fact appears is its home. A later restatement is removed, reworded to add something, or kept only where repetition is the point (a summary table, a FAQ answer). Product A's homepage audit found 28 facts stated more than once; across their repeats, 12 removals, 34 rewordings and 23 keeps took the article from 4,326 to 3,735 words (13.7% fewer).

### Rewrites

The same rules hold for every page a brief edits, including another page it names for a stale claim or a new link. A rewrite keeps the URL, title, meta description, H1, section headings, card titles, FAQ questions, comparison table, section order, JSON-LD and heading anchors, unless the brief names the one it changes and why. The writer verifies by script that every old string, link and schema block survives in every locale, and keeps each removed heading ID as an alias: one Product A docs rewrite dropped 83 heading IDs, breaking bookmarks, search results and agent citations.

### Competitors

- Concede first. Each competitor section opens with where that tool wins and who should stay with it.
- Never call the product a deprecated tool's "successor", and never claim to be the only option.
- A compare page needs a hands-on run with screenshots. Without one, write an alternatives page and say "We didn't install or run it."

## Building from a brief (writer)

- Read the brief and `.seo/facts.md` first. Build only what the brief names; a change it does not name goes back to the strategist as a question.
- Use the allowed wording of approved rows. A claim with no approved row stays out of the page, and the PR lists it for its owner.
- Re-check competitor and vendor rows before marking the PR ready, as the ledger rules say.
- Add the experiment record in the same PR, and run the acceptance checks; the PR body lists each with its result.

## Sources

- "Growth, phase by phase" (v2, 2026-11-04): Phase 2 (page types and their lag), Principles 1 to 3 and 8, "Linking ahead caused months of errors".
- "Why new pages are not indexed" (investigation, 2026-11-03): the 41-page inlink comparison and the owned-query findings.
- "Alternatives pages for the gap analysis" (Session item, 2026-11-16 to 2026-11-17): writer brief, own-product facts file, 64 fact sheets, one claims table per page, findings for four PRs.
- "Superset is now Paradev, PR #242" (2026-11-15), "Homepage: say each fact once, PR #248" (2026-11-15), "Docs clarity audit and rewrite" (2026-11-15 to 2026-11-16).
- "SEO: GSC Findings and Diagnosis" (2026-05-07), "Content Briefs" (2026-05-07 to 2026-05-14), "SEO Strategy" (2026-07-17): title rules, resolution framing, honest competitor copy.
- "Batch 1 new-name pages and fact sheets" (facts verified 2026-11-05) and "Competitive pages: run progress" (2026-10-04): fact sheets with a verified date and a tick box for a person, vendor facts that changed.
- A customer workflow starter (method only): the commercial brief's decision path, fact ledger fields, acceptance checks and "a brief is not permission to publish".
