[CmdletBinding()]
param(
  [switch]$PR,    # also open PRs to main (requires GitHub CLI logged in)
  [switch]$Tag    # also create & push a tag backup-YYYYMMDD-HHMM
)

$ErrorActionPreference = 'Stop'

# ========= helpers =========
function Write-Head([string]$t){ Write-Host "`n== $t ==" -ForegroundColor Cyan }
function Write-Step([string]$t){ Write-Host "Step: $t" -ForegroundColor DarkGray }

# Resolve git.exe once and always use that absolute path
$script:GitExe = (Get-Command git -ErrorAction Stop).Source

function Invoke-GitExec {
  param(
    [Parameter(Mandatory)] [string]   $Repo,
    [Parameter(Mandatory)] [string[]] $Args
  )
  Write-Step ("git {0}" -f ($Args -join ' '))
  & $script:GitExe -C $Repo @Args
  if ($LASTEXITCODE -ne 0) { throw "git $($Args -join ' ') failed ($LASTEXITCODE)" }
}

function Get-RemoteUrl([string]$Repo) {
  try {
    $urls = & $script:GitExe -C $Repo remote get-url --all origin 2>$null
    if (-not $urls) { return '(no remote)' }
    ($urls | ForEach-Object { $_.Trim() }) -join '; '
  } catch { '(no remote)' }
}

# One timestamp/tag per run so UI + plugin share the same value
$script:TS      = Get-Date -Format 'yyyyMMdd-HHmm'
$script:Human   = Get-Date -Format 'yyyy-MM-dd HH:mm'
$script:TagName = "backup-$script:TS"

function Backup-Repo {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Name
  )

  Write-Head $Name
  Write-Host ("Repo:   {0}" -f $Path) -ForegroundColor DarkGray
  $remoteString = Get-RemoteUrl $Path
  Write-Host ("Remote: {0}" -f $remoteString) -ForegroundColor DarkGray

  $hasRemote = $remoteString -ne '(no remote)'

  if ($hasRemote) {
    Invoke-GitExec -Repo $Path -Args @('fetch','origin','--prune')
  } else {
    Write-Step "no 'origin' remote — skipping network operations (fetch/pull/push)"
  }

  # Try to base from main if present
  $hasMain = (& $script:GitExe -C $Path branch --list main)
  if ($hasMain) {
    Invoke-GitExec -Repo $Path -Args @('checkout','main')
    if ($hasRemote) { Invoke-GitExec -Repo $Path -Args @('pull','--ff-only') }
  }

  $branch  = "backup/$script:TS"
  $title   = "backup: $script:Human"

  Invoke-GitExec -Repo $Path -Args @('checkout','-B',$branch)

  # Only commit when there are working-tree changes
  $status = (& $script:GitExe -C $Path status --porcelain)
  if ($status) {
    Invoke-GitExec -Repo $Path -Args @('add','-A')
    Invoke-GitExec -Repo $Path -Args @('commit','-m',$title)
    Write-Host "Committed: $title" -ForegroundColor Green
  } else {
    Write-Host 'No local changes to commit — pushing/refreshing backup branch anyway.' -ForegroundColor Yellow
  }

  if ($hasRemote) {
    Invoke-GitExec -Repo $Path -Args @('push','-u','origin',$branch)

    if ($PR) {
      try {
        & gh pr create --base main --head $branch --title $title --body "Automated backup" | Out-Host
      } catch {
        Write-Host "PR creation skipped: $($_.Exception.Message)" -ForegroundColor Yellow
      }
    }

    if ($Tag) {
      Invoke-GitExec -Repo $Path -Args @('tag','-f',$script:TagName)
      Invoke-GitExec -Repo $Path -Args @('push','-f','origin',"refs/tags/$script:TagName")
      Write-Host "Pushed tag $script:TagName" -ForegroundColor Green
    }
  }

  if ($hasMain) {
    Invoke-GitExec -Repo $Path -Args @('checkout','main')
  }
}

# ========= locate repos =========
# script dir (works in PS 5/7)
if ($PSScriptRoot) { $ScriptDir = $PSScriptRoot }
elseif ($PSCommandPath) { $ScriptDir = Split-Path -Path $PSCommandPath -Parent }
else { $ScriptDir = Split-Path -Path $MyInvocation.MyCommand.Path -Parent }

# UI repo is the parent of /tools
$UiRepo = (Resolve-Path (Join-Path $ScriptDir '..')).Path

# Optional plugin repo from env var or common locations
$PluginRepo = $null
$OverridePluginRepo = $env:BUDGET_STATE_PATH
if ($OverridePluginRepo -and (Test-Path (Join-Path $OverridePluginRepo '.git'))) {
  $PluginRepo = $OverridePluginRepo
} else {
  $ProjectRoot = Split-Path -Path $UiRepo -Parent
  foreach ($c in @(
    (Join-Path $ProjectRoot 'budget-state'),
    (Join-Path $ProjectRoot 'wp-plugin\budget-state'),
    (Join-Path $ProjectRoot 'wp-content\plugins\budget-state')
  )) {
    if (Test-Path (Join-Path $c '.git')) { $PluginRepo = $c; break }
  }
}

# ========= run =========
Write-Host ("PowerShell {0}" -f $PSVersionTable.PSVersion) -ForegroundColor DarkGray
Write-Host ("Script dir: {0}" -f $ScriptDir) -ForegroundColor DarkGray
Write-Host ("UI repo:    {0}" -f $UiRepo) -ForegroundColor DarkGray
if ($PluginRepo) {
  Write-Host ("Plugin repo: {0}" -f $PluginRepo) -ForegroundColor DarkGray
} else {
  Write-Host "Plugin repo: (not found — skipping plugin backup)" -ForegroundColor Yellow
}

Backup-Repo -Path $UiRepo -Name 'UI (budget-dashboard-ui)'

if ($PluginRepo) {
  Backup-Repo -Path $PluginRepo -Name 'WP Plugin (budget-state)'
}

Write-Host "`nAll done." -ForegroundColor Cyan
