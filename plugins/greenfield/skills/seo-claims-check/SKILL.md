---
name: seo-claims-check
description: "Check every claim on an SEO page or content PR against a live source before it reaches the person: numbers, absence claims, prices, scanner scores, known wrong beliefs, AI-layer advice, competitor facts. Use as the reviewer on a ranked page, deep dive, investigation, page draft or content PR; it writes findings and edits nothing."
---

# SEO claims check

The reviewer's check on anything the SEO roles hand to the person: a ranked page, a deep dive, an investigation, a page draft, or a content PR. It checks every claim, writes findings in greenfield's routing format, and edits nothing; the author fixes.

- **On a content PR:** run the `review` skill's steps at the PR's size, with `principled-review` for the code it touches, and run this check on every page the PR changes. Post one review, event `COMMENT`, as the review skill says.
- **On a page:** run this check and the cold read, and write the findings file only.

Agent-written SEO work is wrong often enough that every claim is checked, never a sample. Product A's 54-page alternatives program had 9, 13, 11 and 6 Must-Fix findings across four PRs, mostly facts from desk research: features the product ships called missing, closed issues cited as open, shipped competitor features called absent, wrong counts and casing ("Alternatives pages for the gap analysis", 2026-11-16 to 2026-11-17).

## 1. List every claim

Read the whole target and list every claim in a table: where it is, the claim, its kind (number, absence, price or score, scanner, known wrong belief, AI-layer advice, competitor or spam verdict, vendor fact, own-product fact), and the check you ran. Record the count. The table is the coverage proof: a claim not in it was not checked.

## 2. Check each claim

**Numbers.** Each number names its source and window ("connected Search Console tool, 28 days to 2026-11-19"). A number with no source or window is a finding. Re-pull each number the page's actions rest on when the access tier allows, and compare. A reading at low counts stays directional, and an item backed only by another product's number is a hypothesis ranked last; the evidence rules in `seo-evidence` say how each is labelled.

**Absence claims, all of them.** Every "missing", "broken", "not indexed", "404", "no X", "lacks", "orphan" or "not served" claim is re-checked live, one by one. Record per claim what you ran, when, and what came back.

| Claim says | Live check |
|---|---|
| 404, broken, missing page | Fetch the URL: status, final URL after redirects, and the same for the www and trailing-slash forms. |
| Not indexed | URL Inspection through the connected Search Console tool. "Discovered, currently not indexed" and "URL is unknown to Google" both mean Google never fetched it; say which. Without access, mark it unchecked and say so. |
| noindex, blocked | Fetch robots.txt, the `X-Robots-Tag` header and the meta robots tag. A crawl blocked by robots.txt never sees a noindex header, so check both. |
| Orphan page | Find inlinks in the rendered HTML of live pages, not only in the sitemap or source. |
| No schema, no llms.txt, no Markdown | Fetch the live page or file and read what it serves today. |
| "Competitor has no X" | The competitor's own docs, pricing page, changelog or repository today; an issue's current state before calling it an open defect. |

**Prices and scores.** Re-read every price and every score live from its owner's page on the day of the check, and record the date. A price copied from research, a review site or an older page of ours does not count. Example: a draft lists Rivalsoft at $90 a month; Rivalsoft's pricing page that day shows plans at $30 and $60, so the finding quotes both and the date. Product B shipped this kind of error once ("Growth, phase by phase", v2, 2026-11-04, Phase 2).

**Scanners.** Each scanner score keeps its own scanner's name and the date it ran. Two names count as two scanners only when they are separate scans: is-agentic is Ora's short score built on the same scan, so the two are one reading. A score describes readiness, whether an agent could use the site; it never stands for citations, AI traffic or rankings. Product A scored 100 and 87 after a 7-hour readiness pass while AI-assistant pageviews fell from 5.2% to 1.4% of pageviews (July to October 2026); Product B scored 64 and 65 while its AI-assistant visits about doubled (May to October). A page that recommends chasing a score, or reads a score as citations, gets a finding.

**The corrections list, line by line.** Open the corrections list in `seo-evidence` (references/corrections.md) and take each entry in order: search the target for the wrong belief and record "absent" or a finding. Typical hits: Google reading IndexNow pings, FAQ markup as a growth tactic, llms.txt as a Google ranking signal, "if rank holds, traffic holds", moving a ranking URL to a cleaner path, a dated audit quoted as the live site. The findings file lists every entry with its result.

**AI-layer advice.** Advice to add agents.md, Markdown copies, llms.txt or an MCP card fits only when the product's buyers use agents and the site serves what the file describes. Check both live. Product B's /agents.md described MCP and OAuth that no endpoint served; Product A served Markdown only for / and /docs, and its MCP card described a local stdio server, so both scanners reported a failed handshake.

**Competitor and spam verdicts.** "Outranked by spam", "shut down", "renamed", "dropped its free plan" and every other verdict about another site carries its evidence: the live page or results page, its date, and the primary source. A verdict with no evidence is a finding.

**Vendor and competitor facts are dated.** Each one carries the date it was read, and a date older than 7 days is re-read before the target goes to the person. These facts change within days: Conductor's shutdown copy (Nov 4 to 5) was overturned by a new release on Nov 13 with only its cloud winding down; Superset renamed to Paradev with licence and price changes in late October; a "sign-in required" fact flipped between a Nov 4 research pass and a Nov 5 check.

**Own-product claims.** Each matches an approved row in `.seo/facts.md`, or the product's released docs at a named version. The page claims only what ships: unbuilt work is labelled "proposed", "design preview" or "not yet available"; roadmap items and sample numbers from a demo are not claims.

**Written for a stranger.** The page opens with the actions: what to do, in order, before any background. A reader with no context can follow it: internal names explained, absolute dates, every claim with its number and source. A ranked page or deep dive also lists its rerun and gap check (what the first pass missed or got wrong, or "nothing", with the checks named).

## 3. Cold read

Send the target to your `cold-reader` child, which reads it with the `cold-read` skill as a first-time reader, with no other context. Each confusion, omission or contradiction it reports becomes a finding or goes under Dropped with the reason.

## 4. Verify every finding yourself

A review finding can itself be wrong. Product B's reviewers once called a documented import limit a Must-Fix error; the fix report showed the lower cap always applies first, and the reviewers had it backwards. Before raising a Must-Fix or Should-Fix, run its check again yourself and attach the result. One you cannot verify goes in as a Should-Fix marked "unverified", or under Dropped with the evidence that rules it out.

## 5. Grade and write the findings

Grade by consequence with the severity rubric in the `review` skill's CRITERIA.md (harm, reach, recovery), and weigh each Must-Fix and Should-Fix with its "Fix or let go" section. For SEO targets:

- **Must-Fix:** a false claim about the product or a competitor that would publish; a wrong number an action rests on; an action the corrections list disproves; an absence claim ("broken", "not indexed", "404") that the live check contradicts, when a ranked action rests on it; any leaked credential, private path or private customer detail.
- **Should-Fix:** a number with no source or window; an undated vendor fact; a scanner score with no name or date; an action without a time or evidence line; a missing rerun and gap check; a cold-read confusion that changes what the reader would do.
- **Suggestion:** wording and order that do not change a decision.

Each finding:

```
**F-n [title]** · <page section, or file:line> - what is wrong.
Evidence: <the live check: what was run, when, and what came back>
Harm: high|medium|low (why) · Reach: high|medium|low (who) · Recovery: silent|visible (workaround) → <level>
Fix size: small | large (≈N lines; what it adds)
Options: 1. <cheapest safe fix> 2. <full fix, if different>
Decision: fix | mitigate (option 1) | let go (known limitation: <one line>)
Scope: in | out (<why>) · Approach/scope: no | yes (<the plan change it would need>)
Checked by: live | source | reading
```

`Scope:` is in when the fix stays inside the target or the item's approved work, out when it lies elsewhere (another page, a follow-up). `Approach/scope:` is yes when the fix needs a different approach or a change to the approved pick, such as a ranked item resting on a disproved premise.

The findings file, in this order, every section present (`none` when empty): Must-Fix, Should-Fix, Suggestions, Live checks (the claims table from step 1 with each result), Corrections list (each entry: absent or F-n), Cold read, Dropped, Summary.

- **For a PR:** the Summary ends with `Mergeable as is: yes | no - <one line why>`, and the review ends with `<!-- greenfield-review head=<sha> -->`. The live checks and corrections list go in the posted review after the Claims section.
- **For a page:** the Summary ends with `Ready for the person: yes | no - <one line why>`, and the file ends with `<!-- greenfield-review page=<path or URL> revision=<revision id or content sha256> -->`.

Say yes when no Must-Fix is open. When an orchestrator launched you, it names the findings file; run by hand, write `./tmp/claims-check-<page or branch>.md` and give the person its path. The author fixes; a follow-up checks only the sent findings and the lines the fix changed.

## Sources

- "Alternatives pages for the gap analysis" (Session item, 2026-11-16 to 2026-11-17): Must-Fix counts and error classes over four PRs.
- "Growth, phase by phase" (v2, 2026-11-04): Principle 6 (readiness scores and AI traffic), Phase 2 "Copy this" (a person checks every fact).
- "Why new pages are not indexed" (investigation, 2026-11-03): what "unknown to Google" and "discovered, not indexed" mean.
- "Batch 1 new-name pages and fact sheets" (facts verified 2026-11-05) and competitor research dated 2026-11-18: vendor facts that changed within days.
- The quick-wins method's verify step (greenfield-inc/skills commit ac05069, 2026-11-04): re-check every "missing" or "broken" claim live, re-read every price and score, cold read with a fresh agent; the customer workflow starter's verification method (method only).
- A Product B PR fix report (2026-10-19): a Must-Fix the fix showed was backwards.
