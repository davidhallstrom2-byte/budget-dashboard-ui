# File: find-missing-utils.ps1
# Purpose: Find the utility files that were referenced but not searched for

$projectRoot = "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui"
$separator = "=" * 80

$files = @(
    "financialHealthScore.js",
    "statementParser.js",
    "ocr.js",
    "CameraCapture.jsx"
)

Write-Host $separator -ForegroundColor Cyan
Write-Host "FINDING UTILITY FILES" -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan
Write-Host ""

foreach ($fileName in $files) {
    $found = Get-ChildItem -Path $projectRoot -Recurse -Filter $fileName -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if ($found) {
        $relativePath = $found.FullName.Replace($projectRoot, "").TrimStart("\")
        
        Write-Host ""
        Write-Host $separator -ForegroundColor Yellow
        Write-Host "FILE: $fileName" -ForegroundColor Green
        Write-Host "PATH: $relativePath" -ForegroundColor Gray
        Write-Host $separator -ForegroundColor Yellow
        Write-Host ""
        
        Get-Content -Path $found.FullName -Raw
        
        Write-Host ""
        Write-Host ""
    } else {
        Write-Host "FILE NOT FOUND: $fileName" -ForegroundColor Red
        Write-Host ""
    }
}

Write-Host $separator -ForegroundColor Cyan
Write-Host "END OF FILES" -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan