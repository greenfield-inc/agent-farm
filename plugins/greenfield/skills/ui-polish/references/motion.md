# Motion

Motion in polish explains cause and effect: what was pressed, where a panel came from, what changed. It never decorates. `probe` marks what `scripts/probe.js` measures. Sources are listed in [lenses.md](lenses.md#sources).

## Should it move at all

- Something used 100+ times a day, such as a keyboard shortcut or a command palette, does not animate.
- Something used tens of times a day (hover, list navigation) animates barely or not at all.
- Modals, drawers, toasts and menus get a standard, short animation.
- Only rare moments (first run, a completed goal) earn anything expressive.

## Easing and duration

- Entering or leaving: ease-out. Moving on screen: ease-in-out. Hover and color: ease. Constant motion: linear.
- Never ease-in for UI; it delays the moment the user is watching.
- Built-in curves are weak. A strong ease-out such as `cubic-bezier(0.23, 1, 0.32, 1)` feels faster at the same duration.
- Press feedback 100–160ms, tooltips and small popovers 125–200ms, dropdowns 150–250ms, modals and drawers 200–500ms. Most UI motion stays under 300ms.

## Physical correctness

- Press feedback lands on pointer-down: `transform: scale(0.97)` on `:active`, subtle (0.95–0.98).
- Nothing grows from `scale(0)`. Start from `scale(0.9–0.97)` with `opacity: 0`.
- Popovers and menus scale from their trigger (`transform-origin` at the anchor). Modals stay centered.
- The first tooltip in a group waits briefly; moving to a neighbor shows its tooltip at once, with no delay or animation.
- SVG transforms go on a `<g>` with `transform-box: fill-box`.

## Interruptible

- UI that can be retriggered mid-motion (toggles, toasts, menus) uses CSS transitions, which retarget. Keyframes restart from zero.
- Enter states can use `@starting-style` instead of a mount flag.
- Motion follows input: a drag tracks the pointer, and a flick with enough velocity dismisses without crossing a distance threshold.

## Performance

- Animate only `transform` and `opacity`. Width, height, top, left, margin and padding force layout every frame. `probe`
- List transition properties explicitly; `transition: all` animates whatever changes next, including layout. `probe`
- Set `transform` on the moving element itself. A CSS variable changed on a parent recalculates styles for every descendant.
- Framer Motion's `x`/`y`/`scale` shorthands run on the main thread; animate the full `transform` string.
- Keep animated `blur()` under 20px, especially for Safari.
- Use `will-change: transform` only to fix an observed 1px shift at the start or end of a motion.
- To find dropped frames, record a Performance trace with 4x CPU throttling, or slow the motion in the DevTools Animations panel. The frame budget is 16.7ms at 60Hz and 8ms at 120Hz.

## Reduced motion

- Honor `prefers-reduced-motion` (WCAG 2.3.3): keep fades and color changes that aid understanding, and drop movement and scaling.
- Autoplaying motion longer than 5 seconds beside other content has a pause, stop or hide control (WCAG 2.2.2).
