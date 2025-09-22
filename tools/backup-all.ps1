<# ======================================================================
Backup both repos + create timestamped snapshot branches on GitHub

✓ Commits any local changes (single “backup” commit)
✓ Tries to rebase main on origin/main when safe (skips if rebase in progress)
✓ Pushes main (only if you’re on it)
✓ ALWAYS creates a snapshot branch from the exact current commit:
  snap/YYYYMMDD-HHMMSS[-label]
Tested with PowerShell 7.x
====================================================================== #>

[CmdletBinding()]
param(
  [string]$Label  # Optional backup label (letters/numbers/-/_/.)
)

$ErrorActionPreference = 'Stop'
$PSStyle.OutputRendering = 'Host'

function Write-Section($text) { Write-Host "`n================  $text  ================" -ForegroundColor Cyan }
function Write-Info($text)    { Write-Host $text -ForegroundColor Gray }
function Write-Ok($text)      { Write-Host $text -ForegroundColor Green }
function Write-Warn($text)    { Write-Warning $text }
function Write-ErrLine($text) { Write-Host $text -ForegroundColor Red }

function Exec([string]$Cmd, [string]$WorkDir) {
  Push-Location $WorkDir
  try {
    Write-Info $Cmd
    & git.exe $Cmd.Split(' ') 2>&1 | ForEach-Object { $_ }
  } finally { Pop-Location }
}

function InRebase([string]$RepoPath) {
  return (Test-Path -LiteralPath (Join-Path $RepoPath '.git\rebase-merge')) -or
         (Test-Path -LiteralPath (Join-Path $RepoPath '.git\rebase-apply'))
}

function Get-GitHeadName([string]$RepoPath) {
  Push-Location $RepoPath
  try {
    $raw  = git rev-parse --abbrev-ref HEAD 2>$null
    $name = "$raw".Trim()         # SAFE: coerce-to-string first
    if (-not $name) { return 'HEAD' }
    return $name
  } catch {
    return 'HEAD'
  } finally { Pop-Location }
}

function Commit-If-Dirty([string]$RepoPath, [string]$Message) {
  Push-Location $RepoPath
  try {
    $status = git status --porcelain
    $isDirty = -not [string]::IsNullOrWhiteSpace("$status")
    if ($isDirty) {
      Exec "add -A" $RepoPath | Out-Null
      Exec "commit -m $Message" $RepoPath | Out-Null
      Write-Ok "Committed local changes."
    } else {
      Write-Info "No local changes to commit."
    }
  } finally { Pop-Location }
}

function Rebase-Main-IfSafe([string]$RepoPath) {
  if (InRebase $RepoPath) {
    Write-Warn "Rebase in progress — skipping rebase step."
    return
  }
  $branch = Get-GitHeadName $RepoPath
  if ($branch -ne 'main') {
    Write-Info "Not on main (currently $branch) — skipping main rebase."
    return
  }
  Exec "fetch origin --prune" $RepoPath | Out-Null
  Exec "rebase --autostash origin/main" $RepoPath | Out-Null
  Write-Ok "Rebased main onto origin/main."
}

function Push-Main-IfOnMain([string]$RepoPath) {
  $branch = Get-GitHeadName $RepoPath
  if ($branch -ne 'main') {
    Write-Info "Not on main (currently $branch) — skipping main push."
    return
  }
  Exec "push origin main" $RepoPath | Out-Null
  Write-Ok "Pushed main to origin."
}

function Push-Snapshot([string]$RepoPath, [string]$SnapBranch) {
  # Always push the exact current commit to a ref-qualified branch name
  Exec "push -u origin HEAD:refs/heads/$SnapBranch" $RepoPath | ForEach-Object { $_ | Write-Host }
  Write-Ok "Snapshot branch pushed: $SnapBranch"
}

# ---------- Configurable repo paths ----------
$UIRepo      = 'C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui'
$PluginRepo  = 'C:\Users\david\Local Sites\main-dashboard\app\public\wp-content\plugins\budget-state'
# --------------------------------------------

$ts     = (Get-Date -Format 'yyyyMMdd-HHmmss')
$labelT = "$Label".Trim()
$suffix = if ($labelT) { "-$labelT" } else { "" }
$snap   = "snap/$ts$suffix"

Write-Info  "PowerShell $($PSVersionTable.PSVersion)"
Write-Host  "Backup started: $(Get-Date -Format 'MM/dd/yyyy HH:mm:ss')" -ForegroundColor Yellow

# -------------- UI Repo --------------
Write-Section "ui"
Write-Info "Repo: $UIRepo"
Exec "fetch origin --prune" $UIRepo | Out-Null
Commit-If-Dirty $UIRepo "backup: $ts$suffix"
Rebase-Main-IfSafe $UIRepo
Push-Main-IfOnMain $UIRepo
Push-Snapshot $UIRepo $snap
Write-Info "View: https://github.com/davidhallstrom2-byte/budget-dashboard-ui/tree/$($snap.Replace('/','%2F'))"

# -------------- Plugin Repo -----------
Write-Section "budget-state"
Write-Info "Repo: $PluginRepo"
Exec "fetch origin --prune" $PluginRepo | Out-Null
Commit-If-Dirty $PluginRepo "backup: $ts$suffix"
Rebase-Main-IfSafe $PluginRepo
Push-Main-IfOnMain $PluginRepo
Push-Snapshot $PluginRepo $snap
Write-Info "View: https://github.com/davidhallstrom2-byte/budget-state/tree/$($snap.Replace('/','%2F'))"

Write-Ok "`n✓ All backups done."
