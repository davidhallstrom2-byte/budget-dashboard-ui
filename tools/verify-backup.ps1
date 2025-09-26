git fetch --all --tags
$today = Get-Date -Format 'yyyyMMdd'
Write-Host "`n🔍 Checking for today's backup ($today)..." -ForegroundColor Cyan
git branch -r | Select-String "backup/$today"
git tag | Select-String "backup-$today"