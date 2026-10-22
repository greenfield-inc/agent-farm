# Review-worker briefs

One review-worker definition, two jobs. The reviewer sends one of these briefs; the worker returns at most about 2k tokens. Workers read only: no edits, commits, checkouts, resets, stashes, and nothing posted to GitHub.

## Finder brief

```text
Job          finder · area: bugs | spec and scope | conventions | security | tests | lane: <lane name>
PR           <owner/repo>#<n> at <head sha>
Scope        step <id>, packages <P-n…|all>
Files        <the scoped file list>; read the diff with git diff <base>...<head> -- <files>
Spec         <bundle>/cover-sheet.html#<P-n> cards and J/S in scope; control-flow.json; decisions cited
Criteria     CRITERIA.md beside the review skill: section 0, Severity, the sections for your area, section 7; severity-examples.md
Return       one entry per candidate, most severe first
```

Areas:

- **bugs:** logic, edge cases, error handling, async and state bugs, regressions in callers of changed code (sections 1, and 3 to 4 where they apply).
- **spec and scope:** does each package do what its card says, through its stated approach; anything unrequested (schema, dependency, refactor); anything missing (section 7).
- **conventions:** the repository's own rules (AGENTS.md or CLAUDE.md, lint configuration) and section 6; consistency with the best existing code.
- **security:** trust boundaries crossed by the diff (section 2).
- **tests:** behaviour added without a test at a sensible seam; tests that cannot fail; flaky timing.
- **lane:** one data-cost or principle lane from the lane briefs below. Look only through that lane.

At small size the two bug hunters also take spec and scope: bugs first, then whether the change does what was asked and nothing more.

Each candidate:

```text
title          one line, the problem not the fix
where          file:line (and P-n / J-n it concerns)
what           one sentence
failure        a concrete scenario: if X, then Y breaks because Z
severity       Harm: <high|medium|low> (why) · Reach: <high|medium|low> (who) · Recovery: <silent|visible> → Must-Fix | Should-Fix | Suggestion
routing        Scope: in | out (why) · Approach/scope: no | yes (the plan change it would need)   (Must-Fix and Should-Fix only; CRITERIA.md section 7)
evidence       the code read, or the command run and its output
```

Report "no candidates" when there are none, with what you searched.

## Checker brief

```text
Job          checker · try to refute one finding
PR           <owner/repo>#<n> at <head sha>
Spec         the same cover-sheet cards and J/S
Finding      title, where, what, failure scenario, severity line, routing line (not the finder's reasoning)
Criteria     the Severity section of CRITERIA.md and severity-examples.md
Return       confirmed | refuted, how you checked (repro | test | reading), evidence;
             severity agreed, or your own severity line and why;
             routing agreed, or your own routing line and why
```

Start from the claim that the finding is wrong. Read the code path; run the failing scenario or a focused test when you can. Return `refuted` only with concrete evidence that it cannot happen (the guard that prevents it, a passing reproduction of the scenario). If you cannot tell, say `confirmed` with "unverified" and why.

Then check the severity line on its own: is each answer right for this code (who actually reaches it, whether the failure shows), and does the level follow from the answers under the rubric? Give your own line when it doesn't.

Then check the routing line the same way: is the fix inside what the PR changes (scope in), and would it need a different approach or a change to the plan or the issue's scope (approach/scope yes)? A broken premise, a missing package or a plan-level gap is approach/scope yes.

## Lane briefs

Adapted from greenfield's principled-review. Add the lane's text to the finder brief as its area. Every lane reads the full diff, searches the codebase where the lane says, and returns candidates in the same format, or "N/A" with the reason when the diff gives it nothing to check.

**Data cost** (standard and large, when the diff adds or changes a query, schema, data access or a loop over data that grows). No request should get slower as the product grows. Assume 1 million active users; derive each table's row count from what it stores per user and each path's call rate from how often those users hit it, and show the arithmetic. List every query the diff adds or changes. For each, find the table's real indexes in the schema, migrations or models and confirm one serves the WHERE, JOIN and ORDER BY columns (a function on the column, a leading `%`, a type mismatch or an OR across unindexed columns defeats it). Weigh call rate against table size: badges, counters, polled endpoints and page loads run constantly, and a COUNT or scan there is the classic failure. Check query shape (a query per item in a loop, a read with no LIMIT, a count where EXISTS answers, `SELECT *` on a wide table, an unbounded IN list) and in-memory work that grows with data. Run EXPLAIN only against a local or dev database you can reach read-only, never production. Each candidate states its cost at 1M users ("every page load, ~20k calls/s, scans ~500M rows, no index on user_id"); drop any with no plausible scale cost.

**Reuse and single way** (large). One way to do each thing. For every new function, hook, component, class, endpoint or helper, search the codebase (shared, common and utils directories first) for something that already does it, and name the existing one with its file:line. Flag copy-pasted blocks, new abstractions where an existing one works, a second pattern beside an established one, and anti-patterns the repository documents as forbidden.

**Data-layer consistency** (large, when data fetching, caching or state changes). Identify the project's data layer and its best existing examples. Check that new code follows them for keys, writes, loading and error states, invalidation and optimistic updates, and flag direct calls that bypass the layer.

**Backend and frontend conventions** (large, for the side or sides the diff touches). Read the area's AGENTS.md or CLAUDE.md and its most mature modules, and check the new code against them: request handling, service boundaries, errors, data access, auth and validation on the backend; component structure, state, data fetching, routing, styling and separation of logic from presentation on the frontend. Cite the exemplar.

**Self-contained components** (large, UI only). A temporary or optional feature (a banner, a flag, an experiment) should be removable by touching as few files as possible. Simulate removal and count the files; flag hard-coded offsets, constants imported from temporary code, and state threaded through unrelated modules.

**Docs** (large). New files and non-obvious logic carry documentation in the project's own style; a changed command, flag, config key, path or default is updated in every doc that states it; TODOs have context.

**Test strategy** (large, when behaviour or tests changed). Behaviour users depend on has a test at the cheapest level that proves it; tests are at the right level (no mocked database for a query); no test only repeats what the types or another test already prove; test data and environment resemble production enough to catch real bugs.
