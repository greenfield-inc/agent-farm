---
name: seo-answer-panel
description: "Measure whether AI answer engines name, recommend and cite the product, with a frozen panel of unbranded buyer questions and per-engine rates that show every numerator and denominator. Use for a baseline, a matched follow-up after a page change, or the monthly AI check."
---

# AI answer panel

AI answers show a product without sending a click, so referral traffic undercounts them. The panel asks the questions buyers ask, the same way every time, and records what each engine says and cites. The result is a sample of answers: it reports how often each engine named, recommended and cited the product on these questions. It is never market share, citation share of the market, query volume or a revenue forecast.

Read `references/protocol.md` before the first run. It holds the full protocol and a worked CSV with its hand-computed summary.

## Why it exists

- AI answers carry visibility without clicks. On Product B (a B2B healthcare SaaS with a free plan), AI-feature impressions rose from 14% of regular web impressions to 34% about three months later, and its definition and compliance pages appeared in AI answers far more often than they were clicked. Search Console counts those appearances; it does not say whether the answer named the product. The panel answers that. Source: "Growth, phase by phase" (v2, 2026-11-04), Principle 5.
- Visitors from an AI answer land on the page the answer cited. On Product A (an open-source developer tool for running coding agents in parallel), Perplexity referrals rose from 2 to 24 pageviews over May 10 to 12, 2026 after the compare pages were rewritten, and those visitors landed on the cited compare pages and category hubs, never on the homepage or the llms files. So the cited URL is the page to improve, and the panel records every cited URL. Source: "Content Briefs" (Product A, 2026-05-12 entry); "SEO and growth catalog" (2026-11-21), the distribution step.
- A readiness scanner score measures something else. Product A scored 100 on an agent-readiness scanner in August 2026 while its AI-assistant visits fell; the fall had started three weeks earlier, when assistants stopped linking its competitor compare pages. Report scanner scores as readiness, dated and named, beside the panel and never in place of it. Source: "Growth, phase by phase" (v2, 2026-11-04), "A perfect agent score, fewer AI visits".

## Where things live

All under `.seo/answer-panel/` in the product's repository, written on the measurer's own branch and draft PR:
- `panel.md`: the frozen definition (prompts and settings, below).
- `runs/<YYYY-MM-DD>.csv`: one file per panel round, named by the round's first day. One row per planned slot.
- `runs/<YYYY-MM-DD>/`: one capture file per answered slot (answer text, cited URLs, capture time, model shown).

## Steps

1. **Draft prompts by buyer intent.** Group unbranded questions by the job a buyer is trying to get done (for Example Co: "choose a tool", "compare two named tools", "check a requirement", "set it up"). Never put the product's name in an unbranded prompt and never hint at the wanted answer. Branded diagnostic prompts ("is Example Co good for X?") are a separate study and stay out of the rates.
2. **Validate the wording against real buyer language** before freezing: sales and support call notes, survey answers, and Search Console queries from the connected Search Console tool (or the snapshots `seo-data-pull` wrote). Rewrite a prompt that no buyer would phrase that way, and record the source that supports each prompt in `panel.md`.
3. **Freeze the settings in `panel.md`**: prompt version, the prompts with ids and intent, engines, locale and country, search mode (on or off), signed-in state, repetitions per prompt and engine, run dates (spread over at least two days), the random seed for prompt order, and the authorized budget. A change to any of these starts a new prompt version and a new baseline.
4. **Validate one manual run before repeating or scheduling.** Run one complete round by hand, check every row and capture against the protocol, run the summarizer, and have the person confirm the result reads correctly. Only then repeat it or schedule it. A scheduled job that records bad rows produces months of unusable data.
5. **Run each slot in a fresh session**: a new chat with memory and personalization off, or a fresh API call, with the frozen settings. Write the CSV row for every planned slot before running it. When an engine is unavailable, mark the slot `unavailable` and move on; never substitute another engine.
6. **Capture per slot**: the full answer text, every cited URL, the capture date and time, and the model the engine showed. Then score the slot (definitions in the protocol): mentioned, recommended, cited, and whether the cited page supports the claim correctly, checked by a person against the fact ledger in `.seo/facts.md`.
7. **Summarize** with the script, then report.

```bash
node <this skill>/scripts/summarize-panel.mjs .seo/answer-panel/runs/2026-11-02.csv          # table
node <this skill>/scripts/summarize-panel.mjs .seo/answer-panel/runs/2026-11-02.csv --json   # for the report
```

## Rates and denominators

Every rate is reported as numerator over denominator, with the rate beside it. Missing is never zero.
- **Availability** = answered slots / planned slots.
- **Mentioned, recommended, cited** = slots scored yes / answered slots scored yes or no. Unavailable slots and unscored values leave the denominator.
- **Correctness** = correct citations / scored citations (answered slots with cited yes and correctness scored yes or no).
- One row per engine. Never average engines into one score; their availability and behavior differ.

The same question has different correct answers under different denominators. Product B's AI share of sign-ups was about 4% in tracked attribution, 20% in survey answers counted in analytics, and 24.3% and 27% in warehouse counts over different windows, all correct for what each measured. Name the denominator in every sentence that states a rate. Source: "Growth, phase by phase" (v2, 2026-11-04), Principle 7; "Product B consolidation digest" (2026-11-21).

## Measure AI three ways

The panel is one of three AI readings. Report each with its own denominator and never add them:
1. The Generative AI features report in Search Console (impressions only, read from the UI; see `seo-evidence` for how to transcribe and label it).
2. The panel, plus a ten-minute click test: click one of the product's citations in an AI answer (claude.ai, for example) and read the referrer the analytics tool records. That shows whether that assistant's clicks arrive tagged, as direct, or at all.
3. A "How did you find us?" sign-up survey with an AI option split by assistant.

Source: "Growth, phase by phase" (v2, 2026-11-04), The monthly loop step 4; "Why AI-assistant visits to Product A fell after the agent-readiness pass" (2026-11-03), settling measurement.

## Cadence and use

- Run a baseline, then a matched follow-up with the same prompt version and settings: monthly by default, and around a page change that the experiment record in `seo-experiments` names as the panel's page. The read-back in `seo-read-back` compares matched rounds.
- Before crediting a page change, check the spread across repetitions on the same prompt; a swing inside that spread is noise.
- Connect each finding to a page: a prompt where the engine cites a competitor's page and not ours points to the page to write or fix.
- Report: the per-engine table, the factual errors found (claim, engine, cited URL, the fact it contradicts), and at most three proposed changes, each tied to a page.

This method generalizes the independent answer panel in a customer workflow starter (confidential, method only). The lessons above come from `seo-evidence`.
