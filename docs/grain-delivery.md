# Grain save behavior

Agent Farm's compiler appends `src/grain-policy.ts` to every agent's instructions.
The compiled manifest, instruction files and native child prompts carry the same
policy. This applies to greenfield, bigbrain, orchestra, dcouple and local agents,
without modifying published or generated plugin snapshots. Existing bundles are
immutable; rebuild/relaunch an agent to receive changed instructions.

Save and checkpoint normally, but open, reveal, focus, reopen or refresh Grain
only when the user explicitly asks for that UI action. Return private links
without visiting them. Read back files/history to verify delivery. Preserve
destination selection, stable IDs, organization/folder, local-only requests and
access restrictions. Requested open-in-Pane behavior is unaffected.

## Supported workflow and upstream boundary

Inspected the installed `@grain/cli` package version **0.4.1** (the managed
wrapper's version comment is independently **0.2.4**). No Grain UI was launched.
These implementation paths are relative to that CLI package, not Agent Farm:

- `dist/operations/registry.js`: `grain_new` maps to `new --checkout --no-open`;
  `grain_push` with `reload:false` maps to `push --no-reload`.
- `dist/commands/push.js`: both the static-content path and runtime path guard
  first-open **and** refresh with `noReload`. The post-upload failure path also
  uses that guard. Disabling reload does not disable upload or revision recording.
- `dist/operations/artifact.js`: `grain_artifact` creates a hidden checkout,
  writes HTML, then calls `pushCommand` with no `--no-reload`. Its strict input
  schema exposes no suppression parameter. A skill instruction cannot suppress
  that internal push. Use new/edit/push instead, even for a small HTML report.
- The same module's `grain_artifact_update` commits an existing HTML revision
  directly and fast-forwards a clean local checkout; it makes no UI handoff.
  Keep `expectedRevisionId` for conflict protection.

For a new artifact use `grain_new`, edit its returned checkout and call
`grain_push` with `reload:false`. For updates, reuse the workspace ID,
`grain_checkout`, edit and push with `reload:false`. CLI equivalents are
`new --checkout --no-open` and `push --no-reload`, with explicit workspace on
updates/pushes. Do not use continuous sync to bypass the handoff.

Other Grain versions must be checked for equivalent behavior. If a version's
push opens unconditionally despite `reload:false`, Agent Farm cannot fix that
through instructions: retain the local draft and report delivery blocked.
The separate upstream Grain dependency is a no-open option on
`grain_artifact` propagated to its internal push, plus tool/server guidance that
separates saving from UI handoff. Agent Farm neither patches installed Grain
code nor claims to change its defaults. These instructions guide agent choices;
they are not a runtime interception of arbitrary Grain calls.

## Audit and behavior matrix

Audited prepare-pr, review, report and artifact paths. Greenfield's page skill
already says to open when asked; its prepare-pr/review/session-trace workflows
publish through destination skills. Bigbrain copies those workflows and owns
the documents workflow. Orchestra's artifact-storage, PR-writing, wrap-up and
review/report paths delegate to installed Grain guidance. Dcouple's
`create-ticket` says to open the draft and `astra-ticket` says “Open Grain last
when connected”; other artifact/report skills also delegate to Grain.
The shared compiled instruction explicitly overrides these automatic UI steps.
No snapshot edits or resync are needed: the policy is applied after resolution
to every node, including generated/mirrored workflows. Dcouple source wording
belongs to `greenfield-inc/skills`; it remains a separate source cleanup.

| Request | Save path | UI action | Evidence |
| --- | --- | --- | --- |
| Save a new report without opening | new checkout/no-open, edit, push/no-reload | None | Registry mapping and both push guards inspected |
| Update an existing grain without reopening or refreshing | checkout same ID, edit, push/no-reload; HTML update with expected revision is also supported | None | Push guards and direct HTML commit inspected |
| Open Grain explicitly | grain_open, or requested named-tab operation | Requested action only | Open operation remains available; no tool filtering |
| Open in Pane explicitly | Existing Pane workflow | Requested Pane action | Policy preserves destination-specific opening |
| Save with a tool lacking suppression | Keep local work; use supported checkout/push or report blocker | None | Artifact schema/internal push inspected |

Compiler regression tests cover Claude/Codex × native/process children,
persisted instructions and native prompts, unchanged skill copies, retained
role guidance and connections. This validates instruction delivery, not model
obedience or a live Grain save. No live save/open/restart is part of QA.
