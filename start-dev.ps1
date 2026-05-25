# start-dev.ps1
# Desktop localhost launcher for Budget Dashboard
# Opens the dashboard at https://localhost:4174/budget-dashboard-fs/

$ErrorActionPreference = 'Stop'

$ui = "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui"
$url = "https://localhost:4174/budget-dashboard-fs/"

if (-not (Test-Path $ui)) {
  Write-Host "UI path not found: $ui" -ForegroundColor Red
  exit 1
}

try {
  $conns = Get-NetTCPConnection -LocalPort 4174 -State Listen -ErrorAction SilentlyContinue
  if ($conns) {
    $processIds = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
      try {
        Stop-Process -Id $processId -Force -ErrorAction Stop
      } catch {}
    }
  }
} catch {}

try {
  Get-CimInstance Win32_Process |
    Where-Object {
      ($_.Name -match 'node.exe' -or $_.Name -match 'vite.exe') -and
      ($_.CommandLine -match 'vite')
    } |
    ForEach-Object {
      try {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
      } catch {}
    }
} catch {}

Set-Location $ui

$env:VITE_DEV_HOST = "localhost"

npm.cmd config set registry https://registry.npmjs.org/ | Out-Null

if (-not (Test-Path ".\node_modules")) {
  npm.cmd install
}

Start-Process $url

npm.cmd run dev -- --host 127.0.0.1 --port 4174 --strictPort