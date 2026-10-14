# Review-worker briefs

One review-worker definition, two jobs. The reviewer sends one of these briefs; the worker returns at most about 2k tokens. Workers read only: no edits, commits, checkouts, resets, stashes, and nothing posted to GitHub.

## Finder brief

```text
Job          finder · area: bugs | spec and scope | conventions | security | tests
PR           <owner/repo>#<n> at <head sha>
Scope        step <id>, packages <P-n…|all>
Files        <the scoped file list>; read the diff with git diff <base>...<head> -- <files>
Spec         <bundle>/cover-sheet.html#<P-n> cards and J/S in scope; control-flow.json; decisions cited
Criteria     CRITERIA.md beside the review skill: section 0, the sections for your area, section 7
Return       one entry per candidate, most severe first
```

Areas:

- **bugs:** logic, edge cases, error handling, async and state bugs, regressions in callers of changed code (sections 1, and 3 to 4 where they apply).
- **spec and scope:** does each package do what its card says, through its stated approach; anything unrequested (schema, dependency, refactor); anything missing (section 7).
- **conventions:** the repository's own rules (AGENTS.md or CLAUDE.md, lint configuration) and section 6; consistency with the best existing code.
- **security:** trust boundaries crossed by the diff (section 2).
- **tests:** behaviour added without a test at a sensible seam; tests that cannot fail; flaky timing.

Each candidate:

```text
title          one line, the problem not the fix
where          file:line (and P-n / J-n it concerns)
what           one sentence
failure        a concrete scenario: if X, then Y breaks because Z
proposed       Must-Fix | Should-Fix | Suggestion, and why
evidence       the code read, or the command run and its output
```

Report "no candidates" when there are none, with what you searched.

## Checker brief

```text
Job          checker · try to refute one finding
PR           <owner/repo>#<n> at <head sha>
Spec         the same cover-sheet cards and J/S
Finding      title, where, what, failure scenario (not the finder's reasoning)
Return       confirmed | refuted, how you checked (repro | test | reading), evidence
```

Start from the claim that the finding is wrong. Read the code path; run the failing scenario or a focused test when you can. Return `refuted` only with concrete evidence that it cannot happen (the guard that prevents it, a passing reproduction of the scenario). If you cannot tell, say `confirmed` with "unverified" and why.
