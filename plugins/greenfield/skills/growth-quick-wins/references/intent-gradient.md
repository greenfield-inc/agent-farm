# The intent gradient

What the searcher typed sets a ceiling on how many click. A page that matches the query reaches that ceiling; no title or rewrite pushes past it. Use this table to size the payoff of a page: impressions at stake times the bucket's click rate.

Two products measured it. **Product A** is an open-source developer tool for running coding agents in parallel (Search Console through 2026-11-01). **Product B** is a B2B healthcare SaaS with a free plan (90 days to 2026-11-01, similar positions).

| Intent | Example shape | Click rate seen | Build |
| --- | --- | --- | --- |
| Brand | `<product>`, `<product> login` | Product B 75%; Product A homepage 13.5% (28 days) | Already won; protect the homepage title |
| Free plan | `free <category>`, `is <competitor> free` | Product B 4.11% for the bucket, 8 to 11% on single queries, about 7x the next intent | A page aimed at the free plan; a pricing row on the competitor page |
| Competitor alternatives | `<competitor> alternatives`, `<competitor> competitors` | Product A 4.26% (28 days), 4.38% lifetime, best queries 6.4 to 8.6%; Product B family 1.7% | One page per competitor buyers choose between, URL and H1 matching the query |
| Pricing | `<product> pricing`, `<category> cost` | Product B pricing page about 1.2% | An indexable pricing page with the price in text |
| Head to head | `<product> vs <competitor>` | Product A 1.85% (28 days), 2.28% lifetime; Product B 0.35% | Only when buyers choose between the two tools |
| Vertical or role | `<category> for <vertical>` | Product B 0.9%, its best new family | A page per vertical that already earns impressions |
| Verification | `is <tool> <compliant/safe/secure>` | Product B 0.4 to 0.5% | Citation play; judge by AI views |
| Definition | `what is <term>` | Product A 0.87% (28 days); Product B 0.10% | Citation play; write no more once one exists |
| Category list | `best <category>`, `<category> software` | Product B 0.08 to 0.13% with no list page | One honest list page, 8 to 10 products, the product ranked on merit |
| Conversational | 5+ word questions | Product B 0 clicks at position 3 to 6 | Test one page whose H1 is the question |
| Bare competitor name | `<competitor>` | Product B 0.05 to 0.11% | Test one honest review page at most |
| Wants people | `<category> reddit` | Product A 0 clicks on 150 impressions | Join the threads; no page wins it |

## Reading it

- Among Product B's non-brand intents, free-plan searches were the only bucket above 1% (4.11%, against 0.50% for compliance checks, 0.19% for the category head and 0.10% for definitions). Its free-plan cluster ran 3.38% against a 0.40% site baseline.
- Alternatives beat "vs" for the same competitor: Product A's alternatives pages earned 4.26% against 1.85% for its compare pages and out-clicked them 3.5 to 1 over the 28 days to 2026-11-01.
- The same page type swings with who the competitor is. Over the same 90 days (2026-05-14 to 08-11), Product A's compare pages earned 2.30% and Product B's vs pages 0.35% on near-equal impressions: 6.6x the click rate. Product A's named tools were ones buyers chose between; Product B's were tools people already used for something else, so the results page answered "is this allowed?" itself.
- Build a compare page only when buyers choose between the two tools. Product A shipped compare pages for every newly found tool; 2 of 9 were indexed, and its quick wins redirected the ones whose query an older page already won (see the worked page). Alternatives pages for real competitors came first.
- Definitions get seen, not clicked. Product A's explainers ran 0.87% over 28 days and 0.80% lifetime; of 14 definition pages shipped in October, 1 was indexed by Nov 3. Product B's ran 0.10%.
- Plan on the cluster rate, not the best query. Product B's best free query hit 13%; the cluster ran about 4%.
- An AI Overview can take clicks at a steady rank. Product A's Conductor queries went from 182 clicks on 3,655 impressions to 60 on 3,845 while position held near 5. `/compare/conductor` had become a source card inside the Overview. Check the live results page before rewriting a title.
- A falling site-wide click rate is often mix shift (more low-intent pages), not decay. Product B's site rate fell from 4.8% to 2.0% in six months while clicks grew 68%, because a large low-intent page set joined a small high-intent one.
- Page count predicts impressions; intent predicts clicks. Impressions per page per month held roughly constant per site: Product A about 150, rising to 217 in October; Product B several times higher.
- Forecast as a scenario: impressions are roughly pages times the site's rate per page; clicks are impressions times the bucket's click rate. The click rate varies more than 10x across buckets and is the lever a page controls.

Sources: "Growth, phase by phase" (v2, 2026-11-04); "Agent-First Growth Playbook" (updated 2026-11-03); "Product B growth deep dive" (2026-11-03); "Conductor query clicks" (2026-11-03).
