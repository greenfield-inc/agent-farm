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

Codex launches also pass `-c check_for_update_on_startup=false`, so a Codex tab
never opens on Codex's "Update available" screen. Update Codex yourself, for
example with Homebrew. ACP launches start Codex's app server, which shows no
update screen.

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

[CONFIGURATION.md](../CONFIGURATION.md#your-own-mcp-servers) says which launches
also load MCP servers you set up yourself: Codex without a host provider always
does, and the `inherit` opt-in adds them elsewhere. Those servers run with the
agent's permissions. Under `inherit`, Claude also starts the servers in the
repository's `.mcp.json` without its approval prompt, because launches run with
`--dangerously-skip-permissions`; use `inherit` only in repositories you trust.

### MCP sign-ins before launch

Before each launch (`run`, `--exec`, `--print-launch` and `--print-acp`; not
`--explain`), Agent Farm asks the native harness whether it holds a sign-in for
every `auth: native` connection the agent would get. It never reads or prints a
token:

- Codex: `codex mcp list --json` with the connections passed as `-c` overrides,
  against the original Codex home. Codex looks in its credential store before the
  network, so the check is fast and works offline.
- Claude: `claude mcp get` for each connection, in parallel, from the same private
  folder `mcp login` uses. This connects to each server, so a confirmed sign-in is
  remembered for an hour in `~/.cache/agent-farm/claude-mcp-signins.json`.

A connection the harness reports as not signed in is left out of that launch. The
agent's instructions say it is unavailable and not to sign in, and the launch
prints one line on stderr with the command that signs in, for example
`agent-farm mcp login linear --directory /path/to/repo`. Each path in that
command is quoted so that pasting it runs nothing inside the path; on Windows, a
path that cmd or PowerShell would expand is shown as a placeholder to fill in.
`mcp login` finds only workspace connections, so for a connection set in an agent
definition, use the harness's own MCP login. A connection left out still turns off
the project's `mcp-remote` bridge for the same server. The check fails open: if
the harness is missing, errors, or does not answer within a few seconds, the
connection stays in and nothing is printed. Set `AGENT_FARM_SIGNIN_CHECK=off` to
skip the check, for example on an offline machine. Native Codex subagents are
checked with the launch, including connections only they declare; when one is
left out, the subagent gets a copy of its config without it, under
`~/.cache/agent-farm/native-children/`. Native Claude subagents share the
parent's servers and get the same note.

`agent-farm doctor` runs the same check for the current directory's workspace and
lists each missing sign-in with its login command. `agent-farm inspect` reports
configured connections, not whether they are authenticated or reachable.

### gcloud sign-in before launch

When the launch environment sets `CLOUDSDK_ACTIVE_CONFIG_NAME` or
`GOOGLE_APPLICATION_CREDENTIALS`, each launch (the same ones as above; not
`--explain`) asks gcloud whether those identities can still get a token:
`gcloud auth print-access-token` for the configuration and
`gcloud auth application-default print-access-token` for the credentials file,
both at once, each stopped after 10 seconds. The token gcloud prints is discarded
unread. An identity whose error says it needs a new sign-in, or that its credentials
file is not valid credentials, is lapsed: the agent's
instructions (and its native subagents') say gcloud is unavailable, not to run or
retry it, and to report blocked once asking the person to sign in again, and the
launch prints one line on stderr naming each lapsed identity. Agent Farm does not
know your sign-in command; run your own.

Each result is kept for 10 minutes in `~/.cache/agent-farm/gcloud-identities.json`
(state, time and an error class, never a token or gcloud's output), so a new
sign-in shows up in launches within 10 minutes. Parallel launches share one probe
through a lock file next to it. The check fails open: a missing gcloud, a timeout,
or an error that is not about the sign-in adds no note and prints nothing. Set
`AGENT_FARM_GCLOUD_CHECK=off` to skip it.

`agent-farm doctor` has a gcloud section with one row per identity in its
environment: `✓` ok, `✗` lapsed, or `?` could not check. It asks gcloud afresh
rather than reading the 10-minute cache, and stores what it learns for launches.

## Generated bundles and isolation

Launch bundles live in `.agent-farm/generated/` under the launch directory
(`--directory`, or the current directory), and snapshots in
`.agent-farm/snapshots/`. Ignore both in Git, and keep bundles and snapshots
that running sessions still use: a launch refuses a deleted snapshot.

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

The bundled default plugin is `greenfield`. Users run `agent-farm plugin install`
after upgrading, plus `agent-farm plugin install NAME` for each other bundled
plugin they use (`orchestra`, `machine-security`). `agent-farm plugin list` shows each installed plugin's name,
version, source, and profile count. For install, uninstall, and collision
behavior, see [CONFIGURATION.md](../CONFIGURATION.md#plugins).

## Limits

Configuration validation does not prove that a model is available, that MCP
servers are reachable, or that every selected skill runs successfully.
Subscription rotation, automatic cross-harness handoffs, and hosted daemon
orchestration are not implemented. Telemetry is local only; there is no remote
exporter.
