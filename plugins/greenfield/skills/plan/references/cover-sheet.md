# Plan cover sheet

The HTML cover sheet is the plan for both the person and the implementer. Write it for a human: what is being built, what was decided, what could go wrong, and how they will know it works. Lead with the story and pictures. Show ask-first actions as call-outs, not buried in a list. Put everything the person must review or approve on this page, including material requirements, package approaches, schema implications, risks, and checks; link supporting evidence as needed. Save it as `cover-sheet.html` in the existing bundle.

```text
Header                feature, one-line outcome, status chip:
                      draft | ready for approval | approved | in build | done
Review                once at the end of the workstream (default), alongside status at the top
                      exceptions: mode, reason, small-change skip or user approval status
Contents              section anchors and linked table of related bundle files

In three sentences    what we are building, the approach, what the user gets
Before / After        diagram or mock-ups. Embed the design reference here and
                      name the screens that must match it.

Decisions locked      table: decision | chosen | rejected | why, in one line
                      link to the options document
Deferred              table: item | why deferred | revisit when (a concrete trigger)

Scope                 included outcomes and affected backend/frontend surfaces
Constraints           stack, dependencies, style, safety
Non-goals             explicit exclusions, immediately below Constraints
Ask-first actions     only relevant actions under the standing rules

How we will know it works
  Journeys            numbered user flows to drive in the running app
  Whole-feature check commands and suites

Packages              stacked cards: stage/title, one-line outcome, labels,
                      dependencies/status, expandable technical approach
Package approach      approach, reuse/extend/new systems, schema/contracts,
                      affected areas and relevant checks, on this same page
Look at these first   the two or three packages you consider riskiest, and why.
                      Invite the person to cut any they would be nervous to
                      wake up to.

Change log            newest first. Scope/decision changes are recorded here.
```

Write the review line as [`plan`](../SKILL.md) describes: its default, options, who may change it, and the standalone small-change skip. Under an orchestrator, only the user's explicit word changes the review line.

## Layout and linked contents

Constraints and Non-goals are separate full-width sections, stacked vertically at every viewport width.

Every cover sheet has a visible **Contents & related files** navigation near the top: section anchor links plus a table of linked filenames or titles and their purpose. List the brief, options, approved designs, explainers, evidence, and other bundle files that exist, following `../../page/references/bundle.md`. Keep it current as files are added, use relative links within the bundle, and check every target before publishing. Link only files that exist; if there are none yet, say so and keep the section links.

## Verification: How we will know it works

**How we will know it works** is the finish line for implementation. It holds numbered journeys and whole-feature commands or suites, and implementers and verifiers refer to them by journey number or check name. Keep this format when updating an existing cover sheet.

Give each journey and check an observable outcome for the requested backend or frontend behavior and approved visual states. Add prerequisites or known blockers in plain language. The implementer and frontend verifier record observed results and evidence in the work's status files and finish the required checks before marking the feature done. A check that has not run stays undetermined.

## Explain the approach in each package

Use stacked full-width package cards, following [presentation.md](presentation.md). Each card has a title, a one-line outcome, meaningful labels, dependencies and status, and expandable approach details on this same page. A short paragraph plus a few labelled bullets is usually enough; a small package can skip the disclosure. With many packages, a summary table can sit above the cards.

Each package answers:

- **Outcome and approach:** what will change and how we will build it. Describe the important data and control flow and the integration boundaries.
- **Reuse or extend:** the existing services, components, APIs, jobs, or patterns we build on, and what changes in them. Link confirmed entry points where useful.
- **New systems:** any new component, service, abstraction, or dependency, and why existing systems are insufficient. Write "none" when nothing new is needed.
- **Schema and data:** the entities and fields, relationships, constraints or indexes needed, at a conceptual level, and any migration, backfill, or compatibility implications. Write "no schema changes" where that applies. Mark unverified assumptions explicitly, and never fabricate table or field names. List migrations that need approval under Ask-first actions; running one needs its own approval.
- **Execution and checks:** dependencies or sequencing, affected backend and frontend surfaces, and the relevant journeys or whole-feature checks. Mention the key risk or assumption if it could change the approach.

Give technical direction and leave the coding to the implementer: skip per-file edits, function signatures, pseudocode, exhaustive task lists, and invented class or method names. Separate locked architecture decisions from the proposed approach. The implementer refines routine details within scope and raises any discovery that changes product behavior, schema commitments, system boundaries, or required permissions. Investigate just enough to make the approach credible.
