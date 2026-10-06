# Audit criteria

Shared audit criteria used by the audits skill. This file is
project-agnostic. Step 2 of the skill (discovery) tells the auditor how to
find and apply repo-specific sources. Apply only surfaces that exist here
and that the launch `surface` argument selected (`all` means every surface
below that has data).

---

## 0. Discovery (required first)

Before applying any section below, derive the project's actual floor from
the repo itself:

1. **AGENTS.md / CLAUDE.md** - commands agents run, forbidden patterns
2. **Generated contracts** - `package.json` generate scripts, `contracts/`,
   `agentContext.managedBlock`, committed `AGENTS.md` HTML comment blocks
3. **Manifests and CI** - engines, package manager, workflows
4. **Plugin graph** - `profiles/`, `agents/`, `skills/`, `plugin.yaml`

Where the derived floor conflicts with a generic note below, the repo wins.
State the override in the report.

---

## 1. Issues

List open issues:

```bash
gh issue list --repo "$repo" --state open --limit 200 \
  --json number,title,url,createdAt,updatedAt,labels,author,commentsCount
```

Note age, idle time, labels, and titles. Pull likely-done candidates:

- Titles that match shipped features
- Canaries that say "safe to close after verification"
- CI/tooling migrations whose deadline has passed
- Refactors of code that no longer exists
- Issues whose linked PR already merged
- Exact duplicates of an earlier open issue

For each candidate, prove or disprove on the default branch. Skip umbrellas
with unshipped commands, bugs with live matching PRs, and "looks old"
feature requests with no landing evidence.

| Bucket | Close when |
| --- | --- |
| Shipped | The asked behavior is on the default branch |
| Duplicate | Same ask as an earlier open issue |
| Superseded | A later design covers the job; this API/approach is abandoned |
| Canary | The verification path already succeeded in later filings |

Partial ships stay open unless the headline landed. Name the leftover.

---

## 2. Open PRs

List open PRs:

```bash
gh pr list --repo "$repo" --state open --limit 100 \
  --json number,title,url,createdAt,updatedAt,isDraft,headRefName,baseRefName,mergeable,commits,files
```

For each candidate, compare to default:

- Unique leftover vs already merged elsewhere
- Head behind default by hundreds of commits with no unique files
- Targets a deleted base branch
- Duplicate of a merged PR
- Draft that was superseded by a later design
- Publisher / plugin snapshots that would delete farm-only files (report,
  do not merge)

| Bucket | Recommend when |
| --- | --- |
| Superseded | A later merged PR or shipped design covers it |
| Duplicate | Same head/ask as an open or merged PR |
| Abandoned behind | No unique leftover; head is far behind default |
| Canary | Author marked it closeable after verification that already passed |

Do not close a PR that still holds the only copy of a fix. Do not delete
its branch unless the user asks. Recommend draft vs close; the user picks.

---

## 3. Agent docs

Target files that agents actually follow:

- `AGENTS.md`, `CLAUDE.md`, nested `CLAUDE.md`
- Managed `pane-agent-context` / similar injected HTML comment blocks
- Package READMEs and `docs/` that copy command lists or architecture
- Help dialogs or in-app copy that teach commands or data models when
  those files are in-repo

For each claim that would change an agent's next command or data model:

1. Quote the claim (file + section).
2. Check the default branch: command exists, flags match, types/stores
   still exist, architecture boxes still exist.
3. Classify **wrong**, **stale identity**, **generated-current**, or
   **worktree-only**.

Highest-value misses:

- Command lists that omit the current primitive
- Node/toolchain floors that drifted from `package.json` / CI
- Examples that hardcode one agent brand
- Docs that teach deleted components or APIs
- Clone URLs / `gh --repo` owners that predate a GitHub move

Keep both old and new commands when they are both valid and the doc says
when to use which.

---

## 4. Generated sources

Do not hand-edit generated files. Find the generator first.

Typical sources:

- A contract JSON (or similar) plus `generate-*` script
- Rendered CLI markdown, committed SDK clients, managed `AGENTS.md` blocks
- Agent Farm `plugins/<name>/` snapshots with SHA-256 checksums

If agent context is generated (for example Pane's
`contracts/runpane/contract.json` `agentContext.managedBlock` and
`agentContext.brief.rules`):

1. Change those strings in the source.
2. Run the generate script.
3. Sync the committed `AGENTS.md` block.
4. Confirm with the live reader (`agent-context --json` or equivalent).

Fixing only `AGENTS.md` will be overwritten. If checksums exist, adding a
file without updating `plugin.yaml` fails validation; replacing a generated
plugin tree can delete farm-only profiles. Report that risk; do not publish
a wholesale replace unless the user asked for a full plugin sync.

---

## 5. CI, toolchain, and identity

Compare AGENTS.md/CLAUDE.md floors to what CI and manifests actually use:

- Node, pnpm, Python, or compiler versions
- Workflow files that call deleted scripts or paths
- `package.json` scripts whose targets are missing
- Git remotes, publisher scripts, and docs that still say the old GitHub
  owner after a move
- WSL / platform notes that contradict current code (for example Windows
  watchers over `\\wsl$` when the product forbids them)

Recommend the authored file to change. Do not "fix" CI by weakening a
check.

---

## 6. README, help, and examples

Scan README, `docs/`, and in-repo help for:

- Commands that do not exist on the default branch (`--help`, generated
  contract, or the binary)
- Relative links to files that moved or were deleted
- Setup steps that skip a required generate/build (for example a sandboxed
  preload that cannot load a plain `tsc` emit)

Prefer one-line edits. Do not restyle the README.

---

## 7. Plugin and skill graph

When `profiles/`, `agents/`, and `skills/` exist:

- Every profile `agent:` file exists under `agents/`
- Every agent `skills:` entry exists under `skills/<name>/SKILL.md`
- Native children use the parent harness
- `plugin.yaml` version and checksums match the files on disk if checksums
  are present

Report orphans and broken references. Do not delete experimental profiles
that are farm-only unless the user asked for a full plugin republish.

---

## 8. Labels and milestones (report only)

List milestones and labels that are clearly spent (empty "done" milestone,
migration label whose deadline passed). Recommend; do not delete metadata
until the user picks the list.
