<# ======================================================================
  backup-all.ps1  —  Back up the UI repo (and optional plugin repo)
  Location of this script (for reference):
  C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\backup-all.ps1

  Run examples (from anywhere):
    pwsh -NoProfile -ExecutionPolicy Bypass -File "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\backup-all.ps1"
    pwsh -NoProfile -ExecutionPolicy Bypass -File "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\backup-all.ps1" -PR
    pwsh -NoProfile -ExecutionPolicy Bypass -File "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\backup-all.ps1" -Tag
    pwsh -NoProfile -ExecutionPolicy Bypass -File "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\backup-all.ps1" -PR -Tag
====================================================================== #>

[CmdletBinding()]
param(
  [switch]$PR,   # also open a PR to main (requires GitHub CLI logged in)
  [switch]$Tag   # also create & push a tag backup-YYYY-MM-DD_HHMM
)

$ErrorActionPreference = 'Stop'

# ---------- Path resolution ----------
if ($PSScriptRoot) {
  $ScriptDir = $PSScriptRoot
} elseif ($PSCommandPath) {
  $ScriptDir = Split-Path -Path $PSCommandPath -Parent
} else {
  $ScriptDir = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
}

# UI repo is the parent of /tools
$UiRepo = (Resolve-Path (Join-Path $ScriptDir '..')).Path
$ProjectRoot = Split-Path -Path $UiRepo -Parent

# Optional hard-override if you keep the plugin somewhere else:
$OverridePluginRepo = $null  # e.g. "C:\path\to\budget-state"

# Try to locate the plugin repo automatically
$PluginRepo = $null
if ($OverridePluginRepo -and (Test-Path (Join-Path $OverridePluginRepo '.git'))) {
  $PluginRepo = $OverridePluginRepo
} else {
  $candidates = @(
    (Join-Path $ProjectRoot 'budget-state'),
    (Join-Path $ProjectRoot 'wp-plugin\budget-state'),
    (Join-Path $ProjectRoot 'wp-content\plugins\budget-state')
  )
  foreach ($c in $candidates) {
    if (Test-Path (Join-Path $c '.git')) { $PluginRepo = $c; break }
  }
}

# ---------- Console helpers ----------
function Write-Head([string]$text) {
  Write-Host "`n== $text ==" -ForegroundColor Cyan
}
function Write-Step([string]$t) {
  Write-Host "Step: $t" -ForegroundColor DarkGray
}

# Call git using an argument array (so quoted args like the commit message stay intact)
function Invoke-Git {
  param(
    [Parameter(Mandatory)][string[]]$Args,
    [switch]$AllowFail
  )
  & git @Args
  if ($LASTEXITCODE -ne 0 -and -not $AllowFail) {
    throw "git $($Args -join ' ') failed ($LASTEXITCODE)"
  }
}

# ---------- Backup routine ----------
function Backup-Repo {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Name,
    [switch]$OpenPR,
    [switch]$CreateTag
  )

  Write-Head "$Name"
  Write-Host "Repo:   $Path" -ForegroundColor DarkGray
  Push-Location $Path
  try {
    $remote = (& git remote get-url origin 2>$null)
    if ($remote) { Write-Host "Remote: $remote" -ForegroundColor DarkGray }
    else {
      Write-Host "Remote: (no remote 'origin' configured) — cannot push backup branch." -ForegroundColor Yellow
    }

    if ($remote) {
      Write-Step 'fetch origin --prune'
      Invoke-Git @('fetch','origin','--prune')
    }

    $timestamp = Get-Date -Format 'yyyy-MM-dd_HHmm'  # e.g. 2025-09-24_0958
    $human     = Get-Date -Format 'yyyy-MM-dd HH:mm' # e.g. 2025-09-24 09:58
    $branch    = "backup/$timestamp"
    $title     = "backup: $human"
    $tagName   = "backup-$timestamp"

    if ((git branch --list main)) {
      Write-Step 'checkout main'
      Invoke-Git @('checkout','main')
      if ($remote) {
        Write-Step 'pull --ff-only'
        Invoke-Git @('pull','--ff-only')
      }
    }

    Write-Step "checkout -B $branch"
    Invoke-Git @('checkout','-B',"$branch")

    Write-Step 'add -A'
    Invoke-Git @('add','-A')

    Write-Step "commit -m ""$title"""
    & git commit -m "$title" | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Write-Host 'Nothing to commit — pushing/refreshing backup branch anyway.' -ForegroundColor Yellow
    }

    if ($remote) {
      Write-Step "push -u origin $branch"
      Invoke-Git @('push','-u','origin',"$branch")

      if ($OpenPR) {
        Write-Step 'gh pr create'
        & gh pr create --base main --head "$branch" --title "$title" --body "Automated backup" | Out-Host
      }

      if ($CreateTag) {
        Write-Step "tag $tagName"
        Invoke-Git @('tag','-f',"$tagName")
        Invoke-Git @('push','-f','origin',"$tagName")
      }
    }

    if ((git branch --list main)) {
      Write-Step 'checkout main'
      Invoke-Git @('checkout','main')
    }
  }
  finally {
    Pop-Location
  }
}

# ---------- Kick off ----------
Write-Host "Script dir: $ScriptDir" -ForegroundColor DarkGray
Write-Host "UI repo:    $UiRepo"    -ForegroundColor DarkGray
if ($PluginRepo) {
  Write-Host "Plugin repo: $PluginRepo" -ForegroundColor DarkGray
} else {
  Write-Host "Plugin repo: (not found — skipping plugin backup)" -ForegroundColor Yellow
}

# UI repository
Backup-Repo -Path $UiRepo -Name 'UI (budget-dashboard-ui)' -OpenPR:$PR -CreateTag:$Tag

# Plugin repository (optional)
if ($PluginRepo) {
  Backup-Repo -Path $PluginRepo -Name 'WP Plugin (budget-state)' -OpenPR:$PR -CreateTag:$Tag
}

Write-Host "`nAll done." -ForegroundColor Cyan
