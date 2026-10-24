---
name: ui-polish
description: Use to polish an existing web UI in a real browser. Measure the hover, focus, press, hit-area and motion defects that screenshots miss, fix them at the narrowest level in code, and prove each fix with before and after screenshots.
---

# UI polish

Polish is refinement, never concealed redesign. Keep the product's look, content and behavior. When the concept itself looks wrong, report it and leave it. A missing hover, focus or press state is a defect, so adding one is polish; adding showpiece motion is not.

Drive the app with Playwright or the Chrome DevTools MCP, whichever is available. Start the app the way its `AGENTS.md`, README or package scripts say, and never point the loop at production.

## The loop

1. **Sweep.** Get leads from cheap measurers when they run: axe-core (`@axe-core/playwright`, or inject `axe.min.js`) after each state change, not only on load, and `npx uisight <url> --theme both --no-open` (it downloads Playwright's Chromium on first run). Their output is a lead, not proof of quality. If neither runs, go on with the probe and screenshots.
2. **Probe.** Run [scripts/probe.js](scripts/probe.js) on every screen and in every state you reach: menus open, dialogs shown, and a touch viewport (`hasTouch: true`) for the 44px rule. It reports per element, as JSON, missing hover, active and focus-visible states, focus rings that are invisible, low-contrast, clipped or covered, small or covered targets, dead zones, unlabelled checkboxes, hit areas that spill past the visible control, `transition: all`, and animated layout properties. It scans only what is in the viewport, so scroll and run it again. To measure layout shift during a real click, call `window.uiProbeShift()` in the page before the click; it returns a function that, called after, lists the shifts.
3. **Explore.** Look for yourself: 375px, 768px and 1440px, light and dark, Tab through every screen, hover and press things, and load worst-case data. Go in this order: the main flow and its states, widths, visual polish, keyboard and focus, then robustness. [references/lenses.md](references/lenses.md) and [references/motion.md](references/motion.md) are the bar.
4. **Fix.** First broken or misleading tasks, then missing states, then drift between screens, then visual and motion detail. Classify each drift before fixing it: a missing token, a one-off where a shared component should be used, or a local defect. Fix it at that level, in the shared component when the defect lives there, using the project's own tokens and patterns.
5. **Re-verify.** Take one before and one after screenshot of the same element, in the same state (hover, focus, pressed) and at the same viewport. Force the state with the driver (`hover()`, `focus()`, `mouse.down()`). Rerun the probe: the finding is gone and nothing new appeared.

## Evidence

Every finding carries a measurement (probe output, an axe rule, a computed style) or a screenshot. Models judge severity unreliably, so rank from the evidence:

- **Blocker:** a task cannot be finished, or a control cannot be reached.
- **High:** a WCAG criterion fails, or the UI shows a misleading state.
- **Medium:** a missing state, or visible drift between screens.
- **Nit:** a small visual detail.

Keep evidence under `tmp/ui-polish/`, never committed, with ordered names such as `03-save-button-focus-before.png`.

## Hand back

Open the pull request with `prepare-pr`. If the repository or workspace names a document destination you can reach, publish the before and after pairs there and link them from the PR; otherwise embed the pairs in the PR description. The description lists findings in two groups, fixed and not fixed. Each gives its severity, screen, the rule it breaks and its evidence; each unfixed one says why it was left and what a fix would take.
