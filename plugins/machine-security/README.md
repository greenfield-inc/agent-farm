# machine-security

Scan the Mac or Windows PC you're working on for security problems and keep it hardened. One profile, `machine-security/audit`, picks the skill for the system it runs on: `mac-security-check` on macOS, `windows-security-check` on Windows. Each one runs a read-only scan, writes a report ordered by risk, and applies fixes only after you approve each command.

## Install and start

```sh
agent-farm plugin install machine-security
agent-farm run machine-security/audit --message "Check this computer"
```

Neither scan needs anything installed or elevated rights. You can also run them without an agent:

```sh
# macOS: the system bash 3.2, never sudo
bash ~/.config/agent-farm/plugins/machine-security/skills/mac-security-check/scripts/check.sh --text
```

```powershell
# Windows: Windows PowerShell 5.1 or PowerShell 7, as a standard user. Bypass applies to this one process.
powershell -NoProfile -ExecutionPolicy Bypass -File "$HOME\.config\agent-farm\plugins\machine-security\skills\windows-security-check\scripts\check.ps1" --text
```

## Profile

| Profile | Model | Does |
| --- | --- | --- |
| `audit` | Opus 5.5 high | Runs the scan for its OS, looks closer where the script can't decide, reports Fix now / Prune / Harden habits, records exceptions you accept, and applies the fixes you approve one command at a time |

Agent Farm launches agents without permission prompts (see [docs/operations.md](../../docs/operations.md)). The agent's instructions are the gate instead: read-only until you approve a specific command, no sudo and no elevation (it gives you the command to run), no secret values printed, files moved to the Trash or Recycle Bin instead of deleted, and findings kept on the machine.

## What the scans cover

**Mac:** macOS updates and automatic update settings, FileVault, SIP, Gatekeeper, firewall and stealth mode, screen lock, XProtect, configuration profiles, sharing services, AirPlay Receiver, processes listening on all interfaces, tunnels and Tailscale Serve and Funnel, the contents of launch agents and daemons, login items, system extensions, recently dropped executables, shell startup files that fetch remote code, and unused apps. [Mac check reference](skills/mac-security-check/references/checks.md).

**Windows:** patch age, pending reboots and Windows Update, Defender (real-time protection, definitions, tamper protection) and third-party antivirus, BitLocker, firewall profiles, Remote Desktop and NLA, OpenSSH Server, WinRM, Remote Registry, Remote Assistance, SMB shares and SMBv1, programs listening on all interfaces, Run keys, Startup folders, scheduled tasks, services in user-writable paths, WMI subscriptions, signatures of what those run, UAC, SmartScreen, Secure Boot, LSA protection, Credential Guard, execution policy, remote-access tools, WSL distros, secrets in PowerShell profiles, PSReadLine history and environment variables, Credential Manager (counted only), file ACLs on credential files, Docker's unauthenticated TCP API, editor Workspace Trust and winget upgrades. [Windows check reference](skills/windows-security-check/references/checks.md).

**Both:** inline secrets in shell startup files and history, cloud and registry credentials, credential file permissions, `.env` files and their backups, service-account keys, SSH keys and config, Git credential storage and GitHub CLI scopes, npm and pnpm release-age and install-script settings, pip extra indexes, editor and browser extensions, Claude Code and Codex permission settings, MCP server pinning and inline credentials, Docker exposure, stale checkouts that still hold secrets, and a production kubectl default. These share check ids and rules across the two scans.

| Mode | Time | Adds |
| --- | --- | --- |
| `--fast` (default) | Mac usually 10 to 30 s; both stop at a 60 s budget | Mac: never triggers a macOS permission dialog. Both: search only your repo roots |
| `--deep` | one to several minutes | Mac: live Apple update check, login items (asks for Automation access), a home-wide search including Desktop, Documents and Downloads, deprecated Homebrew packages, Docker disk use. Windows: Windows Update search, winget upgrades, signatures of every non-Windows service binary, a search of the whole user profile |

`--offline` skips the network, `--diff` shows what changed since the last run, `--text` gives readable lines instead of NDJSON, and `--roots` names where your checkouts live (default: whichever of `~/repos ~/src ~/code ~/projects ~/dev ~/work ~/git ~/Developer ~/workspace` exist, plus `~\source\repos` on Windows). Windows separates roots with `;` and skips any inside OneDrive, so the scan never downloads cloud-only files. `--help` lists every option.

## Files they use

| Path | What |
| --- | --- |
| Mac `~/.local/state/mac-security-check/last-<mode>.ndjson`, Windows `%LOCALAPPDATA%\windows-security-check\last-<mode>.ndjson` | The baseline for `--diff` (mode 0600 on a Mac; inside your own profile on Windows). `--no-save` skips it |
| Mac `~/.config/mac-security-check/allow.tsv`, Windows `%APPDATA%\windows-security-check\allow.tsv` | Your accepted exceptions: check id, subject glob, reason and expiry date, tab-separated. Accepted findings show as INFO until they expire |

Every string a scan prints goes through one redaction step: token shapes, `KEY=value` credentials, bearer headers and URL passwords become `[REDACTED]`, control characters and non-ASCII bytes are removed, and your home folder is shown as `~`. Findings are counts, line numbers and paths.

## Development

`tests/machine-security.test.mjs` runs both scripts' classifiers and parsers against fixtures, plus a full scan of a planted home folder:

- The Mac script's tests run on macOS and Linux (the macOS-only checks report SKIP on Linux) and are skipped on Windows.
- The Windows script's tests run wherever PowerShell is installed, under `pwsh` on macOS and Linux and under both Windows PowerShell 5.1 and `pwsh` on Windows. The Windows-only checks report SKIP elsewhere. On Windows, a real `--fast --offline` scan of the CI runner also runs. The tests parse the script, and run PSScriptAnalyzer, including its 5.1 syntax rule, when the module is installed.

Run `shellcheck` on `check.sh` after changing it, and bump `version` in `plugin.yaml` with each change.
