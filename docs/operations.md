# Operational notes

What to know before running agents through Agent Farm. For configuration
syntax, see [CONFIGURATION.md](../CONFIGURATION.md). For releases, see
[RUNBOOK.md](../RUNBOOK.md).

## Launch permissions

Every launch runs Codex with `--yolo` and Claude with
`--dangerously-skip-permissions`, including headless runs and generated process
children. There is no setting to turn this off. Codex bypasses approval prompts
and sandboxing; Claude bypasses permission checks. Agent Farm does not modify
native global permission settings.

Existing sessions and previously generated standalone child launchers keep the
configuration they were built with. Launch again through Agent Farm to generate
a bundle with the current behavior.

## Authentication and MCP connections

Remote workspace connections use native Claude/Codex authentication. Local stdio
servers use their service's own CLI or application login. Agent Farm has no
OAuth credential store of its own. Native credentials stay outside plugin
sources and generated bundles.

MCP servers are registered under `orchestra_<connection>` names so that native
OAuth credentials created before Agent Farm became a standalone tool keep
working. This is a registration identifier, not a command alias.

`agent-farm mcp login` runs the native login; the native client owns token
storage and refresh (see
[CONFIGURATION.md](../CONFIGURATION.md#local-mcp-servers-and-native-sign-in)).
On macOS, native Keychain credentials can be reused across generated runtime
homes, and existing Codex file-based MCP credentials are linked from the
original home. Other platforms and credential backends are unverified; a
successful macOS login does not prove them.

`agent-farm inspect` reports configured connections, not whether they are
authenticated or reachable. Use the native harness's MCP view to check
connectivity.

## Generated bundles and isolation

Launch bundles live in `.agent-farm/generated/` under the launch directory
(`--directory`, or the current directory). Ignore that directory in Git, and
keep bundles that running sessions still use.

Generated Codex runtime homes link native configuration and authentication
files, and native global skills and tools may remain visible. Bundles let
different agent configurations run in the same directory. They do not isolate
filesystem changes, credentials, or native global configuration. Give
concurrent agents separate worktrees when they should make independent code
changes.

Workspace instructions and connection descriptions are prompt context, not an
access boundary. Telemetry agent access is a tool-availability policy, not a
filesystem sandbox. An instruction telling a child not to delegate is not a
security boundary.

## Plugin rollout

The bundled default plugin is `dcouple`. Users run `agent-farm plugin install`
after upgrading, plus `agent-farm plugin install NAME` for each other bundled
plugin they use. `agent-farm plugin list` shows each installed plugin's name,
version, source, and profile count. For install, uninstall, and collision
behavior, see [CONFIGURATION.md](../CONFIGURATION.md#plugins).

## Limits

Configuration validation does not prove that a model is available, that MCP
servers are reachable, or that every selected skill runs successfully.
Subscription rotation, automatic cross-harness handoffs, and hosted daemon
orchestration are not implemented. Telemetry is local only; there is no remote
exporter.
