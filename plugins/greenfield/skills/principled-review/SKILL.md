---
name: principled-review
description: Spawn parallel review agents for the code-quality principles the diff touches, each with project-aware discovery.
argument-hint: "[branch name or PR number]"
disable-model-invocation: true
---

# Principled Review

Review a branch or PR against the code-quality principles below that its
diff touches, in parallel. Each principle is checked by a dedicated sub-agent that first discovers the
project's own conventions, then evaluates the diff against them.

## Step 1: Gather Context

Determine the diff range. If a PR number is provided, fetch its metadata
to get the correct base:

```bash
# PR provided — use its base and head
gh pr view "$pr_number" --json baseRefName,headRefName,headRefOid
# Then diff against the PR's actual base
git diff "$base_ref"..."$head_ref" --name-only
git diff "$base_ref"..."$head_ref" --stat
```

If no PR is provided, detect the base branch from the repo (check for
`main` or `master` or the default branch) and diff against it:

```bash
git rev-parse --abbrev-ref HEAD
BASE=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}' || echo main)
git diff "$BASE"...HEAD --name-only
git diff "$BASE"...HEAD --stat
```

Store the resolved diff range as `DIFF_RANGE` (e.g. `main...HEAD` or
`origin/develop...feature-branch`). Every sub-agent uses this exact range
instead of hard-coding `main...HEAD`.

Also fetch PR metadata and linked issue context when a PR number is
available: use the review skill's Step 1 when it is bundled; otherwise read
the PR with `gh pr view` and each issue it closes or references with
`gh issue view`.

## Step 2: Project Discovery

Before spawning agents, gather the project's conventions so each agent
reviews against what the project actually does, not generic assumptions.

1. Read `AGENTS.md` and/or `CLAUDE.md` at the repo root and in changed directories
2. Read lint/build configuration (tsconfig, pyproject.toml, Cargo.toml, .eslintrc, etc.)
3. Read CI configuration for enforced checks
4. Identify the project's language(s), framework(s), and package structure

Compose a `PROJECT_CONTEXT` block summarizing:
- Languages and frameworks in use
- Documented conventions and forbidden patterns
- Import style and module organization
- Error handling patterns
- Testing patterns
- Any project-specific review criteria

## Step 3: Spawn the Applicable Review Agents in Parallel

Read the diff, then choose principles by the review's size. The `review` skill sizes the range first (its Size step); run on your own, size it the same way with `../review/scripts/review-size.mjs` when it is bundled, or use standard.

| Size | Principles that run |
| --- | --- |
| small | 4, 5 and 13; plus 9 when the diff adds or changes a query, data access, or work on a hot path, and 12 when there is a spec or cover sheet. 3 to 5 agents. Skip 3: a small batch has no scope to creep |
| standard | 3, 4, 5, 12 and 13, plus those the diff makes relevant: 9 for queries, data access or hot paths; 14 and 15 when behaviour or tests changed; the rest only when relevant files changed (for example 7 and 10 only when UI components changed). Up to 10 agents |
| large | every relevant principle, up to all 15 |

Principle 13 (security and PHI) runs at every size, and 12 joins at every size when a spec or cover sheet exists. List every skipped principle in one line with the reason; the `review` skill copies the Ran/Skipped line into its Principles section.

Spawn the chosen agents in parallel in a single message. Pass each
agent the branch name, changed file list, and the PROJECT_CONTEXT block.

**Sub-agent model rules (hard requirement):**
- Claude harness: each sub-agent uses claude-sonnet-5-5 with reasoning: medium
- Codex harness: each sub-agent uses gpt-6.1-sol with reasoning: low

### Principle 1: Reuse Over Recreation

```
Review the diff for violations of the REUSE OVER RECREATION principle.

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: Minimize lines of code. Reuse existing patterns. Avoid
duplicating functionality. More code = larger maintenance surface area.
Key question: "Did we implement with the least amount of lines?"

WHAT TO CHECK:
1. Get the full diff: git diff {diff_range}
2. For each new function/hook/component/class, search the codebase for
   similar existing implementations
3. Check shared/common/utils directories for utilities that could have
   been reused
4. Look for copy-pasted code blocks
5. Identify new abstractions where existing ones would work

OUTPUT: PASS/WARN/FAIL status, violations with file:line references,
existing patterns that should have been used, recommendations.
```

### Principle 2: Clarity & Readability

```
Review the diff for violations of the CLARITY & READABILITY principle.

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: Code should be easy to understand. Good code feels clean.
A single 200-line function with nested if-statements = bad code. Look for
"hot spots" (ugly-feeling code) that need rethinking.

WHAT TO CHECK:
1. Get the full diff: git diff {diff_range}
2. Read each changed file fully
3. Flag functions over 50 lines (warning) or 100 lines (critical)
4. Flag nested conditionals > 3 levels deep
5. Identify unclear variable/function names
6. Find magic numbers/strings without explanation
7. Look for complex logic without comments explaining why

OUTPUT: PASS/WARN/FAIL status, hot spots with file:line references,
specific readability issues, recommendations.
```

### Principle 3: Correct Scope

```
Review the diff for violations of the CORRECT SCOPE principle.

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: A PR should address ONE thing, not three bundled together.
Multiple unrelated changes = harder to review, confusing intent.
One objective = clearer, more reviewable.

WHAT TO CHECK:
1. Get the full diff: git diff {diff_range}
2. Categorize each changed file by the type of change
3. List all distinct features/fixes/refactors in this diff
4. Check if changes are cohesive (all related to one goal)
5. Flag "while I was in here..." changes
6. Flag mixed feature + refactor + bugfix

OUTPUT: PASS/WARN/FAIL status, list of distinct objectives found,
assessment of whether these are related or should be split,
recommendations.
```

### Principle 4: No Anti-Patterns

```
Review the diff for ANTI-PATTERNS.

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: Avoid patterns the project has documented as forbidden or
that contradict its established conventions. Anti-patterns change as a
codebase evolves; discover them from project configuration rather than
assuming a fixed list.

WHAT TO CHECK:
1. Get the full diff: git diff {diff_range}
2. Read CLAUDE.md/AGENTS.md for explicitly forbidden patterns
3. Check that import style matches the project's convention (aliases,
   relative paths, barrel exports — whatever the project uses)
4. Verify error handling follows the project's established pattern
5. Look for dynamic imports that should be static (or vice versa per
   project convention)
6. Check for inconsistent async/callback patterns vs what the codebase uses
7. Verify file structure conventions are followed
8. Flag imports well past a file's import block (inside a function,
   conditional or mid-file): they usually hide a circular dependency or
   missing injection. Name the cycle or root cause. Framework lazy
   loading (React.lazy, Next.js dynamic, Python TYPE_CHECKING) is fine.

SMELL BASELINE (always applies, even when the repo documents nothing —
from Fowler's Refactoring ch.3; repo standards override these):
- Mysterious Name: a function/variable/type whose name doesn't reveal
  what it does. Rename it.
- Duplicated Code: the same logic shape in more than one hunk or file.
  Extract and share.
- Feature Envy: a method reaching into another object's data more than
  its own. Move it.
- Data Clumps: the same few fields/params travelling together (a type
  wanting to be born). Bundle into one type.
- Primitive Obsession: a primitive standing in for a domain concept.
  Give the concept its own type.
- Repeated Switches: the same switch/if-cascade on the same type in
  multiple places. Replace with polymorphism or a shared map.
- Shotgun Surgery: one logical change forces scattered edits across
  many files. Gather what changes together.
- Divergent Change: one file edited for several unrelated reasons.
  Split by reason.
- Speculative Generality: abstraction or hooks for needs the spec
  doesn't have. Delete until a real need shows.
- Message Chains: long a.b().c().d() navigation. Hide behind one method.
- Middle Man: a class that mostly delegates. Cut it.
- Refused Bequest: a subclass that ignores most of what it inherits.
  Use composition.

Each smell is a labelled heuristic, not a hard violation. Skip anything
linting or formatting already enforces. A documented repo standard
always wins over the baseline.

OUTPUT: PASS/WARN/FAIL status, anti-patterns found with file:line
references, convention violations, late imports with their cause,
smell findings (labelled as judgement calls), recommendations.
```

### Principle 5: Single Way to Do Things (MOST IMPORTANT)

```
Review the diff for violations of the SINGLE WAY TO DO THINGS principle.
THIS IS THE MOST IMPORTANT PRINCIPLE.

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: Only ONE implementation pattern per feature/behavior in a
codebase. LLMs default to creating new patterns when they see multiple
ways to solve the same problem. If two hooks exist for audio recording,
an LLM will create a third for the next feature. If one unified hook
exists in multiple places, the LLM reuses it. Critical for scaling a
codebase and reducing proliferation of similar code.

WHAT TO CHECK:
1. Get the full diff: git diff {diff_range}
2. For EACH new pattern introduced (hook, component, utility, class,
   API endpoint, helper):
   a. Search the entire codebase for similar functionality
   b. List all existing approaches to the same problem
   c. Flag if multiple ways to do the same thing now exist
3. Specific checks:
   - New abstractions: Do similar ones already exist?
   - New API patterns: Is this consistent with other endpoints?
   - New component/module patterns: How do similar ones work?
   - New utilities: Check shared/common/utils directories

OUTPUT: PASS/WARN/FAIL status, new patterns introduced (list each),
existing alternatives that should have been used, pattern proliferation
risk assessment, recommendations.
```

### Principle 6: Backend Conventions

```
Review the diff for violations of the project's BACKEND CONVENTIONS.

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: Backend code should follow the project's established
architectural patterns. Discover these from the codebase rather than
assuming any specific framework.

WHAT TO CHECK:
1. Get the backend portion of the diff
2. Read backend CLAUDE.md/AGENTS.md if present
3. Find exemplar files: identify the most mature or well-structured
   modules in the backend and use them as the reference
4. Check for consistent patterns in:
   - Request handling (middleware, decorators, handlers — whatever the
     project uses)
   - Service/business logic layer separation
   - Error handling and error types
   - Database access patterns (ORM, query builders, raw queries)
   - Authentication/authorization patterns
   - Input validation approach
5. Verify new code follows the same patterns as exemplars

If the diff contains no backend changes, report N/A.

OUTPUT: PASS/WARN/FAIL/N/A status, pattern violations with file:line
references, exemplar files used as reference, recommendations.
```

### Principle 7: Frontend Conventions

```
Review the diff for violations of the project's FRONTEND CONVENTIONS.

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: Frontend code should follow the project's established
component, state management, and organizational patterns. Discover these
from the codebase rather than assuming any specific framework.

WHAT TO CHECK:
1. Get the frontend portion of the diff
2. Read frontend CLAUDE.md/AGENTS.md if present
3. Find exemplar files: identify the most mature or well-structured
   pages/components and use them as the reference
4. Check for consistent patterns in:
   - Component organization and file structure
   - State management approach (whatever the project uses)
   - Data fetching patterns
   - Routing conventions
   - Style/CSS approach
   - Separation of logic from presentation
   - Component colocation conventions (local vs shared)
5. Verify new code follows the same patterns as exemplars

If the diff contains no frontend changes, report N/A.

OUTPUT: PASS/WARN/FAIL/N/A status, pattern violations with file:line
references, exemplar files used as reference, recommendations.
```

### Principle 8: Documentation Standards

```
Review the diff for violations of DOCUMENTATION STANDARDS.

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: Major new files and non-obvious logic should have
documentation. This helps both humans and LLMs understand the code.
Match the project's existing documentation style.

WHAT TO CHECK:
1. Get the full diff: git diff {diff_range}
2. Get new files: git diff {diff_range} --name-status | grep "^A"
3. Check the project's existing documentation style (JSDoc, docstrings,
   inline comments, README files) and match it
4. For each NEW file: verify documentation exists matching project style
5. For complex functions: verify parameter/return documentation
6. For non-obvious logic: verify inline comments explain "why"
7. Check TODOs have context (issue number or explanation)

OUTPUT: PASS/WARN/FAIL status, new files missing documentation,
complex code lacking explanation, orphaned TODOs without context,
recommendations.
```

### Principle 9: Query, Data & Hot-Path Cost

```
Review the diff for QUERY, DATA AND HOT-PATH COST at production scale.

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: No request should get slower as the product grows.
Assume 1 million active users. Derive each table's row count from what
it stores per user (for example messages per user per day x days
retained) and each path's call rate from how often 1M users hit it.
Show the arithmetic.

WHAT TO CHECK:
1. Get the full diff: git diff {diff_range}
2. List every database query the diff adds or changes, whatever the
   ORM, query builder or raw SQL produces
3. For each query, find the table's real indexes in the schema,
   migrations or ORM models. Confirm an index serves the WHERE, JOIN
   and ORDER BY columns. A function on the column, a leading %
   wildcard, a type mismatch or an OR across unindexed columns
   defeats the index.
4. Weigh call rate against table size. Badges, counters, polled
   endpoints and page-load paths run constantly; a COUNT over a large
   table there is the classic failure (for example a per-user unread
   counter on every page load).
5. Check query shape: a query per item in a loop or resolver (N+1), a
   large read with no LIMIT or pagination, a count where EXISTS
   answers the question, SELECT * on a wide table, an unbounded IN
   list.
6. Check in-memory work that grows with data: nested loops over
   growing collections, or loading a whole table to filter it in code.
7. Check CPU, memory, render and latency cost on hot paths (page
   loads, request handlers, render loops, polling, startup): work per
   call that grows with data, repeated work a cache or index would
   remove, re-renders of large lists, synchronous I/O or blocking
   calls on a request or UI thread, and memory that grows without
   bound.
8. When the repo has a local or dev database you can reach read-only,
   run EXPLAIN and include the plan. Never run anything against
   production.

Every finding names the hot path, the scale and an estimate of the
cost at 1M users, e.g. "runs on every page load, ~20k calls/s, scans
~500M rows with no index on user_id" or "page load, 5k items per
account, nested loop ~25M comparisons, ~2 s". Drop any finding that
cannot name all three, or has no plausible scale cost. No
micro-optimizations.

If the diff adds or changes no queries, no data-sized loops and no
hot-path work, report N/A.

OUTPUT: PASS/WARN/FAIL/N/A status, each query, loop or hot path with file:line,
the index that serves it (or none), call rate x rows touched at 1M
users, EXPLAIN plans when run, recommendations.
```

### Principle 10: Self-Contained Components

```
Review the diff for violations of the SELF-CONTAINED COMPONENTS principle.

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: Temporary, optional, or removable features should be
self-contained. Removing or adding the feature should require touching
as few files as possible — ideally ONE.

Problems with non-self-contained components:
- Removing a feature requires changes across multiple files
- Easy to forget to revert all related changes
- Creates hidden dependencies between files

WHAT TO CHECK:
1. Get the full diff: git diff {diff_range}
2. Identify temporary/optional elements (banners, promos, feature flags,
   announcements, experimental features)
3. For each: check if adding it required changes to other files (layout
   adjustments, configuration, hardcoded offsets)
4. Simulate removal: how many files would need changes?
5. Look for hardcoded values that depend on optional components

GOOD PATTERNS: CSS variables with fallbacks, self-registering plugins,
configuration-driven features, components that own their own layout impact.

BAD PATTERNS: Hardcoded layout offsets for optional elements, manual
adjustments in unrelated files, constants imported from temporary code,
state threading through unrelated modules.

OUTPUT: PASS/WARN/FAIL status, temporary/optional components found,
self-containment issues with file:line, number of files that would need
changes on removal, recommendations.
```

### Principle 11: Data Layer Consistency

```
Review the diff for violations of DATA LAYER CONSISTENCY.

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: Whatever data-fetching or state-management layer the
project uses, new code must follow its established patterns consistently.
Inconsistency here causes LLMs to proliferate competing approaches.

WHAT TO CHECK:
1. Get the full diff: git diff {diff_range}
2. Identify the project's data layer (e.g., TanStack Query, SWR, Redux,
   Apollo, tRPC, Zustand, REST clients, ORM patterns — whatever is used)
3. Find the project's exemplar files for data access patterns
4. Check new code against the established patterns:
   - Cache/query key structure: consistent with existing keys?
   - Mutation/write patterns: follow the project's approach?
   - Loading/error state handling: consistent?
   - Data invalidation/refresh: follows established patterns?
   - Optimistic updates: uses the project's approach?
5. Flag any new data-access patterns that diverge from exemplars
6. Check for direct API calls that bypass the established data layer

If the diff contains no data-layer changes, report N/A.

OUTPUT: PASS/WARN/FAIL/N/A status, pattern violations with file:line
references, exemplar files used as reference, divergent patterns found,
recommendations.
```

### Principle 12: Spec Fidelity

```
Review the diff for SPEC FIDELITY — does this change actually implement
what was asked for?

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: A change can be beautifully written and still wrong if it
doesn't match the spec. This axis is deliberately separate from code
quality so a clean code pass cannot hide a wrong feature.

WHAT TO CHECK:
1. Get the full diff: git diff {diff_range}
2. Find the spec source — look for:
   a. Issue references in commit messages (#123, Closes #45, etc.)
      and fetch them via gh issue view
   b. PR description and linked issues
   c. Spec files under docs/, specs/, .scratch/ matching the branch
3. Write one line: "this change claims to X"
4. Check every requirement in the spec against the diff:
   a. Requirements the spec asked for that are missing or partial
   b. Behavior in the diff that wasn't asked for (scope creep)
   c. Requirements that look implemented but where the implementation
      looks wrong
5. Quote the spec line for each finding

If no spec/issue can be found, report "no spec available" and skip —
do not invent requirements.

OUTPUT: PASS/WARN/FAIL/SKIPPED status, the one-line claim, missing
requirements with spec quotes, scope creep findings, wrong
implementations with spec quotes, recommendations.
```

### Principle 13: Security Boundaries & PHI

```
Review the diff for SECURITY BOUNDARY violations and PHI exposure.
This principle runs on every review, whatever the size.

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: Every value that originates outside the process — user
input, client data, LLM output, webhook, file, external API — crosses
a trust boundary. Each boundary needs a control at the sink. Map
boundaries first, then check controls.

WHAT TO CHECK:
1. Get the full diff: git diff {diff_range}
2. List every value in the diff that originates outside the process as
   source → sink (e.g. "query param id → SQL WHERE", "form field →
   HTML render", "webhook body → business logic")
3. For each boundary, verify a control exists:
   - SQL/queries: parameterized, never string-concatenated
   - Shell/subprocess: array-arg APIs, no string-built commands
   - File paths: join + canonicalize + prefix check (traversal defense)
   - HTML rendering: escaped by default; any raw-HTML sink needs
     justification
   - URLs the server fetches: scheme + host validated (SSRF defense)
   - Deserialization: try/catch + shape validation
4. For each mutating endpoint, verify:
   - Authentication: WHO is calling (check is in code, not assumed)
   - Authorization: MAY they touch THIS object (ownership/membership
     check on the specific row, not just "is logged in")
   - Client-supplied identity/scope fields are never trusted
5. Check for secrets:
   - No hardcoded tokens, keys, or credentials
   - No secrets in client bundles or logs
   - No raw provider errors exposed to users
6. Flag dangerous defaults:
   - Token comparison with == instead of constant-time compare
   - Missing rate limiting on expensive endpoints
   - CORS * on authenticated routes
   - Cookies without httpOnly/secure/sameSite
7. Map PHI the same way, in every repository, declared or not. Sources:
   any field or record about a person's health or care (diagnosis,
   condition, medication, procedure, lab result, clinical note,
   insurance or member id, or a patient record joined to a name,
   contact or date). Sinks: logs, error messages and error trackers,
   analytics and telemetry events, caches, URLs and query strings,
   third-party APIs, and client storage (localStorage, cookies,
   IndexedDB). Controls: leave it out, redact or hash it, or send it
   only to an approved store over an authorized path.

A boundary with no control is a finding. Every finding names the
source, the sink, and the missing control (e.g. "source
patient.diagnosis → sink logger.error → missing control redaction";
"source query param q → sink exec() string → missing control argument
array"). Drop any that cannot name all three. PHI reaching a sink
without a control is always Must-Fix.

OUTPUT: PASS/WARN/FAIL status, boundary map (source → sink → control,
PHI included),
missing controls with file:line, auth gaps, secret exposures,
dangerous defaults, recommendations.
```

### Principle 14: Test Integrity

```
Review the diff for TEST INTEGRITY — does each test actually prove
something about real behavior?

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: A test exists to catch a real regression. A test that
passes whether the code works or not is worse than no test — it gives
false confidence and costs maintenance. Every test should answer: "if
production broke in this way, would this test fail?"

WHAT TO CHECK:
1. Get the full diff: git diff {diff_range}
2. Read every new or modified test file completely
3. For each test, check:

   MOCK THEATER: Is the test mocking so aggressively that it only
   proves the mock works? Signs:
   - Mocking the thing being tested (testing that a stub returns what
     you told it to return)
   - Mocking every dependency so the test exercises zero real code paths
   - Assertions that check the mock was called, not that the behavior
     is correct
   - A test that would still pass if you deleted the implementation

   MEANINGLESS ASSERTIONS: Does the assertion prove anything?
   - Checking truthiness instead of specific values
   - "expect(result).toBeDefined()" on something that can never be
     undefined
   - Snapshot tests on volatile output (timestamps, IDs, random values)
   - Assertions that restate the setup ("set X to 5, assert X is 5")

   DEAD ON ARRIVAL: Would this test catch a regression?
   - Flip the logic in the code under test — does the test fail? If
     you can't tell from reading it, flag it
   - Tests with no assertions or only try/catch with no rethrow
   - Tests that catch errors and assert nothing about them
   - Commented-out assertions or skipped tests committed as passing

   COPY-PASTE TESTS: Tests that are slight variations of each other
   with only one value changed, when a parameterized/table-driven test
   would be clearer and more maintainable

If the diff contains no test changes, report N/A.

OUTPUT: PASS/WARN/FAIL/N/A status, theater tests with file:line and
what they actually prove (nothing), meaningless assertions, tests that
would pass with broken code, recommendations for what each test should
assert instead.
```

### Principle 15: Test Strategy

```
Review the diff for TEST STRATEGY — are we testing the right things,
at the right level, without waste?

PROJECT_CONTEXT: {project_context}
Changed files: {file_list}

THE PRINCIPLE: Good test strategy means testing what matters at the
cheapest level that still proves it. The critical user-facing path
needs coverage. Internal implementation details don't. Redundant tests
that duplicate what the type system or another test already covers are
wasted lines of code.

WHAT TO CHECK:
1. Get the full diff: git diff {diff_range}
2. Identify what the PR changes functionally — the actual behaviors
   that could break in production
3. Check test coverage strategy:

   MISSING CRITICAL COVERAGE: What user-facing behavior changed but
   has no test?
   - New API endpoints with no integration test
   - New UI flows with no end-to-end or component test
   - Error paths that could affect users (payment failures, auth
     errors, data loss scenarios) with no test
   - Edge cases explicitly handled in the code but not tested

   WRONG LEVEL: Is the test at the right altitude?
   - Unit-testing a database query by mocking the database (should be
     an integration test against a real DB or in-memory equivalent)
   - End-to-end test for pure logic that could be a unit test
   - Testing framework internals instead of application behavior

   REDUNDANT COVERAGE: Is this test proving something already proven?
   - A test that checks the same thing a TypeScript type already
     enforces
   - Multiple tests for the same behavior at different levels with no
     additional confidence gained
   - Tests for trivial getters/setters or pass-through functions
   - Tests that duplicate what the project's lint rules already catch

   PRODUCTION FIDELITY: Does the test environment reflect reality?
   - Test data that's nothing like production data (single-character
     strings, sequential IDs starting at 1, empty optional fields)
   - Missing concurrency — testing a concurrent system sequentially
   - Environment differences that would hide real bugs (different DB
     engine, disabled auth, relaxed validation)

If the diff contains no test changes AND no testable behavior changes,
report N/A. If behavior changed but no tests were added, that's a
finding.

OUTPUT: PASS/WARN/FAIL/N/A status, missing critical coverage (what
should be tested and isn't), wrong-level tests, redundant tests that
should be deleted, production fidelity gaps, recommendations.
```

## Step 4: Aggregate Results

After the started agents complete, aggregate into a final report:

```markdown
# Principled Review: {branch}

## Overall: {PASS/WARN/FAIL}

| # | Principle | Status | Issues |
|---|-----------|--------|--------|
| 1 | Reuse Over Recreation | {status} | {count} |
| 2 | Clarity & Readability | {status} | {count} |
| 3 | Correct Scope | {status} | {count} |
| 4 | No Anti-Patterns | {status} | {count} |
| 5 | Single Way to Do Things | {status} | {count} |
| 6 | Backend Conventions | {status} | {count} |
| 7 | Frontend Conventions | {status} | {count} |
| 8 | Documentation Standards | {status} | {count} |
| 9 | Query, Data & Hot-Path Cost | {status} | {count} |
| 10 | Self-Contained Components | {status} | {count} |
| 11 | Data Layer Consistency | {status} | {count} |
| 12 | Spec Fidelity | {status} | {count} |
| 13 | Security Boundaries & PHI | {status} | {count} |
| 14 | Test Integrity | {status} | {count} |
| 15 | Test Strategy | {status} | {count} |

Ran: {n, names} · Skipped: {names - reason each, or "none"}

## Critical Issues (Must Fix)
{Aggregate critical issues from all agents}

## Warnings
{Aggregate warnings from all agents}

## Detailed Reports
{Each agent's full report under its principle heading}
```

## Scoring Rules

- Any agent FAIL → overall FAIL
- Any agent WARN (none FAIL) → overall WARN
- Principle 5 (Single Way) violations are weighted most heavily
- Skipped principles count as N/A
- Principles 6, 7, 9, 11 report N/A when their domain has no changes — N/A
  does not affect the overall score
- Principle 12 reports SKIPPED when no spec/issue is found
- Mismatched data-layer patterns (Principle 11) are CRITICAL severity
- Security boundary gaps (Principle 13) with no control are CRITICAL severity
- A missing index, unbounded scan or data-sized loop on a hot path
  (Principle 9) is CRITICAL severity
- PHI reaching a sink without a control (Principle 13) is CRITICAL
  severity
- Principles 14, 15 report N/A when the diff contains no test changes and
  no testable behavior changes
- Test theater (Principle 14) — tests that pass with broken code — is a
  CRITICAL finding
