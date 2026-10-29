---
name: ui-mockup
description: Create three UI mockup options per round from product screenshots, then refine the person's favourite into the approved design reference. Use for "mock this up," "UI mockup," or "show me what this would look like" before an interface is built. Collect screenshots and save approved designs with the ticket, brief or plan.
---

# UI mockup

A mock-up settles what the interface should look like before anyone plans or builds it. The approved result becomes the design reference that `visual` checks are judged against.

## Start from the current interface

- Reuse screenshots the person gives you, or capture them yourself: when specific user state is unnecessary, launch the dev build or open an accessible environment and capture the screens with browser tools, following the repository's setup guidance. Ask for screenshots when the screen or state is out of reach.
- Inspect a small reference set for layout, theme, type and components.
- Agree on the screen, the state, what changes, and what must be preserved. For a brand new screen, agree on the references to match.

## Make the options

Pick the method that fits, and say which you used:

- **Images**, only when you have an image generation tool yourself, for exploring looks quickly or changing an existing screen: edit the real screenshots with it, one call per option. Generate from scratch only for a new screen from agreed references.
- **HTML and CSS**, when exact text, real data, responsive behaviour, or a pixel comparison later matters, and whenever you have no image tool: rebuild the screen from the product's real components, styles, icons and fonts, matching its layout, type, spacing, colours, and density. The result can be opened, resized, and compared against a screenshot.
- The approved design that `visual` checks are judged against should be exact. If the approved option is a generated image with invented details, either rebuild it in HTML or list which details are illustrative.
- Ask before using any paid fallback.
- Produce three distinct options per round and label them 1 to 3. Change only what is in scope and give exact labels. Check the text and look for unintended changes. Share all three as file links and explain any fidelity limits.
- Ask for a favourite, then refine it with their feedback, using it as the next round's starting point. Keep the original screenshots and earlier options.

## Approval and saving

- A favourite guides the next round. Only an explicit approval selects the final design.
- Save the approved design under `mockups/` in the work's bundle, or with the ticket or brief, with a caption, version, and approval status. Keep rejected options marked as rejected, and keep the prompts and source references.
- Honour local-only and draft-only requests; a standalone mockup stays local. Never widen who can see it without authorization.
- Record it in the brief under Evidence. When a plan follows, it becomes the design reference on the cover sheet, with the list of screens that must match it.
- Details that the mock-up invented and nobody discussed are illustrations, not requirements. Say which are which.
- Check that images and links render, then return their paths or links. If an upload fails, keep the local files and report what is outstanding.

## Banned

- Changing source code to produce a mock-up
- Presenting a mock-up as approved when the person only picked a favourite
