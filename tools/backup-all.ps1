# backup-all.ps1 — back up UI (and optionally plugin) by creating backup/<timestamp> branches
# Flags:
#   -PR   opens PRs to main (requires `gh` and login; skipped if not available)
#   -Tag  creates & pushes a backup-<timestamp> tag

[CmdletBinding()]
param(
  [switch]$PR,
  [switch]$Tag
)

$ErrorActionPreference = 'Stop'

# ---------------- small helpers ----------------
function Write-Head([string]$t) { Write-Host "`n== $t ==" -ForegroundColor Cyan }
function Write-Step([string]$t) { Write-Host "Step: $t" -ForegroundColor DarkGray }

# Resolve git.exe once and reuse (prevents PATH confusion)
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

# ---------- one timestamp per run (shared by all repos) ----------
$script:Now     = Get-Date
$script:TS      = $script:Now.ToString('yyyy-MM-dd_HHmm')
$script:Human   = $script:Now.ToString('yyyy-MM-dd HH:mm')
$script:TagName = "backup-$($script:TS)"

function Backup-Repo {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Name
  )

  Write-Head $Name
  Write-Host ("Repo:   {0}" -f $Path) -ForegroundColor DarkGray
  Write-Host ("Remote: {0}" -f (Get-RemoteUrl $Path)) -ForegroundColor DarkGray

  Invoke-GitExec -Repo $Path -Args @('fetch','origin','--prune')

  # Use the shared timestamp so all repos get the same names
  $timestamp = $script:TS
  $human     = $script:Human
  $branch    = "backup/$timestamp"
  $title     = "backup: $human"
  $tagName   = $script:TagName

  # Base off main if it exists
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
    # Open a PR if gh is available; otherwise, skip politely
    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if ($gh) {
      try {
        & $gh.Source pr create --base main --head $branch --title $title --body "Automated backup" | Out-Host
      } catch { Write-Host "PR creation skipped: $($_.Exception.Message)" -ForegroundColor Yellow }
    } else {
      Write-Host "PR creation skipped: GitHub CLI (gh) not found." -ForegroundColor Yellow
    }
  }

  if ($Tag) {
    # Always (re)point the tag locally, then push that specific tag ref
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
  $candidates = @(
    (Join-Path $ProjectRoot 'budget-state'),
    (Join-Path $ProjectRoot 'wp-plugin\budget-state'),
    (Join-Path $ProjectRoot 'wp-content\plugins\budget-state')
  )
  foreach ($c in $candidates) {
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

if ($PluginRepo) {
  Backup-Repo -Path $PluginRepo -Name 'WP Plugin (budget-state)'
}

Write-Host "`nAll done." -ForegroundColor Cyan
