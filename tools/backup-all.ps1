# backup-all.ps1 - Budget Dashboard Backup Script with Git Integration
# Creates local backup, validates Vite build, commits, and pushes to GitHub
# Location: C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\backup-all.ps1

param(
    [string]$CommitMessage = "Backup",
    [switch]$CreateTag = $false,
    [string]$TagName = "",
    [switch]$SkipGit = $false,
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"

# Configuration - Script is in ui\tools, so go up two levels for ProjectRoot
$ScriptDir = Split-Path -Parent $PSCommandPath
$UIFolder = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent $UIFolder
$BackupsFolder = "$ProjectRoot\backups"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$BackupFolder = "$BackupsFolder\backup-$Timestamp"

Write-Host "PowerShell $($PSVersionTable.PSVersion)" -ForegroundColor Cyan
Write-Host "Creating backup in: $BackupFolder" -ForegroundColor Yellow
Write-Host ""

# Required files that must exist and be committed for GitHub Actions/Linux builds
$RequiredFiles = @(
$RequiredGitFiles = @(
    "src/components/BudgetDashboard.jsx",
    "src/components/todo/TodoListSection.jsx",
    "src/components/tabs/TodoTab.jsx",
    "src/components/tabs/DashboardTab.jsx"
)

Write-Host "Checking required files..." -ForegroundColor Green
foreach ($RequiredFile in $RequiredFiles) {
    $FullRequiredPath = Join-Path $UIFolder $RequiredFile
    if (!(Test-Path $FullRequiredPath)) {
        Write-Host "ERROR: Required file missing:" -ForegroundColor Red
        Write-Host $FullRequiredPath -ForegroundColor Yellow
        exit 1
    }
}
Write-Host "Required files found." -ForegroundColor Green
Write-Host ""

# Create backup directory
New-Item -ItemType Directory -Path $BackupFolder -Force | Out-Null

# Backup UI folder, excluding build artifacts
Write-Host "Backing up UI folder..." -ForegroundColor Green
$UIBackup = "$BackupFolder\ui"
New-Item -ItemType Directory -Path $UIBackup -Force | Out-Null

$ExcludeDirs = @('node_modules', 'dist', '.vite', '.git')
Get-ChildItem -Path $UIFolder -Recurse | Where-Object {
    $FullName = $_.FullName
    -not ($ExcludeDirs | Where-Object { $FullName -match "\\$($_)(\\|$)" })
} | ForEach-Object {
    $targetPath = $_.FullName.Replace($UIFolder, $UIBackup)
    if ($_.PSIsContainer) {
        New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
    } else {
        $targetDir = Split-Path -Parent $targetPath
        if (!(Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        Copy-Item $_.FullName -Destination $targetPath -Force
    }
}

# Backup save.php endpoint
Write-Host "Backing up save.php endpoint..." -ForegroundColor Green
if (Test-Path "$ProjectRoot\save.php") {
    Copy-Item "$ProjectRoot\save.php" -Destination "$BackupFolder\save.php" -Force
}

# Backup budget-data.json
Write-Host "Backing up budget-data.json..." -ForegroundColor Green
if (Test-Path "$ProjectRoot\budget-data.json") {
    Copy-Item "$ProjectRoot\budget-data.json" -Destination "$BackupFolder\budget-data.json" -Force
}

# Create backup manifest
$Manifest = @{
    Timestamp = $Timestamp
    Message = $CommitMessage
    Files = @{
        UI = "Backed up excluding node_modules, dist, .vite, .git"
        SaveEndpoint = if (Test-Path "$ProjectRoot\save.php") { "Included" } else { "Not found" }
        BudgetData = if (Test-Path "$ProjectRoot\budget-data.json") { "Included" } else { "Not found" }
    }
}

$Manifest | ConvertTo-Json -Depth 3 | Out-File "$BackupFolder\manifest.json" -Encoding UTF8

Write-Host ""
Write-Host "Backup completed successfully!" -ForegroundColor Green
Write-Host "Location: $BackupFolder" -ForegroundColor Cyan
Write-Host ""

Set-Location $UIFolder

# Install deps if missing
if (!(Test-Path "$UIFolder\node_modules")) {
    Write-Host "node_modules not found. Running npm.cmd install..." -ForegroundColor Yellow
    npm.cmd install
}

# Validate build before commit/push
if (-not $SkipBuild) {
    Write-Host "=== Build Validation ===" -ForegroundColor Yellow
    Write-Host ""
    npm.cmd run build
    Write-Host ""
    Write-Host "Build passed." -ForegroundColor Green
    Write-Host ""
}

# Git operations
if (-not $SkipGit) {
    Write-Host "=== Git Operations ===" -ForegroundColor Yellow
    Write-Host ""

    if (!(Test-Path "$UIFolder\.git")) {
        Write-Host "ERROR: Not a git repository. Run git init first." -ForegroundColor Red
        exit 1
    }

    $CurrentBranch = git rev-parse --abbrev-ref HEAD
    Write-Host "Current branch: $CurrentBranch" -ForegroundColor Cyan

    # Force-stage required files first so GitHub does not miss new component files
    foreach ($RequiredFile in $RequiredFiles) {
        git add --force $RequiredFile
    }

    # Stage all other changes
    git add .

    # Verify required files are tracked
    Write-Host ""
    Write-Host "Checking required Git-tracked files..." -ForegroundColor Green
    foreach ($RequiredFile in $RequiredFiles) {
        $Tracked = git ls-files -- $RequiredFile
        if ([string]::IsNullOrWhiteSpace($Tracked)) {
            Write-Host "ERROR: Required file exists locally but is not tracked by Git:" -ForegroundColor Red
            Write-Host $RequiredFile -ForegroundColor Yellow
            exit 1
        }
    }
    Write-Host "Required files are tracked." -ForegroundColor Green
    Write-Host ""

    $Status = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($Status)) {
        Write-Host "No changes to commit." -ForegroundColor Yellow
    } else {
        Write-Host "Changes detected:" -ForegroundColor Green
        git status --short
        Write-Host ""

        Write-Host "Committing changes..." -ForegroundColor Green
        git commit -m "$CommitMessage - $Timestamp"

        Write-Host "Pushing to GitHub..." -ForegroundColor Green
        git push origin $CurrentBranch
        Write-Host "Successfully pushed to GitHub!" -ForegroundColor Green

        if ($CreateTag) {
            if ([string]::IsNullOrWhiteSpace($TagName)) {
                $TagName = "backup-$Timestamp"
            }

            Write-Host ""
            Write-Host "Creating git tag: $TagName" -ForegroundColor Green
            git tag -a $TagName -m "$CommitMessage"
            git push origin $TagName
            Write-Host "Tag created and pushed!" -ForegroundColor Green
        }
    }

    Write-Host ""
    Write-Host "Git operations completed!" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Backup Summary ===" -ForegroundColor Yellow
Write-Host "- Timestamp: $Timestamp" -ForegroundColor Cyan
Write-Host "- Message: $CommitMessage" -ForegroundColor Cyan
Write-Host "- Local backup: $BackupFolder" -ForegroundColor Cyan
if (-not $SkipBuild) {
    Write-Host "- Build validation: Passed" -ForegroundColor Cyan
}
if (-not $SkipGit) {
    Write-Host "- Git commit/push: Completed" -ForegroundColor Cyan
    if ($CreateTag) {
        Write-Host "- Git tag: $TagName" -ForegroundColor Cyan
    }
}
Write-Host ""
Write-Host "Done!" -ForegroundColor Green