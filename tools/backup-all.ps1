<# =======================================================================
Backup both repos + create timestamped snapshot branches on GitHub

- Commits any local changes (single “backup” commit)
- Tries to rebase main on origin/main when safe
- Pushes main (if you’re on it)
- ALWAYS creates a snapshot branch from the exact current commit:
    snap/YYYYMMDD-HHMMSS[-label]
======================================================================= #>

[CmdletBinding()]
param(
  # Optional label to append to the snapshot branch name (letters/numbers/-/_/.)
  [string]$Label = ''
)

$ErrorActionPreference = 'Stop'
$PSStyle.OutputRendering = 'Host'

# ---- Config ------------------------------------------------------------
$UIRepoPath      = 'C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui'
$PluginRepoPath  = 'C:\Users\david\Local Sites\main-dashboard\app\public\wp-content\plugins\budget-state'

$Owner       = 'davidhallstrom2-byte'
$UIRepoName  = 'budget-dashboard-ui'
$PLRepoName  = 'budget-state'

$RemoteName  = 'origin'
$MainBranch  = 'main'
# -----------------------------------------------------------------------

function Invoke-Git {
  param(
    [string]$RepoPath,
    [Parameter(ValueFromRemainingArguments = $true)]
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
  return ((Test-Path (Join-Path $RepoPath '.git\rebase-apply')) -or
          (Test-Path (Join-Path $RepoPath '.git\rebase-merge')))
}

function Commit-AnyChanges {
  param([string]$RepoPath)

  Push-Location $RepoPath
  try {
    $status = (git status --porcelain).Trim()
    if ($status) {
      git add -A  | Out-Null
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
  try {
    Invoke-Git $RepoPath rebase --autostash "$RemoteName/$MainBranch" | Out-Null
    Write-Host "Rebase complete." -ForegroundColor DarkGray
  } catch {
    Write-Warning "Rebase failed or unnecessary — continuing. ($($_.Exception.Message))"
    Invoke-Git $RepoPath rebase --abort 2>$null | Out-Null
  }
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
    [string]$Owner,
    [string]$RepoName,
    [string]$Label
  )

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $cleanLabel = ($Label -replace '[^A-Za-z0-9._-]', '').Trim()
  $branchName = if ($cleanLabel) { "snap/$stamp-$cleanLabel" } else { "snap/$stamp" }

  # Fully-qualify the destination ref on the remote to avoid “not a full refname”.
  $dest = "refs/heads/$branchName"
  Invoke-Git $RepoPath push -u $RemoteName "HEAD:$dest"

  Write-Host ("Snapshot branch pushed: " + $branchName) -ForegroundColor Green
  $slug = $branchName.Replace('/','%2F')
  Write-Host ("View: https://github.com/$Owner/$RepoName/tree/$slug") -ForegroundColor DarkGray
}

function Backup-Repo {
  param(
    [string]$Name,
    [string]$RepoPath,
    [string]$RepoName,
    [string]$RemoteName,
    [string]$MainBranch,
    [string]$Label
  )

  Write-Host ("`n================  {0}  ================" -f $Name) -ForegroundColor Cyan
  Write-Host ("Repo: {0}" -f $RepoPath) -ForegroundColor DarkGray

  Invoke-Git $RepoPath fetch $RemoteName --prune | Out-Null
  Commit-AnyChanges $RepoPath | Out-Null
  Try-Rebase-Main -RepoPath $RepoPath -RemoteName $RemoteName -MainBranch $MainBranch
  Push-Main-If-On-Main -RepoPath $RepoPath -RemoteName $RemoteName -MainBranch $MainBranch
  New-Snapshot-Branch -RepoPath $RepoPath -RemoteName $RemoteName -Owner $Owner -RepoName $RepoName -Label $Label
}

Write-Host ("PowerShell " + $PSVersionTable.PSVersion.ToString()) -ForegroundColor DarkGray
Write-Host ("Backup started: " + (Get-Date)) -ForegroundColor DarkGray

Backup-Repo -Name 'ui'           -RepoPath $UIRepoPath     -RepoName $UIRepoName  -RemoteName $RemoteName -MainBranch $MainBranch -Label $Label
Backup-Repo -Name 'budget-state' -RepoPath $PluginRepoPath -RepoName $PLRepoName  -RemoteName $RemoteName -MainBranch $MainBranch -Label $Label

Write-Host "`n✓ All backups done." -ForegroundColor Green
