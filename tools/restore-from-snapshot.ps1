# restore-from-snapshot.ps1
# Pick a repo -> pick a snap/* branch -> merge / hard-reset / checkout

$ErrorActionPreference = 'Stop'
function say([string]$msg, [string]$color='Gray'){ Write-Host $msg -ForegroundColor $color }

# ---- Repos to manage ----
$REPOS = @(
  @{
    Name = 'UI (budget-dashboard-ui)'
    Path = 'C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui'
    Remote = 'https://github.com/davidhallstrom2-byte/budget-dashboard-ui.git'
  },
  @{
    Name = 'Plugin (budget-state)'
    Path = 'C:\Users\david\Local Sites\main-dashboard\app\public\wp-content\plugins\budget-state'
    Remote = 'https://github.com/davidhallstrom2-byte/budget-state.git'
  }
)

function Pick-FromList($items, $title) {
  if ($items.Count -eq 0) { return $null }
  # GUI picker if available
  try {
    $ogv = Get-Command Out-GridView -ErrorAction Stop
    $sel = $items | Out-GridView -Title $title -OutputMode Single
    if ($sel) { return $sel }
  } catch { }
  # Console fallback
  say "`n$title" 'Cyan'
  $items | ForEach-Object -Begin { $i=1 } -Process {
    say ("  [$i] " + $_) 'Gray'; $i++
  }
  do {
    $idx = Read-Host 'Choose number'
  } while ([int]::TryParse($idx, [ref]$null) -eq $false -or [int]$idx -lt 1 -or [int]$idx -gt $items.Count)
  return $items[[int]$idx-1]
}

function Git($repoPath, [string[]]$args) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'git'
  $psi.WorkingDirectory = $repoPath
  $psi.Arguments = ($args -join ' ')
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.UseShellExecute = $false
  $p = [Diagnostics.Process]::Start($psi)
  $out = $p.StandardOutput.ReadToEnd()
  $err = $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  if ($p.ExitCode -ne 0) {
    throw "git $($args -join ' ')`n$out`n$err"
  }
  return $out
}

# ---- 1) Pick repo ----
$repoNameList = $REPOS | ForEach-Object { $_.Name }
$repoChoice = Pick-FromList $repoNameList 'Pick a repository'
if (-not $repoChoice) { say 'No repository selected. Exiting.' 'Yellow'; exit 0 }

$repo = $REPOS | Where-Object { $_.Name -eq $repoChoice }
$path = $repo.Path

say "`nRepo: $($repo.Name)" 'Green'
say "Path: $path" 'DarkGray'

# Safety: ensure git repo
if (-not (Test-Path (Join-Path $path '.git'))) {
  throw "Not a git repository: $path"
}

# If rebase in progress, offer to quit
$gitMeta = Git $path 'rev-parse --git-path rebase-merge'
$rebMerge = $gitMeta.Trim()
$gitMeta2 = Git $path 'rev-parse --git-path rebase-apply'
$rebApply = $gitMeta2.Trim()
if ((Test-Path $rebMerge) -or (Test-Path $rebApply)) {
  say 'A rebase is in progress in this repo.' 'Yellow'
  $ans = Read-Host 'Quit the rebase now? (y/N)'
  if ($ans -match '^[Yy]') {
    try { Git $path 'rebase --quit' | Out-Null } catch { }
  } else { say 'Aborting to avoid data loss.' 'Red'; exit 1 }
}

# ---- 2) Refresh & list snapshot branches ----
say "`nFetching snapshots..." 'Gray'
Git $path 'fetch origin --prune' | Out-Null
# Get remote snap branches
$rem = Git $path 'for-each-ref --format="%(refname:short)" refs/remotes/origin/snap/*'
$snapBranches = $rem -split "`r?`n" | Where-Object { $_ -and ($_ -match '^origin/snap/') } | ForEach-Object { $_.Substring(7) } # strip 'origin/'

if (-not $snapBranches -or $snapBranches.Count -eq 0) {
  say "No snapshot branches found on origin." 'Yellow'
  exit 0
}

$snap = Pick-FromList $snapBranches 'Pick a snapshot branch'
if (-not $snap) { say 'No snapshot selected. Exiting.' 'Yellow'; exit 0 }

# ---- 3) Pick action ----
$actions = @(
  'Merge into main (recommended, preserves history)',
  'Force reset main to snapshot (exact rollback, destructive)',
  'Just check out the snapshot locally (no change to main)'
)
$action = Pick-FromList $actions "How do you want to restore '$snap'?"
if (-not $action) { say 'No action selected. Exiting.' 'Yellow'; exit 0 }

# ---- 4) Do it ----
switch -Regex ($action) {

  '^Merge' {
    say "`nMerging origin/$snap into main..." 'Cyan'
    Git $path 'fetch origin --prune' | Out-Null
    try { Git $path 'switch main' | Out-Null } catch { Git $path 'checkout -B main' | Out-Null }
    Git $path "merge --no-ff origin/$snap -m `"restore: sync main to $snap`"" | Out-Null
    Git $path 'push origin main' | Out-Null
    say "✓ Merged into main and pushed." 'Green'
  }

  '^Force reset' {
    say "`nWARNING: This will make main exactly match $snap" 'Yellow'
    $ok = Read-Host 'Type RESET to continue'
    if ($ok -ne 'RESET') { say 'Canceled.' 'Yellow'; break }
    Git $path 'fetch origin --prune' | Out-Null
    try { Git $path 'switch main' | Out-Null } catch { Git $path 'checkout -B main' | Out-Null }
    Git $path "reset --hard origin/$snap" | Out-Null
    Git $path 'push --force-with-lease origin main' | Out-Null
    say "✓ main force-reset to $snap and pushed." 'Green'
  }

  '^Just check' {
    say "`nChecking out snapshot locally..." 'Cyan'
    # Create local branch with same name if it doesn’t exist
    $exists = (Git $path 'branch --list "snap/*"') -split "`r?`n" | Where-Object { $_.Trim() -eq $snap }
    if ($exists) {
      Git $path "switch $snap" | Out-Null
    } else {
      Git $path "switch -c $snap origin/$snap" | Out-Null
    }
    say "✓ Now on $snap (local). main unchanged." 'Green'
  }
}

say "`nDone." 'Green'
