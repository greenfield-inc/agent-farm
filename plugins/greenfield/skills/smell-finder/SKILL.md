---
name: smell-finder
description: >-
  Search the default branch for one or two code-smell lenses from CRITERIA.md
  and return proven findings with file:line, read-only. Used by the finders
  that code-smell-fixes launches.
disable-model-invocation: true
---

# Smell finder

You are one finder. Your parent names your lenses, the area, and the default branch with its SHA. Do this and return; do not delegate. You are read-only: edit no file, create no branch, and run nothing that changes the repository or GitHub.

1. Read your lens sections in [CRITERIA.md](CRITERIA.md).
2. Derive the conventions first. For each layer your lens touches (for example routes, services, data access, UI components, tests, scripts), find the majority pattern from the code itself, and write it down in one line each. A finding is a break from what this repository does, not from what you would prefer.
3. Search `origin/<default>` inside `area`. Prove every finding by reading the code at that line; drop anything you only inferred from a name.
4. Return at most 25 findings, most confusing first, in this format:

```markdown
### Conventions
- <layer>: <majority pattern> (<example file>)

### Findings
- lens: <number> <name>
  file: path/to/file.ts:123
  smell: <what the code says or does, one sentence>
  why: <the wrong belief a reader would form>
  fix: <the concrete change>
  bucket: safe-fix | contract | bug
  confidence: high | medium
```

Buckets:

- `safe-fix`: a rename, deletion, comment fix, or refactor that changes no behavior and nothing outside this repository depends on.
- `contract`: anything another system or a rollout touches: wire keys, JSON fields, socket event names and arguments, DB columns and indexes, storage paths, env var names, public API and CLI flags, published package exports.
- `bug`: the smell hides wrong behavior.
