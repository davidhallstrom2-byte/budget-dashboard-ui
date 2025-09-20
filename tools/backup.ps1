# C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\backup.ps1
param(
  [string]$Label = ""
)

$ErrorActionPreference = "Stop"

# Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$UiDir     = Split-Path -Parent $ScriptDir
$ProjectDir = Split-Path -Parent $UiDir          # ...\budget-dashboard-fs
$PublicDir  = Split-Path -Parent $ProjectDir     # ...\public (WordPress root if present)
$BackupsDir = Join-Path $ProjectDir "backups"
New-Item -ItemType Directory -Path $BackupsDir -Force | Out-Null

# Names
$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$labelClean = ""
if ($Label) { $labelClean = "-" + ($Label -replace "[^a-zA-Z0-9-_]", "_") }
$baseName = "budget-dashboard-fs_ui_$stamp$labelClean"

# Staging
$TempDir = Join-Path $env:TEMP $baseName
if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
New-Item -ItemType Directory -Path $TempDir | Out-Null

# Copy UI excluding heavy and build folders
$rc = robocopy $UiDir $TempDir /MIR /XD node_modules .git dist .next .turbo .cache coverage /XF *.zip
if ($LASTEXITCODE -ge 8) { throw "robocopy failed: $LASTEXITCODE" }

# Zip UI
$ZipPath = Join-Path $BackupsDir ($baseName + ".zip")
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path (Join-Path $TempDir "*") -DestinationPath $ZipPath -Force
Remove-Item -Recurse -Force $TempDir

# Optional DB export (if WordPress present and wp-cli available)
$WpConfig = Join-Path $PublicDir "wp-config.php"
if (Test-Path $WpConfig) {
  try {
    $DbOut = Join-Path $BackupsDir ($baseName + "-db.sql")
    # Requires wp-cli on PATH. Falls back silently if not found.
    wp --path="$PublicDir" db export "$DbOut" | Out-Null

    # Add DB into the zip under /db/db.sql
    $TmpDbDir = Join-Path $env:TEMP ($baseName + "_db")
    New-Item -ItemType Directory -Path $TmpDbDir -Force | Out-Null
    Copy-Item "$DbOut" -Destination (Join-Path $TmpDbDir "db.sql") -Force
    Compress-Archive -Path (Join-Path $TmpDbDir "*") -DestinationPath $ZipPath -Update
    Remove-Item -Recurse -Force $TmpDbDir
  }
  catch {
    Write-Warning "WP-CLI not found or DB export failed. Skipping DB export."
  }
}

Write-Host ("Backup created: " + $ZipPath)
