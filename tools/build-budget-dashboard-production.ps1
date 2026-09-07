$ErrorActionPreference = "Stop"

$UiRoot = "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui"
$DistRoot = Join-Path $UiRoot "dist"

$Host.UI.RawUI.WindowTitle = "Budget Dashboard - Production Build"

Clear-Host

Write-Host ""
Write-Host "Budget Dashboard Production Build" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project:" -NoNewline
Write-Host " $UiRoot" -ForegroundColor White
Write-Host ""

try {
    if (-not (Test-Path -LiteralPath $UiRoot -PathType Container)) {
        throw "UI project folder was not found: $UiRoot"
    }

    $PackageJson = Join-Path $UiRoot "package.json"
    if (-not (Test-Path -LiteralPath $PackageJson -PathType Leaf)) {
        throw "package.json was not found: $PackageJson"
    }

    $NpmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
    if (-not $NpmCommand) {
        throw "npm.cmd was not found in PATH. Confirm Node.js is installed."
    }

    Set-Location -LiteralPath $UiRoot

    Write-Host "Running production build..." -ForegroundColor Yellow
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "Vite production build failed with exit code $LASTEXITCODE."
    }

    if (-not (Test-Path -LiteralPath $DistRoot -PathType Container)) {
        throw "Build reported success, but the dist folder was not found: $DistRoot"
    }

    $IndexFile = Join-Path $DistRoot "index.html"
    if (-not (Test-Path -LiteralPath $IndexFile -PathType Leaf)) {
        throw "Build reported success, but dist\index.html was not found."
    }

    Write-Host ""
    Write-Host "BUILD PASSED" -ForegroundColor Green
    Write-Host ""
    Write-Host "Production files are ready here:" -ForegroundColor Green
    Write-Host $DistRoot -ForegroundColor White
    Write-Host ""
    Write-Host "You can now run your existing deployment ZIP script." -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host "BUILD FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Read-Host "Press Enter to close"
