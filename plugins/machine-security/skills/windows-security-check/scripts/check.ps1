# windows-security-check: read-only security scan of the Windows PC it runs on.
#
# Prints NDJSON, one finding per line, with a stable check id:
#   {"id":"os.bitlocker","level":"PASS","score":0,"subject":"C:","detail":"...","fix":"...","key":"...","norm":"..."}
# --text prints LEVEL|AREA|CHECK|DETAIL|FIX instead, most severe first.
# Levels: FAIL (fix now, 10 points), WARN (review, 3 points), INFO, PASS, SKIP (not checked, with the reason).
#
# It runs as a standard user: it never elevates, never changes a setting, and never prints a secret
# value. Every string passes through one redaction function before it is printed. A check that needs
# admin reports SKIP with the command for the person to run. The only files it writes are its own
# baseline under %LOCALAPPDATA% (skip with --no-save).
# Compatible with Windows PowerShell 5.1 and PowerShell 7. Elsewhere the Windows-only checks report SKIP.
#
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File check.ps1 [options]   (Bypass applies to this process only)

$WscVersion = '1.0.0'
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$Usage = @'
Usage: check.ps1 [--fast | --deep] [--offline] [--text] [--diff] [--no-save]
                 [--role laptop|server] [--roots DIR;DIR...] [--days-unused N] [--budget SECONDS] [--only LIST]

  --fast         Default. Usually under a minute (60 s budget). Repo roots only, no Windows Update search.
  --deep         Adds the Windows Update search (can take minutes), winget upgrades, signatures of every
                 non-Windows service binary, and a search of the whole user profile for .env and key files.
  --offline      Skips everything that talks to the network (Windows Update, winget, gh).
  --text         LEVEL|AREA|CHECK|DETAIL|FIX lines instead of NDJSON.
  --diff         Show only what changed since the last run in the same mode: new, resolved, changed.
  --no-save      Don't write this run as the new baseline.
  --role server  For an always-on machine: BitLocker off, Remote Desktop and OpenSSH Server are INFO.
  --roots        Folders that hold your checkouts, separated by ';' (':' outside Windows). Default: whichever
                 of ~\repos ~\src ~\code ~\projects ~\dev ~\work ~\git ~\source\repos ~\workspace exist.
                 Also WSC_ROOTS. Roots inside OneDrive are skipped so the scan never downloads cloud files.
  --days-unused  Checkouts untouched this many days are flagged. Default 90.
  --budget       Seconds before remaining sections are skipped. Default 60 (--deep: 900).
  --only         Comma-separated sections: os defender network persistence hardening apps secrets ssh git
                 packages editors agents docker stale cloud. Implies --no-save.

Allowlist: %APPDATA%\windows-security-check\allow.tsv (or WSC_ALLOWLIST), tab-separated:
  id <TAB> match <TAB> reason <TAB> expires (YYYY-MM-DD)
id and match are wildcards; match is tested against the finding's subject. A matching FAIL or WARN is
shown as INFO with "accepted" and the reason until the expiry date.

Exit status: 0 no new FAIL since the baseline, 1 new FAIL findings, 2 usage error.
'@

# ---------- platform and paths ----------

$OnWindows = ($PSVersionTable.PSEdition -eq 'Desktop') -or ((Get-Variable -Name IsWindows -ValueOnly -ErrorAction SilentlyContinue) -eq $true)
$Sep = [IO.Path]::DirectorySeparatorChar

function Get-UserHome {
  if ($env:WSC_HOME) { return $env:WSC_HOME }
  if ($OnWindows -and $env:USERPROFILE) { return $env:USERPROFILE }
  return $HOME
}
$UserHome = Get-UserHome
# Roaming and local app data. WSC_HOME (tests) keeps every path inside the fixture.
if ($env:WSC_HOME) {
  if ($OnWindows) { $AppData = Join-Path $UserHome 'AppData\Roaming'; $LocalAppData = Join-Path $UserHome 'AppData\Local' }
  else { $AppData = Join-Path $UserHome '.config'; $LocalAppData = Join-Path $UserHome '.local/state' }
} elseif ($OnWindows) { $AppData = $env:APPDATA; $LocalAppData = $env:LOCALAPPDATA }
else { $AppData = Join-Path $UserHome '.config'; $LocalAppData = Join-Path $UserHome '.local/state' }

function Join-PathParts([string[]]$Parts) { $p = $Parts[0]; for ($i = 1; $i -lt $Parts.Count; $i++) { $p = Join-Path $p $Parts[$i] }; return $p }
function Get-HomePath([string]$Rel) { return (Join-Path $UserHome ($Rel -replace '[\\/]', [string]$Sep)) }

# ---------- findings, redaction, encoding ----------

$script:Findings = New-Object System.Collections.ArrayList

function Add-Finding([string]$Level, [string]$Id, [string]$Subject, [string]$Detail, [string]$Fix) {
  [void]$script:Findings.Add([pscustomobject]@{ Level = $Level; Id = $Id; Subject = [string]$Subject; Detail = [string]$Detail; Fix = [string]$Fix })
}

# Token shapes, for content checks. A boundary is required before sk-.
$TokenRe = '(^|[^A-Za-z0-9])(sk-ant-[A-Za-z0-9_-]{20,}|sk-(proj-)?[A-Za-z0-9_-]{20,}|gh[opusr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|(AKIA|ASIA)[0-9A-Z]{16}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|glpat-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{30,})|-----BEGIN [A-Z ]*PRIVATE KEY-----'
$CredWords = '(TOKEN|SECRET|API_?KEY|APIKEY|PASSWORD|PASSWD|PRIVATE_KEY|ACCESS_KEY|CLIENT_SECRET|CREDENTIALS)'
# A credential-named variable assigned a literal: shell (NAME=v), PowerShell ($env:NAME = 'v') and SetEnvironmentVariable('NAME', 'v').
$SecretAssignRes = @(
  ('^\s*(export\s+)?[A-Za-z0-9_]*' + $CredWords + '[A-Za-z0-9_]*\s*=\s*["'']?[A-Za-z0-9/+_.@:-]{8,}'),
  ('^\s*\$env:[A-Za-z0-9_]*' + $CredWords + '[A-Za-z0-9_]*\s*=\s*["''][A-Za-z0-9/+_.@:-]{8,}'),
  ('SetEnvironmentVariable\(\s*["''][A-Za-z0-9_]*' + $CredWords + '[A-Za-z0-9_]*["'']\s*,\s*["''][A-Za-z0-9/+_.@:-]{8,}')
)

# The one redaction step every printed string goes through: $HOME becomes ~, token shapes and
# credential assignments become [REDACTED], control characters and non-ASCII bytes are removed,
# and long text is shortened.
function Protect-Text([string]$Text, [int]$Max = 400) {
  if ($null -eq $Text) { return '' }
  $s = $Text
  if ($UserHome -and $UserHome.Length -gt 3) {
    foreach ($h in @($UserHome, ($UserHome -replace '\\', '/'))) {
      $s = [regex]::Replace($s, ([regex]::Escape($h) + '(?=[\\/\s]|$)'), '~', 'IgnoreCase')
    }
  }
  $s = [regex]::Replace($s, '-----BEGIN [A-Z ]*PRIVATE KEY-----', '[REDACTED]')
  $s = [regex]::Replace($s, '(^|[^A-Za-z0-9])(sk-ant-|sk-proj-|sk-|gh[opusr]_|github_pat_|glpat-|xox[abprs]-|npm_|hf_|AIza)[A-Za-z0-9_-]{16,}', '$1[REDACTED]')
  $s = [regex]::Replace($s, '(^|[^A-Za-z0-9])(AKIA|ASIA)[0-9A-Z]{16}', '$1[REDACTED]')
  $s = [regex]::Replace($s, 'eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}', '[REDACTED]')
  $s = [regex]::Replace($s, '(bearer\s+)[^\s"'',;]{8,}', '$1[REDACTED]', 'IgnoreCase')
  $s = [regex]::Replace($s, '(://[^/:@\s]+:)[^@/\s]+@', '$1[REDACTED]@')
  $s = [regex]::Replace($s, '([A-Za-z0-9_-]*(token|secret|passw(or)?d|api[_-]?key|auth)[A-Za-z0-9_-]*\s*=\s*["'']?)[^\s"'',;&)]{4,}', '$1[REDACTED]', 'IgnoreCase')
  $s = [regex]::Replace($s, '("[A-Za-z0-9_-]*(token|secret|passw(or)?d|api[_-]?key|auth)[A-Za-z0-9_-]*"\s*:\s*")[^"]{4,}', '$1[REDACTED]', 'IgnoreCase')
  $s = [regex]::Replace($s, '(--?(token|password|secret|api-?key)\s+)[^\s-]\S*', '$1[REDACTED]', 'IgnoreCase')
  $s = [regex]::Replace($s, '[\x00-\x1F\x7F]', ' ')
  $s = [regex]::Replace($s, '[^\x20-\x7E]', '?')
  if ($s.Length -gt $Max) { $s = $s.Substring(0, $Max - 3) + '...' }
  return $s
}

function Get-ShortHash([string]$Text) {
  $sha = [Security.Cryptography.SHA256]::Create()
  $bytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text))
  return (($bytes[0..3] | ForEach-Object { $_.ToString('x2') }) -join '')
}

# ---------- helpers ----------

function Get-RegValue([string]$Path, [string]$Name) {
  try { $v = Get-ItemProperty -LiteralPath $Path -Name $Name -ErrorAction Stop; return $v.$Name } catch { return $null }
}

function Format-Arg([string]$A) {
  if ($A -eq '') { return '""' }
  if ($A -notmatch '[\s"]') { return $A }
  return '"' + (($A -replace '(\\*)"', '$1$1\"') -replace '(\\+)$', '$1$1') + '"'
}

# Run a program with a time limit; stdin is closed so nothing can wait for input.
function Invoke-Tool([string]$Name, [string[]]$ArgList, [int]$TimeoutSec = 10) {
  $cmd = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $cmd) { return $null }
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $cmd.Path
  $psi.Arguments = (@($ArgList | ForEach-Object { Format-Arg $_ }) -join ' ')
  $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true; $psi.RedirectStandardInput = $true
  try { $p = [Diagnostics.Process]::Start($psi) } catch { return $null }
  $p.StandardInput.Close()
  $out = $p.StandardOutput.ReadToEndAsync(); $err = $p.StandardError.ReadToEndAsync()
  if (-not $p.WaitForExit($TimeoutSec * 1000)) {
    try { $p.Kill() } catch { }
    return [pscustomobject]@{ Code = -1; Out = ''; Err = ''; TimedOut = $true }
  }
  $p.WaitForExit()
  return [pscustomobject]@{ Code = $p.ExitCode; Out = $out.Result; Err = $err.Result; TimedOut = $false }
}

function Read-Text([string]$Path) { try { return [IO.File]::ReadAllText($Path) } catch { return $null } }
function Read-Lines([string]$Path) { try { return [IO.File]::ReadAllLines($Path) } catch { return @() } }

# Line numbers (1-based) of lines matching any pattern, skipping op:// references.
function Get-MatchingLines([string[]]$Lines, [string[]]$Patterns, [switch]$CaseSensitive) {
  $hits = New-Object System.Collections.ArrayList
  for ($i = 0; $i -lt $Lines.Count; $i++) {
    $l = $Lines[$i]
    if ($l -match 'op://') { continue }
    foreach ($pat in $Patterns) {
      $m = if ($CaseSensitive) { $l -cmatch $pat } else { $l -match $pat }
      if ($m) { [void]$hits.Add($i + 1); break }
    }
  }
  return $hits.ToArray()
}

# True when a file that holds credentials is readable by Everyone, Users or Authenticated Users
# (Windows, by SID so it works in any language), or by group or others (elsewhere).
function Test-LooseFile([string]$Path) {
  if ($OnWindows) {
    try {
      $acl = Get-Acl -LiteralPath $Path -ErrorAction Stop
      foreach ($r in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        if ($r.AccessControlType -ne 'Allow') { continue }
        if (@('S-1-1-0', 'S-1-5-32-545', 'S-1-5-11') -notcontains $r.IdentityReference.Value) { continue }
        if (([int]$r.FileSystemRights -band 1) -ne 0) { return $true }
      }
    } catch { }
    return $false
  }
  $mode = $null
  try { $mode = (Get-Item -LiteralPath $Path -Force -ErrorAction Stop).UnixMode } catch { }
  if ($mode -and $mode.Length -ge 10) { return ($mode.Substring(4, 6) -ne '------') }
  return $false
}

# Files under a folder, pruning dependency and cache folders, junctions, OneDrive and cloud-only files.
$PruneNames = @('node_modules', '.git', '.hg', 'vendor', '.venv', 'venv', '.tox', '.cache', '.cargo', '.rustup', '.nvm', '.pnpm-store', '.npm', '.yarn', '.gradle', '.m2', 'DerivedData', '.next', '.turbo', 'dist', 'build', 'target', '__pycache__', '.terraform', 'AppData', 'bin', 'obj', 'packages')
function Find-Files([string]$Root, [int]$MaxDepth, [scriptblock]$Match, [switch]$IncludeDirs) {
  $found = New-Object System.Collections.ArrayList
  $queue = New-Object System.Collections.Queue
  $queue.Enqueue(@($Root, 0))
  while ($queue.Count -gt 0) {
    $item = $queue.Dequeue(); $dir = $item[0]; $depth = $item[1]
    try {
      foreach ($f in [IO.Directory]::EnumerateFiles($dir)) {
        $attr = [int][IO.File]::GetAttributes($f)
        if (($attr -band 0x1000) -or ($attr -band 0x400000)) { continue }   # Offline, RecallOnDataAccess
        if (& $Match ([IO.Path]::GetFileName($f)) $f) { [void]$found.Add($f) }
      }
      if ($depth -ge $MaxDepth) { continue }
      foreach ($d in [IO.Directory]::EnumerateDirectories($dir)) {
        $name = [IO.Path]::GetFileName($d)
        if ($IncludeDirs -and (& $Match $name $d)) { [void]$found.Add($d); continue }
        if ($PruneNames -contains $name -or $name -like 'OneDrive*') { continue }
        if (([int][IO.File]::GetAttributes($d)) -band 0x400) { continue }      # ReparsePoint
        $queue.Enqueue(@($d, ($depth + 1)))
      }
    } catch { }
  }
  return $found.ToArray()
}

# ---------- JSON that works on 5.1 and 7 ----------

# Windows PowerShell 5.1's ConvertFrom-Json stops at 2 MB, and ~/.claude.json grows past that.
function ConvertFrom-JsonText([string]$Text) {
  if ($null -eq $Text) { return $null }
  if ($PSVersionTable.PSEdition -eq 'Desktop' -and $Text.Length -gt 1900000) {
    Add-Type -AssemblyName System.Web.Extensions
    $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $ser.MaxJsonLength = [int]::MaxValue
    return $ser.DeserializeObject($Text)
  }
  return ($Text | ConvertFrom-Json)
}
# Returns the property value; an array is returned whole, not unrolled into the pipeline.
function Get-JProp($Obj, [string]$Name) {
  $v = $null
  if ($Obj -is [Collections.IDictionary]) { if (@($Obj.Keys) -contains $Name) { $v = $Obj[$Name] } }
  elseif ($Obj -is [Management.Automation.PSCustomObject]) { $p = $Obj.PSObject.Properties[$Name]; if ($p) { $v = $p.Value } }
  if ($v -is [array]) { return ,$v }
  return $v
}
function Get-JKeys($Obj) {
  if ($null -eq $Obj) { return @() }
  if ($Obj -is [Collections.IDictionary]) { return @($Obj.Keys) }
  if ($Obj -is [Management.Automation.PSCustomObject]) { return @($Obj.PSObject.Properties | ForEach-Object { $_.Name }) }
  return @()
}
function Test-JObject($Obj) { return (($Obj -is [Collections.IDictionary]) -or ($Obj -is [Management.Automation.PSCustomObject])) }
function Get-JArray($Obj) {
  if ($null -eq $Obj) { return @() }
  if ($Obj -is [string]) { return @($Obj) }
  if ($Obj -is [Collections.IEnumerable] -and -not (Test-JObject $Obj)) { return @($Obj) }
  return @()
}

# ---------- pure classifiers (tested with fixtures in tests/machine-security.test.mjs) ----------

# Days since the newest installed update -> level.
function Get-PatchAgeLevel([int]$Days) { if ($Days -le 40) { 'PASS' } elseif ($Days -le 75) { 'WARN' } else { 'FAIL' } }

# A Windows Update title and its categories -> "LEVEL id".
function Get-UpdateClass([string]$Title, [string]$Categories) {
  if ($Title -match 'Feature update|Upgrade to Windows') { return 'INFO os.major-upgrade' }
  if ($Title -match 'Security Intelligence|Definition Update' -or $Categories -match 'Definition') { return 'WARN os.updates-definitions' }
  if ($Categories -match 'Driver') { return 'INFO os.updates-driver' }
  if ($Title -match 'Security|Cumulative' -or $Categories -match 'Security|Critical') { return 'FAIL os.updates' }
  return 'WARN os.updates'
}

# SecurityCenter2 productState: byte 2 (0x1000) is on, byte 3 (0x10) means definitions are out of date.
function Get-AvState([int]$State) {
  return [pscustomobject]@{ Enabled = (($State -band 0x1000) -ne 0); UpToDate = (($State -band 0x10) -eq 0) }
}

# Shell property System.Volume.BitLockerProtection -> level and words. 1, 3 and 5 mean protection is on.
function Get-BitLockerState($Value) {
  switch ([string]$Value) {
    '1' { return @('PASS', 'BitLocker is on') }
    '3' { return @('PASS', 'BitLocker is on (encrypting)') }
    '5' { return @('PASS', 'BitLocker is on (locked)') }
    '2' { return @('FAIL', 'BitLocker is off') }
    '4' { return @('WARN', 'BitLocker is decrypting') }
    '6' { return @('WARN', 'BitLocker is on but suspended') }
    default { return @('SKIP', 'BitLocker state is unknown') }
  }
}

# The program a command line runs: the quoted part, or up to the first executable extension.
function Get-ProgramPath([string]$CommandLine) {
  $c = [Environment]::ExpandEnvironmentVariables($CommandLine.Trim())
  if ($c -match '^"([^"]+)"') { return $Matches[1] }
  if ($c -match '^(.+?\.(exe|com|bat|cmd|ps1|vbs|vbe|js|jse|wsf|hta|msc|scr))(\s|$)') { return $Matches[1] }
  return ($c -split '\s+')[0]
}

function Get-Raised([string]$Level, [string]$To) { if ($To -eq 'FAIL' -or $Level -eq 'FAIL') { return 'FAIL' }; if ($To -eq 'WARN' -or $Level -eq 'WARN') { return 'WARN' }; return $Level }

# A Run key, startup item, scheduled task or WMI consumer command -> level and reasons.
function Get-CommandRisk([string]$CommandLine, [string]$Signature, [bool]$Exists) {
  $c = [Environment]::ExpandEnvironmentVariables($CommandLine)
  $prog = Get-ProgramPath $CommandLine
  $level = 'INFO'; $reasons = New-Object System.Collections.ArrayList
  if ($prog -match '\\(Temp|Tmp)\\|\\Users\\Public\\|\\Windows\\Temp\\|^/tmp/') { $level = Get-Raised $level 'FAIL'; [void]$reasons.Add('runs from a temp or public folder') }
  if ($c -match '(powershell|pwsh)(\.exe)?\b.*\s-(e|ec|en|enc|enco|encod|encode|encoded|encodedc|encodedco|encodedcom|encodedcomm|encodedcomma|encodedcomman|encodedcommand)\s+[A-Za-z0-9+/=]{16,}') { $level = Get-Raised $level 'FAIL'; [void]$reasons.Add('runs an encoded PowerShell command') }
  if ($c -match '(?i)\b(iwr|irm|Invoke-WebRequest|Invoke-RestMethod|DownloadString|DownloadFile|Start-BitsTransfer|wget|curl(\.exe)?)\b' -or $c -match '(?i)certutil.*-urlcache|bitsadmin.*/transfer') { $level = Get-Raised $level 'FAIL'; [void]$reasons.Add('downloads from the network') }
  if ($c -match '(?i)\bmshta(\.exe)?\b|regsvr32.*/i:https?|rundll32.*javascript:') { $level = Get-Raised $level 'FAIL'; [void]$reasons.Add('uses mshta, regsvr32 or rundll32 to run script') }
  if ($c -match '(?i)\b(iex|Invoke-Expression)\b') { $level = Get-Raised $level 'WARN'; [void]$reasons.Add('evaluates a string as code') }
  if ($c -match '(?i)\b(wscript|cscript)(\.exe)?\b' -or $prog -match '(?i)\.(vbs|vbe|js|jse|wsf|hta)$') { $level = Get-Raised $level 'WARN'; [void]$reasons.Add('runs a Windows Script Host script') }
  if ($c -match '(?i)(powershell|pwsh).*\s-w(indowstyle)?\s+hidden') { $level = Get-Raised $level 'WARN'; [void]$reasons.Add('runs PowerShell in a hidden window') }
  if ($prog -match '(?i)\\AppData\\Roaming\\|\\Downloads\\|^[A-Z]:\\ProgramData\\[^\\]+$') { $level = Get-Raised $level 'WARN'; [void]$reasons.Add('runs from a user-writable folder') }
  if (-not $Exists) { $level = Get-Raised $level 'WARN'; [void]$reasons.Add('program is missing (orphaned)') }
  if ($Signature -eq 'HashMismatch') { $level = Get-Raised $level 'FAIL'; [void]$reasons.Add('signature does not match the file') }
  elseif ($Signature -eq 'NotSigned' -and $prog -notmatch '(?i)^[A-Z]:\\Windows\\') { $level = Get-Raised $level 'WARN'; [void]$reasons.Add('program is unsigned') }
  if ($reasons.Count -eq 0) { [void]$reasons.Add('nothing unusual') }
  return @($level, ($reasons -join '; '))
}

# Share names from `net share` output (any language): rows whose second column is a drive path.
function Get-NetShareNames([string]$Output) {
  $names = New-Object System.Collections.ArrayList
  foreach ($line in ($Output -split "`r?`n")) {
    if ($line -match '^(\S+)\s+([A-Za-z]:\\\S*)') { [void]$names.Add(@($Matches[1], $Matches[2])) }
  }
  return $names.ToArray()
}

# MCP launch -> pinned | unpinned | local. Unpinned launchers fetch whatever version is newest.
function Get-McpPinState([string]$Command, [string]$ArgLine) {
  $words = @($ArgLine -split '\s+' | Where-Object { $_ -ne '' })
  $cmd = ([IO.Path]::GetFileNameWithoutExtension(($Command -replace '\\', '/').Split('/')[-1])).ToLower()
  # cmd /c npx ... on Windows: look at the command cmd runs.
  if ($cmd -eq 'cmd' -and $words.Count -gt 1 -and $words[0] -match '^/[ck]$') {
    $cmd = ([IO.Path]::GetFileNameWithoutExtension($words[1])).ToLower(); $words = @($words | Select-Object -Skip 2)
  }
  $line = ' ' + ($words -join ' ') + ' '
  $fetch = $false
  switch ($cmd) {
    { @('npx', 'bunx', 'pnpx', 'uvx', 'pipx') -contains $_ } { $fetch = $true }
    { @('pnpm', 'yarn') -contains $_ } { if ($line -match ' dlx ') { $fetch = $true } }
    { @('npm', 'bun') -contains $_ } { if ($line -match ' (exec|x) ') { $fetch = $true } }
    { @('docker', 'podman') -contains $_ } { if ($line -match ' run ') { $fetch = $true } }
  }
  if (-not $fetch) { return 'local' }
  if ($line -match '@latest|:latest') { return 'unpinned' }
  $pkg = ''; $skipNext = $false; $fromNext = $false
  foreach ($a in $words) {
    if ($fromNext) { $pkg = $a; break }
    if ($skipNext) { $skipNext = $false; continue }
    if ($a -eq '--from') { $fromNext = $true; continue }
    if (@('-e', '-v', '-p', '-w', '-u', '--env', '--volume', '--publish', '--name', '--network', '--env-file', '--mount', '--user', '--workdir', '--entrypoint', '--with', '--python') -contains $a) { $skipNext = $true; continue }
    if ($a -like '-*' -or @('dlx', 'exec', 'x', 'run') -contains $a -or $a -like '*=*') { continue }
    $pkg = $a; break
  }
  if ($pkg -eq '') { return 'unpinned' }
  if (@('uvx', 'pipx') -contains $cmd) { if ($pkg -match '==|@[0-9]') { return 'pinned' } else { return 'unpinned' } }
  if (@('docker', 'podman') -contains $cmd) { if ($pkg -match '@sha256:|:[0-9]') { return 'pinned' } else { return 'unpinned' } }
  if ($pkg -match '^@[^/]+/[^@]+@[0-9]' -or $pkg -match '^[^@][^@]*@[0-9]') { return 'pinned' }
  if ($pkg -match '^([A-Za-z]:)?[\\/.]|\.(m?js)$') { return 'local' }
  return 'unpinned'
}

function Test-LiteralSecret([string]$Name, $Value) {
  if (-not ($Value -is [string])) { return $false }
  if ($Value -cmatch $TokenRe) { return $true }
  return ($Name -match 'TOKEN|SECRET|KEY|PASSWORD' -and -not $Value.StartsWith('$') -and -not $Value.StartsWith('%') -and $Value.Length -ge 8 -and $Value -notmatch '^\$\{')
}

# Claude Code settings object -> findings as @(level, code, detail).
function Get-ClaudeSettingsFindings($S, [bool]$IsUser) {
  $out = New-Object System.Collections.ArrayList
  $perm = Get-JProp $S 'permissions'
  if ((Get-JProp $perm 'defaultMode') -eq 'bypassPermissions') { [void]$out.Add(@('WARN', 'bypass', 'permissions.defaultMode is bypassPermissions')) }
  if ((Get-JProp $S 'skipDangerousModePermissionPrompt') -eq $true) { [void]$out.Add(@('WARN', 'skip-prompt', 'skipDangerousModePermissionPrompt is true')) }
  if ((Get-JProp $S 'enableAllProjectMcpServers') -eq $true) { [void]$out.Add(@('WARN', 'all-project-mcp', 'enableAllProjectMcpServers is true: every repo .mcp.json server starts without asking')) }
  $hooks = Get-JProp $S 'hooks'; $events = New-Object System.Collections.ArrayList
  foreach ($e in (Get-JKeys $hooks)) {
    foreach ($group in (Get-JArray (Get-JProp $hooks $e))) {
      foreach ($h in (Get-JArray (Get-JProp $group 'hooks'))) {
        $c = [string](Get-JProp $h 'command')
        if ($c -match '(^|[^A-Za-z])(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\s|\|\s*(ba|z)?sh(\s|$)|base64 +(-d|--decode)|-EncodedCommand|\|\s*iex') { if ($events -notcontains $e) { [void]$events.Add($e) } }
      }
    }
  }
  if ($events.Count) { [void]$out.Add(@('WARN', 'hook-fetch', ('hooks that download or pipe to a shell: ' + ($events -join ', ')))) }
  $envBlock = Get-JProp $S 'env'; $bad = New-Object System.Collections.ArrayList
  foreach ($k in (Get-JKeys $envBlock)) { if (Test-LiteralSecret $k (Get-JProp $envBlock $k)) { [void]$bad.Add($k) } }
  if ($bad.Count) { [void]$out.Add(@('FAIL', 'env-secret', ('env block sets credentials inline: ' + ($bad -join ', ')))) }
  if ((Get-JKeys $envBlock) -contains 'ANTHROPIC_BASE_URL') { [void]$out.Add(@('INFO', 'base-url', 'env sets ANTHROPIC_BASE_URL (requests go to another endpoint)')) }
  if ($IsUser) {
    $deny = (@(Get-JArray (Get-JProp $perm 'deny')) | ForEach-Object { [string]$_ }) -join ' '
    if ($deny -match '\.ssh' -and $deny -match '\.env' -and $deny -match '\.aws|gcloud|credentials') { [void]$out.Add(@('PASS', 'deny', 'permissions.deny covers ~/.ssh, .env and cloud credentials')) }
    else { [void]$out.Add(@('INFO', 'deny', 'permissions.deny does not cover all of ~/.ssh, .env and cloud credential files')) }
    $sb = Get-JProp $S 'sandbox'
    if ((Get-JProp $sb 'enabled') -eq $true) {
      if ((Get-JProp $sb 'allowUnsandboxedCommands') -eq $false) { [void]$out.Add(@('PASS', 'sandbox', 'sandbox on, no unsandboxed escape hatch')) }
      else { [void]$out.Add(@('INFO', 'sandbox', 'sandbox on, but allowUnsandboxedCommands is not false')) }
    } else { [void]$out.Add(@('INFO', 'sandbox', 'sandbox.enabled is not true')) }
  }
  return $out.ToArray()
}

# Any MCP config object -> servers as @(name, command, args, inline-secret count).
function Get-McpServers($Cfg) {
  $out = New-Object System.Collections.ArrayList
  $tables = New-Object System.Collections.ArrayList
  $top = Get-JProp $Cfg 'mcpServers'; if (Test-JObject $top) { [void]$tables.Add($top) }
  $projects = Get-JProp $Cfg 'projects'
  if (Test-JObject $projects) {
    foreach ($p in (Get-JKeys $projects)) { $m = Get-JProp (Get-JProp $projects $p) 'mcpServers'; if (Test-JObject $m) { [void]$tables.Add($m) } }
  }
  foreach ($t in $tables) {
    foreach ($name in (Get-JKeys $t)) {
      $s = Get-JProp $t $name; if (-not (Test-JObject $s)) { continue }
      $cmd = [string](Get-JProp $s 'command'); if (-not $cmd) { $cmd = [string](Get-JProp $s 'url') }
      $argList = @(Get-JArray (Get-JProp $s 'args') | ForEach-Object { [string]$_ })
      $secrets = 0
      $envBlock = Get-JProp $s 'env'; foreach ($k in (Get-JKeys $envBlock)) { if (Test-LiteralSecret $k (Get-JProp $envBlock $k)) { $secrets++ } }
      $headers = Get-JProp $s 'headers'
      foreach ($k in (Get-JKeys $headers)) { $v = [string](Get-JProp $headers $k); if ($v -cmatch $TokenRe -or $v -match '^Bearer [A-Za-z0-9._-]{12,}') { $secrets++ } }
      foreach ($a in $argList) { if ($a -cmatch $TokenRe) { $secrets++ } }
      if ([string](Get-JProp $s 'url') -match '[?&](token|key|api_key)=[^$&]{8,}') { $secrets++ }
      [void]$out.Add(@($name, $cmd, ($argList -join ' '), $secrets))
    }
  }
  return $out.ToArray()
}

# Codex config.toml lines -> findings as @(level, code, detail[, args, secrets]). A small line-based
# reader: sections, key = value pairs, single- and multi-line arrays, inline tables for env.
function Get-CodexFindings([string[]]$Lines, [string]$HomeDir, [string[]]$Roots) {
  $out = New-Object System.Collections.ArrayList
  $section = ''; $srv = ''; $cmd = ''; $argLine = ''; $envSecret = 0; $pending = ''; $trusted = 0; $tmp = 0
  $unq = { param($v) return ($v.Trim() -replace '^"|"$', '') }
  $homes = @($HomeDir, ($HomeDir.TrimEnd('\', '/') + $Sep), '/', '~')
  foreach ($raw in $Lines) {
    $line = $raw -replace '\s+#.*$', ''
    if ($pending -ne '') { $pending = $pending + ' ' + $line; if ($line -notmatch '\]') { continue }; $line = $pending; $pending = '' }
    if ($line -match '^\s*\[') {
      $ns = ($line -replace '^\s*\[+\s*|\s*\]+\s*$', ''); $bare = $ns -replace '"', ''
      if ($srv -ne '' -and $bare -ne ('mcp_servers.' + $srv + '.env')) { [void]$out.Add(@('MCP', $srv, $cmd, $argLine, $envSecret)); $srv = ''; $cmd = ''; $argLine = ''; $envSecret = 0 }
      $section = $ns
      if ($bare -match '^mcp_servers\.([^.]+)$') { $srv = $Matches[1] }
      continue
    }
    if ($line -notmatch '=') { continue }
    $key = ($line -replace '\s*=.*$', '').Trim() -replace '"', ''
    $val = ($line -replace '^[^=]*=\s*', '')
    if ($val -match '^\[' -and $val -notmatch '\]') { $pending = $line; continue }
    $where = if ($section -eq '') { 'top level' } else { '[' + $section + ']' }
    if ($key -eq 'approval_policy' -and (& $unq $val) -eq 'never') { [void]$out.Add(@('WARN', 'approval-never', $where)) }
    if ($key -eq 'sandbox_mode' -and (& $unq $val) -eq 'danger-full-access') { [void]$out.Add(@('WARN', 'full-access', $where)) }
    if ($section -eq 'sandbox_workspace_write' -and $key -eq 'network_access' -and $val -match 'true') { [void]$out.Add(@('INFO', 'network', '[sandbox_workspace_write]')) }
    if ($section -match '^projects\.' -and $key -eq 'trust_level' -and (& $unq $val) -eq 'trusted') {
      $p = (($section -replace '^projects\.', '') -replace '^"|"$', '' -replace "^'|'$", '') -replace '\\\\', '\'
      $trusted++
      if ($homes -contains $p -or $Roots -contains $p) { [void]$out.Add(@('WARN', 'trust-broad', $p)) }
      elseif ($p -match '^(/tmp|/private/tmp|/var/folders|/private/var/folders)/|\\(Temp|Tmp)\\') { $tmp++ }
    }
    if ($srv -ne '' -and $section -match '^"?mcp_servers\.') {
      if (($section -replace '"', '') -match '\.env$') { if (Test-LiteralSecret $key (& $unq $val)) { $envSecret++ } }
      elseif ($key -eq 'command') { $cmd = & $unq $val }
      elseif ($key -eq 'args') { $argLine = (($val -replace '^\s*\[|\]\s*$', '') -replace '"\s*,\s*"', ' ' -replace '"', '' -replace '[\s,]+$', '').Trim() }
      elseif ($key -eq 'env') {
        foreach ($kv in (($val -replace '[{}]', '') -split ',')) {
          $pair = $kv -split '=', 2
          if ($pair.Count -eq 2 -and (Test-LiteralSecret (($pair[0] -replace '[\s"]', '')) (& $unq $pair[1]))) { $envSecret++ }
        }
      }
    }
  }
  if ($srv -ne '') { [void]$out.Add(@('MCP', $srv, $cmd, $argLine, $envSecret)) }
  [void]$out.Add(@('INFO', 'trusted-count', [string]$trusted))
  if ($tmp) { [void]$out.Add(@('INFO', 'trusted-tmp', [string]$tmp)) }
  return $out.ToArray()
}

# ---------- check sections ----------

function Test-WindowsOnly([string]$Id) { if ($OnWindows) { return $true }; Add-Finding SKIP $Id '' 'not Windows'; return $false }
$AdminHint = 'Run in an elevated PowerShell yourself: '

function Test-Os {
  if (-not (Test-WindowsOnly 'os.version')) { return }
  $cv = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
  $os = $null; try { $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop } catch { }
  $caption = if ($os) { $os.Caption } else { Get-RegValue $cv 'ProductName' }
  Add-Finding INFO os.version '' ('{0} {1}, build {2}.{3}' -f $caption, (Get-RegValue $cv 'DisplayVersion'), (Get-RegValue $cv 'CurrentBuildNumber'), (Get-RegValue $cv 'UBR'))

  $newest = $null
  try { $newest = Get-HotFix -ErrorAction Stop | ForEach-Object { try { $_.InstalledOn } catch { $null } } | Where-Object { $_ } | Sort-Object -Descending | Select-Object -First 1 } catch { }
  if ($newest) {
    $days = [int]((Get-Date) - $newest).TotalDays
    $lvl = Get-PatchAgeLevel $days
    Add-Finding $lvl os.patch-age '' ('The newest installed update is {0} days old ({1:yyyy-MM-dd})' -f $days, $newest) 'Settings > Windows Update > Check for updates'
  } else { Add-Finding SKIP os.patch-age '' 'Get-HotFix returned no install dates' }
  if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') {
    Add-Finding WARN os.reboot-pending '' 'Updates are installed but wait for a restart' 'Restart to finish installing updates'
  }

  if ($Mode -ne 'deep') { Add-Finding SKIP os.updates '' 'needs --deep (the Windows Update search can take minutes)' }
  elseif ($Offline) { Add-Finding SKIP os.updates '' '--offline' }
  else {
    $job = Start-Job -ScriptBlock {
      $s = New-Object -ComObject Microsoft.Update.Session
      $r = $s.CreateUpdateSearcher().Search("IsInstalled=0 and IsHidden=0 and Type='Software'")
      foreach ($u in $r.Updates) { $u.Title + "`t" + ((@($u.Categories) | ForEach-Object { $_.Name }) -join ',') }
    }
    if (Wait-Job $job -Timeout 300) {
      $lines = @(Receive-Job $job -ErrorAction SilentlyContinue)
      if ($job.State -eq 'Failed') { Add-Finding SKIP os.updates '' 'the Windows Update search failed' }
      elseif ($lines.Count -eq 0) { Add-Finding PASS os.updates '' 'No pending Windows updates (live search)' }
      foreach ($l in $lines) {
        $parts = ([string]$l) -split "`t", 2; $cls = (Get-UpdateClass $parts[0] $parts[1]) -split ' '
        Add-Finding $cls[0] $cls[1] $parts[0] ('Pending: ' + $parts[0]) 'Settings > Windows Update'
      }
    } else { Stop-Job $job; Add-Finding SKIP os.updates '' 'the Windows Update search took over 300 s' }
    Remove-Job $job -Force -ErrorAction SilentlyContinue
  }

  $v = $null
  try { $v = (New-Object -ComObject Shell.Application).NameSpace($env:SystemDrive).Self.ExtendedProperty('System.Volume.BitLockerProtection') } catch { }
  $bl = Get-BitLockerState $v
  if ($bl[0] -eq 'SKIP') { Add-Finding SKIP os.bitlocker $env:SystemDrive ('BitLocker state is unknown; ' + $AdminHint + 'manage-bde -status ' + $env:SystemDrive) }
  elseif ($bl[0] -eq 'FAIL' -and $Role -eq 'server') { Add-Finding INFO os.bitlocker $env:SystemDrive ($bl[1] + ' on ' + $env:SystemDrive + '; allowed for --role server') 'Record why in the allowlist' }
  else { Add-Finding $bl[0] os.bitlocker $env:SystemDrive ($bl[1] + ' on ' + $env:SystemDrive) 'Settings > Privacy & security > Device encryption, or Control Panel > BitLocker Drive Encryption; keep the recovery key off this PC' }
}

function Test-Defender {
  if (-not (Test-WindowsOnly 'defender.status')) { return }
  $others = @()
  try {
    foreach ($p in @(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction Stop)) {
      $st = Get-AvState ([int]$p.productState)
      if ($p.displayName -notmatch 'Defender') { $others += $p.displayName; Add-Finding INFO defender.third-party $p.displayName ('{0} is registered, {1}, definitions {2}' -f $p.displayName, $(if ($st.Enabled) { 'on' } else { 'off' }), $(if ($st.UpToDate) { 'up to date' } else { 'out of date' })) }
      if ($st.Enabled -and $p.displayName -notmatch 'Defender') { $script:OtherAvOn = $true }
    }
  } catch { Add-Finding SKIP defender.third-party '' 'SecurityCenter2 is not available (Windows Server has none)' }
  $mp = $null
  try { $mp = Get-MpComputerStatus -ErrorAction Stop } catch { }
  if (-not $mp) {
    if ($script:OtherAvOn) { Add-Finding INFO defender.status '' ('Defender is not answering; ' + ($others -join ', ') + ' is active') }
    else { Add-Finding FAIL defender.status '' 'No antivirus status: Defender is not answering and no other antivirus is on' 'Windows Security > Virus & threat protection' }
    return
  }
  if (-not $mp.AMServiceEnabled -or -not $mp.AntivirusEnabled) {
    if ($script:OtherAvOn) { Add-Finding INFO defender.status '' ('Defender antivirus is off; ' + ($others -join ', ') + ' is active') }
    else { Add-Finding FAIL defender.status '' 'Defender antivirus is off and no other antivirus is on' 'Windows Security > Virus & threat protection' }
    return
  }
  if ($mp.RealTimeProtectionEnabled) { Add-Finding PASS defender.realtime '' 'Real-time protection is on' }
  else { Add-Finding FAIL defender.realtime '' 'Real-time protection is off' 'Windows Security > Virus & threat protection settings > Real-time protection' }
  $age = [int]$mp.AntivirusSignatureAge
  if ($age -gt 7) { Add-Finding FAIL defender.signatures '' "Defender definitions are $age days old" 'Windows Security > Virus & threat protection updates' }
  elseif ($age -gt 3) { Add-Finding WARN defender.signatures '' "Defender definitions are $age days old" 'Windows Security > Virus & threat protection updates' }
  else { Add-Finding PASS defender.signatures '' "Defender definitions are $age day(s) old" }
  if ($mp.IsTamperProtected) { Add-Finding PASS defender.tamper '' 'Tamper protection is on' }
  else { Add-Finding WARN defender.tamper '' 'Tamper protection is off' 'Windows Security > Virus & threat protection settings > Tamper protection' }
}

function Test-Network {
  if (-not (Test-WindowsOnly 'network.firewall')) { return }
  try {
    foreach ($p in @(Get-NetFirewallProfile -ErrorAction Stop)) {
      if ([string]$p.Enabled -eq 'False') { Add-Finding FAIL network.firewall $p.Name ('The {0} firewall profile is off' -f $p.Name) ('Settings > Privacy & security > Windows Security > Firewall & network protection > {0} network' -f $p.Name) }
      else { Add-Finding PASS network.firewall $p.Name ('The {0} firewall profile is on' -f $p.Name) }
      if ([string]$p.DefaultInboundAction -eq 'Allow') { Add-Finding FAIL network.firewall-inbound $p.Name ('The {0} profile allows inbound connections by default' -f $p.Name) ($AdminHint + "Set-NetFirewallProfile -Name $($p.Name) -DefaultInboundAction Block") }
    }
  } catch { Add-Finding SKIP network.firewall '' ('could not read the firewall profiles; ' + $AdminHint + 'Get-NetFirewallProfile') }

  $ts = 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server'
  if ((Get-RegValue $ts 'fDenyTSConnections') -eq 0) {
    if ($Role -eq 'server') { Add-Finding INFO sharing.remote-desktop '' 'Remote Desktop is on; expected for --role server' }
    else { Add-Finding WARN sharing.remote-desktop '' 'Remote Desktop is on' 'Settings > System > Remote Desktop: turn it off unless you use it' }
    if ((Get-RegValue "$ts\WinStations\RDP-Tcp" 'UserAuthentication') -eq 0) { Add-Finding WARN sharing.rdp-nla '' 'Remote Desktop accepts connections without Network Level Authentication' 'Settings > System > Remote Desktop > require Network Level Authentication' }
  } else { Add-Finding PASS sharing.remote-desktop '' 'Remote Desktop is off' }
  if ((Get-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\Remote Assistance' 'fAllowToGetHelp') -eq 1) { Add-Finding WARN sharing.remote-assistance '' 'Remote Assistance invitations are allowed' 'System Properties > Remote: clear Allow Remote Assistance connections' }
  foreach ($svc in @(@('sshd', 'ssh-server', 'OpenSSH Server'), @('WinRM', 'winrm', 'Windows Remote Management'), @('RemoteRegistry', 'remote-registry', 'Remote Registry'))) {
    $s = Get-Service -Name $svc[0] -ErrorAction SilentlyContinue
    if ($s -and ([string]$s.Status -eq 'Running' -or [string]$s.StartType -eq 'Automatic')) {
      if ($Role -eq 'server' -and $svc[1] -eq 'ssh-server') { Add-Finding INFO "sharing.$($svc[1])" '' "$($svc[2]) is $($s.Status) ($($s.StartType)); expected for --role server" }
      else { Add-Finding WARN "sharing.$($svc[1])" '' "$($svc[2]) is $($s.Status) ($($s.StartType))" ($AdminHint + "Stop-Service $($svc[0]); Set-Service $($svc[0]) -StartupType Disabled (if you don't use it)") }
    }
  }
  $shares = @()
  try { $shares = @(Get-SmbShare -ErrorAction Stop | ForEach-Object { , @($_.Name, $_.Path) }) }
  catch { $r = Invoke-Tool 'net.exe' @('share') 10; if ($r -and $r.Code -eq 0) { $shares = @(Get-NetShareNames $r.Out) } }
  foreach ($sh in $shares) {
    if ($sh[0] -like '*$') { continue }
    Add-Finding WARN sharing.smb-share $sh[0] ('Shared folder {0} -> {1}' -f $sh[0], $sh[1]) 'Stop sharing it unless you need to: right-click the folder > Properties > Sharing'
  }
  if ((Get-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters' 'SMB1') -eq 1) { Add-Finding FAIL sharing.smb1-server '' 'The SMBv1 server is on' ($AdminHint + 'Set-SmbServerConfiguration -EnableSMB1Protocol $false') }
  $c = Get-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Services\mrxsmb10' 'Start'
  if ($null -ne $c -and $c -ne 4) { Add-Finding WARN sharing.smb1-client '' 'The SMBv1 client driver is installed and enabled' ($AdminHint + 'Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol') }

  $known = @('System', 'svchost', 'lsass', 'wininit', 'services', 'spoolsv', 'Idle', 'MsMpEng', 'NisSrv', 'SearchIndexer')
  try {
    $listen = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { @('0.0.0.0', '::') -contains $_.LocalAddress })
    $seen = @{}
    foreach ($l in $listen) {
      $port = [int]$l.LocalPort
      if (@(3389, 22, 5985, 5986, 445, 139, 135) -contains $port) { continue }
      $name = $null; try { $name = (Get-Process -Id $l.OwningProcess -ErrorAction Stop).ProcessName } catch { }
      $k = "$name|$port"; if ($seen.ContainsKey($k)) { continue }; $seen[$k] = 1
      if (-not $name) { Add-Finding INFO network.listening-all ('port-' + $(if ($port -ge 49152) { 'ephemeral' } else { $port })) "Port $port listens on all interfaces; its owner is not visible" ($AdminHint + "Get-Process -Id (Get-NetTCPConnection -LocalPort $port -State Listen).OwningProcess") }
      elseif ($known -contains $name) { Add-Finding INFO network.listening-all $name "$name (Windows) listens on all interfaces, port $port" }
      else { Add-Finding WARN network.listening-all $name "$name listens on all interfaces, port $port" 'Bind dev servers to 127.0.0.1, or stop the program if unused' }
    }
  } catch { Add-Finding SKIP network.listening-all '' 'could not list listening ports' }
  foreach ($p in @('ngrok', 'cloudflared', 'frpc', 'bore', 'zrok')) { if (Get-Process -Name $p -ErrorAction SilentlyContinue) { Add-Finding INFO network.tunnel $p "$p is running" 'Make sure every tunnel is one you still need' } }
}

function Get-SignatureStatus([string]$Path) {
  if (-not $Path -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) { return 'Unknown' }
  try { return [string](Get-AuthenticodeSignature -LiteralPath $Path -ErrorAction Stop).Status } catch { return 'Unknown' }
}
function Add-CommandFinding([string]$Id, [string]$Subject, [string]$What, [string]$CommandLine, [string]$Fix) {
  $prog = Get-ProgramPath $CommandLine
  $exists = $false
  if ($prog -match '^[A-Za-z]:\\|^\\\\') { $exists = Test-Path -LiteralPath $prog } else { $exists = [bool](Get-Command $prog -ErrorAction SilentlyContinue) }
  $sig = if ($exists) { Get-SignatureStatus $prog } else { 'Unknown' }
  $r = Get-CommandRisk $CommandLine $sig $exists
  Add-Finding $r[0] $Id $Subject ('{0} runs {1} ({2})' -f $What, $prog, $r[1]) $Fix
}

function Test-Persistence {
  if (-not (Test-WindowsOnly 'persistence.run-key')) { return }
  foreach ($k in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\RunOnce')) {
    $item = Get-Item -LiteralPath $k -ErrorAction SilentlyContinue; if (-not $item) { continue }
    foreach ($n in $item.GetValueNames()) {
      if ($n -eq '') { continue }
      Add-CommandFinding persistence.run-key "$k\$n" "Run key $n" ([string]$item.GetValue($n)) 'Show the command and its signature first; if unwanted, turn it off in Settings > Apps > Startup or Task Manager > Startup apps'
    }
  }
  $shell = $null; try { $shell = New-Object -ComObject WScript.Shell } catch { }
  foreach ($dir in @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('CommonStartup'))) {
    if (-not $dir -or -not (Test-Path -LiteralPath $dir)) { continue }
    foreach ($f in @(Get-ChildItem -LiteralPath $dir -File -Force -ErrorAction SilentlyContinue)) {
      if ($f.Name -eq 'desktop.ini') { continue }
      $cmd = '"' + $f.FullName + '"'
      if ($f.Extension -eq '.lnk' -and $shell) { $lnk = $shell.CreateShortcut($f.FullName); $cmd = '"' + $lnk.TargetPath + '" ' + $lnk.Arguments }
      Add-CommandFinding persistence.startup-folder $f.FullName ('Startup item ' + $f.Name) $cmd 'Show what it is first; if unwanted, move it out of the Startup folder to the Recycle Bin'
    }
  }
  try {
    foreach ($t in @(Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.TaskPath -notlike '\Microsoft\*' })) {
      foreach ($a in @($t.Actions)) {
        if (-not $a.Execute) { continue }
        $state = if ([string]$t.State -eq 'Disabled') { ' (disabled)' } else { '' }
        Add-CommandFinding persistence.scheduled-task ($t.TaskPath + $t.TaskName) ('Scheduled task ' + $t.TaskPath + $t.TaskName + $state) ('"' + $a.Execute + '" ' + $a.Arguments) 'Show the task and its signature first; if unwanted, disable it in Task Scheduler (yours) or ask an admin'
      }
    }
  } catch { Add-Finding SKIP persistence.scheduled-task '' 'could not list scheduled tasks' }
  try {
    foreach ($s in @(Get-CimInstance Win32_Service -ErrorAction Stop | Where-Object { $_.PathName -and $_.PathName -notmatch '(?i)^"?[A-Z]:\\Windows\\' })) {
      $prog = Get-ProgramPath $s.PathName; $why = @()
      if ($prog -match '(?i)\\Users\\|\\(Temp|Tmp)\\|^[A-Z]:\\ProgramData\\[^\\]+$') { $why += 'binary is in a user-writable folder' }
      if ($s.PathName -notmatch '^"' -and $prog -match ' ' ) { $why += 'unquoted path with spaces' }
      if ($Mode -eq 'deep') { $sig = Get-SignatureStatus $prog; if ($sig -eq 'NotSigned' -or $sig -eq 'HashMismatch') { $why += "binary signature: $sig" } }
      if ($why.Count) { Add-Finding WARN persistence.service $s.Name ('Service {0} runs {1} ({2})' -f $s.Name, $prog, ($why -join '; ')) 'Check what installed it; an admin can fix the path or remove the service' }
    }
  } catch { Add-Finding SKIP persistence.service '' 'could not list services' }
  try {
    foreach ($cls in @('CommandLineEventConsumer', 'ActiveScriptEventConsumer')) {
      foreach ($c in @(Get-CimInstance -Namespace root/subscription -ClassName $cls -ErrorAction Stop)) {
        $cmdLine = if ($c.CommandLineTemplate) { $c.CommandLineTemplate } else { [string]$c.ScriptFileName }
        Add-Finding WARN persistence.wmi-consumer $c.Name ('WMI event consumer {0} ({1}) runs {2}' -f $c.Name, $cls, (Get-ProgramPath $cmdLine)) 'WMI subscriptions are a common fileless persistence method; an admin should check it'
      }
    }
  } catch { Add-Finding SKIP persistence.wmi-consumer '' ('reading WMI subscriptions needs admin; ' + $AdminHint + 'Get-CimInstance -Namespace root/subscription -ClassName __EventConsumer') }
}

function Test-Hardening {
  if (-not (Test-WindowsOnly 'hardening.uac')) { return }
  $pol = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
  if ((Get-RegValue $pol 'EnableLUA') -eq 0) { Add-Finding FAIL hardening.uac '' 'User Account Control is off' 'Control Panel > User Accounts > Change User Account Control settings (needs a restart)' }
  elseif ((Get-RegValue $pol 'ConsentPromptBehaviorAdmin') -eq 0) { Add-Finding FAIL hardening.uac '' 'Admins elevate without any prompt' 'Change User Account Control settings: at least the default level' }
  elseif ((Get-RegValue $pol 'PromptOnSecureDesktop') -eq 0) { Add-Finding WARN hardening.uac '' 'UAC prompts are not on the secure desktop' 'Change User Account Control settings: the default level' }
  else { Add-Finding PASS hardening.uac '' 'User Account Control is on' }
  $ss1 = Get-RegValue 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System' 'EnableSmartScreen'
  $ss2 = Get-RegValue 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer' 'SmartScreenEnabled'
  if ($ss1 -eq 0 -or [string]$ss2 -eq 'Off') { Add-Finding WARN hardening.smartscreen '' 'SmartScreen for apps and files is off' 'Windows Security > App & browser control > Reputation-based protection' }
  else { Add-Finding INFO hardening.smartscreen '' 'SmartScreen is not turned off by policy or the Explorer setting' }
  $sb = Get-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot\State' 'UEFISecureBootEnabled'
  if ($sb -eq 1) { Add-Finding PASS hardening.secure-boot '' 'Secure Boot is on' }
  elseif ($sb -eq 0) { Add-Finding WARN hardening.secure-boot '' 'Secure Boot is off' 'Turn it on in the UEFI firmware settings' }
  else { Add-Finding SKIP hardening.secure-boot '' ('Secure Boot state not readable (legacy BIOS?); ' + $AdminHint + 'Confirm-SecureBootUEFI') }
  $ppl = Get-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa' 'RunAsPPL'
  Add-Finding INFO hardening.lsa-protection '' ('LSA protection (RunAsPPL) is ' + $(if ($ppl -ge 1) { 'on' } else { 'not set' })) 'Windows Security > Device security > Core isolation > Local Security Authority protection'
  try {
    $dg = Get-CimInstance -Namespace root/Microsoft/Windows/DeviceGuard -ClassName Win32_DeviceGuard -ErrorAction Stop
    Add-Finding INFO hardening.credential-guard '' ('Credential Guard is ' + $(if (@($dg.SecurityServicesRunning) -contains 1) { 'running' } else { 'not running' }))
  } catch { Add-Finding SKIP hardening.credential-guard '' 'Device Guard status is not readable' }
  try {
    foreach ($e in @(Get-ExecutionPolicy -List)) {
      if ([string]$e.Scope -eq 'Process') { continue }
      if (@('Unrestricted', 'Bypass') -contains [string]$e.ExecutionPolicy) { Add-Finding WARN hardening.execution-policy ([string]$e.Scope) ('PowerShell execution policy is {0} at {1} scope' -f $e.ExecutionPolicy, $e.Scope) "Set-ExecutionPolicy RemoteSigned -Scope $($e.Scope) (LocalMachine needs admin)" }
    }
  } catch { }
  $sbl = Get-RegValue 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ScriptBlockLogging' 'EnableScriptBlockLogging'
  Add-Finding INFO hardening.script-block-logging '' ('PowerShell script block logging is ' + $(if ($sbl -eq 1) { 'on' } else { 'off' }))
  $lock = Get-RegValue $pol 'InactivityTimeoutSecs'
  $ssSecure = Get-RegValue 'HKCU:\Control Panel\Desktop' 'ScreenSaverIsSecure'; $ssTime = Get-RegValue 'HKCU:\Control Panel\Desktop' 'ScreenSaveTimeOut'
  if ($lock -and [int]$lock -le 900) { Add-Finding PASS hardening.screen-lock '' "The PC locks after $lock s of inactivity (policy)" }
  elseif ([string]$ssSecure -eq '1' -and $ssTime -and [int]$ssTime -le 900) { Add-Finding PASS hardening.screen-lock '' "The screen saver locks after $ssTime s" }
  else { Add-Finding INFO hardening.screen-lock '' 'No inactivity lock is set by policy or the screen saver' 'Settings > Accounts > Sign-in options > If you have been away, and Settings > System > Power > Screen timeout' }
}

function Test-Apps {
  if (-not (Test-WindowsOnly 'apps.installed')) { return }
  $apps = @()
  foreach ($k in @('HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*')) {
    $apps += @(Get-ItemProperty -Path $k -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -and $_.SystemComponent -ne 1 -and -not $_.ParentKeyName })
  }
  $names = @($apps | ForEach-Object { $_.DisplayName } | Sort-Object -Unique)
  Add-Finding INFO apps.installed '' "$($names.Count) programs installed" 'Settings > Apps > Installed apps: remove what you do not use'
  foreach ($n in $names) {
    if ($n -match '(?i)TeamViewer|AnyDesk|RustDesk|ScreenConnect|Splashtop|RealVNC|TightVNC|UltraVNC|LogMeIn|Chrome Remote Desktop|Parsec|NoMachine|Zoho Assist') { Add-Finding WARN apps.remote-access $n "Remote-access tool installed: $n" 'Uninstall it unless you use it; these are a favorite way in for scammers and attackers' }
  }
  Add-Finding SKIP apps.unused '' ('Windows keeps last-run times in Prefetch, which needs admin; ' + $AdminHint + 'Get-ChildItem C:\Windows\Prefetch | Sort-Object LastWriteTime')
  $lx = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss'
  foreach ($d in @(Get-ChildItem -LiteralPath $lx -ErrorAction SilentlyContinue)) {
    $dn = Get-RegValue $d.PSPath 'DistributionName'; $ver = Get-RegValue $d.PSPath 'Version'
    if ($dn) { Add-Finding INFO apps.wsl-distro $dn ('WSL distro {0} (WSL {1}); its files and secrets are not scanned here' -f $dn, $(if ($ver -eq 2) { 2 } else { 1 })) 'wsl --unregister removes a distro you no longer use (this deletes its files)' }
  }
}

# Folders to search: existing repo roots in --fast, the user profile in --deep.
function Get-SearchDirs {
  if ($null -ne $script:SearchDirs) { return $script:SearchDirs }
  if ($Mode -eq 'deep') { $script:SearchDirs = @($UserHome); return $script:SearchDirs }
  $dirs = New-Object System.Collections.ArrayList
  foreach ($r in $RootList) {
    if (-not $r -or -not (Test-Path -LiteralPath $r -PathType Container)) { continue }
    if ($r -match '(?i)[\\/]OneDrive') { Add-Finding SKIP secrets.env-files $r "$r is inside OneDrive; reading it could download cloud-only files"; continue }
    [void]$dirs.Add($r)
  }
  $script:SearchDirs = $dirs.ToArray()
  return $script:SearchDirs
}

function Test-HoldsEnvCreds([string]$Path) {
  $lines = Read-Lines $Path
  if ((Get-MatchingLines $lines $SecretAssignRes).Count) { return $true }
  return ((Get-MatchingLines $lines @($TokenRe) -CaseSensitive).Count -gt 0)
}
function Add-CredPerm([string]$Path) {
  if (Test-LooseFile $Path) { Add-Finding FAIL secrets.file-permissions $Path "$Path holds credentials and other users can read it" $(if ($OnWindows) { "icacls `"$Path`" /inheritance:r /grant:r `"%USERNAME%:F`"" } else { "chmod 600 '$Path'" }) }
}
function Format-Lines($Nums) { $n = @($Nums); $s = (@($n | Select-Object -First 10) -join ','); if ($n.Count -gt 10) { $s += ', ...' }; return $s }

function Get-ProfilePaths {
  $docs = if ($env:WSC_HOME -or -not $OnWindows) { Get-HomePath 'Documents' } else { [Environment]::GetFolderPath('MyDocuments') }
  $list = @()
  foreach ($d in @('WindowsPowerShell', 'PowerShell')) { foreach ($f in @('profile.ps1', 'Microsoft.PowerShell_profile.ps1', 'Microsoft.VSCode_profile.ps1')) { $list += (Join-PathParts @($docs, $d, $f)) } }
  $list += (Get-HomePath '.config/powershell/profile.ps1'); $list += (Get-HomePath '.config/powershell/Microsoft.PowerShell_profile.ps1')
  foreach ($f in @('.bashrc', '.bash_profile', '.profile', '.zshrc')) { $list += (Get-HomePath $f) }
  return $list
}

function Test-Secrets {
  foreach ($f in (Get-ProfilePaths)) {
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) { continue }
    $lines = Read-Lines $f
    $hits = @(@(Get-MatchingLines $lines @($TokenRe) -CaseSensitive) + @(Get-MatchingLines $lines $SecretAssignRes) | Sort-Object -Unique)
    if ($hits.Count) { Add-Finding FAIL secrets.profile $f ('{0} line(s) {1} look like inline secrets' -f $f, (Format-Lines $hits)) 'Load them at runtime instead (Get-Secret, op read, or the Credential Manager), then rotate them' }
    $fetch = Get-MatchingLines $lines @('(?i)(iwr|irm|Invoke-WebRequest|Invoke-RestMethod|curl|wget)[^|]*\|\s*(iex|Invoke-Expression|sh|bash)\b', '(?i)\b(iex|Invoke-Expression)\b.*\b(iwr|irm|Invoke-WebRequest|Invoke-RestMethod|DownloadString)\b', '(?i)-EncodedCommand\s')
    if ($fetch.Count) { Add-Finding FAIL persistence.profile-fetch $f ('{0} line(s) {1} download and run remote code at every shell start' -f $f, (Format-Lines $fetch)) 'Look at those lines; remove them unless you wrote them, and rotate anything that shell could reach' }
  }
  $hist = @()
  $psrl = if ($OnWindows) { Join-PathParts @($AppData, 'Microsoft', 'Windows', 'PowerShell', 'PSReadLine') } else { Get-HomePath '.local/share/powershell/PSReadLine' }
  if (Test-Path -LiteralPath $psrl) { $hist += @(Get-ChildItem -LiteralPath $psrl -Filter '*_history.txt' -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }) }
  foreach ($f in @('.bash_history', '.python_history', '.node_repl_history', '.psql_history')) { $hist += (Get-HomePath $f) }
  foreach ($f in $hist) {
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) { continue }
    $hits = Get-MatchingLines (Read-Lines $f) @($TokenRe) -CaseSensitive
    if ($hits.Count) { Add-Finding FAIL secrets.shell-history $f ('{0} has {1} line(s) with token-like strings (lines {2})' -f $f, $hits.Count, (Format-Lines $hits)) 'Rotate those tokens first. Then delete the lines in an editor with every PowerShell window closed, or ask before moving the file to the Recycle Bin' }
  }
  if ($OnWindows -and -not $env:WSC_HOME) {
    foreach ($target in @('User', 'Machine')) {
      $vars = [Environment]::GetEnvironmentVariables($target); $bad = @()
      foreach ($k in $vars.Keys) { $v = [string]$vars[$k]; if ($v -cmatch $TokenRe -or (Test-LiteralSecret (([string]$k).ToUpper()) $v)) { $bad += [string]$k } }
      if ($bad.Count) { Add-Finding FAIL secrets.env-var $target ("{0} environment variables hold credentials: {1}" -f $target, (($bad | Sort-Object) -join ', ')) 'Settings > System > About > Advanced system settings > Environment Variables: remove them, load secrets at runtime, and rotate them' }
    }
  }

  $f = Get-HomePath '.aws/credentials'
  if (Test-Path -LiteralPath $f) {
    $n = @((Read-Lines $f) | Where-Object { $_ -match 'aws_access_key_id' }).Count
    if ($n) { Add-Finding FAIL secrets.aws-static-keys $f "$f holds $n long-lived access key(s)" 'Switch to IAM Identity Center (aws configure sso), then deactivate and delete the keys' }
    Add-CredPerm $f
  }
  foreach ($f in @((Get-HomePath '.netrc'), (Get-HomePath '_netrc'))) { if ((Test-Path -LiteralPath $f) -and (Read-Text $f) -match '(^|\s)password\s') { Add-Finding WARN secrets.netrc $f "$f holds password(s)" 'Use a credential helper instead'; Add-CredPerm $f } }
  $f = Get-HomePath '.npmrc'; if ((Test-Path -LiteralPath $f) -and (Read-Text $f) -match '(_authToken|_auth|_password)\s*=\s*[^$\s]') { Add-Finding WARN secrets.npm-token $f "$f holds a literal npm credential" 'Use a short-lived granular token from the environment (${NPM_TOKEN}), or npm logout when not publishing'; Add-CredPerm $f }
  $f = Get-HomePath '.docker/config.json'; if ((Test-Path -LiteralPath $f) -and (Read-Text $f) -match '"auth"\s*:\s*"[^"]+') { Add-Finding WARN secrets.docker-auth $f "$f stores registry logins inline" 'Set "credsStore": "wincred" (or "desktop") and log in again'; Add-CredPerm $f }
  foreach ($f in @((Join-PathParts @($AppData, 'GitHub CLI', 'hosts.yml')), (Get-HomePath '.config/gh/hosts.yml'))) { if ((Test-Path -LiteralPath $f) -and (Read-Text $f) -match 'oauth_token:') { Add-Finding WARN secrets.gh-plaintext $f "$f stores the GitHub CLI login in plain text" 'gh auth logout, then gh auth login (it uses the Credential Manager by default)'; Add-CredPerm $f } }
  $f = Get-HomePath '.kube/config'; if ((Test-Path -LiteralPath $f) -and (Read-Text $f) -match '(?m)^\s*(token|client-key-data|password):') { Add-CredPerm $f }
  foreach ($f in @((Join-PathParts @($AppData, 'gcloud', 'application_default_credentials.json')), (Join-PathParts @($AppData, 'gcloud', 'credentials.db')), (Get-HomePath '.config/gcloud/application_default_credentials.json'))) { if (Test-Path -LiteralPath $f) { Add-CredPerm $f } }

  if ($OnWindows -and -not $env:WSC_HOME) {
    $r = Invoke-Tool 'cmdkey.exe' @('/list') 10
    if ($r -and $r.Code -eq 0) {
      $n = @(($r.Out -split "`r?`n") | Where-Object { $_ -match '^\s*Target:' }).Count
      if ($n) { Add-Finding INFO secrets.credential-manager '' "Credential Manager holds $n saved credential(s) (names and values not shown)" 'Control Panel > Credential Manager: remove ones you no longer use' }
      else { Add-Finding INFO secrets.credential-manager '' 'Credential Manager entries could not be counted (no English Target: lines)' }
    } else { Add-Finding SKIP secrets.credential-manager '' 'cmdkey /list did not answer' }
  }

  # .env files that hold credentials, and service-account keys, under the repo roots.
  $dirs = @(Get-SearchDirs)
  if ($dirs.Count -eq 0) { Add-Finding SKIP secrets.env-files '' 'no repo roots found (set --roots or WSC_ROOTS); --deep searches the whole user profile'; return }
  $envs = New-Object System.Collections.ArrayList; $keys = New-Object System.Collections.ArrayList
  foreach ($d in $dirs) {
    foreach ($e in (Find-Files $d 6 { param($n) ($n -eq '.env' -or $n -like '.env.*' -or $n -like '*.env' -or $n -like '*.env.bak*') -and $n -notmatch '\.(example|sample|template|dist|defaults|schema)$' })) { if (Test-HoldsEnvCreds $e) { [void]$envs.Add($e) } }
    foreach ($j in (Find-Files $d 8 { param($n, $p) $n -like '*.json' -and (New-Object IO.FileInfo $p).Length -lt 20480 })) { $t = Read-Text $j; if ($t -match '"type"\s*:\s*"service_account"' -and $t -match '"private_key"') { [void]$keys.Add(@($j, ([regex]::Match($t, '"private_key_id"\s*:\s*"([^"]*)"').Groups[1].Value))) } }
  }
  if ($envs.Count -eq 0) { Add-Finding PASS secrets.env-files '' ('No .env files with credentials in ' + ($dirs -join ' ')) }
  else {
    Add-Finding WARN secrets.env-files '' ('{0} .env file(s) hold credentials under {1}' -f $envs.Count, ($dirs -join ' ')) 'Delete those in stale clones and worktrees; load secrets at runtime where you can'
    foreach ($e in $envs) {
      if ([IO.Path]::GetFileName($e) -match '\.bak|backup|\.old$|\.orig$|~$') { Add-Finding FAIL secrets.env-backup $e "Backup of a .env file with credentials: $e" 'Make sure the values are rotated, then move it to the Recycle Bin' }
      if (Test-LooseFile $e) { Add-Finding WARN secrets.env-permissions $e "$e is readable by other users" $(if ($OnWindows) { "icacls `"$e`" /inheritance:r /grant:r `"%USERNAME%:F`"" } else { "chmod 600 '$e'" }) }
    }
  }
  if ($keys.Count) {
    $distinct = @($keys | ForEach-Object { $_[1] } | Sort-Object -Unique).Count
    Add-Finding FAIL secrets.gcp-sa-keys '' ('{0} Google service-account key file(s) on disk ({1} distinct keys), e.g. {2}' -f $keys.Count, $distinct, ((@($keys | Select-Object -First 2 | ForEach-Object { $_[0] })) -join ' ')) 'Rotate the keys in IAM, delete the copies, use gcloud user sign-in or workload identity'
  } else { Add-Finding PASS secrets.gcp-sa-keys '' 'No Google service-account key files found' }
}

function Test-Ssh {
  $dir = Get-HomePath '.ssh'
  if (Test-Path -LiteralPath $dir) {
    foreach ($f in @(Get-ChildItem -LiteralPath $dir -File -Force -ErrorAction SilentlyContinue)) {
      if ($f.Name -like '*.pub' -or $f.Name -like 'known_hosts*' -or $f.Name -like 'authorized_keys*' -or $f.Name -eq 'config') { continue }
      $text = Read-Text $f.FullName; if (-not $text -or $text -notmatch 'BEGIN .*PRIVATE KEY') { continue }
      if (Test-LooseFile $f.FullName) { Add-Finding FAIL ssh.key-permissions $f.FullName "$($f.FullName) is readable by other users" $(if ($OnWindows) { "icacls `"$($f.FullName)`" /inheritance:r /grant:r `"%USERNAME%:F`"" } else { "chmod 600 '$($f.FullName)'" }) }
      if ($text -match 'ENCRYPTED') { Add-Finding PASS ssh.key $f.FullName "$($f.FullName) is passphrase-protected"; continue }
      $r = Invoke-Tool 'ssh-keygen' @('-y', '-P', '', '-f', $f.FullName) 10
      if (-not $r) { Add-Finding SKIP ssh.key $f.FullName 'ssh-keygen is not installed'; continue }
      $fix = "Use a hardware-backed key or agent, or add a passphrase: ssh-keygen -p -f `"$($f.FullName)`""
      if ($r.Code -ne 0) {
        if (($r.Err + $r.Out) -match 'UNPROTECTED|bad permissions') { Add-Finding PASS ssh.key $f.FullName "$($f.FullName): ssh-keygen refused to read it (permissions); passphrase unknown" }
        else { Add-Finding PASS ssh.key $f.FullName "$($f.FullName) is passphrase-protected" }
      } elseif ($r.Out -match '^sk-') { Add-Finding INFO ssh.key $f.FullName "$($f.FullName) is a hardware-backed (FIDO) key without a passphrase" }
      else { Add-Finding FAIL ssh.key $f.FullName "$($f.FullName) has no passphrase" $fix }
    }
    $f = Join-PathParts @($dir, 'authorized_keys')
    if (Test-Path -LiteralPath $f) { $n = @((Read-Lines $f) | Where-Object { $_ -match '\S' -and $_ -notmatch '^\s*#' }).Count; if ($n) { Add-Finding WARN ssh.authorized-keys '' "$n key(s) can log in to this account over SSH" 'Remove keys you do not recognise; turn off OpenSSH Server if unused' } }
    $f = Join-PathParts @($dir, 'config')
    if (Test-Path -LiteralPath $f) {
      $lines = Read-Lines $f
      $a = Get-MatchingLines $lines @('^\s*ForwardAgent[\s=]+yes'); if ($a.Count) { Add-Finding WARN ssh.forward-agent '' ('{0} line(s) {1} forward your SSH agent' -f $f, (Format-Lines $a)) 'Forward only to hosts you trust, per Host block; prefer ProxyJump' }
      $b = Get-MatchingLines $lines @('^\s*StrictHostKeyChecking[\s=]+(no|off)', '^\s*UserKnownHostsFile[\s=]+(/dev/null|NUL)\s*$'); if ($b.Count) { Add-Finding WARN ssh.host-key-checking '' ('{0} line(s) {1} turn off host key checking' -f $f, (Format-Lines $b)) 'Remove them, or limit them to throwaway local VMs' }
    }
  }
  if ($OnWindows -and (Test-Path 'C:\ProgramData\ssh\administrators_authorized_keys')) { Add-Finding INFO ssh.admin-authorized-keys '' 'administrators_authorized_keys exists (admins can log in with these keys); reading it needs admin' ($AdminHint + 'Get-Content C:\ProgramData\ssh\administrators_authorized_keys') }
  $r = Invoke-Tool 'ssh-add' @('-l') 5
  if ($r) {
    if ($r.Code -eq 0) { Add-Finding INFO ssh.agent '' ("{0} key(s) loaded in the SSH agent" -f @(($r.Out -split "`r?`n") | Where-Object { $_ }).Count) }
    elseif ($r.Code -eq 1) { Add-Finding INFO ssh.agent '' 'The SSH agent holds no keys' }
    else { Add-Finding INFO ssh.agent '' 'No SSH agent reachable' }
  }
}

function Test-Git {
  $f = Get-HomePath '.git-credentials'
  if (Test-Path -LiteralPath $f) { Add-Finding FAIL git.credential-store $f "$f stores Git passwords or tokens in plain text" 'Use Git Credential Manager (git config --global credential.helper manager), rotate the tokens, then move the file to the Recycle Bin' }
  $r = Invoke-Tool 'git' @('config', '--global', '--get-all', 'credential.helper') 5
  if ($r -and (' ' + $r.Out + ' ') -match '\sstore(\s|$)') { Add-Finding FAIL git.credential-store 'helper' 'git credential.helper is store (plain-text file)' 'git config --global --unset-all credential.helper; use Git Credential Manager' }
  $r = Invoke-Tool 'git' @('config', '--global', 'commit.gpgsign') 5
  if ($r) { if ($r.Out.Trim() -eq 'true') { Add-Finding PASS git.commit-signing '' 'Commits are signed by default' } else { Add-Finding INFO git.commit-signing '' 'Commits are not signed by default' 'Optional: sign with an SSH key (git config --global gpg.format ssh; commit.gpgsign true)' } }
  if ($Offline) { Add-Finding SKIP git.gh-scopes '' '--offline'; return }
  $r = Invoke-Tool 'gh' @('auth', 'status') 10
  if (-not $r) { Add-Finding SKIP git.gh-scopes '' 'gh is not installed'; return }
  if ($r.TimedOut) { Add-Finding SKIP git.gh-scopes '' 'gh auth status timed out'; return }
  $scopes = @([regex]::Matches(($r.Out + $r.Err), "(?im)token scopes:(.*)$") | ForEach-Object { [regex]::Matches($_.Groups[1].Value, "'([^']+)'") | ForEach-Object { $_.Groups[1].Value } } | Sort-Object -Unique)
  if (-not $scopes.Count) { Add-Finding SKIP git.gh-scopes '' 'gh is not logged in, or reported no scopes'; return }
  foreach ($s in $scopes) {
    if (@('delete_repo', 'admin:org', 'admin:enterprise', 'admin:org_hook', 'admin:repo_hook', 'site_admin', 'admin:public_key', 'admin:gpg_key') -contains $s) { Add-Finding WARN git.gh-scopes $s "The GitHub CLI login has the $s scope" "gh auth refresh --remove-scopes $s (keep powerful scopes for short sessions)" }
    elseif ($s -eq 'workflow') { Add-Finding INFO git.gh-scopes $s 'The GitHub CLI login can edit workflows (workflow scope)' }
  }
}

function Test-Packages {
  $r = Invoke-Tool 'pnpm' @('config', 'get', 'minimum-release-age') 15
  if (-not $r) { Add-Finding SKIP packages.pnpm-release-age '' 'pnpm is not installed' }
  else {
    $v = $r.Out.Trim()
    if ($v -match '^\d+$' -and [int]$v -ge 1440) { Add-Finding PASS packages.pnpm-release-age '' "pnpm minimum-release-age is $v minutes" }
    elseif ($v -match '^\d+$' -and [int]$v -gt 0) { Add-Finding WARN packages.pnpm-release-age '' "pnpm minimum-release-age is only $v minutes" 'pnpm config set minimum-release-age 10080 --global' }
    else { Add-Finding WARN packages.pnpm-release-age '' 'No minimum-release-age in your global pnpm config' 'pnpm config set minimum-release-age 10080 --global (7 days); also set minimumReleaseAge in each pnpm-workspace.yaml' }
  }
  $r = Invoke-Tool 'npm' @('config', 'get', 'ignore-scripts') 15
  if (-not $r) { Add-Finding SKIP packages.npm-ignore-scripts '' 'npm is not installed' }
  else {
    if ($r.Out.Trim() -eq 'true') { Add-Finding PASS packages.npm-ignore-scripts '' 'npm ignore-scripts is true' } else { Add-Finding WARN packages.npm-ignore-scripts '' 'npm runs package install scripts' 'npm config set ignore-scripts true (allow the few packages that need a build)' }
    # npm config get can print null even when set (npm/cli#9199), so read ~/.npmrc too.
    $r = Invoke-Tool 'npm' @('config', 'get', 'min-release-age') 15
    $v = if ($r) { $r.Out.Trim() } else { '' }
    if ($v -notmatch '^[1-9]\d*$') { $m = [regex]::Match([string](Read-Text (Get-HomePath '.npmrc')), '(?m)^\s*min-release-age\s*=\s*(\d+)'); $v = if ($m.Success) { $m.Groups[1].Value } else { '' } }
    if ($v -match '^[1-9]\d*$') { Add-Finding PASS packages.npm-release-age '' "npm min-release-age is $v day(s)" } else { Add-Finding WARN packages.npm-release-age '' 'No npm min-release-age' 'npm config set min-release-age 7 (npm 11.10 or later)' }
  }
  foreach ($f in @((Join-PathParts @($AppData, 'pip', 'pip.ini')), (Get-HomePath 'pip/pip.ini'), (Get-HomePath '.config/pip/pip.conf'), (Get-HomePath '.pip/pip.conf'), (Join-PathParts @($AppData, 'uv', 'uv.toml')), (Get-HomePath '.config/uv/uv.toml'))) {
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) { continue }
    $hits = Get-MatchingLines (Read-Lines $f) @('^\s*(extra-index-url|trusted-host|extra_index_url)')
    if ($hits.Count) { Add-Finding WARN packages.pip-index $f ('{0} sets an extra index or trusted host (line(s) {1})' -f $f, (Format-Lines $hits)) 'Use one index (index-url) and pin hashes; extra indexes let a public package shadow a private one' }
  }
  foreach ($v in @('PIP_EXTRA_INDEX_URL', 'PIP_TRUSTED_HOST', 'UV_EXTRA_INDEX_URL')) { if ([Environment]::GetEnvironmentVariable($v)) { Add-Finding WARN packages.pip-index $v "$v is set in the environment" 'Use one index and pin hashes' } }
  if (-not $OnWindows) { return }
  if ($Mode -ne 'deep') { Add-Finding SKIP packages.winget-upgrades '' 'needs --deep (winget contacts its sources)' }
  elseif ($Offline) { Add-Finding SKIP packages.winget-upgrades '' '--offline' }
  else {
    $r = Invoke-Tool 'winget' @('upgrade', '--include-unknown', '--disable-interactivity') 180
    if (-not $r) { Add-Finding SKIP packages.winget-upgrades '' 'winget is not installed' }
    elseif ($r.TimedOut) { Add-Finding SKIP packages.winget-upgrades '' 'winget upgrade took over 180 s' }
    else {
      $m = [regex]::Match($r.Out, '(\d+)\s+upgrades?\s+available')
      if ($m.Success) { Add-Finding WARN packages.winget-upgrades '' "$($m.Groups[1].Value) winget package upgrade(s) available" 'winget upgrade --all (review the list first)' }
      elseif ($r.Out -match 'No installed package found matching|No applicable upgrade') { Add-Finding PASS packages.winget-upgrades '' 'No winget upgrades available' }
      else { Add-Finding SKIP packages.winget-upgrades '' 'could not read winget upgrade output (it may need its source agreements accepted once)' }
    }
  }
}

function Test-Editors {
  foreach ($d in @((Get-HomePath '.vscode/extensions'), (Get-HomePath '.cursor/extensions'), (Get-HomePath '.windsurf/extensions'))) {
    if (Test-Path -LiteralPath $d) { $n = @(Get-ChildItem -LiteralPath $d -Directory -ErrorAction SilentlyContinue).Count; Add-Finding INFO editors.extensions $d "${d}: $n extension(s)" 'Remove ones you do not use; prefer verified publishers' }
  }
  foreach ($f in @((Join-PathParts @($AppData, 'Code', 'User', 'settings.json')), (Join-PathParts @($AppData, 'Cursor', 'User', 'settings.json')), (Join-PathParts @($AppData, 'Windsurf', 'User', 'settings.json')))) {
    $t = Read-Text $f; if (-not $t) { continue }
    if ($t -match '"security\.workspace\.trust\.enabled"\s*:\s*false') { Add-Finding WARN editors.workspace-trust $f "${f}: Workspace Trust is off, so any folder you open can run its tasks and extensions" 'Remove "security.workspace.trust.enabled": false' }
    if ($t -match '"task\.allowAutomaticTasks"\s*:\s*"on"') { Add-Finding WARN editors.auto-tasks $f "${f}: tasks that run on folder open are allowed without asking" 'Set "task.allowAutomaticTasks" to "off"' }
  }
  $local = if ($OnWindows) { $LocalAppData } else { Get-HomePath '.config' }
  foreach ($b in @(@('Chrome', (Join-PathParts @($local, 'Google', 'Chrome', 'User Data'))), @('Edge', (Join-PathParts @($local, 'Microsoft', 'Edge', 'User Data'))), @('Brave', (Join-PathParts @($local, 'BraveSoftware', 'Brave-Browser', 'User Data'))))) {
    if (-not (Test-Path -LiteralPath $b[1])) { continue }
    foreach ($prof in @(Get-ChildItem -LiteralPath $b[1] -Directory -ErrorAction SilentlyContinue)) {
      $ext = Join-Path $prof.FullName 'Extensions'; if (-not (Test-Path -LiteralPath $ext)) { continue }
      $n = @(Get-ChildItem -LiteralPath $ext -Directory -ErrorAction SilentlyContinue).Count; $wide = 0
      foreach ($m in @(Get-ChildItem -LiteralPath $ext -Filter manifest.json -Recurse -Depth 2 -File -ErrorAction SilentlyContinue)) { if ((Read-Text $m.FullName) -match '"<all_urls>"|"\*://\*/\*"|"https?://\*/\*"|"debugger"|"cookies"|"nativeMessaging"') { $wide++ } }
      Add-Finding INFO browser.extensions $ext ('{0} in {1}: {2} extension(s), {3} with broad access (all sites, cookies, debugger or native messaging)' -f $prof.Name, $b[0], $n, $wide) "Open the browser's extensions page; remove anything unused or unknown"
    }
  }
}

function Add-McpServerFindings([string]$Cfg, $Server) {
  if ([int]$Server[3] -gt 0) { Add-Finding FAIL agents.mcp-inline-secret "$Cfg#$($Server[0])" ('{0}: MCP server {1} has {2} credential(s) written inline' -f $Cfg, $Server[0], $Server[3]) 'Reference them from the environment or a secret manager instead, then rotate them' }
  if ((Get-McpPinState $Server[1] $Server[2]) -eq 'unpinned') { Add-Finding WARN agents.mcp-unpinned "$Cfg#$($Server[0])" ('{0}: MCP server {1} is launched unpinned ({2} {3}), so each start fetches the newest version' -f $Cfg, $Server[0], $Server[1], ((@($Server[2] -split '\s+') | Select-Object -First 3) -join ' ')) 'Pin an exact version, or install it once and run the binary' }
}
function Add-ClaudeSettings([string]$Path, [bool]$IsUser) {
  $obj = $null; try { $obj = ConvertFrom-JsonText (Read-Text $Path) } catch { Add-Finding SKIP agents.claude-settings $Path "could not parse $Path"; return }
  $fixes = @{ 'bypass' = 'Keep bypass and skip-prompt for sandboxes, containers and VMs; use approval prompts on your own machine'; 'skip-prompt' = 'Keep bypass and skip-prompt for sandboxes, containers and VMs; use approval prompts on your own machine'; 'all-project-mcp' = 'Set it to false and approve project servers one by one'; 'hook-fetch' = 'Read each hook; a hook runs on every matching event with your permissions'; 'env-secret' = 'Use apiKeyHelper or a secret manager, then rotate the values'; 'base-url' = ''; 'deny' = 'Add permissions.deny rules such as Read(~/.ssh/**), Read(./.env*), Read(~/.aws/**)'; 'sandbox' = 'Turn on the sandbox (sandbox.enabled true, allowUnsandboxedCommands false) where your workflow allows' }
  $ids = @{ 'bypass' = 'agents.claude-permissions'; 'skip-prompt' = 'agents.claude-permissions'; 'all-project-mcp' = 'agents.claude-project-mcp'; 'hook-fetch' = 'agents.claude-hooks'; 'env-secret' = 'agents.claude-env-secret'; 'base-url' = 'agents.claude-base-url'; 'deny' = 'agents.claude-deny'; 'sandbox' = 'agents.claude-sandbox' }
  foreach ($x in @(Get-ClaudeSettingsFindings $obj $IsUser)) {
    $subject = if ($x[1] -eq 'bypass' -or $x[1] -eq 'skip-prompt') { "$Path#$($x[1])" } else { $Path }
    Add-Finding $x[0] $ids[$x[1]] $subject ('{0}: {1}' -f $Path, $x[2]) $fixes[$x[1]]
  }
}

function Test-Agents {
  foreach ($f in @((Get-HomePath '.claude/settings.json'), (Get-HomePath '.claude/settings.local.json'))) { if (Test-Path -LiteralPath $f) { Add-ClaudeSettings $f $true } }
  $managed = if ($OnWindows) { 'C:\Program Files\ClaudeCode\managed-settings.json' } else { '/etc/claude-code/managed-settings.json' }
  if (Test-Path -LiteralPath $managed) { Add-Finding INFO agents.claude-managed '' 'Managed Claude Code settings are installed' 'They override user settings; make sure they are expected' }
  $proj = @(); foreach ($d in (Get-SearchDirs)) { $proj += @(Find-Files $d 5 { param($n, $p) $n -eq '.mcp.json' -or (($n -eq 'settings.json' -or $n -eq 'settings.local.json') -and ([IO.Path]::GetFileName([IO.Path]::GetDirectoryName($p)) -eq '.claude')) }) }
  $userClaude = Get-HomePath '.claude'
  foreach ($f in $proj) { if ($f -like '*settings*.json' -and -not $f.StartsWith($userClaude)) { Add-ClaudeSettings $f $false } }
  $mcpFiles = @($proj | Where-Object { [IO.Path]::GetFileName($_) -eq '.mcp.json' })
  if ($mcpFiles.Count) { Add-Finding INFO agents.project-mcp '' "$($mcpFiles.Count) project .mcp.json file(s) under your repo roots" 'Project MCP servers run as you once approved: review each before trusting a repo' }
  foreach ($cfg in @(@((Get-HomePath '.claude.json'), (Get-HomePath '.cursor/mcp.json'), (Join-PathParts @($AppData, 'Claude', 'claude_desktop_config.json')), (Get-HomePath '.codeium/windsurf/mcp_config.json'), (Get-HomePath '.gemini/settings.json')) + $mcpFiles)) {
    if (-not (Test-Path -LiteralPath $cfg -PathType Leaf)) { continue }
    $obj = $null; try { $obj = ConvertFrom-JsonText (Read-Text $cfg) } catch { Add-Finding SKIP agents.mcp $cfg "could not parse $cfg"; continue }
    foreach ($s in @(Get-McpServers $obj)) { Add-McpServerFindings $cfg $s }
  }
  $f = Get-HomePath '.codex/config.toml'
  if (Test-Path -LiteralPath $f) {
    foreach ($x in @(Get-CodexFindings (Read-Lines $f) $UserHome $RootList)) {
      switch ($x[1]) {
        'approval-never' { Add-Finding WARN agents.codex-approval $x[2] "Codex approval_policy is never ($($x[2]))" 'Use on-request outside a sandbox or VM' }
        'full-access' { Add-Finding WARN agents.codex-sandbox $x[2] "Codex sandbox_mode is danger-full-access ($($x[2]))" 'Use workspace-write; keep full access for throwaway VMs' }
        'network' { Add-Finding INFO agents.codex-network '' 'Codex workspace-write sandbox allows network access' }
        'trust-broad' { Add-Finding WARN agents.codex-trust-broad $x[2] "Codex trusts a whole folder of repos or your home: $($x[2])" 'Remove that [projects] entry; trust individual repos' }
        'trusted-count' { Add-Finding INFO agents.codex-trusted-projects '' "$($x[2]) trusted Codex project(s)" 'Trim entries for deleted checkouts' }
        'trusted-tmp' { Add-Finding INFO agents.codex-trusted-tmp '' "$($x[2]) trusted Codex project(s) are temp folders" 'Remove them from config.toml' }
        default { if ($x[0] -eq 'MCP') { Add-McpServerFindings $f @($x[1], $x[2], $x[3], $x[4]) } }
      }
    }
  }
}

function Test-Docker {
  foreach ($f in @((Join-PathParts @($AppData, 'Docker', 'settings-store.json')), (Join-PathParts @($AppData, 'Docker', 'settings.json')))) {
    $t = Read-Text $f
    if ($t -and $t -match '"exposeDockerAPIOnTCP2375"\s*:\s*true') { Add-Finding FAIL docker.tcp-exposed $f 'Docker Desktop exposes its API on tcp://localhost:2375 without TLS' 'Docker Desktop > Settings > General: turn off Expose daemon on tcp://localhost:2375 without TLS' }
  }
  foreach ($f in @((Get-HomePath '.docker/daemon.json'), 'C:\ProgramData\docker\config\daemon.json')) {
    $t = Read-Text $f
    if ($t -and $t -match '"hosts"[^\]]*tcp://' -and $t -notmatch '"tlsverify"\s*:\s*true') { Add-Finding FAIL docker.tcp-exposed $f "$f makes the Docker daemon listen on TCP without TLS verification" 'Remove the tcp:// host, or turn on tlsverify' }
  }
  $r = Invoke-Tool 'docker' @('info', '--format', '{{.ServerVersion}}') 8
  if (-not $r) { Add-Finding SKIP docker.published-port '' 'docker is not installed'; return }
  if ($r.Code -ne 0 -or $r.TimedOut) { Add-Finding SKIP docker.published-port '' 'the Docker daemon is not running'; return }
  $r = Invoke-Tool 'docker' @('ps', '--format', '{{.Names}}|{{.Ports}}') 8
  if ($r -and $r.Code -eq 0) {
    foreach ($line in ($r.Out -split "`r?`n")) { if ($line -match '0\.0\.0\.0:|:::|\[::\]:') { $p = $line -split '\|', 2; Add-Finding WARN docker.published-port $p[0] ('Container {0} publishes on all interfaces: {1}' -f $p[0], $p[1]) 'Publish to 127.0.0.1 only (-p 127.0.0.1:3000:3000), or stop the container' } }
  }
}

# Stale checkouts that still hold .env credentials. Reads only file times: it never runs git inside
# the repo, because a repo's own config can make git run programs.
function Test-Stale {
  $dirs = @($RootList | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Container) -and $_ -notmatch '(?i)[\\/]OneDrive' })
  if (-not $dirs.Count) { Add-Finding SKIP stale.checkout '' 'no repo roots found'; return }
  foreach ($d in $dirs) {
    foreach ($g in (Find-Files $d 4 { param($n) $n -eq '.git' } -IncludeDirs)) { Test-StaleRepo $g }
  }
}
function Test-StaleRepo([string]$GitPath) {
  $repo = Split-Path -Parent $GitPath; $gd = $GitPath
  if (Test-Path -LiteralPath $GitPath -PathType Leaf) { $m = [regex]::Match([string](Read-Text $GitPath), 'gitdir:\s*(.+)'); if ($m.Success) { $gd = $m.Groups[1].Value.Trim(); if (-not [IO.Path]::IsPathRooted($gd)) { $gd = Join-Path $repo $gd } } }
  $last = $null
  foreach ($f in @('index', 'HEAD', (Join-PathParts @('logs', 'HEAD')), 'FETCH_HEAD')) { $p = Join-Path $gd $f; if (Test-Path -LiteralPath $p) { $t = (Get-Item -LiteralPath $p -Force).LastWriteTime; if (-not $last -or $t -gt $last) { $last = $t } } }
  if (-not $last) { return }
  $age = [int]((Get-Date) - $last).TotalDays
  if ($age -lt $DaysUnused) { return }
  $n = @(Find-Files $repo 3 { param($n) $n -like '.env*' -and $n -notmatch '\.(example|sample|template)$' } | Where-Object { Test-HoldsEnvCreds $_ }).Count
  if ($n) { Add-Finding WARN stale.checkout $repo ('{0}: untouched for {1} days, {2} .env file(s) with credentials' -f $repo, $age, $n) 'Delete the checkout (git worktree remove for worktrees) or its .env files, after checking for unpushed work' }
}

function Test-Cloud {
  $t = Read-Text (Get-HomePath '.kube/config'); if (-not $t) { return }
  $m = [regex]::Match($t, '(?m)^current-context:\s*"?([^"\r\n]+)')
  if ($m.Success -and $m.Groups[1].Value -match '(?i)prod') { Add-Finding WARN cloud.kubectl-prod-default '' "kubectl's default context looks like production: $($m.Groups[1].Value)" 'Default to a non-production context; pass --context for production on purpose' }
}

# ---------- finalize: redaction, allowlist, keys, diff, output ----------

function ConvertTo-Record($Level, $Id, $Subject, $Detail, $Fix, $Extra) {
  $score = if ($Level -eq 'FAIL') { 10 } elseif ($Level -eq 'WARN') { 3 } else { 0 }
  $o = [ordered]@{ id = $Id; level = $Level; score = $score; subject = $Subject; detail = $Detail; fix = $Fix; key = ''; norm = (Get-ShortHash ($Detail -replace '[0-9]+', '#')) }
  if ($Extra) { foreach ($k in $Extra.Keys) { $o[$k] = $Extra[$k] } }
  return $o
}

function Get-FinalRecords([string]$AllowPath, [string]$Today) {
  $allow = New-Object System.Collections.ArrayList; $late = New-Object System.Collections.ArrayList
  if ($AllowPath -and (Test-Path -LiteralPath $AllowPath)) {
    $n = 0
    foreach ($raw in (Read-Lines $AllowPath)) {
      $n++; if ($raw -match '^\s*(#|$)') { continue }
      $a = @($raw -split "`t" | ForEach-Object { Protect-Text $_ 200 })
      if ($a.Count -lt 4 -or $a[0] -eq '' -or $a[1] -eq '' -or $a[2] -eq '' -or $a[3] -notmatch '^\d{4}-\d{2}-\d{2}$') { [void]$late.Add((ConvertTo-Record 'WARN' 'meta.allowlist-invalid' "line $n" "allowlist line $n needs id, match, reason and expiry (YYYY-MM-DD), separated by tabs" 'Fix or delete that line of the allowlist' $null)); continue }
      if ($a[3] -lt $Today) { [void]$late.Add((ConvertTo-Record 'WARN' 'meta.allowlist-expired' "$($a[0]) $($a[1])" "allowlist entry for $($a[0]) ($($a[1])) expired on $($a[3]): $($a[2])" 'Check the finding again, then renew the date or delete the line' $null)); continue }
      [void]$allow.Add($a)
    }
  }
  $records = New-Object System.Collections.ArrayList
  foreach ($f in $script:Findings) {
    $lvl = $f.Level; $subj = Protect-Text $f.Subject 200; $det = Protect-Text $f.Detail 400; $fix = Protect-Text $f.Fix 300; $extra = $null
    if ($lvl -eq 'FAIL' -or $lvl -eq 'WARN') {
      foreach ($a in $allow) {
        if ($f.Id -like $a[0] -and $subj -like $a[1]) {
          $extra = [ordered]@{ accepted = $true; was = $lvl; reason = $a[2]; expires = $a[3] }
          $det = Protect-Text ($det + ' (accepted until ' + $a[3] + ': ' + $a[2] + ')') 400; $lvl = 'INFO'; break
        }
      }
    }
    [void]$records.Add((ConvertTo-Record $lvl $f.Id $subj $det $fix $extra))
  }
  foreach ($l in $late) { [void]$records.Add($l) }
  $seen = @{}
  foreach ($r in $records) { $k = $r.id + ':' + (Get-ShortHash $r.subject); if ($seen.ContainsKey($k)) { $seen[$k]++; $k = $k + '.' + $seen[$k] } else { $seen[$k] = 1 }; $r.key = $k }
  return $records.ToArray()
}

function Get-Summary($Records, [string]$Mode, [int]$Elapsed) {
  $c = [ordered]@{ FAIL = 0; WARN = 0; INFO = 0; PASS = 0; SKIP = 0; accepted = 0 }; $score = 0
  foreach ($r in $Records) {
    if ($r.id -match '^meta\.(version|timing)$') { continue }
    $c[$r.level]++; $score += $r.score; if ($r.Contains('accepted')) { $c.accepted++ }
  }
  $detail = 'FAIL {0}, WARN {1}, INFO {2}, PASS {3}, SKIP {4}, accepted {5}; score {6}; {7} scan in {8} s' -f $c.FAIL, $c.WARN, $c.INFO, $c.PASS, $c.SKIP, $c.accepted, $score, $Mode, $Elapsed
  return [ordered]@{ id = 'meta.summary'; level = 'INFO'; score = $score; subject = ''; detail = $detail; fix = ''; key = 'meta.summary'; norm = ''; counts = $c; total_score = $score; mode = $Mode; version = $WscVersion; elapsed_s = $Elapsed }
}

# Diff of the current records against baseline JSON lines, keyed by check id + subject.
function Get-Diff([string[]]$BaseLines, $Records, [string]$Mode) {
  $base = @{}
  foreach ($l in $BaseLines) { if (-not $l) { continue }; try { $o = $l | ConvertFrom-Json } catch { continue }; if ($o.id -like 'meta.*') { continue }; $base[$o.key] = $o }
  $out = New-Object System.Collections.ArrayList; $seen = @{}; $new = 0; $newFail = 0; $changed = 0; $resolved = 0
  foreach ($r in $Records) {
    if ($r.id -like 'meta.*') { continue }
    $seen[$r.key] = 1
    if (-not $base.ContainsKey($r.key)) { $new++; if ($r.level -eq 'FAIL') { $newFail++ }; $x = [ordered]@{}; foreach ($k in $r.Keys) { $x[$k] = $r[$k] }; $x.diff = 'new'; [void]$out.Add($x) }
    elseif ($base[$r.key].level -ne $r.level -or $base[$r.key].norm -ne $r.norm) {
      $changed++; if ($r.level -eq 'FAIL' -and $base[$r.key].level -ne 'FAIL') { $newFail++ }
      $x = [ordered]@{}; foreach ($k in $r.Keys) { $x[$k] = $r[$k] }; $x.diff = 'changed'; $x.prev_level = $base[$r.key].level; [void]$out.Add($x)
    }
  }
  foreach ($k in $base.Keys) {
    if ($seen.ContainsKey($k)) { continue }
    $resolved++; $b = $base[$k]; $x = [ordered]@{}; foreach ($p in $b.PSObject.Properties) { $x[$p.Name] = $p.Value }; $x.diff = 'resolved'; [void]$out.Add($x)
  }
  [void]$out.Add([ordered]@{ id = 'meta.summary'; level = 'INFO'; score = 0; subject = ''; detail = ('since the last {0} scan: {1} new, {2} resolved, {3} changed; {4} FAIL not in the baseline' -f $Mode, $new, $resolved, $changed, $newFail); fix = ''; key = 'meta.summary'; norm = ''; new = $new; new_fail = $newFail; resolved = $resolved; changed = $changed })
  return [pscustomobject]@{ Records = $out.ToArray(); NewFail = $newFail }
}

function ConvertTo-Line($Record) { return ($Record | ConvertTo-Json -Compress -Depth 4) }

function Format-Text($Records) {
  $rank = @{ FAIL = 1; WARN = 2; INFO = 3; PASS = 4; SKIP = 5 }; $rows = New-Object System.Collections.ArrayList; $summary = ''; $i = 0
  foreach ($r in $Records) {
    $i++
    if ($r.id -eq 'meta.summary') { $summary = $r.detail; continue }
    $dot = $r.id.IndexOf('.'); $area = if ($dot -ge 0) { $r.id.Substring(0, $dot) } else { $r.id }; $chk = if ($dot -ge 0) { $r.id.Substring($dot + 1) } else { '' }
    $tag = $r.level
    if ($r.Contains('diff')) { $tag = $r.diff.ToUpper() + ' ' + $r.level; if ($r.diff -eq 'changed') { $tag += ' (was ' + $r.prev_level + ')' } }
    $order = if ($r.id -eq 'meta.version') { 0 } else { $rank[$r.level] }
    [void]$rows.Add([pscustomobject]@{ R = $order; I = $i; T = ('{0}|{1}|{2}|{3}|{4}' -f $tag, $area, $chk, ($r.detail -replace '\|', '/'), ($r.fix -replace '\|', '/')) })
  }
  $lines = @($rows | Sort-Object R, I | ForEach-Object { $_.T })
  if ($summary) { $lines += ('SUMMARY|meta|summary|' + $summary + '|') }
  return $lines
}

# ---------- driver ----------

function Invoke-Main([string[]]$Argv) {
  $script:SearchDirs = $null; $script:OtherAvOn = $false
  $script:Mode = 'fast'; $Format = 'ndjson'; $script:Offline = $false; $Diff = $false; $Save = $true; $script:Role = 'laptop'; $script:DaysUnused = 90; $Budget = $null; $Only = ''
  $rootsArg = $env:WSC_ROOTS
  for ($i = 0; $i -lt $Argv.Count; $i++) {
    $a = $Argv[$i]; $next = if ($i + 1 -lt $Argv.Count) { $Argv[$i + 1] } else { '' }
    switch ($a) {
      '--fast' { $script:Mode = 'fast' }
      '--deep' { $script:Mode = 'deep' }
      '--offline' { $script:Offline = $true }
      '--text' { $Format = 'text' }
      '--json' { $Format = 'ndjson' }
      '--ndjson' { $Format = 'ndjson' }
      '--diff' { $Diff = $true }
      '--no-save' { $Save = $false }
      '--role' { $script:Role = $next; $i++ }
      '--roots' { $rootsArg = $next; $i++ }
      '--days-unused' { if ($next -notmatch '^\d+$') { [Console]::Error.WriteLine('check.ps1: --days-unused needs a number'); return 2 }; $script:DaysUnused = [int]$next; $i++ }
      '--budget' { if ($next -notmatch '^\d+$') { [Console]::Error.WriteLine('check.ps1: --budget needs a number of seconds'); return 2 }; $Budget = [int]$next; $i++ }
      '--only' { $Only = $next; $i++ }
      '--version' { [Console]::Out.WriteLine("windows-security-check $WscVersion"); return 0 }
      { $_ -eq '-h' -or $_ -eq '--help' } { [Console]::Out.WriteLine($Usage); return 0 }
      default { [Console]::Error.WriteLine("check.ps1: unknown option: $a"); [Console]::Error.WriteLine($Usage); return 2 }
    }
  }
  if (@('laptop', 'server') -notcontains $script:Role) { [Console]::Error.WriteLine('check.ps1: --role must be laptop or server'); return 2 }
  if ($Only) { $Save = $false }
  if ($null -eq $Budget) { $Budget = if ($script:Mode -eq 'deep') { 900 } else { 60 } }
  if ($rootsArg) { $script:RootList = @($rootsArg -split [regex]::Escape([string][IO.Path]::PathSeparator) | Where-Object { $_ }) }
  else { $script:RootList = @('repos', 'src', 'code', 'projects', 'dev', 'work', 'git', 'source/repos', 'workspace', 'Developer') | ForEach-Object { Get-HomePath $_ } }

  $stateDir = if ($env:WSC_STATE_DIR) { $env:WSC_STATE_DIR } else { Join-Path $LocalAppData 'windows-security-check' }
  $allowPath = if ($env:WSC_ALLOWLIST) { $env:WSC_ALLOWLIST } else { Join-PathParts @($AppData, 'windows-security-check', 'allow.tsv') }
  $basePath = Join-Path $stateDir "last-$($script:Mode).ndjson"
  $clock = [Diagnostics.Stopwatch]::StartNew()
  $platform = if ($OnWindows) { 'Windows' } else { [string][Environment]::OSVersion.Platform }
  Add-Finding INFO meta.version '' ("windows-security-check $WscVersion, $($script:Mode) mode$(if ($script:Offline) { ', offline' }), role $($script:Role), $platform, PowerShell $($PSVersionTable.PSVersion)")
  $sections = @(@('os', 'Test-Os'), @('defender', 'Test-Defender'), @('network', 'Test-Network'), @('persistence', 'Test-Persistence'), @('hardening', 'Test-Hardening'), @('apps', 'Test-Apps'), @('secrets', 'Test-Secrets'), @('ssh', 'Test-Ssh'), @('git', 'Test-Git'), @('packages', 'Test-Packages'), @('editors', 'Test-Editors'), @('agents', 'Test-Agents'), @('docker', 'Test-Docker'), @('stale', 'Test-Stale'), @('cloud', 'Test-Cloud'))
  foreach ($s in $sections) {
    if ($Only -and (@($Only -split ',') -notcontains $s[0])) { continue }
    if ($clock.Elapsed.TotalSeconds -ge $Budget) { Add-Finding SKIP "$($s[0]).budget" '' "skipped: the ${Budget}s time budget was used up"; continue }
    $t = [Diagnostics.Stopwatch]::StartNew()
    try { & $s[1] } catch { Add-Finding SKIP "$($s[0]).error" '' ("the $($s[0]) section stopped early: " + $_.Exception.Message) }
    Add-Finding INFO meta.timing $s[0] ("$($s[0]) took $([int]$t.Elapsed.TotalMilliseconds) ms")
  }
  $elapsed = [int]$clock.Elapsed.TotalSeconds
  $records = @(Get-FinalRecords $allowPath (Get-Date -Format 'yyyy-MM-dd'))
  $final = @($records) + @(Get-Summary $records $script:Mode $elapsed)
  $newFail = @($records | Where-Object { $_.level -eq 'FAIL' }).Count
  $out = $final
  if (Test-Path -LiteralPath $basePath) {
    $d = Get-Diff (Read-Lines $basePath) $records $script:Mode
    $newFail = $d.NewFail
    if ($Diff) { $out = $d.Records }
  } elseif ($Diff) {
    $out = @($final) + @([ordered]@{ id = 'meta.diff'; level = 'SKIP'; score = 0; subject = ''; detail = 'no baseline for this mode yet; showing the full scan, which becomes the baseline'; fix = ''; key = 'meta.diff'; norm = '' })
  }
  if ($Format -eq 'text') { foreach ($l in (Format-Text $out)) { [Console]::Out.WriteLine($l) } }
  else { foreach ($r in $out) { [Console]::Out.WriteLine((ConvertTo-Line $r)) } }

  if ($Save) {
    try {
      [void](New-Item -ItemType Directory -Force -Path $stateDir -ErrorAction Stop)
      $tmp = $basePath + '.tmp'
      [IO.File]::WriteAllLines($tmp, [string[]]@($final | ForEach-Object { ConvertTo-Line $_ }), (New-Object Text.UTF8Encoding $false))
      if (-not $OnWindows) { & chmod 700 $stateDir; & chmod 600 $tmp }
      Move-Item -LiteralPath $tmp -Destination $basePath -Force
    } catch { [Console]::Error.WriteLine("check.ps1: could not save the baseline in $stateDir") }
  }
  if ($newFail -gt 0) { return 1 }
  return 0
}

if ($env:WSC_LIB -ne '1') { $rc = Invoke-Main $args; exit $rc }
