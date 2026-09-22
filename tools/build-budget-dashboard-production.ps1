$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs"
$UiRoot = Join-Path $ProjectRoot "ui"
$DistRoot = Join-Path $UiRoot "dist"
$LocalAppDataSource = Join-Path $ProjectRoot "private-data\app-data-export.json"
$BundledAppDataTarget = Join-Path $UiRoot "public\restore\app-data-export.json"

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

    if (-not (Test-Path -LiteralPath $LocalAppDataSource -PathType Leaf)) {
        throw @"
The complete localhost dashboard snapshot was not found:

$LocalAppDataSource

Open https://localhost:4174/budget-dashboard-fs/ and allow the dashboard to save its current data before running the production build again.
"@
    }

    $RawSnapshot = Get-Content -LiteralPath $LocalAppDataSource -Raw
    try {
        $Snapshot = $RawSnapshot | ConvertFrom-Json
    }
    catch {
        throw "The complete localhost dashboard snapshot is not valid JSON: $LocalAppDataSource"
    }

    if (
        $Snapshot.type -ne "budget-dashboard-mobile-migration" -or
        -not $Snapshot.snapshotId -or
        -not $Snapshot.items
    ) {
        throw "The localhost app-data snapshot is not a valid complete dashboard export."
    }

    $SnapshotModified = (Get-Item -LiteralPath $LocalAppDataSource).LastWriteTime
    $SnapshotAgeMinutes = ((Get-Date) - $SnapshotModified).TotalMinutes

    if ($SnapshotAgeMinutes -gt 10) {
        throw @"
The complete localhost dashboard snapshot is more than 10 minutes old.

Snapshot modified: $SnapshotModified

Open https://localhost:4174/budget-dashboard-fs/, wait for the current dashboard data to save, then run this production build again.
"@
    }

    $RestoreDirectory = Split-Path -Parent $BundledAppDataTarget
    if (-not (Test-Path -LiteralPath $RestoreDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $RestoreDirectory -Force | Out-Null
    }

    $DeploymentStamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $Snapshot.snapshotId = "$($Snapshot.snapshotId)-production-$DeploymentStamp"
    $Snapshot.exportedAt = (Get-Date).ToUniversalTime().ToString("o")

    $BundledJson = $Snapshot | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText(
        $BundledAppDataTarget,
        $BundledJson,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host "Current localhost dashboard data attached to production build." -ForegroundColor Green
    Write-Host "Snapshot:" -NoNewline
    Write-Host " $($Snapshot.snapshotId)" -ForegroundColor White
    Write-Host "Exported:" -NoNewline
    Write-Host " $($Snapshot.exportedAt)" -ForegroundColor White
    Write-Host ""

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

    $DistAppData = Join-Path $DistRoot "restore\app-data-export.json"
    if (-not (Test-Path -LiteralPath $DistAppData -PathType Leaf)) {
        throw "Build passed, but the complete dashboard data snapshot was not included in dist\restore\app-data-export.json."
    }

    Write-Host ""
    Write-Host "BUILD PASSED" -ForegroundColor Green
    Write-Host ""
    Write-Host "Production code and the current localhost dashboard dataset are ready here:" -ForegroundColor Green
    Write-Host $DistRoot -ForegroundColor White
    Write-Host ""
    Write-Host "After deployment, production will apply this snapshot once and cloud sync will publish it." -ForegroundColor Cyan
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
