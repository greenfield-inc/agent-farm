---
name: plan
description: Use when the direction is chosen and the person wants a plan. Writes a high-level HTML cover sheet with package outcomes and explicit validation criteria. Never implements.
---

# Plan

Write the context a capable implementer needs to build the feature. The approved cover sheet is the whole implementation handoff: it explains what to build and why, and leaves the step-by-step coding to the implementer.

## Establish the outcome

Start from the existing brief, approved design, and decisions. Settle genuine product choices with the person and leave routine implementation details to the implementer. A trivial task can use the existing one-sentence handoff instead of a plan. When alternatives are still open, use `options`.

Inspect enough of the repository to identify the affected surfaces, integration boundaries, existing patterns, and verification prerequisites. Link a few useful entry points when known. Keep investigation bounded: use an investigator only for a specific unknown that affects scope or validation. Leave test harnesses and environment repair to the implementer, and record what it must check during preflight, separating known blockers from assumptions.

## One output

Write `cover-sheet.html` in the work's existing bundle using the `page` standard and [references/cover-sheet.md](references/cover-sheet.md). The person and the implementer both read it. Keep its published identity and its links to the brief and approved designs.

Include:

- Outcome, scope and exclusions, high-level approach, constraints, locked decisions, and deferred items.
- Stacked package cards following [the presentation reference](references/presentation.md), each with concise approach notes: the outcome, how it will be built, systems to reuse or extend, any new systems and why, schema and data changes (or "none"), meaningful dependencies, and the relevant journey numbers or check names. Follow the package guidance in the cover-sheet reference, name confirmed integration points, and label assumptions. Packages are checkpoints for one implementer. Cover every affected client and entry path, including alternate composers and adapters.
- The **How we will know it works** section: numbered journeys and whole-feature commands or suites, each with an observable outcome and its prerequisites. Cover the backend, frontend, integration, and design behavior the feature needs, including identity, duplicate-name, and notification edge cases when they apply. Keep the checks specific to this task.
- Known environment and fixture needs, required whole-feature checks, and anything that cannot be exercised yet. Mark planned tests as planned; only an observed result counts as a pass. A missing capability leaves its criterion open.
- The review line at the top of the page, saying whether review runs and when:
  - The default is `Review: once at the end of the workstream`: `greenfield/reviewer` reviews each PR when every PR in the workstream is ready to merge.
  - The person may choose no review, review of this plan on its own, or checkpoints after named packages. Record their choice and when they made it; a mode you chose yourself does not count.
  - Standalone, small, low-risk changes may skip review without asking. Say so up front and record the reason. Under an orchestrator, never skip on your own: the review line follows the workstream policy, and only the user's explicit word changes it.

Keep the page short enough to read before coding. Explain the important technical approach and let the implementer choose files, signatures, and steps.

## Self-check and handoff

Before presenting the cover sheet, check it yourself against the brief and approved design:

- Scope, exclusions, constraints, and locked decisions agree. Packages cover the affected backend and frontend paths and explain the approach, reuse or extension, new systems, schema and data impact, and dependencies. Assumptions are labelled and required approvals are visible.
- **How we will know it works** covers required behavior, meaningful edge cases, and approved visual states, with observable outcomes and enough context to run each check. Prerequisites and blockers are recorded honestly, and planned checks are marked as planned.
- The page itself contains everything the person must review, including exact proposed copy or contract semantics when they matter. Important decisions and risks are visible above the package disclosures.
- The review line says whether review runs and when, with the person's choice or, for standalone small work, the skip reason. Contents and related-file links resolve, and Constraints and Non-goals are stacked vertically. Explicitly named entry points are confirmed with a quick look when needed.

Fix substantive gaps, mark the cover sheet **ready for approval**, and return its link. This is your own check, separate from user approval, so keep it quick: settled decisions stay settled and coding detail stays with the implementer. Socrates reviews the direction once, during `options`. Start implementation only when your role instructions separately authorize it; otherwise hand off as your role instructions describe.

When scope or a locked decision changes, revise the same cover sheet and its affected criteria. The implementer handles routine technical discoveries and extra in-scope caller files without a replan.
