---
name: documents
description: Holds bigbrain's page templates, worked examples, JSON schemas and the check-bundle script. Used whenever a step writes a page or a JSON source, changes a page's stage, or checks a bundle or status file.
---

# Documents

Every bigbrain page is built from a template here, carries a `doc-meta` block, and passes `check-bundle` before it changes stage. The `page` skill still owns form (colours, drawing first, layout); this skill owns the skeletons, the machine-readable parts and the checker.

## Write a page

1. Copy `formats/<kind>/template.html` into the bundle at the kind's file name (in `kinds.json`). Read `formats/<kind>/example.html` once for a filled-in page of the same kind.
2. Fill every section. A section that does not apply says "n/a because …"; never delete one. The required section ids are in `kinds.json`.
3. Fill `doc-meta`: `kind`, a kebab-case `id`, `status`, `revision`, `supersedes`, `updated`, the IDs this page `defines` (each also an element `id` on the page, so `decisions.html#D-4` links), the IDs it `cites`, and the counts of open `[NEEDS DECISION` and `[ASSUMPTION` markers.
4. Add the page to `bundle.json`'s `documents`.

Kinds: brief, explainer, options, decisions, cover-sheet, design-notes, mockups, verification, bug-report, sweep, post-mortem, learning, map.

## JSON sources

| File | Schema | Written by | Rule |
| --- | --- | --- | --- |
| `control-flow.json` | `schemas/control-flow.schema.json` | planner | The cover sheet's Control flow section is rendered from it: `<section id="control-flow" data-control-flow-revision="N">` with one `data-step="<id>"` element per step, in order. Never hand-edit the section. |
| `evidence/verification.json` | `schemas/verification.schema.json` | planner (rows), implementer and verifier (results) | One row per J/S with `flow` copied exactly from `control-flow.json`. Results set only verdict, method, evidence, commit and round, and append to the logs. |
| `.agent/status/<role>.json` | `schemas/status.schema.json` | each worker | See `contract.md`. |
| every page | `schemas/doc-meta.schema.json` | the page's writer | The `doc-meta` block. |

The control-flow steps, review-point rules, who runs which step, and how the section renders are in [references/control-flow.md](references/control-flow.md). Read it whenever you write, render, execute or review against a control flow.

## Check

```sh
node <this skill>/scripts/check-bundle.mjs <bundle dir> [--stage draft|approve|done] [--json]
node <this skill>/scripts/check-bundle.mjs --status <status file> [--json]
```

It needs only Node. Exit 0 is pass; each failure names its rule:

| Rule | Fails when |
| --- | --- |
| `bundle-json` | `bundle.json` is missing, or lists a file that does not exist |
| `doc-meta` | a listed page (other than `trace.html`) has no valid `doc-meta` |
| `sections` | a page lacks a required section of its kind |
| `id-anchors` | a defined ID has no element with that id, or the kind may not define that prefix |
| `ids-unique`, `ids-defined` | an ID is defined twice, or a cited or mentioned ID is defined nowhere (the Session map may mention IDs from the bundles it lists) |
| `open-counts` | `doc-meta.open` disagrees with the markers on the page |
| `needs-decision` | a `[NEEDS DECISION` sits on an approved, in-build or done page, or anywhere at `--stage approve` or `done` |
| `links` | a relative link or anchor does not resolve inside the bundle |
| `schema:control-flow`, `control-flow-refs`, `review-points`, `control-flow-render` | the flow is invalid (including a bare `null`, `false`, `0` or `""`), cites unknown IDs, lacks a checkpoint reason, does not end with the end review or its waiver, or the cover sheet's section no longer shows the same steps and facts |
| `schema:verification`, `verification-rows`, `verification-reworded`, `verification-verdicts` | rows are added, removed, reworded, or still pending at `--stage done` |
| `schema:status`, `status-state` | a status file is invalid or its state and blocks disagree |

Run it before reporting any stage change: `--stage approve` before relaying a cover sheet for approval, `--stage done` before reporting done. The orchestrator runs `--stage approve` itself before it relays an approval. Paste the result line into your report.
