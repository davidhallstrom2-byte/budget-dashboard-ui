[CmdletBinding()]
param(
    [string]$DistPath = "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\dist",
    [string]$OutputDirectory = "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\production-packages"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-NormalizedFullPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [System.IO.Path]::GetFullPath($Path).TrimEnd(
        [char[]]@(
            [System.IO.Path]::DirectorySeparatorChar,
            [System.IO.Path]::AltDirectorySeparatorChar
        )
    )
}

function Test-IsWithinDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CandidatePath,

        [Parameter(Mandatory = $true)]
        [string]$DirectoryPath
    )

    $candidate = Get-NormalizedFullPath -Path $CandidatePath
    $directory = Get-NormalizedFullPath -Path $DirectoryPath
    $directoryPrefix = $directory + [System.IO.Path]::DirectorySeparatorChar

    return $candidate.StartsWith(
        $directoryPrefix,
        [System.StringComparison]::OrdinalIgnoreCase
    )
}

function Get-RelativeArchivePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string]$RootPath
    )

    if (-not (Test-IsWithinDirectory -CandidatePath $FilePath -DirectoryPath $RootPath)) {
        throw "The file is outside the dist directory: $FilePath"
    }

    $relativePath = $FilePath.Substring($RootPath.Length).TrimStart(
        [char[]]@(
            [System.IO.Path]::DirectorySeparatorChar,
            [System.IO.Path]::AltDirectorySeparatorChar
        )
    )

    return $relativePath.Replace("\", "/")
}

function Get-ProductionSourceFiles {
    param(
        [Parameter(Mandatory = $true)]
        [string]$UiRoot
    )

    $results = @()
    $sourceDirectory = Join-Path $UiRoot "src"
    $publicDirectory = Join-Path $UiRoot "public"
    $publicRestoreDirectory = Join-Path $publicDirectory "restore"

    if (Test-Path -LiteralPath $sourceDirectory -PathType Container) {
        $results += Get-ChildItem -LiteralPath $sourceDirectory -Recurse -File -Force
    }

    if (Test-Path -LiteralPath $publicDirectory -PathType Container) {
        $results += Get-ChildItem -LiteralPath $publicDirectory -Recurse -File -Force |
            Where-Object {
                -not (Test-IsWithinDirectory -CandidatePath $_.FullName -DirectoryPath $publicRestoreDirectory)
            }
    }

    foreach ($fileName in @("index.html", "vite.config.js", "package.json", "package-lock.json")) {
        $candidate = Join-Path $UiRoot $fileName
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $results += Get-Item -LiteralPath $candidate
        }
    }

    return @($results)
}

$zipPath = $null
$archive = $null
$validationArchive = $null

try {
    $distFullPath = Get-NormalizedFullPath -Path $DistPath
    $outputFullPath = Get-NormalizedFullPath -Path $OutputDirectory

    if (-not (Test-Path -LiteralPath $distFullPath -PathType Container)) {
        throw "The production build directory does not exist: $distFullPath"
    }

    $indexPath = Join-Path $distFullPath "index.html"
    if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
        throw "The production build is missing index.html. Run npm.cmd run build first."
    }

    $uiRoot = Split-Path -Parent $distFullPath
    $sourceFiles = @(Get-ProductionSourceFiles -UiRoot $uiRoot)
    if ($sourceFiles.Count -gt 0) {
        $latestSourceFile = $sourceFiles |
            Sort-Object LastWriteTimeUtc -Descending |
            Select-Object -First 1

        $builtIndex = Get-Item -LiteralPath $indexPath
        if ($latestSourceFile.LastWriteTimeUtc -gt $builtIndex.LastWriteTimeUtc.AddSeconds(2)) {
            throw "The dist build is older than $($latestSourceFile.FullName). Run npm.cmd run build before packaging."
        }
    }

    $restoreDirectory = Get-NormalizedFullPath -Path (Join-Path $distFullPath "restore")

    $filesToPackage = @(
        Get-ChildItem -LiteralPath $distFullPath -Recurse -File -Force |
            Where-Object {
                -not (Test-IsWithinDirectory -CandidatePath $_.FullName -DirectoryPath $restoreDirectory)
            } |
            Sort-Object FullName
    )

    if ($filesToPackage.Count -eq 0) {
        throw "No production files were found in: $distFullPath"
    }

    if (-not (Test-Path -LiteralPath $outputFullPath -PathType Container)) {
        New-Item -ItemType Directory -Path $outputFullPath -Force | Out-Null
    }

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
    $zipPath = Join-Path $outputFullPath "budget-dashboard-production-$timestamp.zip"

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    $archive = [System.IO.Compression.ZipFile]::Open(
        $zipPath,
        [System.IO.Compression.ZipArchiveMode]::Create
    )

    foreach ($file in $filesToPackage) {
        $entryName = Get-RelativeArchivePath -FilePath $file.FullName -RootPath $distFullPath

        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive,
            $file.FullName,
            $entryName,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }

    $archive.Dispose()
    $archive = $null

    $validationArchive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    $entryNames = @($validationArchive.Entries | ForEach-Object { $_.FullName })

    $entrySet = [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::OrdinalIgnoreCase
    )
    foreach ($entryName in $entryNames) {
        [void]$entrySet.Add($entryName)
    }

    $forbiddenEntries = @(
        $entryNames | Where-Object {
            $_ -match "^(?i:restore|private-data|dist)/" -or
            $_ -match "(?i)(?:app-data-export|budget-data)\.json$"
        }
    )

    if ($forbiddenEntries.Count -gt 0) {
        throw "The ZIP contains forbidden local-data paths: $($forbiddenEntries -join ', ')"
    }

    foreach ($requiredEntry in @("index.html", "manifest.json", "manifest.webmanifest", "sw.js")) {
        if (-not $entrySet.Contains($requiredEntry)) {
            throw "The ZIP is missing the required file: $requiredEntry"
        }
    }

    $indexText = Get-Content -LiteralPath $indexPath -Raw
    $referencePattern = '(?i)(?:src|href)=["''](?<url>/budget-dashboard-fs/[^"''?#]+)'
    $referenceMatches = [System.Text.RegularExpressions.Regex]::Matches(
        $indexText,
        $referencePattern
    )

    foreach ($match in $referenceMatches) {
        $url = $match.Groups["url"].Value
        $entryName = $url.Substring("/budget-dashboard-fs/".Length)

        if (-not $entrySet.Contains($entryName)) {
            throw "index.html references a file that is missing from the ZIP: $entryName"
        }
    }

    $mainScriptReference = @(
        $referenceMatches |
            ForEach-Object { $_.Groups["url"].Value } |
            Where-Object { $_ -match "/assets/index-[^/]+\.js$" }
    ) | Select-Object -First 1

    if (-not $mainScriptReference) {
        throw "index.html does not reference a production JavaScript bundle."
    }

    $validationArchive.Dispose()
    $validationArchive = $null

    $zipFile = Get-Item -LiteralPath $zipPath
    $sizeMb = [Math]::Round($zipFile.Length / 1MB, 2)

    Write-Host ""
    Write-Host "Production ZIP completed successfully." -ForegroundColor Green
    Write-Host "Source: $distFullPath"
    Write-Host "Restore folder excluded: Yes"
    Write-Host "Files included: $($entryNames.Count)"
    Write-Host "Main bundle: $($mainScriptReference.Substring('/budget-dashboard-fs/'.Length))"
    Write-Host "ZIP size: $sizeMb MB"
    Write-Host "ZIP: $zipPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Upload this ZIP to ChatGPT for verification before deploying it to cPanel."

    try {
        Set-Clipboard -Value $zipPath
        Write-Host "The ZIP path was copied to the clipboard."
    } catch {
        Write-Host "The ZIP path could not be copied to the clipboard."
    }

    try {
        Start-Process -FilePath "explorer.exe" -ArgumentList "/select,`"$zipPath`""
    } catch {
        Write-Host "File Explorer could not be opened automatically."
    }
} catch {
    if ($archive) {
        $archive.Dispose()
    }

    if ($validationArchive) {
        $validationArchive.Dispose()
    }

    if ($zipPath -and (Test-Path -LiteralPath $zipPath -PathType Leaf)) {
        Remove-Item -LiteralPath $zipPath -Force
    }

    Write-Host "" 
    Write-Host "PACKAGING FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
