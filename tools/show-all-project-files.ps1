# File: show-all-project-files.ps1
# Purpose: Display all 28 project files for AI handoff

$projectRoot = "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui"
$parentRoot = "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs"

$files = @(
    # Core Components
    @{name="BudgetDashboard.jsx"; path="$projectRoot\src\components"},
    @{name="App.jsx"; path="$projectRoot\src"},
    @{name="main.jsx"; path="$projectRoot\src"},
    @{name="index.html"; path="$projectRoot"},
    
    # Tab Components
    @{name="DashboardTab.jsx"; path="$projectRoot\src\components\tabs"},
    @{name="EditorTab.jsx"; path="$projectRoot\src\components\tabs"},
    @{name="AnalysisTab.jsx"; path="$projectRoot\src\components\tabs"},
    @{name="CalculatorTab.jsx"; path="$projectRoot\src\components\tabs"},
    
    # Modern Components
    @{name="EmergencyFundWidget.jsx"; path="$projectRoot\src\components\modern"},
    @{name="NotificationPanel.jsx"; path="$projectRoot\src\components\modern"},
    @{name="SpendingTrendsChart.jsx"; path="$projectRoot\src\components\modern"},
    @{name="FinancialHealthCard.jsx"; path="$projectRoot\src\components\modern"},
    @{name="HealthRecommendations.jsx"; path="$projectRoot\src\components\modern"},
    
    # Common Components
    @{name="LoadingGate.jsx"; path="$projectRoot\src\components\common"},
    @{name="PageContainer.jsx"; path="$projectRoot\src\components\common"},
    @{name="StickyToolbar.jsx"; path="$projectRoot\src\components\common"},
    
    # UI Components
    @{name="ArchivedDrawer.jsx"; path="$projectRoot\src\components\ui"},
    @{name="StatementScanner.jsx"; path="$projectRoot\src\components\statements"},
    
    # Receipt/Camera
    @{name="CameraCapture.jsx"; path="$projectRoot\src\components\receipts"},
    
    # Utils & State
    @{name="state.js"; path="$projectRoot\src\utils"},
    @{name="financialHealthScore.js"; path="$projectRoot\src\utils"},
    @{name="statementParser.js"; path="$projectRoot\src\utils\statements"},
    @{name="ocr.js"; path="$projectRoot\src\utils\receipts"},
    
    # Data & Config
    @{name="budget-data.json"; path="$projectRoot\public\restore"},
    @{name="save.php"; path="$parentRoot"},
    @{name="package.json"; path="$projectRoot"},
    @{name="vite.config.js"; path="$projectRoot"},
    @{name="postcss.config.cjs"; path="$projectRoot"},
    @{name="index.css"; path="$projectRoot\src"}
)

$separator = "=" * 80
Write-Host $separator -ForegroundColor Cyan
Write-Host "ALL PROJECT FILES FOR AI HANDOFF (28 files)" -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan
Write-Host ""

$count = 0
foreach ($file in $files) {
    $found = Get-ChildItem -Path $file.path -Filter $file.name -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if ($found) {
        $count++
        Write-Host ""
        Write-Host $separator -ForegroundColor Yellow
        Write-Host "FILE $count/28: $($file.name)" -ForegroundColor Green
        Write-Host "PATH: $($found.FullName.Replace('C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\', ''))" -ForegroundColor Gray
        Write-Host $separator -ForegroundColor Yellow
        Write-Host ""
        Get-Content -Path $found.FullName -Raw
        Write-Host ""
    } else {
        Write-Host "NOT FOUND: $($file.name)" -ForegroundColor Red
    }
}

Write-Host $separator -ForegroundColor Cyan
Write-Host "COMPLETE: $count/28 files displayed" -ForegroundColor Green
Write-Host $separator -ForegroundColor Cyan