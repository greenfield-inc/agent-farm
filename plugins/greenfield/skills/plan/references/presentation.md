# Cover-page presentation

This format follows a user-approved sample plan (v3, 23 September 2026): a readable narrative followed by package cards.

## Page structure

- Center a single reading column around 46rem wide, with comfortable line height, restrained green accents, subtle borders, and light and dark themes. Adapt to narrow screens and let wide tables and diagrams scroll.
- Lead with the feature title, a one-line outcome, and compact status, version, and review metadata. Keep the linked contents and related-files navigation near the top.
- Show the before/after diagram early, with a caption saying which systems already exist and what this work changes. Draw the real behavior.
- Add a visible **What you are approving** callout: the scope in a few sentences, the most consequential choice, and the packages worth a close look. Add warnings only when they apply.
- Keep **In three sentences**, compact **Decisions locked** and **Deferred** tables, scope, vertically stacked **Constraints** and **Non-goals**, relevant ask-first callouts, and the **How we will know it works** numbered journeys and whole-feature checks.
- Follow with the stacked package cards, an execution-order sentence, related files, and the change log. Link the post-mortem and trace once they exist in the bundle.

## Package cards

Each card shows its ID and title, a one-line outcome, and a few informative labels: **reuse**, **extend**, **new**, the affected surface (such as backend or web), dependencies, and status. Use **look at this** only for a real decision or risk, with the reason visible before expanding. One implementer builds every package, so cards carry no worker tier.

A native `<details>` disclosure titled **Approach, reuse, and affected areas** holds the supporting technical detail, in short labelled paragraphs: approach; reused or extended systems; new systems (or none); schema, data, and contracts; and relevant checks. A short annotated tree or list can orient the reader to known modules. Name a few useful boundaries rather than every path.

Everything needed for approval appears on this page. Keep consequential decisions, schema or migration impact, and important risks visible in the card summary or the approval callout. When exact UI wording, contract semantics, or a design state needs review, show it inline or embed the approved design. Use disclosures for extra depth only, so every approval decision stays visible. State unknowns as unknowns.

Review follows the cover-sheet rules: single lane by default, the small-change skip, and user approval for dual review.
