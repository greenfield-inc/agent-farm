---
name: deep-dive
description: Investigate a topic, market, organization, practice, trend, or decision across primary sources, communities, directories, reviews, and structured web data; produce a clear, cited synthesis with evidence gaps and practical implications. Use for substantial deep research or expanding an existing research brief, not a simple factual lookup.
---

# Deep Dive

Own a thorough investigation and an explanation a new reader can understand. Turn scattered material into a useful answer: what is happening, what supports it, what remains uncertain, and what it means for the user's question. Adapt to the subject; not every deep dive needs product ideas, a cost calculator or a purchasing recommendation.

## Frame the question

Infer the research question, audience, geography/timeframe, intended decision, seed material, output destination and limits from the conversation. Ask only for missing context that materially changes the work; continue independent research while waiting. Separate an exploratory request from a decision that needs explicit criteria. Do not impose a fixed interview or expand a small update into a new survey.

For existing work, inspect the artifact, source cache and ledger first. Preserve its workspace ID and wanted content. New evidence may change the thesis, priorities or conclusion rather than merely add an appendix. Track what changed and why.

## Choose sources and access

Map the questions to the evidence that can answer them: official documents and datasets, original research, direct observations, practitioner accounts, reviews, discussions, implementation evidence, or historical records. Use source types because they fit the question, not because a scraper exists. Prefer authoritative primary evidence for factual claims; use communities to find experience, disagreement and leads.

Read [Bright Data operations and scraper discovery](references/bright-data.md) before source discovery that would benefit from it. That reference owns the missing-key question, skip behavior, scraper catalog, credentials, zones, caching and asynchronous recovery. Ask once for an unavailable API key with an explicit skip option and explain the relevant coverage loss; reuse configured access and prior answers. Do not interrupt a public-document-only task for an irrelevant credential request.

When using or evaluating a Bright Data collection route, inspect its current scraper catalog and task-oriented docs index to find capabilities beyond X/Reddit. Identify the target site's correct record type and endpoint before collecting. Read only the relevant platform documentation. Existing connectors or accessible primary pages may be sufficient; do not provision unrelated services or collect every available record.

## Discover beyond the seeds

- Start with supplied sources, synonyms, alternate terminology, authors, organizations and dates. Search for support, counterevidence, failed attempts, exceptions, and changes over time. Account for every supplied link as reviewed, duplicate, off-topic or inaccessible.
- Explicitly look for relevant directories, curated lists, association/resource indexes, marketplaces, galleries, community roundups and official collections. For technical subjects, include `awesome-*` lists and examples/cookbooks. Inspect more than one promising collection when available, including lesser-known entries; follow useful leads into their original evidence.
- Include X and Reddit when practitioner or public discussion is relevant, unless the user narrows scope. Read full posts and meaningful reply chains, corrections and follow-ups. Use [X recovery](references/x.md) and [Reddit collection](references/reddit.md) as needed. A title, snippet, comment count or popular opinion does not establish the underlying claim.
- Maintain a small coverage map: research questions, discovery routes, collections checked, distinct sources/entities, evidence strength and unresolved leads. Detect a missing perspective before repeatedly searching the same angle.
- Expand in bounded batches. Inspect novelty and remaining budget before another batch; count records, including comments/reviews, as well as requests. Stop when the important questions are supported and additional searching mostly repeats evidence, or a time/access/spend limit is reached. Report consequential remaining gaps. Do not call a limited survey exhaustive.

## Build and challenge the evidence

Keep a local source ledger with canonical URL/permalink, author/publisher, publication and retrieval dates, claim, relevant excerpt or observation, method/sample, limitations, media path, and status: reported / directly observed or inspected / independently verified / inference / unavailable. Retain raw responses separately for resumption. Several directories, reposts or articles repeating one report are not independent confirmations.

Trace headline conclusions to original sources. Distinguish what a source says from what the evidence establishes. Check definitions, denominator, sampling, timeframe, location and incentives. A large volume of scraped reviews or social posts is a selected sample, not automatically representative public opinion. Verify live facts when freshness matters.

Investigate contradictions rather than averaging incompatible claims. Explain disagreements in definitions, dates, methods or populations when possible; otherwise preserve the uncertainty. Preserve dissent and failures that materially change a conclusion. Missing, deleted or inaccessible content contributes no unsupported claims.

When numbers inform the answer, show the baseline, units and assumptions beside their first meaningful use. Separate reported measurements, your calculations and forecasts. Include material costs, quality losses and confounders. Avoid false precision or transferring a result to the user's situation without stating the inference.

## Synthesize for the reader

Lead with the answer or strongest useful finding. Organize around the reader's questions and decisions, not the order sources were fetched. Define unfamiliar terms before relying on them and use one concrete example to anchor abstractions.

For an important finding, explain: what it is → why it matters → what supports it → where it holds or fails → implications for this user's question. When useful, add a comparison, reusable lesson, next action, or inexpensive test. An experiment needs a baseline, success criterion and measured outcome; label proposed thresholds as proposals. Do not manufacture an action recommendation for a purely explanatory request.

Build a layered deliverable: a two-minute overview, the supporting explanations, then optional detail and source receipts. Put caveats that change a headline's meaning in the visible summary. Prefer useful original media and simple diagrams; label reconstructions. Interactive maps, timelines, comparisons or calculators are optional when they improve understanding. Cite claims near their evidence and make deeper sources easy to follow.

Publish to the document destination your workspace instructions name, using its tools; honor another destination the person names; otherwise keep a local HTML bundle. Preserve the existing private workspace and audience. Save a local deliverable if unavailable, and explicitly report an unsaved remote update when the user requested one. Creating a shareable guide does not authorize a public share or sending messages.

## Mandatory fresh-reader review

Before delivering a new brief or substantive update, the coordinator dispatches one fresh subagent per review pass, with no conversation history, only the artifact and intended audience. Apply `cold-read` if available; tell the reader to review directly without further delegation. Do not supply author rationale, expected conclusions or prior findings.

Require a teach-back: What question does this answer? What are its main findings and explanations? Which claims are supported, reported, inferred or unknown? What should the reader understand or do next? Then ask for confusing passages, missing definitions, contradictions and misleading skim takeaways.

Compare the teach-back with the evidence and fix material gaps. After changes that alter the explanation, claim status or recommended decision, run another isolated teach-back; minor wording fixes need only focused rechecking. Independent reader understanding is evidence of clarity, not a guarantee that the actual audience will understand. If subagents are unavailable, perform a separate editorial pass and disclose that independent review was unavailable.

## Verify and deliver

Verify links, citations, relevant media/interactions, legibility and desktop/mobile layout for visual output, and the saved revision. Reconcile changed priorities and source counts. Return the link/path, main answer or changes, and material evidence/access limitations. Keep source state for future batches.

Store supporting generated reviews/research artifacts in the supplied task folder at the document destination your workspace instructions name, or that destination's default folder; propagate that destination and privacy boundary to delegated work. Preserve needed local copies. Never upload credentials or raw private logs as supporting evidence.
