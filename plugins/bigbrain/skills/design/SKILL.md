---
name: design
description: Settles what an interface should look like before it is built - captures the current screens, writes design notes, makes three options per round by editing real screenshots with the image tool, critiques each against design-quality.md, relays them for a pick, and records the approved design in mockups/. Never edits product source. Used by the bigbrain designer; the verifier reads its design-quality reference.
---

# Design

The approved design is the reference the build is checked against: the verifier compares built screens with it, screen by screen. Your starting message names the bundle, the screens and states, what must change, what must stay, and your status file. You reach the person only through `needs_you` (`contract.md`).

## 0. Check the image tool

Before anything else, confirm you have an image generation or editing tool in this session. If not, set `state: blocked` with "The designer has no image tool in this Codex session. Enable it in the person's Codex configuration (see the bigbrain README), or answer 'HTML only' to continue with HTML/CSS mockups," and report. Continue with HTML/CSS only if the answer says so.

## 1. Capture

Run the dev build (with `verify-app`'s setup rules: reuse what is running, start only what is missing, test data only) and screenshot each affected screen in every relevant state (default, empty, loading, error, long content), theme and viewport the work touches. Save them under `mockups/current/` named `<screen>-<state>-<viewport>-<theme>.png`. If a screen cannot be reached, report what is missing as a `needs_you` instead of inventing it.

## 2. Design notes

Write `mockups/design-notes.html` from the `documents` skill's `design-notes` template, once per product area, then reuse and extend it: the screens captured; grid, max widths, breakpoints and gutters; the type scale and where each size is used; tokens from code when they exist (primitive → semantic); colour pairs for light and dark with their contrast; the components to reuse, with source paths; density and copy voice; do and don't rules seen in the product, each with a screenshot. Read the source for tokens and components; do not guess them from pixels when the code says.

## 3. Options, three per round

For round N, make three genuinely different options (not three shades of one idea) by editing the real screenshots with the image tool, or by rebuilding the screen in HTML/CSS when exact text, layout or responsive behaviour matters. Save them as `mockups/<screen>-v<N>-<option>.png|html`.

- Change only what is in scope. Keep layout, type, density, icons and unaffected regions as they are.
- Use the product's own tokens and components from the design notes.
- Look at every result. Critique each option against [references/design-quality.md](references/design-quality.md): the principles, and the jank items that apply to a still image (overflow, alignment, spacing, contrast, touch targets, dark mode, phone width, missing states). Fix what you can before showing it.
- List each option's invented details (text, data, icons nobody asked for); they are illustrative, not requirements.

Write or update `mockups/index.html` from the `mockups` template: the brief, the current screenshots, this round's options with a one-line approach, the self-critique and the invented details for each.

## 4. Relay the pick

Write a `needs_you` of kind `choice`: one question "Which option for <screen>?", the options with your recommendation first and why, and the three files (plus the current screenshot) in `files` so the orchestrator opens them beside the person. Keep working on the next screen while you wait. A favourite with changes starts round N+1 from that option, keeping earlier rounds on the gallery. Only an explicit approval selects the final design.

## 5. Record the approved design

- When exact text, data or layout matters, rebuild the approved option in self-contained HTML/CSS (`mockups/<screen>-v<N>-<option>.html`) so it can be opened, resized and compared; say which details stay illustrative.
- On the gallery: the approved version, "approved via Q-n → D-n", the **must-match** list (screens and states the build is checked against, each naming the J-n that will check it), annotations only where tokens and components do not already say it, the illustrative details, and the rejected options marked rejected. Status `ready-for-build`.
- Run `check-bundle`, set your status to `done` with the approved paths, and report. The planner cites them in the cover sheet and in `control-flow.json`'s `qa.mockups`; mid-build, the orchestrator passes them to the implementer.

## Never

- Edit product source to make a mockup.
- Present a favourite as approved.
- Put a question to the person in your own tab; every question is a `needs_you`.
