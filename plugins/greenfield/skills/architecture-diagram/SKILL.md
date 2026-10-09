---
name: architecture-diagram
description: Use when a design, plan, or option needs the person to understand how a system works or would work - what runs where, what is new versus reused, and how a request or message moves through it. Draws inline-SVG system and flow diagrams in the house style, light and dark, using the bundled diagram kit.
---

# Architecture diagram

A good diagram answers "what runs where, and what happens to one request" before the person reads a word of prose. Draw it from the real code, not from guesses.

## Before drawing

- Read the code and deployment config that the diagram claims to show: entry points, workers, queues, tables, external services, and which process each runs in. Settle the questions people will actually ask, such as "is this a new server or the existing one?", and answer them in the diagram.
- Mark each part as existing, new, or external. Name new tables, task types, services and deployments explicitly.

## The page

Write one self-contained HTML page (the kit already carries the house page tokens), following [references/layout.md](references/layout.md), and copy the tokens, classes and markers from [references/diagram-kit.html](references/diagram-kit.html). Keep its colors and line meanings so every diagram reads the same way. In this order:

1. **Answer first:** 3 to 5 bullets on what runs where, what is new versus reused, and whether any new service or deployment is needed.
2. **System diagram:** components in their deployment frames, with edges labelled by latency, cost or volume where they matter. Add a legend.
3. **One flow per scenario:** the happy path, the important variants, the abuse or failure case, and an outage. Each gets a numbered sequence diagram, matching numbered steps in prose, and a bold one-line outcome.
4. **Behavior table** when there are stages: what each stage does on error and on a positive result, now and later.
5. **Arithmetic** for cost and latency, shown, with assumptions labelled.

## Rules

- Inline SVG only, with `viewBox` set, colors from CSS variables (never hard-coded), and text at 11px or larger. Wrap each diagram in `.diag` so it scrolls sideways on phones instead of shrinking.
- One meaning per line style: sync, new, async (dashed), external, alert. Don't invent more.
- At most about 12 boxes per diagram. Split into another diagram rather than crowding one.
- Label every arrow that isn't obvious. Number every step in a flow.
- Look at the page in both light and dark mode before showing it, and fix collisions and clipped text.
