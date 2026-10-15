# Plan cover sheet

The cover sheet is the plan for both the person and the implementer: what is being built, what was decided, what could go wrong, how they will know it works, and the control flow that will run. Copy the `documents` skill's `formats/cover-sheet/template.html`, read its `example.html` once, and fill every section. Lead with what the user will be able to do, shown with the approved mockups, then the database changes underneath, then the program; put everything the person must approve on this page.

The sections go in this order; `check-bundle` fails a draft whose sections are out of order (`section-order`):

```text
Header                feature, one-line outcome, status chip, doc-meta, the drawing
What you are approving  call-out: the tracks and packages in a few sentences, the most
                      consequential choice and its cost, the packages worth a close look,
                      the review points; links to #what-we-build and #schema-changes
Control flow summary  #control-flow-summary: review points + QA settings in one line
Contents              #contents: section anchors + table of related bundle files
In three sentences    what, approach, what the user gets (cites SC-n)
Before / After        today, and the approved design with the screens that must match
What we're building   #what-we-build: one track per user-facing capability
Schema changes        #schema-changes: one group per table, DDL above its table
Packages P-n          stacked cards
How we will know it works
  J-n                 Given / When / Then / Check (covers SC-n · P-n)
  S-n                 Run {command} → expect {result}
Control flow          #control-flow: diagram + step detail, rendered from control-flow.json
Decisions locked      D-n | chosen | rejected | why
Deferred              item | why deferred | revisit when (a concrete trigger)
Scope · Constraints · Non-goals (stacked, full width) · Ask-first actions
Cross-cutting         security · privacy · observability · migration and rollback ·
                      performance: "addressed in P-n" or "n/a because …"
Open markers          remaining [ASSUMPTION]s; NEEDS DECISION must be 0
Look at these first   the two or three riskiest packages, and why
Change log            newest first
```

Each J-n, S-n and P-n gets its own element with that id (`<article id="J-2">`), so other pages can link `cover-sheet.html#J-2`, and is listed in doc-meta `defines`.

## Contents and related files

A visible navigation near the top: section anchors plus a table of every other bundle file that exists (brief, options, decisions, mockups, explainers, `control-flow.json`, the verification page, evidence index, `bundle.json`), each with its purpose. Relative links only; link only files that exist; `check-bundle` verifies every target.

## What we're building

One track per thing a user can now do (view the table, select, archive, add to a broadcast…), not per package. A short intro line and a numbered list of the tracks with anchors come first. Each track is `<article class="card track" id="track-<slug>">` and shows only:

- a numbered title saying what the user can do (`2 · Select patients, up to every match`);
- the approved mockup frames for it, inline as images (`<img>` inside a link to the mockup page), with alt text that describes the frame and a one-line caption. Two frames side by side go in a `.pair`.

Everything else sits in native `<details>` blocks, closed by default, each with a clear `<summary>`:

- **What happens, step by step:** each step the user takes and what the product does, side effects included (what else changes, who is notified, what is skipped).
- **Rules:** a `meta` line with the SC-n and D-n, then who may do it, limits, and what never happens.
- **What makes it work underneath:** the P-n that build it, the existing pieces they reuse, and the schema changes it needs, each linked to its row in Schema changes (`#schema-<object>`).

Add another `<details>` when a track needs one (a copy change to an approved frame, how something comes back). Opening a `#track-…` link lands on the track's title and frames. A change with no interface still gets tracks for what callers or operators can now do; its frames say "n/a because …".

## Schema changes

Every database change in the feature, exact and grouped by table, so the person sees what will be applied and why each part is needed. Ground it in the repository's schema file and its naming conventions; say the implementer may adjust a name in review, and that anything beyond the list comes back as a new revision. With no schema change, the section says "n/a because …" and names the stores checked.

1. **Intro paragraph:** the schema file, the number of statements and groups, the order they apply in, any backfill, whether it all adds; and the three impact badges, `everyone`, `one feature` and `slower / minor`, meaning who is affected if the object is missing when the new code starts.
2. **A table diagram** (inline SVG): new and changed tables in accent, existing tables read but not changed dashed, relations as arrows.
3. **New tables**, then **Changes to existing tables**, each table one `<article class="schema-group" id="schema-<table>">`:
   - a numbered `h4` heading, `S1. <table>: <what it holds, in plain words>`, with the statement count (`(2 statements)`). Number groups S1, S2 … with no hyphen: S-n is a suite;
   - a `meta` line with its P-n, SC-n and D-n;
   - the group's exact DDL in a visible code block (`<div class="ddl"><pre><code>`), scrolling inside the block, with the template's Copy button script. Never in a closed `<details>`;
   - **below** the DDL, a three-column table: **Object** | **What it is for** | **Why it's needed**. One row per table and per index or group of related columns, not per column; a changed existing table explains its new columns together, in aggregate. "What it is for" says where it shows in the mockups; "Why it's needed" starts with an impact badge and says what is impossible or broken without it. A backfill is a row of its own (`Backfill (not DDL)`). Rows other pages link to carry an `id` (`schema-last-from`);
   - a short paragraph on cost and rollout: fast or slow to apply, what the database fills, what must happen before or after the deploy.
4. **Considered and not needed:** changes someone might expect, and why they are not needed.
5. **How it rolls out:** local or staging (who approves), production (who applies it, and when relative to the deploy), backfill, rollback.

`check-bundle` fails a draft whose schema group lacks its DDL block or table, puts the table above the DDL, or hides the DDL in a `<details>` (`schema-changes`).

Readability: the template's `.schema-table` uses fixed column widths and breaks code names only at `<wbr>` (put one after each `_` or `.`), so names never break mid-word and nothing scrolls sideways at normal width.

## Package cards

Stacked full-width cards, one per package: the ID and title, a one-line outcome, a few labels (**reuse**, **extend**, **new**, the affected surface, dependencies, status), and **look at this** only for a real decision or risk, with the reason visible. A rollback line when it touches data. A native `<details>` titled **Approach, reuse, and affected areas** holds, in short labelled paragraphs:

- **Approach:** what changes and how we will build it; the important data and control flow and the integration boundaries.
- **Reuse:** existing services, components, APIs or patterns we build on, and what changes in them.
- **New:** any new component, service, abstraction or dependency, and why existing ones are not enough; "none" when nothing is new.
- **Schema and data:** the schema groups this package applies, linked to their place in Schema changes, or "no schema changes". Migrations and backfills go under Ask-first actions.
- **Checks:** the J/S this package is proved by, and its key risk or assumption.

Give technical direction and leave the coding to the implementer: no per-file edits, signatures, pseudocode or task lists. Everything needed for approval stays visible with every `<details>` closed.

## Control flow

Rendered from `control-flow.json` as the `documents` skill's `references/control-flow.md` describes: a one-line meta paragraph, an inline-SVG diagram of the phases, actors, review points, QA loop and human gates, and the per-step detail grouped by phase in a closed `<details>`.

## Layout

One reading column about 46rem wide, the `documents` template tokens, light and dark. Constraints and Non-goals are separate full-width sections stacked vertically at every width. Link the post-mortem, verification page and trace once they exist.
