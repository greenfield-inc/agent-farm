# Research briefs

Each researcher gets one line: "Read and follow [research folder]/BRIEF.md exactly. Your slice name: `<slice>`. Scope: <folders and what to judge>." Add the person's own words about that slice when they named it.

## Slices

- **One per product surface**, 8 to 12 in total, each small enough to read deeply (roughly 10,000 to 60,000 lines). Give the person's named parts their own slice and say "read every file".
- **cross-unit-consistency**: an attribute-by-unit matrix across the repeated units (README, tests, build setup, shared helpers used, settings UI, empty and error states, metadata, naming, last change), then the inconsistencies and the shared piece that would remove each.
- **plans-vs-reality**: every spec, plan and decision record marked built, partly built or not started; TODO counts per area; which tests run in CI and which never do; where fix commits concentrate.
- **timeline**: eras and renames, every release with 2 to 4 headline changes, the date each major capability first landed, commits per month by author, big rewrites. Output `timeline.md` and `timeline.json` in the data contract's shape.
- **architecture**: 20 to 40 runtime components with the repo paths that make up each (non-overlapping, so size and activity can be computed), every edge with its transport, one request traced end to end, what is legacy versus central. Output `architecture.md` and `architecture.json` in the data contract's shape.
- **ideas-feasibility** (when the person has ideas): for each, what exists today, what is missing and in which layer, size, and a verdict.

Follow-ups that paid off: a duplication study where the same logic exists per platform or per unit, and an import graph between modules for the architecture page.

## The shared brief (save as BRIEF.md in the research folder, with the bracketed parts filled in)

## Goal
[The person] feels [the product] is unpolished. Find out, with evidence, which parts of the codebase are most polished and which are least, what is fully built, what is half-built, and what could still be built. Go deep: read real code, not only READMEs.

## Codebase
- Read-only clone: [absolute path] (repo [name], branch [branch]).
- Start with the root agent or contributor guide, the decision records, and the nearest README for your slice.
- [Two sentences: what the product is and how its main pieces connect.]

## Hard rules
- Read only. Never run `git checkout`, `reset`, `clean`, `stash`, `pull`, or any command that changes the clone. Do not install dependencies or run builds. `git log`, `git show`, `git blame`, grep and reading files are fine.
- Do not edit any file except your own output file.
- Do not contact external services.

## What to judge, per area or app in your slice
Score polish 1 to 5 (5 = feels finished and cared-for) on evidence such as:
- Completeness: are the features the code, README, ADRs or settings promise actually wired end to end? Look for stubs, TODO/FIXME/HACK, `not implemented`, dead settings, placeholder copy, hardcoded values, commented-out code.
- UX quality: empty, loading and error states; edge cases (offline, slow network, long text, other languages, small screens, each supported platform); copy quality; accessibility; consistency with sibling apps and the design system.
- Robustness: error handling, retries, races, cleanup, logging.
- Tests: do meaningful tests exist for the behavior?
- Activity: `git log` history (who, how often, how recently, churn and revert patterns, many "fix" commits in a row).

## Output
Write one Markdown file at `[research folder]/<your-slice>.md` with:
1. **Summary**: 3 to 5 lines. The most polished thing, the least polished thing, the biggest gap.
2. **Scorecard table**: area/app, polish score 1 to 5, one-line reason, last meaningful change date.
3. **Per area**: what is fleshed out, what is half-built (with `path:line` evidence), rough edges a user would notice, missing pieces.
4. **Opportunities**, in two separate ranked lists (The person wants to raise the codebase's average polish and pick where to invest time):
   - **Low-hanging fruit**: trivial or small fixes (under about half a day each) a user would notice: copy, missing empty/error states, inconsistent styling, dead settings, small bugs. Aim for 12+ items.
   - **Non-trivial investments**: larger work (days to weeks) that would most raise quality or unlock value: unfinished features, missing architecture, test gaps, cross-app consistency. Aim for 10+ items.
   The final report lists the best 25 of each across the whole codebase, so give real, specific, verified candidates, not filler.
   Each item: one line on what and why it matters to a user, size (S/M/L), impact (low/med/high), and the files involved.
5. **Open questions** you could not settle from the code.

Cite `path:line` for every claim. Separate what you saw in code from what you infer. Plain, concise prose with no em dashes. Your final reply should be only the output path and the 3 to 5 line summary.

Write your output file early and update it as you go, so partial work survives if you are stopped.
