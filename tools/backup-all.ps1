<# ============================================================================
 Backup both repos + create timestamped snapshot branches on GitHub

 - Commits any local changes (single “backup” commit)
 - Tries to rebase main on origin/main when safe
 - Pushes main (if you’re on it)
 - ALWAYS creates a snapshot branch from the exact current commit:
     snap/YYYYMMDD-HHMMSS
   …so you can revert to any point in time.

 Tested with PowerShell 7.x
============================================================================ #>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$PSStyle.OutputRendering = 'Host'  # no weird encoding in messages

# ---- Paths (edit if you ever move things) -----------------------------------
$UI     = 'C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui'
$PLUGIN = 'C:\Users\david\Local Sites\main-dashboard\app\public\wp-content\plugins\budget-state'
$REMOTE = 'origin'

# ---- Helpers ----------------------------------------------------------------
function Invoke-Git {
  param(
    [string]$Cwd,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
  )
  Push-Location $Cwd
  try {
    Write-Host "git $($Args -join ' ')" -ForegroundColor DarkGray
    & git @Args
  } finally {
    Pop-Location
  }
}

function Get-GitBranch {
  param([string]$Repo)
  Push-Location $Repo
  try {
    $b = (& git rev-parse --abbrev-ref HEAD).Trim()
    if (-not $b) { 'HEAD' } else { $b }
  } catch {
    'HEAD'
  } finally {
    Pop-Location
  }
}

function In-Rebase {
  param([string]$Repo)
  return (Test-Path (Join-Path $Repo '.git\rebase-merge')) -or
         (Test-Path (Join-Path $Repo '.git\rebase-apply'))
}

function Commit-Local-Changes {
  param([string]$Repo,[string]$Msg)
  Push-Location $Repo
  try {
    $dirty = (& git status --porcelain)
    if ($dirty) {
      & git add -A
      & git commit -m $Msg | Out-Null
      Write-Host "Committed local changes -> $Msg" -ForegroundColor Yellow
    } else {
      Write-Host "No local changes to commit." -ForegroundColor DarkGray
    }
  } finally {
    Pop-Location
  }
}

function Push-Snapshot {
  param(
    [string]$Repo,
    [string]$Remote,
    [string]$SnapName  # e.g., 'snap/20250921-074212'
  )
  # This works even if you’re detached or mid-rebase:
  Invoke-Git $Repo push -u $Remote "HEAD:$SnapName"
  $name = Split-Path -Leaf $Repo
  $slug = if ($name -eq 'ui') { 'budget-dashboard-ui' } else { 'budget-state' }
  $url  = "https://github.com/davidhallstrom2-byte/$slug/tree/$($SnapName -replace '/','%2F')"
  Write-Host "Snapshot branch pushed: $SnapName" -ForegroundColor Green
  Write-Host "View: $url" -ForegroundColor Green
}

function Backup-Repo {
  param([string]$RepoPath)

  if (-not (Test-Path (Join-Path $RepoPath '.git'))) {
    throw "Not a git repo: $RepoPath"
  }

  $ts    = Get-Date -Format 'yyyyMMdd-HHmmss'
  $snap  = "snap/$ts"
  $name  = Split-Path -Leaf $RepoPath

  Write-Host ""
  Write-Host "================  $name  ================" -ForegroundColor Cyan
  Write-Host "Repo: $RepoPath" -ForegroundColor Cyan

  # 1) Make sure we can talk to remote
  Invoke-Git $RepoPath fetch $REMOTE --prune

  # 2) Commit any local changes (if any)
  Commit-Local-Changes -Repo $RepoPath -Msg "chore(backup): $ts"

  # 3) If not in the middle of a rebase, try to rebase main forward
  $branch = Get-GitBranch -Repo $RepoPath
  if (-not (In-Rebase -Repo $RepoPath) -and $branch -eq 'main') {
    try {
      Invoke-Git $RepoPath rebase --autostash "$REMOTE/main"
      Write-Host "Rebased main onto $REMOTE/main." -ForegroundColor DarkGray
    } catch {
      Write-Warning "Rebase failed; keeping local state. (You can resolve later.)"
      Invoke-Git $RepoPath rebase --abort | Out-Null
    }
  } elseif (In-Rebase -Repo $RepoPath) {
    Write-Warning "Rebase in progress — skipping rebase step."
  } else {
    Write-Host "Current branch: $branch (no rebase attempt)." -ForegroundColor DarkGray
  }

  # 4) Push main if we’re on main
  if ($branch -eq 'main') {
    try {
      Invoke-Git $RepoPath push $REMOTE main
      Write-Host "Pushed main to $REMOTE." -ForegroundColor Green
    } catch {
      Write-Warning "Couldn’t push main (non–fast-forward? Resolve later)."
    }
  } else {
    Write-Host "Not on main (currently $branch) — skipping main push." -ForegroundColor DarkGray
  }

  # 5) ALWAYS push a snapshot from the exact current commit
  Push-Snapshot -Repo $RepoPath -Remote $REMOTE -SnapName $snap
}

# ---- Run --------------------------------------------------------------------
$started = Get-Date
Write-Host "Backup started: $started" -ForegroundColor Cyan

Backup-Repo -RepoPath $UI
Backup-Repo -RepoPath $PLUGIN

$ended = Get-Date
Write-Host ""
Write-Host "✓ All backups done. ($([int]($ended - $started).TotalSeconds)s)" -ForegroundColor Green
