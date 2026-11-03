---
name: research-and-product-design
description: Take a feature, workstream or open question from ambiguity to an approved design saved with its brief. Research first (real current screens or architecture, peer products, code facts, standards), then design rounds drawn on the real product, where the person picks per screen from a comparison grid until they approve one. Covers UI features and system-design features. Use for "research this before we decide", "make a research packet", "design this feature", or before interviewing anyone about a feature.
---

# Research and product design

A person decides on a feature by looking at pages, not by answering a long interview. This skill builds those pages: a research packet with three grounded options, then design rounds until the person approves one.

Start each packet page from [references/template.html](references/template.html) and each comparison grid from [references/compare.html](references/compare.html).

## Rules

- Research comes before questions. Ask the person only what the packet can't answer.
- Design for the general capability every customer would use, such as provisioning for any identity provider rather than one customer's. Use each customer's request to test it.
- Code facts come from `origin/main` or a fresh clone, with `file:line` at a named commit.
- Draw every screen from real images: PR screenshots, docs media, public help pages, or a local build of the app. Code and color tokens fill gaps only.
- Never sign in to a product environment or enter credentials. Rebuild a screen you can't reach from code, and say so in Fidelity limits.
- Every outside claim carries a link. Standards and regulations cite the primary source. Mark anything you inferred as **unverified**.
- Use invented sample data. Never put real personal data, such as names or phone numbers, in a page or image.
- Research agents write their notes to files. An agent that can't write returns the full text, and the orchestrator saves it.
- A pick is a recorded direction. The design is final only when the person approves it, and the build waits for their approval of its plan.
- When the work has a progress tracker, update it after each pick or decision.

## The research

Write `research.html` first:

1. **Summary**, one page: the rules in one paragraph, the three or four facts that drive the design, the recommended design, and the one question only the person can answer.
2. **Rules and standards**, each cited to its primary source and section.
3. **Comparable products**: a table of what each does, with links.
4. **Recommended design**: the general capability, what it stores, what it blocks or allows, and the open items.

## The packet (round 1)

Build `round-1/index.html` from the template, keeping its sections in order:

1. **Frame.** The ask in the requester's own words, each quote with its source. The decisions already made, with who made them.
2. **Summary.** The facts that drive the design, linking `research.html`.
3. **Current state.** Real screenshots of every surface the feature touches. For system work, a diagram of how it works today, drawn from the code: the services, data stores and outside systems, and what flows between them. Code facts: what exists, and what is missing.
4. **References.** Three to six peer products, each with its docs link, a real image (or a plain description when none can be fetched), and one line on what to take from it. The standards that apply.
5. **Options.** Three distinct directions, each with its idea, what it is good at, its cost and buildability in one line, the tables and columns it adds (or "none"), every state rendered, and its exact copy. States that are the same in every option go once, under Shared.
6. **Questions.** At most five; zero is fine. Each opens with the recommended answer and its reason, then the alternatives.
7. **Recommendation.** One option, and what the person accepts by taking it.
8. **Fidelity limits.** What was rebuilt from code rather than captured, and which details are illustrative.

## Design rounds

- **UI options.** Draw them with the `ui-mockup` skill, which sets the medium, the fidelity to the real product, and approval. Every state each option covers gets a render: the main path plus empty, first use, error, no permission, feature turned off, and mobile where people use it on a phone.
- **System-design options.** Draw each option on today's diagram with the `architecture-diagram` skill, keeping unchanged parts as they are and marking what is new. The grid has three rows: the data flow, what happens when an outside system fails or is slow, and what each part trusts.
- A feature with both screens and system work gets both kinds of options in one grid.
- Each round has its own folder, `round-N/`, with its renders in `round-N/shots/` named `option{N}-{row}.png` and its reasoning in `round-N/index.html`. Round 1's `index.html` is the packet page above.
- End every round with `round-N/compare.html`, built from the compare template: one row per screen, state or diagram, one column per option, and one column per earlier round showing the option picked there for the same row. Each cell links its image at full size and has a one-line caption that starts with the option number. The sticky header names each option, its build effort, and your recommendation.
- Ask for a pick per row, such as "library 1, empty library 3". A single favourite for the whole round is also an answer.
- After a single favourite, the next round draws three refinements of it. After per-row picks, the next round draws one combined design in a "Combined" column, fixing each place where screens from different options meet (shared navigation, transitions, copy) and listing each fix in its `index.html`. Use your recommendation for any row the person left open, and say so in its caption.
- After a combined round, ask the person to approve it or name changes.
- Save the approved design to `approved/`: its images, the round it came from, and the decisions behind it. Record each pick in the tracker when there is one. The brief links it.

## Output

```
<root>/
  index.html              every feature, linked, with its status and one line each
  <feature>/
    index.html            the hub: status, the decisions so far, and links to everything below
    research.html         the research
    notes.md              the research notes behind it
    current/              real screenshots and today's diagram
    refs/                 peer product images
    round-1/              the packet page, compare.html, shots/, and each option's source
    round-N/              each later round
    approved/             the approved design, saved with the brief
```

For a single feature, `<root>` is the folder the person names. Images sit next to the pages as relative files, with no external requests. Publish to the place the person names, and share only with the audience they name.

## Running several features

1. Write one shared brief from [references/shared-brief.md](references/shared-brief.md): the product, the decisions, the sources, the fidelity rules, the output layout. Every agent reads it first.
2. Ask the person which model to use and how many agents may run at once. Launch one agent per feature, in parallel. Each prompt tells the agent to load this skill and read the brief, then names its feature, its slug, the states to cover, and any research files specific to it.
3. When a packet returns, verify its load-bearing claims cheaply before relaying them: grep the cited `file:line`, fetch a cited link, look at a screenshot. Correct the packet or send it back.
4. Build the root index, publish, and give the person the link with each packet's recommendation and questions.
5. Collect the person's picks for every feature in one message. Send each feature's picks back to its agent, which draws the next round. Feature agents never open a grid or ask the person directly.

For a single feature, do the work yourself, and skip the shared brief and the root index.

## After the approval

In order:

1. **Tables.** List every new table and column the approved design needs, each with why existing data can't produce it. The person understands each one, or it is cut. Do this before writing the user journeys (step-by-step walks through the feature) or the brief.
2. **Brief.** It settles what and why, and links the approved design.
3. **Plan.** It settles how. The person approves it.
4. **Build.**

## Done when

- `research.html` and the round-1 packet have every section, and every claim has its source.
- Every round is rendered on the real product, checked, and laid out in `compare.html`.
- The orchestrator has spot-checked the load-bearing claims.
- The person approved a design, and it is saved in `approved/`.
- The pages are published, and linked from the tracker when there is one.
