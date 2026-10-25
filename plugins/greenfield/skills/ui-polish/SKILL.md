---
name: ui-polish
description: Use to polish the UI of an existing app (web, Electron or native) while it runs. Measure the hover, focus, press, hit-area and motion defects that screenshots miss, fix them at the narrowest level in code, and prove each fix with before and after screenshots.
---

# UI polish

Polish is refinement, never concealed redesign. Keep the product's look, content and behavior. When the concept itself looks wrong, report it and leave it. A missing hover, focus or press state is a defect, so adding one is polish; adding showpiece motion is not.

Drive the app with what fits it. For the web, use Playwright or the Chrome DevTools MCP. For Electron, use Playwright's `_electron.launch`, or attach over CDP to an app started with `--remote-debugging-port`; `probe.js` runs unchanged in each renderer window. For native apps (macOS, iOS, Android), use the platform's own tools: simulator or emulator, accessibility inspector and screenshots. The lenses still apply there; skip the sweep and the probe, and take measurements (sizes, labels, focus order) from the accessibility tree and screenshots. Start the app the way its `AGENTS.md`, README or package scripts say, and never point the loop at production.

## The loop

1. **Sweep.** Get leads from cheap measurers when they run: axe-core (`@axe-core/playwright`, or inject `axe.min.js`) after each state change, not only on load, and `npx uisight <url> --theme both --no-open` (it downloads Playwright's Chromium on first run). Their output is a lead, not proof of quality. If neither runs, go on with the probe and screenshots.
2. **Probe.** Run [scripts/probe.js](scripts/probe.js) on every screen and in every state you reach: menus open, dialogs shown, and a touch viewport (`hasTouch: true`, which the output's `pointer: coarse` confirms) for the 44px rule. It reports per element, as JSON, missing hover, active and focus-visible states, focus rings that are invisible, low-contrast, clipped or covered, small or covered targets, dead zones, unlabelled checkboxes, hit areas that spill past the visible control, `transition: all`, and animated layout properties. It scans only what is visible, so scroll and run it again. A finding marked `unconfirmed` means a child of the control may draw its feedback; check it with real driver input before acting on it. It also leaves `window.uiProbeShift` on the page until the next navigation: call `uiProbeShift.start()` before a real click and `uiProbeShift.stop()` after to list the layout shifts it caused.
3. **Explore.** Look for yourself at three widths, light and dark, Tab through every screen, hover and press things, and load worst-case data. Go in this order: the main flow and its states, widths, visual polish, keyboard and focus, then robustness. [references/lenses.md](references/lenses.md) and [references/motion.md](references/motion.md) are the bar. Whenever you record a finding, from the probe or by eye, take its before screenshot then, with the state forced where the driver can (on the web, `hover()`, `focus()`, `mouse.down()`). A rule whose fix adds a feature or flow, such as undo, confirmation or URL state, is a finding to report, not a fix.
4. **Fix.** First broken or misleading tasks, then missing states, then drift between screens, then visual and motion detail. Classify each drift before fixing it: a missing token, a one-off where a shared component should be used, or a local defect. Fix it at that level, in the shared component when the defect lives there, using the project's own tokens and patterns.
5. **Re-verify.** Take the matching after screenshot: the same element, state and viewport as the before shot. Rerun the probe: the finding is gone and nothing new appeared.

## Evidence

Every finding carries a measurement (probe output, an axe rule, a computed style) or a screenshot. Models judge severity unreliably, so rank from the evidence:

- **Blocker:** a task cannot be finished, or a control cannot be reached.
- **High:** a WCAG criterion fails, or the UI shows a misleading state.
- **Medium:** a missing state, or visible drift between screens.
- **Nit:** a small visual detail.

Keep evidence under `tmp/ui-polish/`, never committed, with ordered names such as `03-save-button-focus-before.png`.

## Hand back

Open the pull request with `prepare-pr`. If the repository or workspace names a document destination you can reach, publish the before and after pairs there and link them from the PR; otherwise embed them in the PR description, hosted the way `prepare-pr` hosts images. The description lists findings in two groups, fixed and not fixed. Each gives its severity, screen, the rule it breaks and its evidence; each unfixed one says why it was left and what a fix would take.
