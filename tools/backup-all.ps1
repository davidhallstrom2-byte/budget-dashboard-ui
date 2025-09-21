<# =======================================================================
Backup both repos + create timestamped snapshot branches on GitHub

- Commits any local changes (single “backup” commit)
- Tries to rebase main on origin/main when safe
- Pushes main (if you’re on it)
- ALWAYS creates a snapshot branch from the exact current commit:
    snap/YYYYMMDD-HHMMSS[-label]
  …so you can revert to any point in time.

Tested with PowerShell 7.x
======================================================================= #>

[CmdletBinding()]
param(
  # Optional readable label to append to the snapshot branch name.
  # Allowed chars: letters, numbers, - _ .
  [string]$Label = ''
)

$ErrorActionPreference = 'Stop'
$PSStyle.OutputRendering = 'Host'  # nice colors, but no weird encoding

# ---- Config: edit here if paths change --------------------------------
$UIRepo      = 'C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui'
$PluginRepo  = 'C:\Users\david\Local Sites\main-dashboard\app\public\wp-content\plugins\budget-state'
$RemoteName  = 'origin'
$MainBranch  = 'main'
# ----------------------------------------------------------------------

function Invoke-Git {
  param(
    [string]$RepoPath,
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Args
  )
  Push-Location $RepoPath
  try {
    Write-Host ("git " + ($Args -join ' ')) -ForegroundColor DarkGray
    & git @Args
  } finally {
    Pop-Location
  }
}

function Get-GitHeadName {
  param([string]$RepoPath)
  Push-Location $RepoPath
  try {
    $name = (git rev-parse --abbrev-ref HEAD).Trim()
    if (-not $name) { return 'HEAD' }
    return $name
  } catch {
    return 'HEAD'
  } finally {
    Pop-Location
  }
}

function Test-GitRebaseInProgress {
  param([string]$RepoPath)
  return Test-Path (Join-Path $RepoPath '.git\rebase-apply') -or
         Test-Path (Join-Path $RepoPath '.git\rebase-merge')
}

function Commit-AnyChanges {
  param([string]$RepoPath)

  Push-Location $RepoPath
  try {
    $status = (git status --porcelain).Trim()
    if ($status) {
      git add -A | Out-Null
      git commit -m ("backup: " + (Get-Date -Format 'yyyy-MM-dd HH:mm')) | Out-Null
      Write-Host "Committed local changes." -ForegroundColor Yellow
      return $true
    } else {
      Write-Host "No local changes to commit." -ForegroundColor DarkGray
      return $false
    }
  } finally {
    Pop-Location
  }
}

function Try-Rebase-Main {
  param(
    [string]$RepoPath,
    [string]$RemoteName,
    [string]$MainBranch
  )

  if (Test-GitRebaseInProgress $RepoPath) {
    Write-Warning "Rebase in progress — skipping rebase step."
    return
  }

  $head = Get-GitHeadName $RepoPath
  if ($head -ne $MainBranch) {
    Write-Host "Not on $MainBranch (currently $head) — skipping rebase." -ForegroundColor DarkGray
    return
  }

  Invoke-Git $RepoPath fetch $RemoteName --prune | Out-Null
  Write-Host "Rebasing $MainBranch onto $RemoteName/$MainBranch ..." -ForegroundColor DarkGray
  Invoke-Git $RepoPath rebase --autostash "$RemoteName/$MainBranch"
  Write-Host "Rebase complete." -ForegroundColor DarkGray
}

function Push-Main-If-On-Main {
  param(
    [string]$RepoPath,
    [string]$RemoteName,
    [string]$MainBranch
  )
  $head = Get-GitHeadName $RepoPath
  if ($head -ne $MainBranch) {
    Write-Host "Not on $MainBranch (currently $head) — skipping main push." -ForegroundColor DarkGray
    return
  }

  Invoke-Git $RepoPath push $RemoteName $MainBranch
  Write-Host "Pushed $MainBranch to $RemoteName." -ForegroundColor Green
}

function New-Snapshot-Branch {
  param(
    [string]$RepoPath,
    [string]$RemoteName,
    [string]$Label
  )

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  # sanitize label -> keep letters, numbers, dash underscore dot only
  $cleanLabel = ($Label -replace '[^A-Za-z0-9._-]', '').Trim()
  $branchName = if ($cleanLabel) { "snap/$stamp-$cleanLabel" } else { "snap/$stamp" }

  # Always push exact current commit to a new remote branch.
  # Use fully-qualified ref on the remote side to avoid ambiguity.
  $dest = "refs/heads/$branchName"
  Invoke-Git $RepoPath push -u $RemoteName "HEAD:$dest"

  Write-Host ("Snapshot branch pushed: " + $branchName) -ForegroundColor Green
  $slug = $branchName.Replace('/','%2F')
  Write-Host ("View: " + "https://github.com/davidhallstrom2-byte/" +
              (Split-Path $RepoPath -Leaf) + "/tree/$slug") -ForegroundColor DarkGray
}

function Backup-Repo {
  param(
    [string]$Name,
    [string]$RepoPath,
    [string]$RemoteName,
    [string]$MainBranch,
    [string]$Label
  )

  Write-Host ("`n================  {0}  ================" -f $Name) -ForegroundColor Cyan
  Write-Host ("Repo: {0}" -f $RepoPath) -ForegroundColor DarkGray

  # 1) Fetch/prune
  Invoke-Git $RepoPath fetch $RemoteName --prune | Out-Null

  # 2) Commit any local changes
  Commit-AnyChanges $RepoPath | Out-Null

  # 3) Try rebase main if safe
  Try-Rebase-Main -RepoPath $RepoPath -RemoteName $RemoteName -MainBranch $MainBranch

  # 4) Push main if we are on main
  Push-Main-If-On-Main -RepoPath $RepoPath -RemoteName $RemoteName -MainBranch $MainBranch

  # 5) ALWAYS push a snapshot branch from exactly current commit
  New-Snapshot-Branch -RepoPath $RepoPath -RemoteName $RemoteName -Label $Label
}

# Pretty banner
Write-Host ("PowerShell " + $PSVersionTable.PSVersion.ToString()) -ForegroundColor DarkGray
Write-Host ("Backup started: " + (Get-Date)) -ForegroundColor DarkGray

# Run both
Backup-Repo -Name 'ui'           -RepoPath $UIRepo     -RemoteName $RemoteName -MainBranch $MainBranch -Label $Label
Backup-Repo -Name 'budget-state' -RepoPath $PluginRepo -RemoteName $RemoteName -MainBranch $MainBranch -Label $Label

Write-Host "`n✓ All backups done." -ForegroundColor Green
