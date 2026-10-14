# Findings file

`findings/pr-<n>-<step id>.md` in the bundle. It defines the F-n the review cites; `check-bundle` reads lines starting with `F-n` or `## F-n`.

```markdown
# Findings: PR #<n> @ <sha> · <step id> · scope <P-n…|all>

Must-Fix: <n> · Should-Fix: <n> · Suggestion: <n>

## F-<n> <title>
P-n/J-n · `file:line` · Must-Fix | Should-Fix | Suggestion
What: …
Failure scenario: …
Fix: …
Checked by: <repro | test | reading> on <vendor>; found by <finder>

## Dropped
- <candidate> · refuted because <evidence>

## Quality gates
- <command>: PASS | FAIL | BLOCKED | N/A

## Verification claims
<N> ok, <N> unsupported: <J/S ids and why>

## Follow-up (<sha>)
- F-<n> closed | still open — <evidence>
```
