# machine-security

Scan the Mac you're working on for security problems and keep it hardened. One profile, `machine-security/audit`, runs the `mac-security-check` skill: a read-only scan, a report ordered by risk, and fixes applied only after you approve each command.

## Install and start

```sh
agent-farm plugin install machine-security
agent-farm run machine-security/audit --message "Check this Mac"
```

The scan is a bash script that runs on the macOS system bash, needs no install and never uses sudo. You can also run it without an agent:

```sh
bash ~/.config/agent-farm/plugins/machine-security/skills/mac-security-check/scripts/check.sh --text
```

## Profile

| Profile | Model | Does |
| --- | --- | --- |
| `audit` | Opus 5.5 high | Runs the scan, looks closer where the script can't decide, reports Fix now / Prune / Harden habits, records exceptions you accept, and applies the fixes you approve one command at a time |

Agent Farm launches agents without permission prompts (see [docs/operations.md](../../docs/operations.md)). The agent's instructions are the gate instead: read-only until you approve a specific command, no sudo (it gives you the command to run), no secret values printed, files moved to the Trash instead of deleted, and findings kept on the machine.

## What the scan covers

macOS updates and automatic update settings, FileVault, SIP, Gatekeeper, firewall and stealth mode, screen lock, XProtect, configuration profiles, sharing services, AirPlay Receiver, processes listening on all interfaces, tunnels and Tailscale Serve and Funnel, the contents of launch agents and daemons, login items, system extensions, recently dropped executables, shell startup files that fetch remote code, unused apps, inline secrets in dotfiles and history, cloud and registry credentials, credential file permissions, `.env` files and their backups, service-account keys, SSH keys and config, Git credential storage and GitHub CLI scopes, npm and pnpm release-age and install-script settings, pip extra indexes, Homebrew, editor and browser extensions, Claude Code and Codex permission settings, MCP server pinning and inline credentials, Docker exposure, stale checkouts that still hold secrets, and a production kubectl default. [The check reference](skills/mac-security-check/references/checks.md) lists every check id.

| Mode | Time | Adds |
| --- | --- | --- |
| `--fast` (default) | usually 10 to 30 s, 60 s budget | Never triggers a macOS permission dialog; searches only your repo roots |
| `--deep` | one to several minutes | Live Apple update check, login items (asks for Automation access), a home-wide search including Desktop, Documents and Downloads (may ask for access), deprecated Homebrew packages, Docker disk use |

`--offline` skips the network, `--diff` shows what changed since the last run, `--text` gives readable lines instead of NDJSON, and `--roots` names where your checkouts live (default: whichever of `~/repos ~/src ~/code ~/projects ~/dev ~/work ~/git ~/Developer ~/workspace` exist). `check.sh --help` lists every option.

## Files it uses

| Path | What |
| --- | --- |
| `~/.local/state/mac-security-check/last-<mode>.ndjson` | The baseline for `--diff`, mode 0600. `--no-save` skips it |
| `~/.config/mac-security-check/allow.tsv` | Your accepted exceptions: check id, subject glob, reason and expiry date, tab-separated. Accepted findings show as INFO until they expire |

Every string the scan prints goes through one redaction step: token shapes, `KEY=value` credentials, bearer headers and URL passwords become `[REDACTED]`, control characters are removed, and your home folder is shown as `~`. Findings are counts, line numbers and paths.

## Development

`tests/machine-security.test.mjs` runs the script's classifiers and parsers against fixtures, and a full scan against a fixture home folder, on macOS and Linux (the macOS-only checks report SKIP there). They are skipped on Windows. Run `shellcheck plugins/machine-security/skills/mac-security-check/scripts/check.sh` after changing the script, and bump `version` in `plugin.yaml` with each change.
