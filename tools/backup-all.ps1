# backup-all.ps1
# One-click backup of UI + WP plugin repos to GitHub.
# - Commits only if there are changes
# - Uses timestamped message by default (override with -Message)
# - Pushes to origin/main
# - Optional -Tag adds and pushes a tag like backup-YYYYMMDD-HHMM

param(
  [string]$Message = (Get-Date -Format 'yyyy-MM-dd HH:mm'),
  [switch]$Tag
)

$ErrorActionPreference = 'Stop'

# Resolve repo paths RELATIVE to this /tools folder:
# UI repo:   ...\budget-dashboard-fs\ui
# Plugin:    ...\public\wp-content\plugins\budget-state
$UIPath     = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$PluginPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\wp-content\plugins\budget-state')).Path

# Expected remotes (used if 'origin' is missing)
$UIRemote      = 'https://github.com/davidhallstrom2-byte/budget-dashboard-ui.git'
$PluginRemote  = 'https://github.com/davidhallstrom2-byte/budget-state.git'

function Ensure-Git {
  try { git --version | Out-Null }
  catch { throw "Git not found. Install Git for Windows, then re-run." }
}

function Backup-Repo([string]$Path, [string]$Name, [string]$ExpectedRemote) {
  if (-not (Test-Path $Path)) { throw "$Name path not found: $Path" }
  Push-Location $Path
  try {
    Write-Host "`n== $Name ==" -ForegroundColor Cyan

    if (-not (Test-Path '.git')) {
      Write-Host "Initializing git repo..." -ForegroundColor Yellow
      git init | Out-Null
      git branch -M main
    }

    # Ensure 'origin' exists
    $hasOrigin = (git remote 2>$null) -contains 'origin'
    if (-not $hasOrigin -and $ExpectedRemote) {
      Write-Host "Adding remote 'origin' -> $ExpectedRemote" -ForegroundColor Yellow
      git remote add origin $ExpectedRemote
    }

    # Show current origin
    $originLine = (git remote -v | Select-String '^[ ]*origin\s').ToString()
    if ($originLine) { Write-Host "Remote: $originLine" -ForegroundColor DarkGray }

    # Stage all; commit only if there are changes
    git add -A
    $dirty = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($dirty)) {
      Write-Host "No changes to commit." -ForegroundColor DarkGray
    } else {
      $msg = "backup: $Message"
      git commit -m $msg
      Write-Host "Committed: $msg" -ForegroundColor Green
    }

    # Push to origin/main (set upstream if needed)
    try { git push -u origin main }
    catch { git push -u origin main }

    if ($Tag) {
      $tagName = 'backup-' + (Get-Date -Format 'yyyyMMdd-HHmm')
      git tag $tagName
      git push origin $tagName
      Write-Host "Pushed tag $tagName" -ForegroundColor Green
    }
  }
  finally { Pop-Location }
}

Ensure-Git
Backup-Repo -Path $UIPath -Name 'UI (budget-dashboard-ui)' -ExpectedRemote $UIRemote
Backup-Repo -Path $PluginPath -Name 'WP Plugin (budget-state)' -ExpectedRemote $PluginRemote
Write-Host "`nAll done." -ForegroundColor Green
