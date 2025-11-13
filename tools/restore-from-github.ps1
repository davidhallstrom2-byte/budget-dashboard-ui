# restore-from-github.ps1 - Budget Dashboard Restore Script
# Restores from GitHub backup commits
# Location: C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\restore-from-github.ps1

param(
    [string]$CommitHash = "",
    [switch]$Latest = $false,
    [switch]$ListBackups = $false,
    [int]$ShowLast = 10
)

$ErrorActionPreference = "Stop"

# Configuration - Script is in ui\tools, so go up two levels for ProjectRoot
$ScriptDir = Split-Path -Parent $PSCommandPath
$UIFolder = Split-Path -Parent $ScriptDir  # ui\tools -> ui
$ProjectRoot = Split-Path -Parent $UIFolder  # ui -> budget-dashboard-fs

Write-Host ""
Write-Host "=== Budget Dashboard Restore Tool ===" -ForegroundColor Cyan
Write-Host ""

# Navigate to UI folder (where git repo is)
Set-Location $UIFolder

# Check if git repo exists
if (!(Test-Path "$UIFolder\.git")) {
    Write-Host "ERROR: Not a git repository!" -ForegroundColor Red
    Write-Host "The UI folder must be a git repository to restore from GitHub." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To set up git:" -ForegroundColor Yellow
    Write-Host "  cd `"$UIFolder`"" -ForegroundColor White
    Write-Host "  git init" -ForegroundColor White
    Write-Host "  git remote add origin https://github.com/davidhallstrom2-byte/budget-dashboard-ui.git" -ForegroundColor White
    Write-Host "  git fetch" -ForegroundColor White
    exit 1
}

# Get current branch
$CurrentBranch = git rev-parse --abbrev-ref HEAD 2>$null
if (!$CurrentBranch) {
    $CurrentBranch = "main"
}

Write-Host "Current branch: $CurrentBranch" -ForegroundColor Cyan
Write-Host ""

# List backups mode
if ($ListBackups) {
    Write-Host "Fetching latest from GitHub..." -ForegroundColor Yellow
    git fetch origin $CurrentBranch 2>&1 | Out-Null
    
    Write-Host ""
    Write-Host "Recent backup commits (last $ShowLast):" -ForegroundColor Green
    Write-Host ""
    
    # Get backup commits (those with "Backup" in message)
    $Commits = git log origin/$CurrentBranch --grep="Backup" --oneline -n $ShowLast
    
    if ([string]::IsNullOrWhiteSpace($Commits)) {
        Write-Host "No backup commits found." -ForegroundColor Yellow
    } else {
        $Commits | ForEach-Object {
            Write-Host "  $_" -ForegroundColor White
        }
        
        Write-Host ""
        Write-Host "To restore a specific backup, run:" -ForegroundColor Cyan
        Write-Host "  .\restore-from-github.ps1 -CommitHash <hash>" -ForegroundColor White
        Write-Host ""
        Write-Host "To restore the latest backup:" -ForegroundColor Cyan
        Write-Host "  .\restore-from-github.ps1 -Latest" -ForegroundColor White
    }
    
    Write-Host ""
    exit 0
}

# Determine which commit to restore
if ($Latest) {
    Write-Host "Finding latest backup commit..." -ForegroundColor Yellow
    git fetch origin $CurrentBranch 2>&1 | Out-Null
    
    $LatestBackup = git log origin/$CurrentBranch --grep="Backup" --oneline -n 1
    if ([string]::IsNullOrWhiteSpace($LatestBackup)) {
        Write-Host "ERROR: No backup commits found!" -ForegroundColor Red
        exit 1
    }
    
    $CommitHash = ($LatestBackup -split ' ')[0]
    $CommitMessage = ($LatestBackup -split ' ', 2)[1]
    
    Write-Host "Latest backup found:" -ForegroundColor Green
    Write-Host "  $LatestBackup" -ForegroundColor White
    Write-Host ""
} elseif ([string]::IsNullOrWhiteSpace($CommitHash)) {
    Write-Host "ERROR: No commit specified!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\restore-from-github.ps1 -Latest              # Restore latest backup" -ForegroundColor White
    Write-Host "  .\restore-from-github.ps1 -CommitHash <hash>   # Restore specific backup" -ForegroundColor White
    Write-Host "  .\restore-from-github.ps1 -ListBackups         # Show available backups" -ForegroundColor White
    Write-Host ""
    exit 1
} else {
    # Fetch to make sure we have the commit
    Write-Host "Fetching from GitHub..." -ForegroundColor Yellow
    git fetch origin $CurrentBranch 2>&1 | Out-Null
    
    # Verify commit exists
    $CommitExists = git cat-file -t $CommitHash 2>$null
    if ($CommitExists -ne "commit") {
        Write-Host "ERROR: Commit '$CommitHash' not found!" -ForegroundColor Red
        Write-Host "Run: .\restore-from-github.ps1 -ListBackups" -ForegroundColor Yellow
        exit 1
    }
    
    $CommitMessage = git log --format=%B -n 1 $CommitHash
}

# Check for uncommitted changes
$Status = git status --porcelain
if (![string]::IsNullOrWhiteSpace($Status)) {
    Write-Host "WARNING: You have uncommitted changes!" -ForegroundColor Yellow
    Write-Host ""
    git status --short
    Write-Host ""
    
    $Response = Read-Host "Continue with restore? This will OVERWRITE your local changes. (yes/no)"
    if ($Response -ne "yes") {
        Write-Host "Restore cancelled." -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host ""
    Write-Host "Creating backup of current state before restore..." -ForegroundColor Yellow
    
    # Create emergency backup
    $EmergencyTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $EmergencyBackup = "$ProjectRoot\backups\pre-restore-$EmergencyTimestamp"
    
    try {
        git stash push -m "Pre-restore backup $EmergencyTimestamp"
        Write-Host "Current changes saved to git stash." -ForegroundColor Green
        Write-Host "To recover: git stash pop" -ForegroundColor Cyan
    } catch {
        Write-Host "WARNING: Could not stash changes." -ForegroundColor Yellow
    }
    
    Write-Host ""
}

# Perform restore
Write-Host "Restoring from commit: $CommitHash" -ForegroundColor Green
Write-Host "Message: $CommitMessage" -ForegroundColor Cyan
Write-Host ""

try {
    # Reset to the specified commit
    Write-Host "Resetting to commit..." -ForegroundColor Yellow
    git reset --hard $CommitHash
    
    Write-Host ""
    Write-Host "Restore completed successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Ask about rebuilding
    $Response = Read-Host "Rebuild the project now? (yes/no)"
    if ($Response -eq "yes") {
        Write-Host ""
        Write-Host "Installing dependencies..." -ForegroundColor Yellow
        npm install
        
        Write-Host ""
        Write-Host "Building project..." -ForegroundColor Yellow
        npm run build
        
        Write-Host ""
        Write-Host "Build completed!" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "=== Restore Summary ===" -ForegroundColor Yellow
    Write-Host "- Restored to: $CommitHash" -ForegroundColor Cyan
    Write-Host "- Message: $CommitMessage" -ForegroundColor Cyan
    Write-Host "- Location: $UIFolder" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Your budget dashboard has been restored!" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Restore failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "You may need to manually resolve this:" -ForegroundColor Yellow
    Write-Host "  cd `"$UIFolder`"" -ForegroundColor White
    Write-Host "  git status" -ForegroundColor White
    exit 1
}

Write-Host ""