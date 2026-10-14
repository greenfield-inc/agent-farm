# Findings: PR #42 @ 3f9c2a1 · review-p1

Scope: P-1 · Reviewer profile: bigbrain/reviewer · Reason: shared-contract

## F-1 Boot script crashes when storage is blocked

- Severity: Must-Fix · P-1 / J-2
- Where: `index.html:14` (inline boot script), `src/theme/store.ts:9`
- What: the boot script calls `localStorage.getItem("notebook.theme")` with no guard.
- Failure scenario: in a private window where storage access throws, the script stops before setting `data-theme`, the app bundle then calls `getTheme()` and throws again, and the page stays blank.
- Fix: wrap every storage read and write in try/catch and fall back to `system`.
- Checked by repro (storage disabled in the browser) on claude.

## F-2 System listener keeps running after an explicit choice

- Severity: Should-Fix · P-1 / J-1
- Where: `src/theme/store.ts:31`
- What: `subscribe()` adds a `prefers-color-scheme` listener when the theme is System and never removes it.
- Failure scenario: a person picks Dark, then the device switches to light at sunrise, and the app flips to light although Dark is selected.
- Fix: remove the listener in `setTheme()` when the new value is not `system`; add a test.
- Checked by test (new failing case in `tests/theme.test.ts`) on claude.

## Dropped

- Candidate: the key should be namespaced per account. Refuted because D-2 settles per-device storage.

## Follow-up

- F-1 closed in 5d27e80: try/catch added; storage-blocked test added and passing.
- F-2 closed in 5d27e80: listener removed on explicit choice; test passing.
