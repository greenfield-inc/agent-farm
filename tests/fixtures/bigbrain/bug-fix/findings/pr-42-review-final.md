# Findings: PR #42 @ a3f5c18 · review-final

Scope: all (P-1). Reviewer: bigbrain/reviewer. Quality gates: `pnpm typecheck` PASS, `pnpm test` PASS, check-bundle PASS.
Verification claims checked: 2 ok, 0 unsupported.

## Must-Fix (0)

None.

## Should-Fix (1)

F-1  A late response can bring old results back after the box is cleared  P-1/J-1 · src/search/useSearch.ts:24 · what: the empty-query branch turns loading off but does not abort the request already in flight · failure scenario: type "soup", clear the box within 140 ms, and the soup response lands and fills the list under an empty box · fix: abort the current controller in the empty branch, and ignore responses whose query no longer matches · checked by repro on claude

## Suggestions (0)

None.

## Dropped

- "Whitespace-only queries still hit the API": refuted because the guard uses `query.trim()` and the network panel shows no request for "   ".

## Follow-up

- F-1 closed in e7d2b10: the empty branch aborts the controller; new test "ignores a response that lands after the box is cleared" passes; QA round 2 rechecked J-1 with a type-then-clear-fast step.

<!-- bigbrain-review step=review-final head=a3f5c18 -->
