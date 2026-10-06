---
name: business-prepare-release
description: Prepare a reviewed business artifact for release, delivery, or human approval.
---

# Business release preparation

## Rules

- Run a fresh-context review independent of the artifact-stage review.
- Rewrite only where review identifies a concrete problem.
- Verify required patches and human approvals before marking the artifact ready.
- Preparation does not authorize sending or publishing.

## Read

Use supplied paths when present; the defaults are:

- `.business/artifacts/draft.md`
- `.business/reviews/artifact-review.md`
- `.business/artifacts/claim-evidence-ledger.md`
- `.business/specs/ready/spec.md`

## Fresh review

- Would a hostile or distracted recipient find the hole the earlier review missed?
- Does the core ask survive a 20-second skim?
- Is there any claim, number, or commitment we would be embarrassed to defend out loud?
- What did familiarity with this artifact make us stop noticing?
Send real problems back for correction before release.

## Write

- `.business/artifacts/final.md`
- `.business/reviews/release-checklist.md`

## Checklist

- reader and ask are obvious
- opening makes stakes clear
- no unsupported claims remain
- numbers/names/dates/pricing/commitments are consistent
- research-adversary objections addressed or intentionally excluded
- formatting/links/tables/screenshots work
- risks are named instead of hidden
- required human review is done or queued

Queued approval means blocked, not ready to release.

## Document handoff

- Read and update all artifacts in the supplied folder at the document destination your workspace instructions name, or that destination's default folder; pass this storage rule to reviewers and sync their outputs.
- Keep needed local files and privacy limits; without a destination, continue locally silently.
