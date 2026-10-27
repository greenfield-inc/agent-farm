# process-cleanup survey: read-only look at what is loading a Windows machine.
#
# Prints sections headed "== name ==", each a tab-separated table with a header row, in the
# same shape as survey.sh. It never stops or changes anything and never elevates. Process
# command lines are shortened and token-shaped words are replaced with <redacted>.
# Runs on Windows PowerShell 5.1 and PowerShell 7:
#   powershell -NoProfile -ExecutionPolicy Bypass -File survey.ps1

$ErrorActionPreference = 'SilentlyContinue'
$now = Get-Date
$day = 86400

function Age([double]$s) {
  if ($s -ge $day) { return ('{0:0.0}d' -f ($s / $day)) }
  if ($s -ge 3600) { return ('{0:0.0}h' -f ($s / 3600)) }
  return ('{0}m' -f [int]($s / 60))
}

function Clean([string]$a) {
  if (-not $a) { return '' }
  $words = $a -split ' '; $hide = $false
  $out = for ($i = 0; $i -lt $words.Count; $i++) {
    $w = $words[$i]
    if ($hide) { '<redacted>'; $hide = $false; continue }
    if ($w -match '(?i)(token|secret|passw|apikey|api_key|api-key|authorization|bearer|cookie|credential)') {
      if ($w.Contains('=')) { $w.Substring(0, $w.IndexOf('=') + 1) + '<redacted>' } else { $w; $hide = $true }
      continue
    }
    if ($w -match '^[A-Za-z0-9_+=-]{32,}$') { '<redacted>'; continue }
    $w
  }
  $s = ($out -join ' ')
  if ($s.Length -gt 160) { $s = $s.Substring(0, 157) + '...' }
  return $s
}

function Row { ($args | ForEach-Object { "$_" }) -join "`t" }

# ---------- host ----------
$os = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
$cores = $cs.NumberOfLogicalProcessors
$cpuLoad = (Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average
$queue = (Get-CimInstance Win32_PerfFormattedData_PerfOS_System).ProcessorQueueLength
$memTotal = $os.TotalVisibleMemorySize / 1MB
$memFree = $os.FreePhysicalMemory / 1MB
$commitTotal = $os.TotalVirtualMemorySize / 1MB
$commitUsed = ($os.TotalVirtualMemorySize - $os.FreeVirtualMemory) / 1MB
$page = Get-CimInstance Win32_PageFileUsage | Measure-Object AllocatedBaseSize, CurrentUsage -Sum
"== host =="
Row key value
Row hostname $env:COMPUTERNAME
Row os ("{0} {1}" -f $os.Caption, $os.Version)
Row cores $cores
Row uptime_days ([int](($now - $os.LastBootUpTime).TotalDays))
Row cpu_load_percent $cpuLoad
Row processor_queue ("{0} ({1:0.0} per core; above 2 per core is overloaded)" -f $queue, ($queue / [math]::Max($cores, 1)))
Row memory ("{0:0.0} GB free of {1:0.0} GB" -f $memFree, $memTotal)
Row commit ("{0:0.0} GB used of {1:0.0} GB limit" -f $commitUsed, $commitTotal)
Row pagefile ("{0:0.0} GB used of {1:0.0} GB" -f (($page | Where-Object Property -eq CurrentUsage).Sum / 1KB), (($page | Where-Object Property -eq AllocatedBaseSize).Sum / 1KB))
Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
  Row ("disk_free " + $_.DeviceID) ("{0:0} GB of {1:0} GB" -f ($_.FreeSpace / 1GB), ($_.Size / 1GB))
}

# ---------- process snapshot ----------
$procs = @(Get-CimInstance Win32_Process | ForEach-Object {
  $created = $_.CreationDate
  [pscustomobject]@{
    Pid = [int]$_.ProcessId; Ppid = [int]$_.ParentProcessId; Name = ($_.Name -replace '\.exe$', '')
    Age = if ($created) { ($now - $created).TotalSeconds } else { 0 }
    Created = $created
    RssMb = $_.WorkingSetSize / 1MB; Cmd = $_.CommandLine; Path = $_.ExecutablePath
  }
})
$byPid = @{}; foreach ($p in $procs) { $byPid[$p.Pid] = $p }
# CPU seconds since start, from Get-Process (Win32_Process has no percentage).
$cpu = @{}; Get-Process | ForEach-Object { if ($_.TotalProcessorTime) { $cpu[$_.Id] = $_.TotalProcessorTime.TotalSeconds } }
function ParentOf($p) {
  $parent = $byPid[$p.Ppid]
  # A reused pid can belong to a younger process; then the real parent is gone.
  if (-not $parent -or ($parent.Created -and $p.Created -and $parent.Created -gt $p.Created)) { return 'gone' }
  return $parent.Name
}

""
"== summary =="
Row processes older_than_1d older_than_2d total_rss_gb
Row $procs.Count @($procs | Where-Object Age -gt $day).Count @($procs | Where-Object Age -gt (2 * $day)).Count ('{0:0.0}' -f (($procs | Measure-Object RssMb -Sum).Sum / 1KB))

""
"== by-name (top 30 by memory) =="
Row name count rss_mb cpu_seconds older_1d older_2d oldest
$procs | Group-Object Name | ForEach-Object {
  $g = $_.Group
  [pscustomobject]@{ Name = $_.Name; Count = $_.Count; Rss = ($g | Measure-Object RssMb -Sum).Sum
    Cpu = ($g | ForEach-Object { $cpu[$_.Pid] } | Measure-Object -Sum).Sum
    O1 = @($g | Where-Object Age -gt $day).Count; O2 = @($g | Where-Object Age -gt (2 * $day)).Count
    Oldest = ($g | Measure-Object Age -Maximum).Maximum }
} | Sort-Object Rss -Descending | Select-Object -First 30 | ForEach-Object {
  Row $_.Name $_.Count ('{0:0}' -f $_.Rss) ('{0:0}' -f $_.Cpu) $_.O1 $_.O2 (Age $_.Oldest)
}

""
"== apps (Electron/Chromium instances and helpers) =="
# launched: main-binary processes whose parent is not the same program, i.e. real instances.
Row app main_binary launched renderers renderers_older_2d other_helpers rss_mb oldest_launched
$procs | Where-Object { $_.Cmd -match '--type=' } | Group-Object Name | ForEach-Object {
  $name = $_.Name
  $all = @($procs | Where-Object Name -eq $name)
  $main = @($all | Where-Object { $_.Cmd -notmatch '--type=' })
  $launched = @($main | Where-Object { (ParentOf $_) -ne $name })
  $rend = @($all | Where-Object { $_.Cmd -match '--type=renderer' })
  [pscustomobject]@{ Name = $name; Main = $main.Count; Launched = $launched.Count; Rend = $rend.Count
    Rend2 = @($rend | Where-Object Age -gt (2 * $day)).Count; Other = $all.Count - $main.Count - $rend.Count
    Rss = ($all | Measure-Object RssMb -Sum).Sum; Oldest = ($launched | Measure-Object Age -Maximum).Maximum }
} | Sort-Object Rss -Descending | Select-Object -First 25 | ForEach-Object {
  Row $_.Name $_.Main $_.Launched $_.Rend $_.Rend2 $_.Other ('{0:0}' -f $_.Rss) $(if ($_.Oldest) { Age $_.Oldest } else { '-' })
}

""
"== fsmonitor (git fsmonitor--daemon) =="
# Git for Windows names each daemon's pipe after its git dir: \\.\pipe\C_\repo\.git\fsmonitor--daemon.ipc.
# The pipe cannot be tied to a pid, so daemons and repos are listed separately.
$daemons = @($procs | Where-Object { $_.Name -eq 'git' -and $_.Cmd -match 'fsmonitor--daemon run' })
Row pid ppid parent age rss_mb
foreach ($d in $daemons) { Row $d.Pid $d.Ppid (ParentOf $d) (Age $d.Age) ('{0:0}' -f $d.RssMb) }
"# $($daemons.Count) daemons"
""
Row state git_dir worktree
$pipes = @([System.IO.Directory]::GetFiles('\\.\pipe\') | Where-Object { $_ -like '*fsmonitor--daemon.ipc' })
foreach ($pipe in $pipes) {
  $rel = $pipe.Substring(9) -replace '\\fsmonitor--daemon\.ipc$', ''
  $gitdir = $rel -replace '^([A-Za-z])_\\', '$1:\'
  if ($gitdir -match '\\\.git\\worktrees\\') {
    $link = Join-Path $gitdir 'gitdir'
    if (Test-Path -LiteralPath $link) {
      $wt = Split-Path -Parent ((Get-Content -LiteralPath $link -TotalCount 1) -replace '/', '\')
      $state = if (Test-Path -LiteralPath $wt) { 'live' } else { 'worktree-missing' }
    } else { $wt = '?'; $state = 'gitdir-missing' }
  } elseif ($gitdir -match '\\\.git$') {
    $wt = $gitdir -replace '\\\.git$', ''
    $state = if (Test-Path -LiteralPath $gitdir) { 'live' } elseif (Test-Path -LiteralPath $wt) { 'gitdir-missing' } else { 'worktree-missing' }
  } else { $wt = $gitdir; $state = if (Test-Path -LiteralPath $gitdir) { 'live' } else { 'gitdir-missing' } }
  if ($wt -like "$env:TEMP*" -or $wt -like 'C:\Windows\Temp*') { $state += ',temp' }
  Row $state $gitdir $wt
}
"# $($pipes.Count) daemon pipes"

$agentRe = '(?i)(^|[\\/ "])(claude|codex|cursor-agent|gemini|opencode|amp)(\.exe|\.cmd|\.js)?("| |$)'
$devNames = '^(node|bun|deno|esbuild|tsc|tsx|turbo|nodemon|vite)$'
$devRe = '(vite|webpack|next dev|storybook|vitest|jest --watch|tsc -w|tsc --watch|esbuild .*--watch)'

""
"== dev-servers (node, bun, esbuild, vite, tsc and other watchers) =="
Row pid ppid parent age rss_mb cpu_seconds args
$procs | Where-Object { ($_.Name -match $devNames -or $_.Cmd -match $devRe) -and $_.Cmd -notmatch $agentRe -and $_.Cmd -notmatch '--type=' } | ForEach-Object {
  Row $_.Pid $_.Ppid (ParentOf $_) (Age $_.Age) ('{0:0}' -f $_.RssMb) ('{0:0}' -f $cpu[$_.Pid]) (Clean $_.Cmd)
}

""
"== agents-and-shells (agent CLIs, and shells older than 1 day or orphaned) =="
Row pid ppid parent kind age rss_mb cpu_seconds args
$procs | ForEach-Object {
  $kind = ''
  if ($_.Cmd -match $agentRe -and $_.Name -notmatch '^(conhost|OpenConsole)$') { $kind = $Matches[2].ToLower() }
  elseif ($_.Name -match '^(pwsh|powershell|cmd|bash|zsh|sh|wsl)$' -and ($_.Age -gt $day -or (ParentOf $_) -eq 'gone')) { $kind = $_.Name }
  if ($kind) { Row $_.Pid $_.Ppid (ParentOf $_) $kind (Age $_.Age) ('{0:0}' -f $_.RssMb) ('{0:0}' -f $cpu[$_.Pid]) (Clean $_.Cmd) }
}

""
"== indexing (Windows Search and Defender) =="
Row name count cpu_seconds rss_mb
$procs | Where-Object { $_.Name -match '^(SearchIndexer|SearchProtocolHost|SearchFilterHost|MsMpEng|MpDefenderCoreService)$' } | Group-Object Name | ForEach-Object {
  Row $_.Name $_.Count ('{0:0}' -f (($_.Group | ForEach-Object { $cpu[$_.Pid] } | Measure-Object -Sum).Sum)) ('{0:0}' -f (($_.Group | Measure-Object RssMb -Sum).Sum))
}
$idx = Get-Service WSearch
Row service_WSearch $(if ($idx) { "$($idx.Status), $($idx.StartType)" } else { 'absent' })

""
"== top-cpu (15, by current use) =="
Row pid name cpu_percent rss_mb age
$perf = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object { $_.IDProcess -gt 0 } | Sort-Object PercentProcessorTime -Descending | Select-Object -First 15
foreach ($x in $perf) {
  $p = $byPid[[int]$x.IDProcess]
  Row $x.IDProcess $x.Name ('{0:0.0}' -f ($x.PercentProcessorTime / [math]::Max($cores, 1))) ('{0:0}' -f ($x.WorkingSetPrivate / 1MB)) $(if ($p) { Age $p.Age } else { '?' })
}
