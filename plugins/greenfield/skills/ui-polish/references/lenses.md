# Lenses

One line per rule, each stated once. `probe` marks what `scripts/probe.js` measures. Motion has its own page: [motion.md](motion.md).

## Interaction states

- Every interactive element has a distinct hover, focus-visible and active state. `probe`
- A control that can be disabled looks disabled, and its reason is discoverable.
- Hover, focus and press raise contrast; they never make a control fainter.
- A loading button keeps its label and adds a spinner. Submit stays enabled until the request starts.
- Every view has designed loading, empty, error and success states, and skeletons match the final layout.
- Anything revealed only on hover is also reachable by keyboard and touch.

## Focus

- The focus ring is visible on every focusable element (WCAG 2.4.7). `outline: none` needs a visible replacement. `probe`
- The focused element is not hidden under a sticky or fixed header or footer (WCAG 2.4.11); `scroll-padding-top` clears it. `probe`
- The ring has 3:1 contrast against the colors next to it (WCAG 1.4.11). `probe` checks outline rings; check box-shadow rings by eye.
- No ancestor's `overflow: hidden` cuts the ring off; inset the ring or pad the container. `probe` checks outline rings.
- Tab order follows the visual order. Dialogs trap focus and return it to their trigger on close.

## Targets and input

- Targets are at least 24×24px (WCAG 2.5.8), and 44px for coarse pointers. Grow the hit area with padding or a pseudo-element, not the visual. Links inside a sentence are exempt. `probe`
- The hit area matches what looks clickable: no unclickable padding inside a painted control, and no clickable area past the visible one. `probe`
- A checkbox or radio and its label share one target. `probe`
- No control is painted over by another element, checked edge to edge with `elementFromPoint`. `probe`
- If it looks clickable, it is clickable, and navigation uses `<a>` so Cmd-click and middle-click work.
- Inputs on mobile use at least 16px text so iOS does not zoom. Zoom is never disabled.
- Controls set `touch-action: manipulation` and a deliberate `-webkit-tap-highlight-color`, so taps neither lag nor flash.
- Hover styles sit inside `@media (hover: hover) and (pointer: fine)`, so they do not stick after a tap.
- Buttons use `user-select: none`, so a long press does not select their text.
- Errors appear inline next to their field, and submit focuses the first one. Paste is never blocked, and inputs set `type`, `inputmode` and `autocomplete`.

## Content shown on hover or focus

- Tooltips and popovers can be dismissed with Escape, can be hovered, and stay open while the pointer or focus is on them (WCAG 1.4.13).

## Layout and spacing

- Alignment is deliberate, to a grid, baseline or edge. Adjust optically by a pixel where geometry looks wrong, for example an icon beside text.
- Spacing comes from the project's scale. Related items sit close, and separate groups get more room.
- Check 375px, 768px and 1440px wide, and ultra-wide by zooming to 50%: no horizontal scroll, no overlap, no text sliding under a control when a row does not wrap.
- Full-height layouts use `100dvh`, and fixed bars respect `env(safe-area-inset-*)` under `viewport-fit=cover`.
- Nested radii are concentric: a child's radius is no larger than its parent's.

## Type

- The same role has the same size, weight and color on every screen.
- Body text below 12px is a defect.
- Numbers that change or are compared use `font-variant-numeric: tabular-nums`.
- Text is cut off only by a deliberate truncation or `line-clamp`, and flex children that truncate have `min-width: 0`.
- Headings avoid one-word last lines (`text-wrap: balance`), and copy uses `…` rather than `...`.

## Color and contrast

- Text has 4.5:1 contrast, and large text 3:1 (WCAG 1.4.3). Control borders and meaningful icons have 3:1 (WCAG 1.4.11). Both hold in every state and theme.
- Theme drift: an element that looks identical in light and dark is hard-coded, and a light patch in dark mode is a defect.
- Dark themes set `color-scheme: dark`, native `<select>` gets explicit colors, and `theme-color` matches the page background.
- Status is never shown by color alone.

## Stability

- Hover, focus and press never change the size or position of the element or its neighbors; use color, outline, shadow or transform. `probe`
- Images and embeds reserve their space with `width` and `height` or `aspect-ratio`.
- Nothing flickers between states, such as content swapped for a spinner and back within a moment.
- Measure shift around a real click with `uiProbeShift.start()` and `uiProbeShift.stop()`. `probe`

## Content stress

- Try long and unbreakable text (emails, URLs, German compounds), one-letter and missing values, emoji, RTL and CJK names, 0, 1 and 1,000,000 counts, a dozen tags, and exactly a page of items plus one.
- Text containers wrap or truncate, empty strings do not collapse rows, and broken images fall back.
- Numbers, dates and times are formatted for the locale.

## Flow and feedback

- No dead ends: every empty and error state offers a next step.
- Error messages name what went wrong and how to recover.
- Destructive actions ask for confirmation or offer undo.
- A temporary value is never shown as the answer, for example "0 results" while results are still loading.
- Where a wrong click costs something (save, delete, pay), one action is clearly primary.
- The browser asks for a permission only after a user action explains it.
- The URL reflects tabs, filters and pagination, and Back restores the scroll position.

## Sources

Rules are adapted from the [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) (MIT), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [uisight](https://github.com/sololabstr/uisight)'s checks (MIT), [Impeccable](https://github.com/pbakaus/impeccable)'s `polish` reference (Apache-2.0), [Emil Kowalski's skills](https://github.com/emilkowalski/skills) (`review-animations`, `emil-design-eng`, `animation-performance`, `mobile-native`, `break-ui`; MIT), and the [OneRedOak design-review agent](https://github.com/OneRedOak/claude-code-workflows/tree/main/design-review) (MIT). Notices are in the plugin's `THIRD_PARTY_NOTICES.md`.
