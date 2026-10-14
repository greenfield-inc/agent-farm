# Design quality

Contents: [Principles](#principles) · [Jank checklist](#jank-checklist) · [Recording results](#recording-results)

Shared by the designer (self-critique of every option) and the verifier (QA rounds). The product's own design notes (`mockups/design-notes.html`) win over anything general here: match the product first.

## Principles

| Principle | What good looks like | How to check |
| --- | --- | --- |
| Hierarchy | One clear primary action per screen; headings, body and secondary text are distinct by size or weight, not colour alone | Squint at a screenshot: the primary action and the title are what you see first |
| Spacing | Spacing comes from the product's scale (design notes); related items sit closer than unrelated ones; edges align to one grid | Overlay or measure a screenshot: gaps are values from the scale, edges line up |
| Contrast | Text at least 4.5:1 against its background (3:1 for large text and UI boundaries), in every theme | Compute from the rendered colours, or the browser's accessibility panel |
| States | Every data view has loading, empty, error and full states; every control has hover, focus, active and disabled where they apply | Force each state (empty fixture, failed request, slow network) and capture it |
| Touch targets | Interactive targets at least 44×44 CSS px on touch viewports, with space between them | Measure the bounding boxes at phone width |
| Copy | Labels say what happens ("Export notes", not "Submit"); errors say what went wrong and what to do; product voice from the design notes | Read every string on the changed screens |
| Consistency | Reuse existing components and tokens; a new pattern needs a reason | Compare with the components listed in the design notes |
| Responsive | Works from 320 px wide to the largest supported desktop without horizontal scroll or clipped content | Capture at phone and desktop widths, and resize through the breakpoints |

## Jank checklist

Walk every item for each changed screen, at every viewport and theme the control flow's `qa` settings name. Each item is pass, fail or undetermined, with evidence.

| Item | Fails when | How to check |
| --- | --- | --- |
| Layout shift | Content jumps after first paint (late fonts, images without size, injected banners) | Record or screenshot during load; compare first paint with settled |
| Overflow and clipping | Text or controls run past their container, are cut off, or cause horizontal scroll | Long and short content (longest realistic title, empty strings) at phone width; check `scrollWidth > clientWidth` on the page |
| Misalignment | Edges or baselines of related items don't line up | Screenshot with a grid overlay, or compare element boxes |
| Spacing off-scale | Gaps that are not values from the design notes' scale | Measure gaps between key elements |
| Missing states | Empty, loading or error renders blank, broken, "undefined", or a raw error | Empty fixture, offline or failing request, throttled network |
| Flicker | A wrong state flashes before the right one (wrong theme, empty list before data) | Reload with the slowest realistic network; watch the first frames |
| Focus and keyboard | Focus is invisible, lost, or trapped; an action can't be reached or triggered by keyboard | Tab through the screen in each theme; Enter and Space on each control; Escape closes overlays |
| Touch targets | A target is smaller than 44×44 or too close to another | Measure at phone width |
| Contrast | Any text or boundary below the contrast minimum, in any theme | Compute from rendered colours |
| Dark mode | Hard-coded colours, unreadable text, light flashes, or images that don't adapt | Capture every changed screen in dark |
| Phone width | Anything unusable or cramped at 320–390 px | Capture at phone width |
| Double submit | Clicking twice creates two records or two requests | Double-click submit; watch requests and records |
| Slow feedback | An action gives no visible response within about 100 ms, or a long one has no progress | Throttle the network; time the first visible change |

## Recording results

The verifier writes one `jank` entry per item and screen in `evidence/verification.json` (`item`, `result`, `evidence`, and `fixed_in_round` once a fix is rechecked), screenshots under `evidence/qa/round-N/` named `<J-n>-<step>-<viewport>-<theme>.png` (or `<screen>-<item>-<viewport>-<theme>.png` outside a journey). A fail names the screen, the state and what is wrong in one line. The designer records its self-critique per option on the mockups gallery, using the same item names.
