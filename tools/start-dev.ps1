# C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\start-dev.ps1
param(
  [string]$Root = "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui",
  [string]$HostAddr = "127.0.0.1",
  [int]$Port = 4174
)
$ErrorActionPreference = "Stop"

if (-not (Test-Path $Root)) { throw "Root not found: $Root" }
Set-Location $Root
$Host.UI.RawUI.WindowTitle = "Budget Dashboard — Vite Dev ($HostAddr`:$Port)"

$npm = "C:\Program Files\nodejs\npm.cmd"
if (-not (Test-Path $npm)) { $npm = "npm" }

& $npm run dev -- --host $HostAddr --port $Port --strictPort --clearScreen false
