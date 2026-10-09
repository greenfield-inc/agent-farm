---
name: architecture-diagram
description: Use when a design, plan, or option needs the person to see how a system works - what runs where, what is new or reused, and how one request moves through it. Draws inline-SVG system and flow diagrams in the house style, light and dark, from the bundled kit.
---

# Architecture diagram

The diagram answers "what runs where, and what happens to one request" before any prose. Draw it from the real code.

## Before drawing

- Read the code and deployment config for every part you show, including the process each runs in.
- Answer the reader's main question, such as "new server or existing one?", in the diagram.
- Mark every part existing, new, or external, and name new tables, tasks, services and deployments.

## The page

Write one self-contained HTML page following [references/layout.md](references/layout.md), copying tokens, classes and markers from [references/diagram-kit.html](references/diagram-kit.html). Sections, in order:

1. **Answer first:** 3 to 5 bullets on what runs where, what is new versus reused, and whether a new service is needed.
2. **System diagram:** components in their deployment frames, edges labelled with latency, cost or volume, and a legend.
3. **One flow per scenario:** happy path, main variants, abuse or failure, outage. Each is a numbered sequence diagram with matching numbered steps and a bold outcome.
4. **Behavior table** for staged systems: each stage on error and on a positive result, now and later.
5. **Arithmetic** for cost and latency, with assumptions labelled.

## Style

- Inline SVG with a `viewBox`, colours from CSS variables, text 11px or larger, each diagram wrapped in `.diag` so it scrolls sideways on phones.
- Five line styles, one meaning each: sync, new, async (dashed), external, alert.
- Up to about 12 boxes per diagram; split larger systems into several diagrams.
- Label arrows and number every flow step.
- Check the page in light and dark mode and fix collisions and clipped text before sharing.
