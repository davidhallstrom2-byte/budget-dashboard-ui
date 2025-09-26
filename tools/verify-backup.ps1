# verify-backup.ps1
# Quick verification script for GitHub backups

param(
    [string]$RepoPath = "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui",
    [string]$RepoName = "davidhallstrom2-byte/budget-dashboard-ui"
)

Write-Host "🔍 Verifying GitHub Backup..." -ForegroundColor Cyan
Write-Host ""

# Change to repo directory
Set-Location $RepoPath

# 1. Fetch latest from remote
Write-Host "📥 Fetching latest from remote..." -ForegroundColor Yellow
git fetch --all --tags --quiet

# 2. Get today's date for branch pattern
$today = Get-Date -Format 'yyyy-MM-dd'
$todayCompact = Get-Date -Format 'yyyyMMdd'

# 3. Check for today's backup branches
Write-Host ""
Write-Host "🌿 Today's Backup Branches ($today):" -ForegroundColor Green
$todayBranches = git branch -r | Select-String "backup/$today" | Select-String -NotMatch "HEAD"
if ($todayBranches) {
    $todayBranches | ForEach-Object { Write-Host "  ✅ $_" -ForegroundColor Green }
} else {
    Write-Host "  ⚠️  No backup branches found for today" -ForegroundColor Yellow
}

# 4. Check for recent backup branches (last 5)
Write-Host ""
Write-Host "🌿 Recent Backup Branches (Last 5):" -ForegroundColor Green
$recentBranches = git branch -r | Select-String "backup/" | Select-String -NotMatch "HEAD" | Select-Object -Last 5
if ($recentBranches) {
    $recentBranches | ForEach-Object { Write-Host "  ✅ $_" -ForegroundColor Green }
} else {
    Write-Host "  ❌ No backup branches found!" -ForegroundColor Red
}

# 5. Check for today's backup tags
Write-Host ""
Write-Host "🏷️  Today's Backup Tags ($todayCompact):" -ForegroundColor Green
$todayTags = git tag | Select-String "backup-$todayCompact"
if ($todayTags) {
    $todayTags | ForEach-Object { Write-Host "  ✅ $_" -ForegroundColor Green }
} else {
    Write-Host "  ⚠️  No backup tags found for today" -ForegroundColor Yellow
}

# 6. Check for recent backup tags (last 5)
Write-Host ""
Write-Host "🏷️  Recent Backup Tags (Last 5):" -ForegroundColor Green
$recentTags = git tag | Select-String "backup-" | Select-Object -Last 5
if ($recentTags) {
    $recentTags | ForEach-Object { Write-Host "  ✅ $_" -ForegroundColor Green }
} else {
    Write-Host "  ❌ No backup tags found!" -ForegroundColor Red
}

# 7. Check last remote commit
Write-Host ""
Write-Host "📝 Last Remote Commit:" -ForegroundColor Green
$lastCommit = git log --remotes --oneline -n 1
if ($lastCommit) {
    Write-Host "  $lastCommit" -ForegroundColor White
    
    # Get commit timestamp
    $commitTime = git log --remotes -n 1 --format="%ci"
    Write-Host "  🕒 Time: $commitTime" -ForegroundColor Cyan
} else {
    Write-Host "  ❌ No remote commits found!" -ForegroundColor Red
}

# 8. GitHub CLI verification (if available)
Write-Host ""
Write-Host "🌐 GitHub CLI Verification:" -ForegroundColor Green
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Host "  Opening repository in browser..." -ForegroundColor Cyan
    gh repo view $RepoName --web
} else {
    Write-Host "  ℹ️  GitHub CLI not installed. Manual URL:" -ForegroundColor Yellow
    Write-Host "  https://github.com/$RepoName" -ForegroundColor White
}

# 9. Summary
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "✅ VERIFICATION COMPLETE" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Review branches at: https://github.com/$RepoName/branches" -ForegroundColor White
Write-Host "  2. Review tags at: https://github.com/$RepoName/tags" -ForegroundColor White
Write-Host "  3. View commits at: https://github.com/$RepoName/commits" -ForegroundColor White
Write-Host ""