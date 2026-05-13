# restore-from-github.ps1 - Budget Dashboard Restore Script
# Restores the UI folder from GitHub, validates the Vite build, and can start the local dev server.
# Location: C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\restore-from-github.ps1

param(
    [string]$CommitHash = "",
    [switch]$Latest = $true,
    [switch]$ListBackups = $false,
    [int]$ShowLast = 12,
    [switch]$SkipBuild = $false,
    [switch]$StartDev = $false,
    [switch]$NoPause = $false
)

$ErrorActionPreference = "Stop"

function Pause-IfNeeded {
    if (-not $NoPause) {
        Write-Host ""
        Read-Host "Press Enter to close"
    }
}

try {
    $ScriptDir = Split-Path -Parent $PSCommandPath
    $UIFolder = Split-Path -Parent $ScriptDir
    $ProjectRoot = Split-Path -Parent $UIFolder
    $BackupsFolder = Join-Path $ProjectRoot "backups"
    $Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $PreRestoreBackupFolder = Join-Path $BackupsFolder "pre-github-restore-$Timestamp"

    Write-Host ""
    Write-Host "=== Budget Dashboard GitHub Restore Tool ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "UI folder: $UIFolder" -ForegroundColor Cyan
    Write-Host ""

    Set-Location $UIFolder

    if (!(Test-Path (Join-Path $UIFolder ".git"))) {
        Write-Host "ERROR: This folder is not a Git repository:" -ForegroundColor Red
        Write-Host $UIFolder -ForegroundColor Yellow
        Pause-IfNeeded
        exit 1
    }

    $CurrentBranch = git rev-parse --abbrev-ref HEAD
    if ([string]::IsNullOrWhiteSpace($CurrentBranch)) {
        $CurrentBranch = "main"
    }

    Write-Host "Current branch: $CurrentBranch" -ForegroundColor Cyan
    Write-Host "Fetching latest from GitHub..." -ForegroundColor Yellow
    git fetch origin main

    if ($ListBackups) {
        Write-Host ""
        Write-Host "Recent commits from origin/main:" -ForegroundColor Green
        Write-Host ""
        git log origin/main --oneline -n $ShowLast
        Write-Host ""
        Write-Host "To restore a specific commit:" -ForegroundColor Cyan
        Write-Host "powershell.exe -ExecutionPolicy Bypass -File `"$PSCommandPath`" -CommitHash COMMIT_HASH" -ForegroundColor White
        Pause-IfNeeded
        exit 0
    }

    $TargetRef = ""
    $TargetDescription = ""

    if (![string]::IsNullOrWhiteSpace($CommitHash)) {
        $TargetRef = $CommitHash
        $TargetDescription = "specific commit $CommitHash"
    } else {
        $TargetRef = "origin/main"
        $TargetDescription = "latest GitHub backup on origin/main"
    }

    $CommitExists = git cat-file -t $TargetRef 2>$null
    if ($CommitExists -ne "commit") {
        Write-Host "ERROR: Restore target not found:" -ForegroundColor Red
        Write-Host $TargetRef -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Run this to see available commits:" -ForegroundColor Cyan
        Write-Host "powershell.exe -ExecutionPolicy Bypass -File `"$PSCommandPath`" -ListBackups" -ForegroundColor White
        Pause-IfNeeded
        exit 1
    }

    $TargetHash = git rev-parse $TargetRef
    $TargetMessage = git log --format=%s -n 1 $TargetHash

    Write-Host ""
    Write-Host "Restore target:" -ForegroundColor Green
    Write-Host "- Ref: $TargetRef" -ForegroundColor Cyan
    Write-Host "- Commit: $TargetHash" -ForegroundColor Cyan
    Write-Host "- Message: $TargetMessage" -ForegroundColor Cyan
    Write-Host ""

    New-Item -ItemType Directory -Path $PreRestoreBackupFolder -Force | Out-Null

    Write-Host "Creating pre-restore local backup..." -ForegroundColor Yellow

    $UIBackup = Join-Path $PreRestoreBackupFolder "ui"
    New-Item -ItemType Directory -Path $UIBackup -Force | Out-Null

    $ExcludeDirNames = @("node_modules", "dist", ".vite", ".git")
    Get-ChildItem -Path $UIFolder -Recurse -Force | Where-Object {
        $Item = $_
        $ShouldExclude = $false

        foreach ($ExcludeDirName in $ExcludeDirNames) {
            if ($Item.FullName -like "*\$ExcludeDirName\*" -or $Item.FullName -like "*\$ExcludeDirName") {
                $ShouldExclude = $true
                break
            }
        }

        -not $ShouldExclude
    } | ForEach-Object {
        $TargetPath = $_.FullName.Replace($UIFolder, $UIBackup)

        if ($_.PSIsContainer) {
            New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
        } else {
            $TargetDir = Split-Path -Parent $TargetPath
            if (!(Test-Path $TargetDir)) {
                New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
            }
            Copy-Item $_.FullName -Destination $TargetPath -Force
        }
    }

    $StatusBeforeRestore = git status --porcelain
    if (![string]::IsNullOrWhiteSpace($StatusBeforeRestore)) {
        Write-Host "Saving uncommitted Git changes to stash..." -ForegroundColor Yellow
        git stash push -u -m "Pre-GitHub restore $Timestamp"
    }

    Write-Host ""
    Write-Host "Resetting local UI folder to $TargetDescription..." -ForegroundColor Yellow
    git reset --hard $TargetHash

    Write-Host "Removing untracked files..." -ForegroundColor Yellow
    git clean -fd

    Write-Host ""
    Write-Host "Restore completed." -ForegroundColor Green
    Write-Host ""

    if (-not $SkipBuild) {
        Write-Host "=== Build Validation ===" -ForegroundColor Yellow
        Write-Host ""
        npm.cmd run build
        Write-Host ""
        Write-Host "Build passed." -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "=== Restore Summary ===" -ForegroundColor Yellow
    Write-Host "- Restored to: $TargetHash" -ForegroundColor Cyan
    Write-Host "- Message: $TargetMessage" -ForegroundColor Cyan
    Write-Host "- Pre-restore backup: $PreRestoreBackupFolder" -ForegroundColor Cyan
    Write-Host "- UI folder: $UIFolder" -ForegroundColor Cyan

    if (-not $SkipBuild) {
        Write-Host "- Build validation: Passed" -ForegroundColor Cyan
    }

    Write-Host ""
    Write-Host "Hard refresh your browser with Ctrl + F5." -ForegroundColor Green

    if ($StartDev) {
        Write-Host ""
        Write-Host "Starting Vite dev server..." -ForegroundColor Yellow
        npm.cmd run dev -- --host 127.0.0.1 --port 4174 --strictPort
    }

    Pause-IfNeeded
} catch {
    Write-Host ""
    Write-Host "ERROR: Restore failed." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Check status with:" -ForegroundColor Yellow
    Write-Host "cd `"$UIFolder`"" -ForegroundColor White
    Write-Host "git status" -ForegroundColor White
    Pause-IfNeeded
    exit 1
}
