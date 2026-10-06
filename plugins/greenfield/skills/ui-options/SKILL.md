---
name: ui-options
description: When the person dislikes how a piece of UI looks (often mid-QA), build three real design options in the actual code, screenshot each in the same set of states and contexts, open the folder in Finder, recommend one, then land the chosen option. Use for "I don't like this UI", "this looks off / not modern / cluttered", or "give me options for X" about an existing screen. For new screens that do not exist yet, use ui-mockup.
---

# UI options

The person reacts to real pixels, not descriptions. Show them three honest options rendered by the product itself, side by side with how it looks today, and let them pick.

## 1. Pin down the complaint (no questions unless truly blocked)
- Read their words and any reference image for the direction: denser, calmer, more modern, less chrome, closer to a named product.
- Find the component and its styles. Note every place that renders the same surface (web, mobile, other entry points), because the chosen option must land everywhere.

## 2. Build three options in the real code
- One shared markup change that all options need (e.g. remove a stray glyph, split name and details into separate elements). Then express each option as a modifier class or a small temporary switch read at load time (e.g. `window.__<surface>Style`). Never hand-draw mockups.
- Make the options genuinely different, not three shades of one idea. A useful spread: a dense option close to their reference, a minimal/quiet option, and a more guided option (e.g. two-line rows or a hint footer).
- Use the app's own fonts, colors, and spacing. Check the font actually has the weights you use.

## 3. Screenshot every option in the same contexts
- Drive the running app (Playwright; `deviceScaleFactor: 2`) with the same account, data, and interaction for every option. Pick 2 to 4 contexts that stress the design: the full or default state, a filtered or edge state (long names, look-alikes, empty), a context with different data (another org, a patient, and so on), and one in-page shot so they see it in place.
- Crop tight shots around the element (padding about 24px), plus one uncropped in-context shot per option.
- Include a `before-*` shot of today's UI.
- Name files so they sort: `before-current.png`, `option-a-1-<context>.png`, `option-a-2-<context>.png`, `option-b-…`.
- Look at every screenshot yourself before showing it. Fix obvious polish issues (weights, contrast, collisions) first.
- Save under `tmp/<pr-or-branch>-qa/<surface>-options/` (never committed) and run `open <folder>` so Finder shows it.

## 4. Present
- One line per option saying what makes it different, and which one you would pick and why.
- Raise any content question the design exposed (e.g. "must we show the org name?"). Answer it from the code and product facts when you can.
- Do not commit while they are choosing.

## 5. Land the choice
- Keep only the chosen option. Delete the other variants and the temporary switch, and fold in any content decisions from the discussion. Apply it on every surface found in step 1.
- Re-screenshot the final version in the same contexts and open that folder too.
- Run lint, typecheck, and the relevant tests. Add a test only for new behavior that could actually fail without the change.

## 6. Re-test only if behavior changed
- A styling-only change (CSS, spacing, colors, icons) needs no re-test; the final screenshots are the check.
- If the change touched behavior (markup the interaction depends on, what data is shown, saved, or sent), drive the journeys that pass through the surface again and report pass or fail per journey with evidence.
- Then commit the product files only, and push if the work is on an open PR the person is driving.
