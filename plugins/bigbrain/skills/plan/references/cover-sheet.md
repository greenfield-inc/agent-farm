# Plan cover sheet

The cover sheet is the plan for both the person and the implementer: what is being built, what was decided, what could go wrong, how they will know it works, and the control flow that will run. Copy the `documents` skill's `formats/cover-sheet/template.html`, read its `example.html` once, and fill every section. Lead with the story and pictures; put everything the person must approve on this page.

```text
Header                feature, one-line outcome, status chip, doc-meta
Control flow summary  #control-flow-summary: review points + QA settings in one line
What you are approving  call-out: scope in a few sentences, the most consequential
                      choice, the packages worth a close look
Contents              #contents: section anchors + table of related bundle files
In three sentences    what, approach, what the user gets (cites SC-n)
Before / After        diagram or approved mockups; screens that must match
Decisions locked      D-n | chosen | rejected | why
Deferred              item | why deferred | revisit when (a concrete trigger)
Scope · Constraints · Non-goals (stacked, full width) · Ask-first actions
Cross-cutting         security · privacy · observability · migration and rollback ·
                      performance: "addressed in P-n" or "n/a because …"
How we will know it works
  J-n                 Given / When / Then / Check (covers SC-n · P-n)
  S-n                 Run {command} → expect {result}
Packages P-n          stacked cards
Control flow          #control-flow, rendered from control-flow.json (never hand-edited)
Open markers          remaining [ASSUMPTION]s; NEEDS DECISION must be 0
Look at these first   the two or three riskiest packages, and why
Change log            newest first
```

Each J-n, S-n and P-n gets its own element with that id (`<article id="J-2">`), so other pages can link `cover-sheet.html#J-2`, and is listed in doc-meta `defines`.

## Contents and related files

A visible navigation near the top: section anchors plus a table of every other bundle file that exists (brief, options, decisions, mockups, explainers, `control-flow.json`, the verification page, evidence index, `bundle.json`), each with its purpose. Relative links only; link only files that exist; `check-bundle` verifies every target.

## Package cards

Stacked full-width cards, one per package: the ID and title, a one-line outcome, a few labels (**reuse**, **extend**, **new**, the affected surface, dependencies, status), and **look at this** only for a real decision or risk, with the reason visible. A rollback line when it touches data. A native `<details>` titled **Approach, reuse, and affected areas** holds, in short labelled paragraphs:

- **Approach:** what changes and how we will build it; the important data and control flow and the integration boundaries.
- **Reuse:** existing services, components, APIs or patterns we build on, and what changes in them.
- **New:** any new component, service, abstraction or dependency, and why existing ones are not enough; "none" when nothing is new.
- **Schema and data:** entities and fields at a conceptual level, migrations or backfills and their compatibility; "no schema changes" when that applies. Never invent table or field names. Migrations go under Ask-first actions.
- **Checks:** the J/S this package is proved by, and its key risk or assumption.

Give technical direction and leave the coding to the implementer: no per-file edits, signatures, pseudocode or task lists. Everything needed for approval stays visible with every `<details>` closed.

## Layout

One reading column about 46rem wide, the `documents` template tokens, light and dark. The before/after drawing comes early, with a caption saying what exists and what changes. Constraints and Non-goals are separate full-width sections stacked vertically at every width. Link the post-mortem, verification page and trace once they exist.
