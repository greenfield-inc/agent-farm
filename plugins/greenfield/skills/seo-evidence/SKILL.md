---
name: seo-evidence
description: "The measured SEO and AI-discovery evidence from two real products: lessons by phase with their numbers, every corrected belief, how each data source was reached and its traps, and an index of worked examples. Open it before you make, rank, review or measure any SEO claim."
---

# SEO evidence

This skill holds what two products learned growing through Google and AI answers in 2026, written down so a role can act on it without the original pages. It has no steps of its own. Every SEO role reads it and follows its evidence rules.

The two products:

- **Product A**: an open-source developer tool for running coding agents in parallel. A new domain from 2026-02-26. Its real numbers, page paths, competitor names and dates appear in full.
- **Product B**: a B2B healthcare SaaS with a free plan. A known brand reworked from April 2026. It appears as ratios and percentages only.

A few method lessons come from one customer engagement (its workflow starter). Only the method is used: never its names, numbers, findings or domains.

## Which file to open

| You are about to | Open |
|---|---|
| Plan pages, rank quick wins, or say what a change is likely to earn and when | [references/lessons-by-phase.md](references/lessons-by-phase.md) |
| Write or approve any claim about indexing, IndexNow, scanners, AI answers, rewrites, URL moves or a traffic drop | [references/corrections.md](references/corrections.md) |
| Pull Search Console, analytics, git history, a sign-up survey or a scanner, or judge whether a number can be trusted | [references/data-sources.md](references/data-sources.md) |
| Find a filled example of a page, brief, record, read-back, investigation or panel | [references/index.md](references/index.md) |

Read the corrections before you write anything a person will see. They are the mistakes this work already made once.

## Evidence rules

Every role follows these on every page, brief, record and report.

1. **Each claim carries its number, its window and its source.** "Alternatives pages earned 4.26% CTR (28 days to 2026-11-01, Search Console, Product A)" is a claim. "Alternatives pages convert well" is not.
2. **Label each claim Shipped, Measured or Plausible.** Shipped: a merged PR, plus its first successful deploy when the site deploys by hand. Measured: a number from a dated pull or a dated live check. Plausible: reasoning the data does not prove. On pages for people, write Plausible as "likely, not proven".
3. **Tag where the evidence comes from**: Live (checked on the site today), Search Console, Analytics, Repo, Survey, or Case (a number from another product, including the two in this skill).
4. **An item backed only by another product's number is a hypothesis.** Mark it "Hypothesis" and rank it below every item with evidence from the product itself. The cases here tell you what to test first. They never prove what a new site will earn.
5. **Low counts are directional only.** A reading under 20 clicks says which way something may be moving and nothing more. Weekly changes at low counts are descriptive: claim no statistical or causal certainty.
6. **Search Console AI-feature data is UI-only.** The API does not return it. Transcribe it from the Search Console screen, label it "transcribed from the Search Console UI on <date>", and keep it as impressions only. [references/data-sources.md](references/data-sources.md#ai-feature-impressions) has the method.
7. **Make no claim about data you do not have.** Name the missing source and the access tier the work ran at. With no backlink tool connected, say nothing about backlinks. When your step needs the missing source for a claim, stop and ask for it; when it does not, continue and state the gap.
8. **Carry every correction forward.** A belief in [references/corrections.md](references/corrections.md) never reappears as advice. A correction you find during a run goes into your output, at the top, and is carried into every later page of that run.
9. **Scanner scores keep their scanner's name and scan date**, and describe agent readiness only.
10. **A dated document is a snapshot.** Before you call anything missing, broken, wrong or not indexed, check it live and record the date you checked.

## Proposing a new lesson

The reference files change only through a reviewed pull request to this skill. Never edit them during a run, even when a run disproves one of them; record the disproof in the run's output and propose the change.

A proposal is one PR that, for each lesson, states:

- the lesson in one sentence, and the file and section it belongs in;
- the number, its window, and the product it comes from;
- the source by title and date (a deep dive, an investigation, an experiment record), never a private path;
- whether it adds, strengthens or corrects an existing line, and which one.

A correction also adds its entry to [references/corrections.md](references/corrections.md) in that file's shape. Describe any product whose owner has not agreed to be named the way Product B is described here: a one-line description, ratios and percentages, no counts, names, competitors or domain.
