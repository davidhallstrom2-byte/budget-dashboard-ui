# Build and deploy the UI to /budget-dashboard-fs/ (Local by Flywheel)
# Usage (from UI folder):
#   npm run deploy:local
#   or:
#   powershell -ExecutionPolicy Bypass -File .\tools\build-and-deploy.ps1

$ErrorActionPreference = 'Stop'

# Move to repo root (this script lives in /tools)
Set-Location -Path (Join-Path $PSScriptRoot '..')

Write-Host "Installing deps (npm ci)..." -ForegroundColor Cyan
if (Test-Path ".\package-lock.json") {
  try { npm ci } catch { npm install }
} else {
  npm install
}

Write-Host "Building (npm run build)..." -ForegroundColor Cyan
npm run build

# Copy dist/* up one level into the public/budget-dashboard-fs/ folder
$target = "..\"
if (-not (Test-Path $target)) {
  throw "Target path '$target' not found. Are you inside the UI folder?"
}

$resolvedTarget = (Resolve-Path $target).Path
Write-Host ("Deploying to {0}" -f $resolvedTarget) -ForegroundColor Cyan
Copy-Item -Recurse -Force ".\dist\*" $target

$localUrl = "http://main-dashboard.local/budget-dashboard-fs/"
Write-Host ("Deployed. Open: {0}" -f $localUrl) -ForegroundColor Green
