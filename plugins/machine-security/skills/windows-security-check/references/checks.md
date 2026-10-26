# Checks

Every finding has a stable `id`. Allowlist lines and `--diff` key on the id plus the finding's `subject`, the thing it is about (a path, a registry value, a task, a server name). "Deep" means the check runs only with `--deep`; every other check runs in the default `--fast` scan. The scan runs as a standard user. A check that needs admin, needs a missing tool, or doesn't apply reports SKIP with the reason, and for admin-only checks the command to run in an elevated PowerShell.

Levels are the most severe the check gives. Most checks also report PASS or INFO. Ids shared with the Mac scan (`secrets.*`, `ssh.*`, `git.*`, `packages.*`, `agents.*`, `stale.*`, `cloud.*`) mean the same thing on both.

## os and defender

| id | Level | What |
| --- | --- | --- |
| `os.version` | INFO | Windows edition, version and build with its update revision |
| `os.patch-age` | FAIL | Days since the newest installed update (`Get-HotFix`): WARN after 40, FAIL after 75 |
| `os.reboot-pending` | WARN | Updates are installed but wait for a restart |
| `os.updates` | FAIL | Pending security or cumulative updates from a Windows Update search (deep, not with `--offline`). Definition updates are `os.updates-definitions` (WARN), drivers `os.updates-driver` and feature updates `os.major-upgrade` (INFO) |
| `os.bitlocker` | FAIL | BitLocker is off on the system drive, read without admin from the shell's `System.Volume.BitLockerProtection` property (INFO with `--role server`). Unknown states are SKIP with `manage-bde -status` |
| `defender.status` | FAIL | Defender antivirus is off and no other antivirus is on. INFO when a third-party product is active |
| `defender.realtime`, `defender.signatures` | FAIL | Real-time protection off; definitions over 7 days old (WARN over 3) |
| `defender.tamper` | WARN | Tamper protection is off |
| `defender.third-party` | INFO | Antivirus products registered with Security Center, on or off, up to date or not |

## network and sharing

| id | Level | What |
| --- | --- | --- |
| `network.firewall` | FAIL | A firewall profile (Domain, Private, Public) is off |
| `network.firewall-inbound` | FAIL | A profile allows inbound connections by default |
| `sharing.remote-desktop`, `sharing.rdp-nla` | WARN | Remote Desktop is on (INFO with `--role server`); it accepts connections without Network Level Authentication |
| `sharing.remote-assistance` | WARN | Remote Assistance invitations are allowed |
| `sharing.ssh-server`, `sharing.winrm`, `sharing.remote-registry` | WARN | The OpenSSH Server, WinRM or Remote Registry service is running or starts automatically |
| `sharing.smb-share` | WARN | A shared folder other than the built-in `$` shares (`Get-SmbShare`, or `net share` without admin) |
| `sharing.smb1-server` | FAIL | The SMBv1 server is on |
| `sharing.smb1-client` | WARN | The SMBv1 client driver is enabled |
| `network.listening-all` | WARN | A non-Windows program listens on all interfaces. Ports whose owner isn't visible are INFO |
| `network.tunnel` | INFO | ngrok, cloudflared, frpc, bore or zrok is running |

## persistence

Every command below is classified the same way. FAIL when it runs from a temp or public folder, runs an encoded PowerShell command, downloads from the network (`iwr`, `irm`, `DownloadString`, `curl`, `certutil -urlcache`, `bitsadmin`), or uses `mshta`, `regsvr32 /i:http` or `rundll32 javascript:`, or when the program's signature doesn't match the file. WARN for `iex`, Windows Script Host scripts, hidden PowerShell windows, programs in Roaming AppData, Downloads or the top of ProgramData, a missing program, or an unsigned program outside `C:\Windows`.

| id | Level | What |
| --- | --- | --- |
| `persistence.run-key` | FAIL | Run and RunOnce values in HKCU and HKLM (including WOW6432Node) |
| `persistence.startup-folder` | FAIL | Items in the user and common Startup folders, with shortcuts resolved to their targets |
| `persistence.scheduled-task` | FAIL | Scheduled tasks outside `\Microsoft\`, one finding per action |
| `persistence.service` | WARN | Services outside `C:\Windows` whose binary sits in a user-writable folder, whose path has spaces but no quotes, or (deep) whose binary is unsigned |
| `persistence.wmi-consumer` | WARN | WMI command-line and script event consumers. Reading them needs admin, so this is usually SKIP with the command |
| `persistence.profile-fetch` | FAIL | PowerShell profiles or shell startup files that download and run code, or run encoded commands. Line numbers only |

## hardening

| id | Level | What |
| --- | --- | --- |
| `hardening.uac` | FAIL | User Account Control is off, or admins elevate without a prompt. WARN when prompts aren't on the secure desktop |
| `hardening.smartscreen` | WARN | SmartScreen for apps and files is turned off by policy or the Explorer setting |
| `hardening.secure-boot` | WARN | Secure Boot is off. SKIP when the state isn't readable (legacy BIOS) |
| `hardening.execution-policy` | WARN | PowerShell execution policy is Unrestricted or Bypass at a persistent scope |
| `hardening.lsa-protection`, `hardening.credential-guard`, `hardening.script-block-logging` | INFO | LSA protection, Credential Guard and script block logging state |
| `hardening.screen-lock` | INFO | No inactivity lock by policy or screen saver. The modern Settings value isn't readable, so this never warns |

## apps

| id | Level | What |
| --- | --- | --- |
| `apps.installed` | INFO | How many programs are installed (Uninstall keys, without system components) |
| `apps.remote-access` | WARN | A remote-access tool is installed (TeamViewer, AnyDesk, RustDesk, ScreenConnect, VNC and others) |
| `apps.unused` | SKIP | Last-run times live in Prefetch, which needs admin; the reason gives the command |
| `apps.wsl-distro` | INFO | Each WSL distro and its WSL version, read from the registry |

## secrets

| id | Level | What |
| --- | --- | --- |
| `secrets.profile` | FAIL | PowerShell profiles (both editions, VS Code host) and `.bashrc`-style files with token shapes or credential-named variables set to a literal (`$env:X_TOKEN = '...'`, `SetEnvironmentVariable`, `export X_TOKEN=...`) |
| `secrets.shell-history` | FAIL | PSReadLine history and other REPL histories with token shapes |
| `secrets.env-var` | FAIL | User or machine environment variables holding credentials. Names only |
| `secrets.credential-manager` | INFO | How many Credential Manager entries exist (`cmdkey /list`, counted, never shown) |
| `secrets.aws-static-keys` | FAIL | Long-lived keys in `~\.aws\credentials` |
| `secrets.netrc`, `secrets.npm-token`, `secrets.docker-auth`, `secrets.gh-plaintext` | WARN | Plain-text credentials in those tools' files |
| `secrets.file-permissions` | FAIL | A file that holds credentials grants read to Everyone, Users or Authenticated Users (checked by SID, so any Windows language works) |
| `secrets.env-files`, `secrets.env-permissions` | WARN | `.env` files with credentials under the repo roots (deep: the whole profile), and ones other users can read |
| `secrets.env-backup` | FAIL | Backup copies of those `.env` files |
| `secrets.gcp-sa-keys` | FAIL | Google service-account key files, counted by distinct key |

## ssh and git

| id | Level | What |
| --- | --- | --- |
| `ssh.key`, `ssh.key-permissions` | FAIL | A private key in `~\.ssh` without a passphrase (FIDO keys are INFO), or one other users can read |
| `ssh.authorized-keys` | WARN | Keys that can log in to this account over SSH |
| `ssh.admin-authorized-keys` | INFO | `administrators_authorized_keys` exists; reading it needs admin |
| `ssh.forward-agent`, `ssh.host-key-checking` | WARN | Agent forwarding or disabled host key checking in `~\.ssh\config` |
| `ssh.agent` | INFO | How many keys the SSH agent holds |
| `git.credential-store` | FAIL | `~\.git-credentials` exists, or the credential helper is `store` |
| `git.commit-signing` | INFO | Commits aren't signed by default |
| `git.gh-scopes` | WARN | The GitHub CLI login has `delete_repo` or an `admin:` scope. Skipped with `--offline` |

## packages, editors, browsers and agents

| id | Level | What |
| --- | --- | --- |
| `packages.pnpm-release-age`, `packages.npm-ignore-scripts`, `packages.npm-release-age`, `packages.pip-index` | WARN | Same as the Mac scan; pip config is read from `%APPDATA%\pip\pip.ini` and the other standard places |
| `packages.winget-upgrades` | WARN | Programs with winget upgrades available (deep, not with `--offline`) |
| `editors.workspace-trust`, `editors.auto-tasks` | WARN | VS Code, Cursor or Windsurf with Workspace Trust off, or automatic tasks on folder open allowed |
| `editors.extensions`, `browser.extensions` | INFO | Extension counts; Chrome, Edge and Brave profiles with how many extensions have broad access |
| `agents.*` | FAIL | The same Claude Code, MCP and Codex checks as the Mac scan, reading `%USERPROFILE%\.claude`, `%USERPROFILE%\.claude.json`, `%APPDATA%\Claude\claude_desktop_config.json`, Cursor, Windsurf, Gemini, `%USERPROFILE%\.codex\config.toml` and each repo's `.mcp.json`. `cmd /c npx ...` launches are judged by the command `cmd` runs |

## docker, checkouts and cloud

| id | Level | What |
| --- | --- | --- |
| `docker.tcp-exposed` | FAIL | Docker Desktop exposes its API on TCP 2375 without TLS, or `daemon.json` adds a TCP host without TLS verification |
| `docker.published-port` | WARN | A running container publishes a port on all interfaces |
| `stale.checkout` | WARN | A checkout untouched for `--days-unused` days that still holds `.env` credentials. Reads file times only and never runs `git` in the repo |
| `cloud.kubectl-prod-default` | WARN | kubectl's current context looks like production |

## meta

`meta.version` comes first and `meta.summary` last. `meta.timing` gives each section's time. `meta.allowlist-invalid` and `meta.allowlist-expired` (WARN) report bad allowlist lines. `<section>.budget` means the time budget ran out, and `<section>.error` means a section stopped early, with the error message.
