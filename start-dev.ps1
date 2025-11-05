# start-dev.ps1 — kill existing Vite on 4174, then start fresh
$ErrorActionPreference = 'Stop'

$ui  = "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui"
$url = "https://localhost:4174/budget-dashboard-fs/"

if (-not (Test-Path $ui)) {
  Write-Host "UI path not found: $ui" -ForegroundColor Red
  exit 1
}

# --- Kill anything on port 4174 (Vite default here) ---
try {
  $conns = Get-NetTCPConnection -LocalPort 4174 -State Listen -ErrorAction SilentlyContinue
  if ($conns) {
    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
      try { Stop-Process -Id $pid -Force -ErrorAction Stop } catch {}
    }
  }
} catch {}

# Also kill any Node processes running vite by command line match (best-effort)
try {
  Get-CimInstance Win32_Process |
    Where-Object { ($_.Name -match 'node.exe' -or $_.Name -match 'vite.exe') -and ($_.CommandLine -match 'vite') } |
    ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
} catch {}

Set-Location $ui

# Ensure public registry (optional if already set)
npm.cmd config set registry https://registry.npmjs.org/ | Out-Null

# Install deps if missing
if (-not (Test-Path ".\node_modules")) {
  npm.cmd install
}

# Launch browser and start Vite
Start-Process $url
npm.cmd run dev -- --host --port 4174
