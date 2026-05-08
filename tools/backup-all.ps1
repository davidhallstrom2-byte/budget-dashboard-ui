# backup-all.ps1 - Budget Dashboard Backup Script with Git Integration
# Creates a local backup, validates the Vite build, commits, and pushes to GitHub.
# Location: C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\backup-all.ps1

param(
    [string]$CommitMessage = "Backup",
    [switch]$CreateTag = $false,
    [string]$TagName = "",
    [switch]$SkipGit = $false,
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $PSCommandPath
$UIFolder = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent $UIFolder
$BackupsFolder = Join-Path $ProjectRoot "backups"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$BackupFolder = Join-Path $BackupsFolder "backup-$Timestamp"

$RequiredFiles = @(
    "src\components\BudgetDashboard.jsx",
    "src\components\todo\TodoListSection.jsx",
    "src\components\tabs\TodoTab.jsx",
    "src\components\tabs\DashboardTab.jsx"
)

$RequiredGitFiles = @(
    "src/components/BudgetDashboard.jsx",
    "src/components/todo/TodoListSection.jsx",
    "src/components/tabs/TodoTab.jsx",
    "src/components/tabs/DashboardTab.jsx"
)

Write-Host "PowerShell $($PSVersionTable.PSVersion)" -ForegroundColor Cyan
Write-Host "Creating backup in: $BackupFolder" -ForegroundColor Yellow
Write-Host ""

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

New-Item -ItemType Directory -Path $BackupFolder -Force | Out-Null

Write-Host "Backing up UI folder..." -ForegroundColor Green
$UIBackup = Join-Path $BackupFolder "ui"
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

Write-Host "Backing up save.php endpoint..." -ForegroundColor Green
$SavePhpPath = Join-Path $ProjectRoot "save.php"
if (Test-Path $SavePhpPath) {
    Copy-Item $SavePhpPath -Destination (Join-Path $BackupFolder "save.php") -Force
}

Write-Host "Backing up budget-data.json..." -ForegroundColor Green
$BudgetDataRootPath = Join-Path $ProjectRoot "budget-data.json"
$BudgetDataRestorePath = Join-Path $UIFolder "public\restore\budget-data.json"

if (Test-Path $BudgetDataRootPath) {
    Copy-Item $BudgetDataRootPath -Destination (Join-Path $BackupFolder "budget-data.json") -Force
}

if (Test-Path $BudgetDataRestorePath) {
    $RestoreBackupFolder = Join-Path $BackupFolder "public-restore"
    New-Item -ItemType Directory -Path $RestoreBackupFolder -Force | Out-Null
    Copy-Item $BudgetDataRestorePath -Destination (Join-Path $RestoreBackupFolder "budget-data.json") -Force
}

$Manifest = @{
    Timestamp = $Timestamp
    Message = $CommitMessage
    Files = @{
        UI = "Backed up excluding node_modules, dist, .vite, .git"
        SaveEndpoint = if (Test-Path $SavePhpPath) { "Included" } else { "Not found" }
        BudgetDataRoot = if (Test-Path $BudgetDataRootPath) { "Included" } else { "Not found" }
        BudgetDataRestore = if (Test-Path $BudgetDataRestorePath) { "Included" } else { "Not found" }
    }
}

$Manifest | ConvertTo-Json -Depth 3 | Out-File (Join-Path $BackupFolder "manifest.json") -Encoding UTF8

Write-Host ""
Write-Host "Backup completed successfully!" -ForegroundColor Green
Write-Host "Location: $BackupFolder" -ForegroundColor Cyan
Write-Host ""

Set-Location $UIFolder

if (!(Test-Path (Join-Path $UIFolder "node_modules"))) {
    Write-Host "node_modules not found. Running npm.cmd install..." -ForegroundColor Yellow
    npm.cmd install
}

if (-not $SkipBuild) {
    Write-Host "=== Build Validation ===" -ForegroundColor Yellow
    Write-Host ""
    npm.cmd run build
    Write-Host ""
    Write-Host "Build passed." -ForegroundColor Green
    Write-Host ""
}

if (-not $SkipGit) {
    Write-Host "=== Git Operations ===" -ForegroundColor Yellow
    Write-Host ""

    if (!(Test-Path (Join-Path $UIFolder ".git"))) {
        Write-Host "ERROR: Not a git repository. Run git init first." -ForegroundColor Red
        exit 1
    }

    $CurrentBranch = git rev-parse --abbrev-ref HEAD
    Write-Host "Current branch: $CurrentBranch" -ForegroundColor Cyan

    foreach ($RequiredGitFile in $RequiredGitFiles) {
        git add --force $RequiredGitFile
    }

    git add .

    Write-Host ""
    Write-Host "Checking required Git-tracked files..." -ForegroundColor Green
    foreach ($RequiredGitFile in $RequiredGitFiles) {
        $Tracked = git ls-files -- $RequiredGitFile
        if ([string]::IsNullOrWhiteSpace($Tracked)) {
            Write-Host "ERROR: Required file exists locally but is not tracked by Git:" -ForegroundColor Red
            Write-Host $RequiredGitFile -ForegroundColor Yellow
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
    }

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