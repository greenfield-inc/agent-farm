---
name: ui-mockup
description: Create three UI mockup options per round from product screenshots, then refine the user’s favorite. Use for "mock this up," "UI mockup," or "show me what this would look like" for interfaces. Collect screenshots and save approved designs with the ticket or brief.
---

# UI mockup

Match the product’s visual language; handle screenshot collection and image-tool selection.

## Start from the current UI

- Reuse screenshots or capture them yourself. When specific user state is unnecessary, launch dev or open accessible production and capture screens with Playwright or app/browser tools, following repository setup guidance. Inspect a small reference set for layout, theme, typography, and components. Ask for screenshots when the required screen or state is inaccessible.
- Establish the screen, state, change, and elements to preserve; clarify material gaps. For new products, agree on references or a concept labeled as new-image generation. Route prototypes and source changes through the implementation workflow.

## Edit and iterate

- Read the available `imagegen` skill and prompting reference; consult `openai-docs` for capability/setup questions. Use the image-editing tool with actual screenshot inputs, or generate new concepts from agreed references. Use HTML/CSS reconstruction when requested.
- If image editing is unavailable, explain and offer setup or handoff. Get agreement for paid API fallbacks.
- Specify changes and exact labels. Preserve layout, dimensions, theme, typography, density, icons, and unaffected regions. Label inputs as edit targets or style references.
- Generate three distinct options per round through separate image calls: initial design directions, then refinements of the favorite. Label 1–3, inspect text and unintended changes, and automatically open all three. If opening fails, display inline with file links; explain fidelity limits.
- Ask for a favorite, then apply feedback using it as the next edit target. Retain original screenshots, prior options, and preservation constraints. A favorite guides iteration; explicit approval selects the final design to save.

## Save the approved result

- Follow the destination’s storage skill; reuse the linked page in the document destination or the tracker artifact. Honor local-only and draft-only requests; standalone mockups stay local. Preserve the audience and obtain authorization for public sharing. Link private briefs.
- Save and display approved image bytes with caption, version, and approval status. Retain prompts and source references; identify drafts and rejected versions.
- Reconcile authorized decisions into the ticket/brief, preserving identity and history. Align scope and acceptance criteria; treat incidental generated details as illustrations.
- Verify rendering and links, then return image and artifact links. If uploads fail, retain local files and report paths, outstanding saves, or access limits.
