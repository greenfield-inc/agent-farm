---
name: mockup
description: Use when the person wants to see an interface before it is built. Three options per round, then the approved design reference.
---

# Mockup

A mock-up settles what the interface should look like before anyone plans or builds it. The approved result becomes the design reference that `visual` checks are judged against.

## Start from the current interface

- Get screenshots of the screens involved. Reuse what the person gives you, or capture them from a running dev build or an accessible environment with browser tools. If you cannot capture them, ask.
- Agree on the screen, the state, what changes, and what must be preserved. For a brand new screen, agree on the references to match.

## Make the options

Pick the method that fits, and say which you used:

- **Images**, for exploring looks quickly or changing an existing screen: if you have an image generation tool, use it on the real screenshots. If you do not but have a `mockup-artist` launcher, call it with `--message` giving the screen and state, what changes, what must be preserved, the screenshot paths, how many options, and the folder to save into. It starts with no context, so the message must stand alone. Look at every image it returns before showing it.
- **HTML and CSS**, when exact text, real data, responsive behaviour, or a pixel comparison later matters, and whenever no image tool is available: reconstruct the screen to match the product's layout, type, spacing, colours, and density. The result can be opened, resized, and compared against a screenshot.
- The approved design that `visual` checks are judged against should be exact. If the approved option is a generated image with invented details, either rebuild it in HTML or list which details are illustrative.
- Ask before using any paid fallback.
- Produce three distinct options per round and label them 1 to 3. Change only what is in scope. Check the text and look for unintended changes. Share all three with the person.
- Ask for a favourite, then refine it with their feedback. Keep the original screenshots and earlier options.

## Approval and saving

- A favourite guides the next round. Only an explicit approval selects the final design.
- Save the approved design under `mockups/` in the work's bundle, with a caption, version, and approval status. Keep rejected options marked as rejected.
- Record it in the brief under Evidence. When a plan follows, it becomes the design reference on the cover sheet, with the list of screens that must match it.
- Details that the mock-up invented and nobody discussed are illustrations, not requirements. Say which are which.

## Banned

- Changing source code to produce a mock-up
- Presenting a mock-up as approved when the person only picked a favourite
