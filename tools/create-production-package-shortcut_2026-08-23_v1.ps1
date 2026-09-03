[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$toolsDirectory = "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools"
$packageScript = Join-Path $toolsDirectory "package-production.ps1"
$shortcutName = "Package Budget Dashboard for Production.lnk"

try {
    if (-not (Test-Path -LiteralPath $packageScript -PathType Leaf)) {
        throw "The packaging script is missing: $packageScript"
    }

    $desktopDirectory = [Environment]::GetFolderPath(
        [Environment+SpecialFolder]::DesktopDirectory
    )

    if (-not $desktopDirectory) {
        throw "Windows could not locate the Desktop folder."
    }

    $powerShellCommand = Get-Command "pwsh.exe" -ErrorAction SilentlyContinue
    if ($powerShellCommand) {
        $powerShellPath = $powerShellCommand.Source
    } else {
        $powerShellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    }

    if (-not (Test-Path -LiteralPath $powerShellPath -PathType Leaf)) {
        throw "PowerShell could not be located."
    }

    $shortcutPath = Join-Path $desktopDirectory $shortcutName
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)

    $shortcut.TargetPath = $powerShellPath
    $shortcut.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -NoExit -File `"$packageScript`""
    $shortcut.WorkingDirectory = $toolsDirectory
    $shortcut.IconLocation = "$powerShellPath,0"
    $shortcut.Description = "Create and validate a production ZIP without the local restore folder."
    $shortcut.WindowStyle = 1
    $shortcut.Save()

    if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) {
        throw "The desktop shortcut was not created."
    }

    Write-Host ""
    Write-Host "Desktop shortcut created successfully." -ForegroundColor Green
    Write-Host "Shortcut: $shortcutPath" -ForegroundColor Cyan
    Write-Host "Target: $packageScript"
    Write-Host ""
    Write-Host "Double-click the shortcut to create and validate a production ZIP."

    try {
        Start-Process -FilePath "explorer.exe" -ArgumentList "/select,`"$shortcutPath`""
    } catch {
        Write-Host "The shortcut was created, but File Explorer could not be opened automatically."
    }
} catch {
    Write-Host ""
    Write-Host "SHORTCUT CREATION FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
