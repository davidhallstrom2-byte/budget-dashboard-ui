# backup-all.ps1 - Budget Dashboard Backup Script with Git Integration
# Creates local backup AND commits/pushes to GitHub
# Location: C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\backup-all.ps1

param(
    [string]$CommitMessage = "Backup",
    [switch]$CreateTag = $false,
    [string]$TagName = "",
    [switch]$SkipGit = $false
)

$ErrorActionPreference = "Stop"

# Configuration - Script is in ui\tools, so go up two levels for ProjectRoot
$ScriptDir = Split-Path -Parent $PSCommandPath
$UIFolder = Split-Path -Parent $ScriptDir  # ui\tools -> ui
$ProjectRoot = Split-Path -Parent $UIFolder  # ui -> budget-dashboard-fs
$BackupsFolder = "$ProjectRoot\backups"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$BackupFolder = "$BackupsFolder\backup-$Timestamp"

Write-Host "PowerShell $($PSVersionTable.PSVersion)" -ForegroundColor Cyan
Write-Host "Creating backup in: $BackupFolder" -ForegroundColor Yellow
Write-Host ""

# Create backup directory
New-Item -ItemType Directory -Path $BackupFolder -Force | Out-Null

# Backup UI folder (excluding build artifacts)
Write-Host "Backing up UI folder..." -ForegroundColor Green
$UIBackup = "$BackupFolder\ui"
New-Item -ItemType Directory -Path $UIBackup -Force | Out-Null

# Copy UI files, excluding build artifacts
$ExcludeDirs = @('node_modules', 'dist', '.vite')
Get-ChildItem -Path $UIFolder -Recurse | Where-Object {
    $_.FullName -notmatch ($ExcludeDirs -join '|')
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
        UI = "Backed up (excluding node_modules, dist, .vite)"
        SaveEndpoint = if (Test-Path "$ProjectRoot\save.php") { "Included" } else { "Not found" }
        BudgetData = if (Test-Path "$ProjectRoot\budget-data.json") { "Included" } else { "Not found" }
    }
}

$Manifest | ConvertTo-Json -Depth 3 | Out-File "$BackupFolder\manifest.json" -Encoding UTF8

Write-Host ""
Write-Host "Backup completed successfully!" -ForegroundColor Green
Write-Host "Location: $BackupFolder" -ForegroundColor Cyan
Write-Host ""

# Git operations
if (-not $SkipGit) {
    Write-Host "=== Git Operations ===" -ForegroundColor Yellow
    Write-Host ""
    
    Set-Location $UIFolder
    
    # Check if git repo exists
    if (!(Test-Path "$UIFolder\.git")) {
        Write-Host "WARNING: Not a git repository. Run 'git init' first." -ForegroundColor Red
        exit 1
    }
    
    # Show current branch
    $CurrentBranch = git rev-parse --abbrev-ref HEAD
    Write-Host "Current branch: $CurrentBranch" -ForegroundColor Cyan
    
    # Check for changes
    $Status = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($Status)) {
        Write-Host "No changes to commit." -ForegroundColor Yellow
    } else {
        Write-Host "Changes detected:" -ForegroundColor Green
        git status --short
        Write-Host ""
        
        # Stage all changes
        Write-Host "Staging changes..." -ForegroundColor Green
        git add .
        
        # Commit
        Write-Host "Committing changes..." -ForegroundColor Green
        git commit -m "$CommitMessage - $Timestamp"
        
        # Push to remote
        Write-Host "Pushing to GitHub..." -ForegroundColor Green
        try {
            git push origin $CurrentBranch
            Write-Host "Successfully pushed to GitHub!" -ForegroundColor Green
        } catch {
            Write-Host "ERROR: Failed to push to GitHub. Check your remote configuration." -ForegroundColor Red
            Write-Host "Run: git remote -v" -ForegroundColor Yellow
            exit 1
        }
        
        # Create tag if requested
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

# Summary
Write-Host ""
Write-Host "=== Backup Summary ===" -ForegroundColor Yellow
Write-Host "- Timestamp: $Timestamp" -ForegroundColor Cyan
Write-Host "- Message: $CommitMessage" -ForegroundColor Cyan
Write-Host "- Local backup: $BackupFolder" -ForegroundColor Cyan
if (-not $SkipGit) {
    Write-Host "- Git commit: Yes" -ForegroundColor Cyan
    Write-Host "- GitHub push: Yes" -ForegroundColor Cyan
    if ($CreateTag) {
        Write-Host "- Git tag: $TagName" -ForegroundColor Cyan
    }
}
Write-Host ""
Write-Host "Done!" -ForegroundColor Green