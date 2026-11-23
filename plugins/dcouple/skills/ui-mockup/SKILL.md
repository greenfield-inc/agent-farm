---
name: ui-mockup
description: Create three UI mockup options from product screenshots, let the person pick per screen in a side-by-side comparison grid, then combine their picks into one design they approve. Use for "mock this up," "UI mockup," or "show me what this would look like" for interfaces. Collect screenshots and save approved designs with the ticket or brief.
---

# UI mockup

Show the person what an interface could look like before anyone builds it, in the product's own visual language.

## Start from the current UI

- Reuse screenshots or capture them yourself: when no specific user state is needed, run the app or open an accessible page and capture it with Playwright or app/browser tools, following the repository's setup notes.
- Ask for screenshots when you can't reach the screen or state.
- Read the product's source for its fonts, color tokens, icon set, radii, spacing, and components.
- Collect 3–6 screenshots of how other products handle the same job, as style references. Give each its source link and one line on what to take from it.
- Establish the screen, state, change, and elements to preserve; clarify material gaps. For new products, agree on references first and label the result a new concept. Route prototypes and source changes through `implement`.

## Pick the medium

- For an existing product, rebuild each screen in HTML and CSS from its screenshot and the product's source, render it in a headless browser, and screenshot the render.
- Use an image model with editing when the person asks for one or the change is purely visual. Get agreement before using a paid API.
- Use a wireframe for early structure questions where fidelity doesn't matter yet.
- Say which medium you used and its fidelity limits.

## Draw the options

- Keep each round in its own folder, `round-N/`, with its renders in `round-N/shots/`, named by option and row, such as `option2-library.png`.
- Specify changes and exact labels. Preserve layout, dimensions, theme, typography, density, icons, and unaffected regions. Label inputs as edit targets or style references.
- Round 1 has three distinct design directions, labelled 1–3, each with a one-line idea.
- Draw every state each option covers: the main path plus empty, first use, error, no permission, feature turned off, and mobile where people use it on a phone. Draw a state that is the same in every option once, under "Shared" in `index.html`.
- Use realistic sample data. Never use real customer or personal data.
- Read every render next to the real screenshot it edits. Fix garbled or overlapping text, regions that changed but shouldn't have, and anything that couldn't really be built.
- Write `round-N/index.html` for the reasoning: the current screens, the references, each option with its idea, what it's good at and what it costs, the exact copy, open questions with your recommended answer first, and your recommendation.
- Retain original screenshots, prior rounds, and preservation constraints.

## Compare and pick

- End every round with a comparison grid, `round-N/compare.html`, for the images and the ask. Build it from `references/compare.html`: plain HTML and CSS that reads without script, in light and dark, linked from the round's `index.html`.
- Give it one row per screen or state and one column per option. Each cell shows the rendered image file, links to it at full size, and carries a one-line caption that starts with the option number. A tall render shows its top in the cell, and the link opens all of it.
- Add one column per earlier round, showing the option picked in that round for the same row. Set `--cols` to one track per column, plus the row-label track. Round 1 has no earlier columns. A row with no earlier pick leaves that cell empty, captioned "new this round".
- Keep a sticky header with each option's name, a short build-effort note, and your recommendation.
- Open the grid for the person; if opening fails, give its path. Ask for a pick per row, such as "library 1, empty library 3"; a single favorite for the whole round is also an answer.
- After a single favorite, the next round draws three refinements of it.
- After per-row picks, the next round draws one combined design: join the picks into one flow and fix each place where screens from different options meet, such as shared navigation, transitions, and copy. List each fix in `index.html`. Its grid has one option column, "Combined", beside the earlier picks. Use your recommendation for any row the person left open, and say so in its caption.
- After a combined round, ask the person to approve it or name changes. A pick guides iteration; only explicit approval selects the final design to save.

## Save the approved result

- Follow the destination’s storage skill; reuse the linked Grain workspace or tracker artifact. Honor local-only and draft-only requests; standalone mockups stay local. Preserve the audience and obtain authorization for public sharing. Link private Grain briefs.
- Save and display approved image bytes with caption, version, and approval status. Retain prompts and source references; identify drafts and rejected versions.
- Record each round's picks in the ticket or brief in the person's own words, marked as a favorite or approved. Align scope and acceptance criteria with the approved design; treat incidental details in the images as illustrations.
- Verify rendering and links, then return image and artifact links. If uploads fail, retain local files and report paths, outstanding saves, or access limits.
