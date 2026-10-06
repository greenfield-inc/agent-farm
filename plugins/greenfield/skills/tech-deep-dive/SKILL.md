---
name: tech-deep-dive
description: Research an emerging technology, product capability, or workflow from X, Reddit, demos, documentation, and source code; explain its reusable mechanisms, practical applications, and experiments in a visual field guide. Use for technology deep dives and surprising use cases, including updating an existing guide.
---

# Tech Deep Dive

Turn a new capability into something a curious builder can explain, challenge and borrow from. Own both the research and the final explanation.

## Shared foundation

Read and apply [Deep Dive](../deep-dive/SKILL.md) once, then add the specialization below. Its source discovery, Bright Data key/skip flow, scraper-catalog discovery, source ledger, coverage checks, publishing, and fresh-reader review are part of this workflow. Do not start a second independent research pass or ask the same access questions again.

Both skills ship together. Supporting references resolve relative to these bundled directories, never a particular user's installation path. If this skill was copied alone, report the missing `deep-dive` dependency and locate/install the companion before claiming to run the full workflow.

## Look for surprising mechanisms

Use the audience, seed links and relevant products from the conversation. Include both X and Reddit in a broad social pass unless the user narrows scope. Explicitly search multiple promising `awesome-*` repositories, use-case directories, demo galleries, official examples/cookbooks, integration registries and community roundups. A collection is a lead source, not independent validation; follow distinctive entries, including lesser-known projects, into original posts and code.

Trace the implementations carrying the strongest conclusions beyond their READMEs. Record the inspected commit/version where possible. Inspect available product context before claiming an integration exists. Prioritize user-selected examples and let new evidence change the guide's main recommendations.

For each standout example explain:

1. **Observed outcome:** What does the user see, and why is it useful or surprising?
2. **Mechanism:** What inputs, representations, options, tools, model decisions, code, state changes and checks make it work?
3. **Transferable pattern:** What can another builder reuse beyond the demo?
4. **Conditions and limits:** What must exist already? Which steps need another model/service? What can fail?
5. **Application:** What useful behavior could this enable? Use the user's products when relevant context is available; otherwise label illustrative applications without inventing their product needs.
6. **Next evidence or test:** When the user is considering adoption or building, what baseline, quality criterion and threshold would justify proceeding? Otherwise explain what evidence would resolve the important unknowns.

Trace the whole loop. Choosing a browser button requires software to expose controls, execute the choice, observe the result and recover from mistakes. Identify where the intelligence lives and where ordinary engineering does the work. Do not attribute an architecture to the featured technology if it works independently of it.

Rank by practical impact, novelty of mechanism, evidence strength and fit to the user's interests. Include replacements for expensive steps and newly affordable experiences. Proactive preparation may be more valuable than a generic recommendation feature. Label proposed capabilities clearly.

## Explain performance without inflating it

Keep author measurements, independently verified measurements and planning examples visibly distinct. Reading code is not benchmarking it. Put the baseline, units and assumptions beside the first impressive number; separate stage-level savings from whole-task improvement and token reduction from bill reduction.

Include fallback, caching, retries, retrieval, hosting and rework when material. Explain what latency includes. Pair cost/speed gains with task success, missed evidence and false alarms. Distinguish demos from production results, attempts from tasks, and agreement with another model from ground truth. Use a range or editable scenario when product baselines are unknown.

A pilot should specify its control, sample, start/stop timing, correctness/usefulness criteria and proposed go/no-go threshold. Isolate interventions: test an architectural change alone before attributing gains to an optional model addition. Measure the promised benefit itself, such as correct preparation and faster resolution, rather than merely detecting an event.

## Shape the field guide

Use the foundation's layered reading path, with a plain definition and concrete input → decision → action example before abstractions. Lead with a few strong lessons and, when relevant to the user's decision, product experiments; put full mechanics, source receipts and cost math behind optional depth. Define technical terms at first use, with a short reference glossary. Show original demos and label explanatory diagrams. Keep qualifications that alter a headline visible.

The mandatory fresh reader receives only the artifact and intended audience, without this conversation or expected answers. In addition to the foundation's review questions, require a teach-back of what the technology can/cannot do, how the surprising examples work, which claims are assumed, and what we could try ourselves. The coordinator owns delegation; the reader does not spawn another reviewer.
