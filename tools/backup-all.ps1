# backup-all.ps1 — back up UI (and optionally plugin) by creating backup/<timestamp> branches
# Flags: -PR (open PRs), -Tag (create tag)

[CmdletBinding()]
param(
  [switch]$PR,
  [switch]$Tag
)

$ErrorActionPreference = 'Stop'

# ---------- helpers ----------
function Write-Head([string]$t) { Write-Host "`n== $t ==" -ForegroundColor Cyan }
function Write-Step([string]$t) { Write-Host "Step: $t" -ForegroundColor DarkGray }

# Resolve git.exe once (avoids PATH/name confusion)
$script:GitExe = (Get-Command git -ErrorAction Stop).Source

function Invoke-GitExec {
  param(
    [Parameter(Mandatory)][string]   $Repo,
    [Parameter(Mandatory)][string[]] $Args
  )
  Write-Step ("git {0}" -f ($Args -join ' '))
  & $script:GitExe -C $Repo @Args
  if ($LASTEXITCODE -ne 0) { throw "git $($Args -join ' ') failed ($LASTEXITCODE)" }
}

function Get-RemoteUrl([string]$Repo) {
  try {
    $u = & $script:GitExe -C $Repo remote get-url origin 2>$null
    if ([string]::IsNullOrWhiteSpace($u)) { '(no remote)' } else { $u.Trim() }
  } catch { '(no remote)' }
}

function Backup-Repo {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Name
  )

  Write-Head $Name
  Write-Host ("Repo:   {0}" -f $Path) -ForegroundColor DarkGray
  Write-Host ("Remote: {0}" -f (Get-RemoteUrl $Path)) -ForegroundColor DarkGray

  Invoke-GitExec -Repo $Path -Args @('fetch','origin','--prune')

  $timestamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
  $human     = Get-Date -Format 'yyyy-MM-dd HH:mm'
  $branch    = "backup/$timestamp"
  $title     = "backup: $human"
  $tagName   = "backup-$timestamp"

  if ((& $script:GitExe -C $Path branch --list main)) {
    Invoke-GitExec -Repo $Path -Args @('checkout','main')
    Invoke-GitExec -Repo $Path -Args @('pull','--ff-only')
  }

  Invoke-GitExec -Repo $Path -Args @('checkout','-B',$branch)

  $status = (& $script:GitExe -C $Path status --porcelain)
  if ($status) {
    Invoke-GitExec -Repo $Path -Args @('add','-A')
    Invoke-GitExec -Repo $Path -Args @('commit','-m',$title)
    Write-Host "Committed: $title" -ForegroundColor Green
  } else {
    Write-Host 'No local changes to commit — pushing/refreshing backup branch anyway.' -ForegroundColor Yellow
  }

  Invoke-GitExec -Repo $Path -Args @('push','-u','origin',$branch)

  if ($PR) {
    try {
      & gh pr create --base main --head $branch --title $title --body "Automated backup" | Out-Host
    } catch { Write-Host "PR creation skipped: $($_.Exception.Message)" -ForegroundColor Yellow }
  }

  if ($Tag) {
    Invoke-GitExec -Repo $Path -Args @('tag','-f',$tagName)
    Invoke-GitExec -Repo $Path -Args @('push','-f','origin',"refs/tags/$tagName")
    Write-Host "Pushed tag $tagName" -ForegroundColor Green
  }

  if ((& $script:GitExe -C $Path branch --list main)) {
    Invoke-GitExec -Repo $Path -Args @('checkout','main')
  }
}

# ---------- locate repos ----------
# Script directory
if ($PSScriptRoot) {
  $ScriptDir = $PSScriptRoot
} elseif ($PSCommandPath) {
  $ScriptDir = Split-Path -Path $PSCommandPath -Parent
} else {
  $ScriptDir = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
}

# UI repo is the parent of /tools
$UiRepo = (Resolve-Path (Join-Path $ScriptDir '..')).Path

# Optional plugin repo (can be overridden via env var BUDGET_STATE_PATH)
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

# ---------- run ----------
Write-Host "PowerShell $($PSVersionTable.PSVersion)" -ForegroundColor DarkGray
Write-Host "Script dir: $ScriptDir" -ForegroundColor DarkGray
Write-Host "UI repo:    $UiRepo" -ForegroundColor DarkGray
if ($PluginRepo) {
  Write-Host "Plugin repo: $PluginRepo" -ForegroundColor DarkGray
} else {
  Write-Host "Plugin repo: (not found — skipping plugin backup)" -ForegroundColor Yellow
}

Backup-Repo -Path $UiRepo -Name 'UI (budget-dashboard-ui)'
if ($PluginRepo) { Backup-Repo -Path $PluginRepo -Name 'WP Plugin (budget-state)' }

Write-Host "`nAll done." -ForegroundColor Cyan
