# restore-all.ps1 - Budget Dashboard complete restore script
# Restores a verified backup created by tools\backup-all.ps1.
# Location: C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\restore-all.ps1

[CmdletBinding()]
param(
    [string]$BackupPath = "",
    [switch]$Latest = $false,
    [switch]$SkipDatabase = $false,
    [switch]$SkipBuild = $false,
    [switch]$SkipRollbackSnapshot = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string[]]$ArgumentList,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    & $FilePath @ArgumentList
    $ExitCode = $LASTEXITCODE

    if ($ExitCode -ne 0) {
        throw "$Description failed with exit code $ExitCode."
    }
}

function Resolve-ApplicationCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Names
    )

    foreach ($Name in $Names) {
        $Command = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $Command -and -not [string]::IsNullOrWhiteSpace($Command.Source)) {
            return $Command.Source
        }
    }

    return $null
}

function Get-WordPressConfigValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ConfigPath,

        [Parameter(Mandatory = $true)]
        [string]$ConstantName
    )

    $ConfigContent = Get-Content -LiteralPath $ConfigPath -Raw
    $Pattern = 'define\s*\(\s*[''"]' + [regex]::Escape($ConstantName) + '[''"]\s*,\s*[''"]([^''"]*)[''"]\s*\)'
    $Match = [regex]::Match(
        $ConfigContent,
        $Pattern,
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    if (!$Match.Success) {
        throw "Could not read $ConstantName from $ConfigPath."
    }

    return $Match.Groups[1].Value
}

function ConvertTo-MySqlOptionValue {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Value
    )

    if ($Value -match '[\r\n]') {
        throw "A MySQL connection value contains an unsupported line break."
    }

    $EscapedValue = $Value.Replace('\', '\\').Replace('"', '\"')
    return '"' + $EscapedValue + '"'
}

function Get-LocalWpMysqlConnection {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LocalSiteRoot
    )

    if ([string]::IsNullOrWhiteSpace($env:APPDATA)) {
        throw "The APPDATA environment variable is unavailable."
    }

    $NormalizedSiteRoot = $LocalSiteRoot.Replace('\', '/').TrimEnd('/')
    $SitesJsonPath = Join-Path $env:APPDATA "Local\sites.json"

    if (Test-Path -LiteralPath $SitesJsonPath -PathType Leaf) {
        $SitesJsonData = Get-Content -LiteralPath $SitesJsonPath -Raw | ConvertFrom-Json
        $SiteEntries = @()

        if ($SitesJsonData -is [System.Array]) {
            foreach ($SiteItem in $SitesJsonData) {
                $SiteEntries += [pscustomobject]@{
                    Id = [string]$SiteItem.id
                    Site = $SiteItem
                }
            }
        } elseif ($null -ne $SitesJsonData.PSObject.Properties["sites"]) {
            foreach ($SiteItem in @($SitesJsonData.sites)) {
                $SiteEntries += [pscustomobject]@{
                    Id = [string]$SiteItem.id
                    Site = $SiteItem
                }
            }
        } else {
            foreach ($SiteProperty in $SitesJsonData.PSObject.Properties) {
                if ($null -ne $SiteProperty.Value -and
                    $null -ne $SiteProperty.Value.PSObject.Properties["path"]) {
                    $SiteEntries += [pscustomobject]@{
                        Id = [string]$SiteProperty.Name
                        Site = $SiteProperty.Value
                    }
                }
            }
        }

        $MatchingSites = @(
            $SiteEntries | Where-Object {
                $SitePath = [string]$_.Site.path
                if ([string]::IsNullOrWhiteSpace($SitePath)) {
                    return $false
                }

                if ($SitePath -match '^~[\\/]') {
                    $SitePath = Join-Path $env:USERPROFILE $SitePath.Substring(2)
                }

                $NormalizedSitePath = $SitePath.Replace('\', '/').TrimEnd('/')
                return $NormalizedSitePath.Equals(
                    $NormalizedSiteRoot,
                    [System.StringComparison]::OrdinalIgnoreCase
                )
            }
        )

        if ($MatchingSites.Count -eq 1) {
            $SelectedSiteEntry = $MatchingSites[0]
            $SelectedSite = $SelectedSiteEntry.Site
            $MysqlPortValue = @($SelectedSite.services.mysql.ports.MYSQL) |
                Select-Object -First 1

            if ($null -eq $MysqlPortValue -or [int]$MysqlPortValue -le 0) {
                throw "LocalWP found the main-dashboard site, but its MySQL port is missing. Restart the site in LocalWP and try again."
            }

            return [pscustomobject]@{
                Host = "127.0.0.1"
                Port = [int]$MysqlPortValue
                SiteId = [string]$SelectedSiteEntry.Id
                MysqlVersion = [string]$SelectedSite.services.mysql.version
            }
        }

        if ($MatchingSites.Count -gt 1) {
            throw "LocalWP sites.json contains more than one entry for $LocalSiteRoot."
        }
    }

    throw "Could not match LocalWP site data to $LocalSiteRoot. Start main-dashboard in LocalWP and try again."
}

function Get-LocalWpMysqlTools {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SiteId,

        [Parameter(Mandatory = $true)]
        [string]$MysqlVersion
    )

    $NormalizedSiteId = $SiteId.Trim()
    $RunningMysqlProcesses = @(
        Get-CimInstance Win32_Process -Filter "Name='mysqld.exe'" -ErrorAction SilentlyContinue
    )

    foreach ($MysqlProcess in $RunningMysqlProcesses) {
        $CommandLine = [string]$MysqlProcess.CommandLine
        if ([string]::IsNullOrWhiteSpace($CommandLine)) {
            continue
        }

        $NormalizedCommandLine = $CommandLine.Replace('\', '/')
        $SiteConfigMarker = "/Local/run/$NormalizedSiteId/conf/mysql/my.cnf"
        if ($NormalizedCommandLine.IndexOf(
                $SiteConfigMarker,
                [System.StringComparison]::OrdinalIgnoreCase
            ) -lt 0) {
            continue
        }

        $MysqlExecutablePath = [string]$MysqlProcess.ExecutablePath
        if ([string]::IsNullOrWhiteSpace($MysqlExecutablePath)) {
            continue
        }

        $MysqlBinFolder = Split-Path -Parent $MysqlExecutablePath
        $MysqlClientPath = Join-Path $MysqlBinFolder "mysql.exe"
        $MysqlDumpPath = Join-Path $MysqlBinFolder "mysqldump.exe"

        if ((Test-Path -LiteralPath $MysqlClientPath -PathType Leaf) -and
            (Test-Path -LiteralPath $MysqlDumpPath -PathType Leaf)) {
            return [pscustomobject]@{
                Mysql = $MysqlClientPath
                MysqlDump = $MysqlDumpPath
                BinFolder = $MysqlBinFolder
            }
        }
    }

    $SearchRoots = New-Object System.Collections.Generic.List[string]

    if (-not [string]::IsNullOrWhiteSpace($env:APPDATA)) {
        [void]$SearchRoots.Add((Join-Path $env:APPDATA "Local\lightning-services"))
    }

    if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        [void]$SearchRoots.Add((Join-Path $env:LOCALAPPDATA "Local\lightning-services"))
        [void]$SearchRoots.Add((Join-Path $env:LOCALAPPDATA "Programs\Local\resources\extraResources\lightning-services"))
    }

    if (-not [string]::IsNullOrWhiteSpace($env:ProgramFiles)) {
        [void]$SearchRoots.Add((Join-Path $env:ProgramFiles "Local\resources\extraResources\lightning-services"))
        [void]$SearchRoots.Add((Join-Path $env:ProgramFiles "Local\resources\extraResources"))
    }

    $MysqlDumpCandidates = @()
    foreach ($SearchRoot in @($SearchRoots | Select-Object -Unique)) {
        if (!(Test-Path -LiteralPath $SearchRoot -PathType Container)) {
            continue
        }

        $MysqlDumpCandidates += @(
            Get-ChildItem `
                -LiteralPath $SearchRoot `
                -Filter "mysqldump.exe" `
                -Recurse `
                -Force `
                -File `
                -ErrorAction SilentlyContinue
        )
    }

    $VersionPattern = "mysql-$([regex]::Escape($MysqlVersion))"
    $MatchingVersionCandidates = @(
        $MysqlDumpCandidates | Where-Object { $_.FullName -match $VersionPattern }
    )

    $PreferredCandidates = if ($MatchingVersionCandidates.Count -gt 0) {
        $MatchingVersionCandidates
    } else {
        $MysqlDumpCandidates
    }

    foreach ($MysqlDumpCandidate in @($PreferredCandidates | Sort-Object LastWriteTimeUtc -Descending)) {
        $MysqlBinFolder = $MysqlDumpCandidate.DirectoryName
        $MysqlClientPath = Join-Path $MysqlBinFolder "mysql.exe"

        if (Test-Path -LiteralPath $MysqlClientPath -PathType Leaf) {
            return [pscustomobject]@{
                Mysql = $MysqlClientPath
                MysqlDump = $MysqlDumpCandidate.FullName
                BinFolder = $MysqlBinFolder
            }
        }
    }

    throw "LocalWP mysql.exe and mysqldump.exe were not found for MySQL $MysqlVersion."
}

function Get-CompleteBackups {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Folder
    )

    if (!(Test-Path -LiteralPath $Folder -PathType Container)) {
        return @()
    }

    $CompleteBackups = @()
    foreach ($Candidate in @(Get-ChildItem -LiteralPath $Folder -Directory -Filter "backup-*")) {
        $ManifestPath = Join-Path $Candidate.FullName "manifest.json"
        $ProjectPath = Join-Path $Candidate.FullName "project"
        $ChecksumsPath = Join-Path $Candidate.FullName "checksums.sha256.csv"

        if (!(Test-Path -LiteralPath $ManifestPath -PathType Leaf) -or
            !(Test-Path -LiteralPath $ProjectPath -PathType Container) -or
            !(Test-Path -LiteralPath $ChecksumsPath -PathType Leaf)) {
            continue
        }

        try {
            $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
            if ([string]$Manifest.LocalBackupStatus -ne "Complete") {
                continue
            }

            $CompleteBackups += [pscustomobject]@{
                Folder = $Candidate
                Manifest = $Manifest
            }
        } catch {
            continue
        }
    }

    return @($CompleteBackups | Sort-Object { $_.Folder.LastWriteTimeUtc } -Descending)
}

function Resolve-BackupFolder {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$RequestedPath,

        [Parameter(Mandatory = $true)]
        [string]$BackupsFolder,

        [Parameter(Mandatory = $true)]
        [bool]$UseLatest
    )

    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
        $CandidatePaths = @($RequestedPath)
        if (-not [System.IO.Path]::IsPathRooted($RequestedPath)) {
            $CandidatePaths += Join-Path $BackupsFolder $RequestedPath
        }

        foreach ($CandidatePath in $CandidatePaths) {
            if (Test-Path -LiteralPath $CandidatePath -PathType Container) {
                return (Resolve-Path -LiteralPath $CandidatePath).Path
            }
        }

        throw "Backup folder was not found: $RequestedPath"
    }

    $AvailableBackups = @(Get-CompleteBackups -Folder $BackupsFolder)
    if ($AvailableBackups.Count -eq 0) {
        throw "No complete backups were found in $BackupsFolder."
    }

    if ($UseLatest) {
        return $AvailableBackups[0].Folder.FullName
    }

    Write-Host "Available complete backups:" -ForegroundColor Green
    $DisplayCount = [Math]::Min($AvailableBackups.Count, 10)
    for ($Index = 0; $Index -lt $DisplayCount; $Index += 1) {
        $Backup = $AvailableBackups[$Index]
        $Label = [string]$Backup.Manifest.BackupLabel
        $FinishedAt = [string]$Backup.Manifest.FinishedAt
        Write-Host "$($Index + 1). $($Backup.Folder.Name) | $Label | $FinishedAt" -ForegroundColor Cyan
    }

    $Selection = Read-Host "Select backup number [1]"
    if ([string]::IsNullOrWhiteSpace($Selection)) {
        $Selection = "1"
    }

    $SelectedNumber = 0
    if (-not [int]::TryParse($Selection, [ref]$SelectedNumber) -or
        $SelectedNumber -lt 1 -or
        $SelectedNumber -gt $DisplayCount) {
        throw "Invalid backup selection: $Selection"
    }

    return $AvailableBackups[$SelectedNumber - 1].Folder.FullName
}

function Test-BackupChecksums {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BackupFolder
    )

    $ChecksumPath = Join-Path $BackupFolder "checksums.sha256.csv"
    if (!(Test-Path -LiteralPath $ChecksumPath -PathType Leaf)) {
        throw "Backup checksum file is missing: $ChecksumPath"
    }

    $Records = @(Import-Csv -LiteralPath $ChecksumPath)
    if ($Records.Count -eq 0) {
        throw "Backup checksum file is empty: $ChecksumPath"
    }

    $NormalizedBackupRoot = [System.IO.Path]::GetFullPath($BackupFolder).TrimEnd('\') + '\'
    $CheckedFiles = 0

    foreach ($Record in $Records) {
        if ([string]::IsNullOrWhiteSpace([string]$Record.Path) -or
            [string]::IsNullOrWhiteSpace([string]$Record.SHA256)) {
            throw "Backup checksum file contains an invalid record."
        }

        $CandidatePath = [System.IO.Path]::GetFullPath((Join-Path $BackupFolder ([string]$Record.Path)))
        if (!$CandidatePath.StartsWith(
                $NormalizedBackupRoot,
                [System.StringComparison]::OrdinalIgnoreCase
            )) {
            throw "Unsafe path found in checksum file: $($Record.Path)"
        }

        if (!(Test-Path -LiteralPath $CandidatePath -PathType Leaf)) {
            throw "Backup file listed in checksums is missing: $CandidatePath"
        }

        $FileInfo = Get-Item -LiteralPath $CandidatePath
        $ExpectedBytes = [int64]$Record.Bytes
        if ([int64]$FileInfo.Length -ne $ExpectedBytes) {
            throw "Backup file size mismatch: $CandidatePath"
        }

        $ActualHash = (Get-FileHash -LiteralPath $CandidatePath -Algorithm SHA256).Hash
        if (!$ActualHash.Equals(
                [string]$Record.SHA256,
                [System.StringComparison]::OrdinalIgnoreCase
            )) {
            throw "Backup checksum mismatch: $CandidatePath"
        }

        $CheckedFiles += 1
    }

    return $CheckedFiles
}

function Invoke-Robocopy {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RoboCopyPath,

        [Parameter(Mandatory = $true)]
        [string]$Source,

        [Parameter(Mandatory = $true)]
        [string]$Destination,

        [Parameter(Mandatory = $true)]
        [string]$LogPath,

        [Parameter(Mandatory = $true)]
        [bool]$Mirror,

        [Parameter(Mandatory = $true)]
        [string[]]$ExcludedDirectories,

        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [string[]]$ExcludedFiles
    )

    $Arguments = @(
        $Source,
        $Destination,
        $(if ($Mirror) { "/MIR" } else { "/E" }),
        "/COPY:DAT",
        "/DCOPY:DAT",
        "/R:2",
        "/W:1",
        "/XJ",
        "/SL",
        "/NFL",
        "/NDL",
        "/NP",
        "/LOG:$LogPath"
    )

    if ($ExcludedDirectories.Count -gt 0) {
        $Arguments += "/XD"
        $Arguments += $ExcludedDirectories
    }

    if ($ExcludedFiles.Count -gt 0) {
        $Arguments += "/XF"
        $Arguments += $ExcludedFiles
    }

    & $RoboCopyPath @Arguments
    $ExitCode = $LASTEXITCODE
    if ($ExitCode -ge 8) {
        throw "Robocopy failed with exit code $ExitCode. Review $LogPath."
    }
}

function Write-MySqlOptionsFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$User,

        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Password,

        [Parameter(Mandatory = $true)]
        [string]$HostName,

        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $Lines = @(
        "[client]",
        "user=$(ConvertTo-MySqlOptionValue -Value $User)",
        "password=$(ConvertTo-MySqlOptionValue -Value $Password)",
        "host=$(ConvertTo-MySqlOptionValue -Value $HostName)",
        "port=$Port",
        "protocol=tcp",
        "default-character-set=utf8mb4"
    )

    $Utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($Path, [string[]]$Lines, $Utf8WithoutBom)
}

function Export-CurrentDatabase {
    param(
        [Parameter(Mandatory = $true)]
        [string]$MysqlDumpPath,

        [Parameter(Mandatory = $true)]
        [string]$OptionsPath,

        [Parameter(Mandatory = $true)]
        [string]$DatabaseName,

        [Parameter(Mandatory = $true)]
        [string]$OutputPath,

        [Parameter(Mandatory = $true)]
        [string]$ErrorLogPath
    )

    $Arguments = @(
        "--defaults-extra-file=`"$OptionsPath`"",
        "--single-transaction",
        "--quick",
        "--routines",
        "--triggers",
        "--events",
        "--hex-blob",
        "--no-tablespaces",
        "--set-gtid-purged=OFF",
        "--default-character-set=utf8mb4",
        "--add-drop-table",
        "--result-file=`"$OutputPath`"",
        "--databases",
        $DatabaseName
    )

    $Process = Start-Process `
        -FilePath $MysqlDumpPath `
        -ArgumentList $Arguments `
        -Wait `
        -PassThru `
        -NoNewWindow `
        -RedirectStandardError $ErrorLogPath

    if ($Process.ExitCode -ne 0) {
        $Details = if (Test-Path -LiteralPath $ErrorLogPath -PathType Leaf) {
            (Get-Content -LiteralPath $ErrorLogPath -Raw).Trim()
        } else {
            "No mysqldump error details were returned."
        }
        throw "Pre-restore database export failed with exit code $($Process.ExitCode). $Details"
    }

    if (!(Test-Path -LiteralPath $OutputPath -PathType Leaf) -or
        (Get-Item -LiteralPath $OutputPath).Length -le 0) {
        throw "Pre-restore database export did not create a valid SQL file: $OutputPath"
    }

    if ((Test-Path -LiteralPath $ErrorLogPath -PathType Leaf) -and
        (Get-Item -LiteralPath $ErrorLogPath).Length -eq 0) {
        Remove-Item -LiteralPath $ErrorLogPath -Force
    }
}

function Import-DatabaseBackup {
    param(
        [Parameter(Mandatory = $true)]
        [string]$MysqlPath,

        [Parameter(Mandatory = $true)]
        [string]$OptionsPath,

        [Parameter(Mandatory = $true)]
        [string]$SqlPath,

        [Parameter(Mandatory = $true)]
        [string]$ErrorLogPath
    )

    $Arguments = @(
        "--defaults-extra-file=`"$OptionsPath`"",
        "--default-character-set=utf8mb4",
        "--binary-mode=1"
    )

    $Process = Start-Process `
        -FilePath $MysqlPath `
        -ArgumentList $Arguments `
        -Wait `
        -PassThru `
        -NoNewWindow `
        -RedirectStandardInput $SqlPath `
        -RedirectStandardError $ErrorLogPath

    if ($Process.ExitCode -ne 0) {
        $Details = if (Test-Path -LiteralPath $ErrorLogPath -PathType Leaf) {
            (Get-Content -LiteralPath $ErrorLogPath -Raw).Trim()
        } else {
            "No mysql error details were returned."
        }
        throw "WordPress database restore failed with exit code $($Process.ExitCode). $Details"
    }

    if ((Test-Path -LiteralPath $ErrorLogPath -PathType Leaf) -and
        (Get-Item -LiteralPath $ErrorLogPath).Length -eq 0) {
        Remove-Item -LiteralPath $ErrorLogPath -Force
    }
}

function New-RollbackChecksums {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Folder
    )

    $ChecksumPath = Join-Path $Folder "checksums.sha256.csv"
    $Files = @(
        Get-ChildItem -LiteralPath $Folder -Recurse -Force -File |
            Where-Object { $_.FullName -ne $ChecksumPath } |
            Sort-Object FullName
    )

    $Records = foreach ($File in $Files) {
        $RelativePath = $File.FullName.Substring($Folder.Length) -replace '^[\\/]+', ''
        $Hash = Get-FileHash -LiteralPath $File.FullName -Algorithm SHA256
        [pscustomobject]@{
            SHA256 = $Hash.Hash
            Bytes = $File.Length
            Path = $RelativePath
        }
    }

    $Records | Export-Csv -LiteralPath $ChecksumPath -NoTypeInformation -Encoding UTF8
}

$OriginalLocation = Get-Location
$ScriptDir = Split-Path -Parent $PSCommandPath
$UIFolder = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent $UIFolder
$WordPressRoot = Split-Path -Parent $ProjectRoot
$LocalSiteRoot = Split-Path -Parent (Split-Path -Parent $WordPressRoot)
$BackupsFolder = Join-Path $ProjectRoot "backups"
$AutomaticAppDataExportPath = Join-Path $ProjectRoot "private-data\app-data-export.json"
$AppDataRestorePendingPath = Join-Path $ProjectRoot "private-data\app-data-restore-pending.json"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RoboCopyPath = $null
$ResolvedBackupFolder = ""
$RollbackFolder = ""
$RollbackStagingFolder = ""
$MysqlOptionsPath = ""
$DatabaseWillRestore = $false
$AppDataWillRestore = $false
$BackupAppDataExportPath = ""
$RestoreApplied = $false

try {
    Write-Host "PowerShell $($PSVersionTable.PSVersion)" -ForegroundColor Cyan
    Write-Host "Budget Dashboard restore" -ForegroundColor Green
    Write-Host ""

    $ResolvedBackupFolder = Resolve-BackupFolder `
        -RequestedPath $BackupPath `
        -BackupsFolder $BackupsFolder `
        -UseLatest $Latest.IsPresent

    $BackupManifestPath = Join-Path $ResolvedBackupFolder "manifest.json"
    $BackupProjectFolder = Join-Path $ResolvedBackupFolder "project"
    $BackupDatabaseFolder = Join-Path $ResolvedBackupFolder "database"

    if (!(Test-Path -LiteralPath $BackupManifestPath -PathType Leaf)) {
        throw "Backup manifest is missing: $BackupManifestPath"
    }

    if (!(Test-Path -LiteralPath $BackupProjectFolder -PathType Container)) {
        throw "Backup project folder is missing: $BackupProjectFolder"
    }

    $BackupManifest = Get-Content -LiteralPath $BackupManifestPath -Raw | ConvertFrom-Json
    if ([string]$BackupManifest.LocalBackupStatus -ne "Complete") {
        throw "The selected backup is not marked complete."
    }

    $RequiredBackupFiles = @(
        "ui\package.json",
        "ui\vite.config.js",
        "ui\src\components\BudgetDashboard.jsx",
        "ui\src\components\tabs\CscOpportunitiesTab.jsx",
        "ui\src\components\tabs\CscShiftsTab.jsx",
        "ui\src\utils\state.js",
        "save.php",
        "csc-event-watch-feed.php"
    )

    foreach ($RequiredFile in $RequiredBackupFiles) {
        $RequiredPath = Join-Path $BackupProjectFolder $RequiredFile
        if (!(Test-Path -LiteralPath $RequiredPath -PathType Leaf)) {
            throw "Required file is missing from the selected backup: $RequiredPath"
        }
    }

    Write-Host "Selected backup: $ResolvedBackupFolder" -ForegroundColor Yellow
    Write-Host "Backup label: $($BackupManifest.BackupLabel)" -ForegroundColor Cyan
    Write-Host "Backup finished: $($BackupManifest.FinishedAt)" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "Verifying SHA-256 checksums..." -ForegroundColor Green
    $CheckedFileCount = Test-BackupChecksums -BackupFolder $ResolvedBackupFolder
    Write-Host "Checksums passed: $CheckedFileCount files" -ForegroundColor Green

    $TopLevelAppDataPath = Join-Path $ResolvedBackupFolder "app-data-export\app-data-export.json"
    $ProjectAppDataPath = Join-Path $BackupProjectFolder "private-data\app-data-export.json"

    if (Test-Path -LiteralPath $TopLevelAppDataPath -PathType Leaf) {
        $BackupAppDataExportPath = $TopLevelAppDataPath
    } elseif (Test-Path -LiteralPath $ProjectAppDataPath -PathType Leaf) {
        $BackupAppDataExportPath = $ProjectAppDataPath
    }

    if (-not [string]::IsNullOrWhiteSpace($BackupAppDataExportPath)) {
        try {
            $BackupAppDataExport = Get-Content -LiteralPath $BackupAppDataExportPath -Raw | ConvertFrom-Json
        } catch {
            throw "The included app-data export is not valid JSON: $BackupAppDataExportPath"
        }

        $AppDataTypeProperty = $BackupAppDataExport.PSObject.Properties["type"]
        $AppDataItemsProperty = $BackupAppDataExport.PSObject.Properties["items"]
        $AppDataSnapshotProperty = $BackupAppDataExport.PSObject.Properties["snapshotId"]

        if ($null -eq $AppDataTypeProperty -or
            [string]$AppDataTypeProperty.Value -ne "budget-dashboard-mobile-migration" -or
            $null -eq $AppDataItemsProperty -or
            $null -eq $AppDataSnapshotProperty -or
            [string]::IsNullOrWhiteSpace([string]$AppDataSnapshotProperty.Value)) {
            throw "The included app-data export has an invalid format: $BackupAppDataExportPath"
        }

        $AppDataWillRestore = $true
    }

    $DatabaseFiles = @()
    if (Test-Path -LiteralPath $BackupDatabaseFolder -PathType Container) {
        $DatabaseFiles = @(
            Get-ChildItem `
                -LiteralPath $BackupDatabaseFolder `
                -Filter "wordpress-database-*.sql" `
                -File |
                Sort-Object LastWriteTimeUtc -Descending
        )
    }

    if (-not $SkipDatabase) {
        if ($DatabaseFiles.Count -gt 1) {
            throw "More than one WordPress database backup was found in $BackupDatabaseFolder."
        }

        if ($DatabaseFiles.Count -eq 1) {
            $DatabaseWillRestore = $true
        } else {
            Write-Host "No database SQL file is present. Database restore will be skipped." -ForegroundColor Yellow
        }
    }

    $RoboCopyPath = Resolve-ApplicationCommand -Names @("robocopy.exe", "robocopy")
    if ([string]::IsNullOrWhiteSpace($RoboCopyPath)) {
        throw "Robocopy was not found. This script requires the Windows robocopy command."
    }

    $MysqlConnection = $null
    $MysqlTools = $null
    $DatabaseName = ""
    $DatabaseUser = ""
    $DatabasePassword = ""

    if ($DatabaseWillRestore) {
        $WordPressConfigPath = Join-Path $WordPressRoot "wp-config.php"
        if (!(Test-Path -LiteralPath $WordPressConfigPath -PathType Leaf)) {
            throw "WordPress configuration is missing: $WordPressConfigPath"
        }

        $MysqlConnection = Get-LocalWpMysqlConnection -LocalSiteRoot $LocalSiteRoot
        $MysqlListeners = @(
            Get-NetTCPConnection `
                -State Listen `
                -LocalPort $MysqlConnection.Port `
                -ErrorAction SilentlyContinue
        )

        if ($MysqlListeners.Count -eq 0) {
            throw "LocalWP site $($MysqlConnection.SiteId) is not listening on MySQL port $($MysqlConnection.Port). Start main-dashboard in LocalWP and try again."
        }

        $MysqlTools = Get-LocalWpMysqlTools `
            -SiteId $MysqlConnection.SiteId `
            -MysqlVersion $MysqlConnection.MysqlVersion

        $DatabaseName = Get-WordPressConfigValue `
            -ConfigPath $WordPressConfigPath `
            -ConstantName "DB_NAME"
        $DatabaseUser = Get-WordPressConfigValue `
            -ConfigPath $WordPressConfigPath `
            -ConstantName "DB_USER"
        $DatabasePassword = Get-WordPressConfigValue `
            -ConfigPath $WordPressConfigPath `
            -ConstantName "DB_PASSWORD"

        Write-Host "LocalWP site ID: $($MysqlConnection.SiteId)" -ForegroundColor Cyan
        Write-Host "LocalWP MySQL port: $($MysqlConnection.Port)" -ForegroundColor Cyan
        Write-Host "LocalWP MySQL version: $($MysqlConnection.MysqlVersion)" -ForegroundColor Cyan
    }

    Write-Host ""
    Write-Host "This will replace the current Budget Dashboard project files." -ForegroundColor Yellow
    if ($DatabaseWillRestore) {
        Write-Host "This will also replace the current WordPress database." -ForegroundColor Yellow
    }
    if ($AppDataWillRestore) {
        Write-Host "This will also restore the complete dashboard app-data snapshot." -ForegroundColor Yellow
    }
    Write-Host "The backups directory, Git history, node_modules, dist, and .vite will be preserved." -ForegroundColor Yellow

    if ($SkipRollbackSnapshot) {
        Write-Host "WARNING: The automatic pre-restore rollback snapshot is disabled." -ForegroundColor Red
    } else {
        Write-Host "A pre-restore rollback snapshot will be created first." -ForegroundColor Green
    }

    $Confirmation = Read-Host "Type RESTORE to continue"
    if ($Confirmation -cne "RESTORE") {
        Write-Host "Restore cancelled. No files were changed." -ForegroundColor Yellow
        exit 0
    }

    $ExcludedDestinationDirectories = @("backups", ".git", "node_modules", "dist", ".vite")

    if (-not $SkipRollbackSnapshot) {
        $RollbackName = "pre-restore-$Timestamp"
        $RollbackFolder = Join-Path $BackupsFolder $RollbackName
        $CollisionNumber = 1
        while (Test-Path -LiteralPath $RollbackFolder) {
            $RollbackFolder = Join-Path $BackupsFolder "$RollbackName-$CollisionNumber"
            $CollisionNumber += 1
        }

        $RollbackStagingFolder = Join-Path $BackupsFolder ".pre-restore-$Timestamp-$([guid]::NewGuid().ToString('N'))"
        $RollbackProjectFolder = Join-Path $RollbackStagingFolder "project"
        $RollbackDatabaseFolder = Join-Path $RollbackStagingFolder "database"
        $RollbackCopyLog = Join-Path $RollbackStagingFolder "robocopy.log"

        Write-Host ""
        Write-Host "Creating pre-restore rollback snapshot..." -ForegroundColor Green
        New-Item -ItemType Directory -Path $RollbackProjectFolder -Force | Out-Null

        Invoke-Robocopy `
            -RoboCopyPath $RoboCopyPath `
            -Source $ProjectRoot `
            -Destination $RollbackProjectFolder `
            -LogPath $RollbackCopyLog `
            -Mirror $false `
            -ExcludedDirectories $ExcludedDestinationDirectories `
            -ExcludedFiles @("app-data-restore-pending.json")

        if ($DatabaseWillRestore) {
            New-Item -ItemType Directory -Path $RollbackDatabaseFolder -Force | Out-Null
            $MysqlOptionsPath = Join-Path $RollbackStagingFolder ".mysql-client-$Timestamp.cnf"
            Write-MySqlOptionsFile `
                -Path $MysqlOptionsPath `
                -User $DatabaseUser `
                -Password $DatabasePassword `
                -HostName $MysqlConnection.Host `
                -Port $MysqlConnection.Port

            $RollbackDatabasePath = Join-Path $RollbackDatabaseFolder "wordpress-database-before-restore-$Timestamp.sql"
            $RollbackDatabaseErrorPath = Join-Path $RollbackDatabaseFolder "mysqldump-error.log"
            Export-CurrentDatabase `
                -MysqlDumpPath $MysqlTools.MysqlDump `
                -OptionsPath $MysqlOptionsPath `
                -DatabaseName $DatabaseName `
                -OutputPath $RollbackDatabasePath `
                -ErrorLogPath $RollbackDatabaseErrorPath

            Remove-Item -LiteralPath $MysqlOptionsPath -Force
            $MysqlOptionsPath = ""
        }

        @(
            "Pre-restore rollback snapshot",
            "Created: $((Get-Date).ToString('o'))",
            "Restore source: $ResolvedBackupFolder",
            "Original project location: $ProjectRoot"
        ) | Set-Content -LiteralPath (Join-Path $RollbackStagingFolder "RESTORE-ROLLBACK-INFO.txt") -Encoding UTF8

        $RollbackAppDataIncluded = Test-Path -LiteralPath $AutomaticAppDataExportPath -PathType Leaf
        if ($RollbackAppDataIncluded) {
            $RollbackAppDataFolder = Join-Path $RollbackStagingFolder "app-data-export"
            New-Item -ItemType Directory -Path $RollbackAppDataFolder -Force | Out-Null
            Copy-Item `
                -LiteralPath $AutomaticAppDataExportPath `
                -Destination (Join-Path $RollbackAppDataFolder "app-data-export.json") `
                -Force
        }

        $RollbackAppDataStatusText = if ($RollbackAppDataIncluded) {
            "Automatic app-data export included in this rollback snapshot."
        } else {
            "Automatic app-data export was not available for this rollback snapshot."
        }
        $RollbackAppDataStatusText |
            Set-Content -LiteralPath (Join-Path $RollbackStagingFolder "APP-DATA-BACKUP-STATUS.txt") -Encoding UTF8

        $RollbackProjectFiles = @(
            Get-ChildItem -LiteralPath $RollbackProjectFolder -Recurse -Force -File
        )
        $RollbackProjectBytes = [int64]0
        foreach ($RollbackProjectFile in $RollbackProjectFiles) {
            $RollbackProjectBytes += [int64]$RollbackProjectFile.Length
        }

        $RollbackManifest = [ordered]@{
            ScriptVersion = "restore-all-2026-08-23.3"
            Timestamp = $Timestamp
            BackupLabel = "Pre-Restore-Rollback"
            ProjectRoot = $ProjectRoot
            BackupFolder = $RollbackFolder
            LocalBackupStatus = "Complete"
            DatabaseStatus = if ($DatabaseWillRestore) { "Included" } else { "Skipped" }
            BuildStatus = "Not run"
            GitStatus = "Not changed"
            GitBranch = ""
            GitRemote = ""
            GitTag = ""
            AppDataExportStatus = if ($RollbackAppDataIncluded) { "Included" } else { "Not available" }
            BrowserLocalStorage = if ($RollbackAppDataIncluded) {
                "Included through the automatic app-data export mirror."
            } else {
                "Not captured"
            }
            ProjectFileCount = $RollbackProjectFiles.Count
            ProjectTotalBytes = $RollbackProjectBytes
            ChecksumFile = "checksums.sha256.csv"
            ExcludedDirectories = @("backups", "node_modules", "dist", ".vite", ".git")
            Error = ""
            FinishedAt = (Get-Date).ToString("o")
        }
        $RollbackManifest |
            ConvertTo-Json -Depth 6 |
            Set-Content -LiteralPath (Join-Path $RollbackStagingFolder "manifest.json") -Encoding UTF8

        New-RollbackChecksums -Folder $RollbackStagingFolder
        Move-Item -LiteralPath $RollbackStagingFolder -Destination $RollbackFolder
        $RollbackStagingFolder = ""
        Write-Host "Rollback snapshot completed: $RollbackFolder" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Restoring Budget Dashboard project files..." -ForegroundColor Green
    $RestoreCopyLog = Join-Path $BackupsFolder "restore-$Timestamp-robocopy.log"

    Invoke-Robocopy `
        -RoboCopyPath $RoboCopyPath `
        -Source $BackupProjectFolder `
        -Destination $ProjectRoot `
        -LogPath $RestoreCopyLog `
        -Mirror $true `
        -ExcludedDirectories $ExcludedDestinationDirectories `
        -ExcludedFiles @($PSCommandPath)

    $RestoreApplied = $true
    Write-Host "Project files restored." -ForegroundColor Green

    if ($AppDataWillRestore) {
        Write-Host "Preparing the automatic app-data restore..." -ForegroundColor Green
        $AutomaticAppDataFolder = Split-Path -Parent $AutomaticAppDataExportPath
        New-Item -ItemType Directory -Path $AutomaticAppDataFolder -Force | Out-Null
        Copy-Item `
            -LiteralPath $BackupAppDataExportPath `
            -Destination $AutomaticAppDataExportPath `
            -Force

        $PendingRestoreData = [ordered]@{
            snapshotId = [string]$BackupAppDataExport.snapshotId
            restoreSource = $ResolvedBackupFolder
            requestedAt = (Get-Date).ToString("o")
        }
        $PendingRestoreData |
            ConvertTo-Json -Depth 4 |
            Set-Content -LiteralPath $AppDataRestorePendingPath -Encoding UTF8

        Write-Host "Automatic app-data restore prepared." -ForegroundColor Green
    }

    if ($DatabaseWillRestore) {
        Write-Host "Restoring the WordPress database..." -ForegroundColor Green
        $MysqlOptionsPath = Join-Path $BackupsFolder ".mysql-restore-$Timestamp-$([guid]::NewGuid().ToString('N')).cnf"
        Write-MySqlOptionsFile `
            -Path $MysqlOptionsPath `
            -User $DatabaseUser `
            -Password $DatabasePassword `
            -HostName $MysqlConnection.Host `
            -Port $MysqlConnection.Port

        $DatabaseRestoreErrorPath = Join-Path $BackupsFolder "restore-$Timestamp-mysql-error.log"
        Import-DatabaseBackup `
            -MysqlPath $MysqlTools.Mysql `
            -OptionsPath $MysqlOptionsPath `
            -SqlPath $DatabaseFiles[0].FullName `
            -ErrorLogPath $DatabaseRestoreErrorPath

        Remove-Item -LiteralPath $MysqlOptionsPath -Force
        $MysqlOptionsPath = ""
        Write-Host "WordPress database restored." -ForegroundColor Green
    }

    if (-not $SkipBuild) {
        Set-Location $UIFolder

        if (!(Test-Path -LiteralPath (Join-Path $UIFolder "node_modules") -PathType Container)) {
            if (Test-Path -LiteralPath (Join-Path $UIFolder "package-lock.json") -PathType Leaf) {
                Write-Host "node_modules not found. Running npm.cmd ci..." -ForegroundColor Yellow
                Invoke-NativeCommand `
                    -FilePath "npm.cmd" `
                    -ArgumentList @("ci") `
                    -Description "npm dependency installation"
            } else {
                Write-Host "node_modules not found. Running npm.cmd install..." -ForegroundColor Yellow
                Invoke-NativeCommand `
                    -FilePath "npm.cmd" `
                    -ArgumentList @("install") `
                    -Description "npm dependency installation"
            }
        }

        Write-Host "Validating the restored Vite build..." -ForegroundColor Green
        Invoke-NativeCommand `
            -FilePath "npm.cmd" `
            -ArgumentList @("run", "build") `
            -Description "Vite build"
        Write-Host "Restored Vite build passed." -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Restore completed successfully." -ForegroundColor Green
    Write-Host "Restored from: $ResolvedBackupFolder" -ForegroundColor Cyan
    Write-Host "Project: Restored" -ForegroundColor Cyan
    Write-Host "Database: $(if ($DatabaseWillRestore) { 'Restored' } else { 'Skipped' })" -ForegroundColor Cyan
    Write-Host "App data: $(if ($AppDataWillRestore) { 'Prepared for automatic restore' } else { 'Not included' })" -ForegroundColor Cyan
    Write-Host "Build: $(if ($SkipBuild) { 'Skipped' } else { 'Passed' })" -ForegroundColor Cyan

    if (-not [string]::IsNullOrWhiteSpace($RollbackFolder)) {
        Write-Host "Rollback snapshot: $RollbackFolder" -ForegroundColor Cyan
    }

    if ($AppDataWillRestore) {
        Write-Host "Open the dashboard. It will load the restored app data automatically and reload once." -ForegroundColor Yellow
    } else {
        Write-Host "No automatic app-data export was included in this backup." -ForegroundColor Yellow
    }

    Write-Host "Git history was preserved. Restored files may appear as uncommitted Git changes." -ForegroundColor Yellow
} catch {
    Write-Host ""

    if ($RestoreApplied) {
        Write-Host "RESTORE WAS APPLIED, BUT A LATER STEP FAILED: $($_.Exception.Message)" -ForegroundColor Red
        if (-not [string]::IsNullOrWhiteSpace($RollbackFolder)) {
            Write-Host "Pre-restore rollback snapshot: $RollbackFolder" -ForegroundColor Yellow
        }
    } else {
        Write-Host "RESTORE FAILED BEFORE PROJECT FILES WERE REPLACED: $($_.Exception.Message)" -ForegroundColor Red
    }

    if (-not [string]::IsNullOrWhiteSpace($RollbackStagingFolder) -and
        (Test-Path -LiteralPath $RollbackStagingFolder -PathType Container)) {
        Write-Host "Incomplete rollback snapshot retained at: $RollbackStagingFolder" -ForegroundColor Yellow
    }

    exit 1
} finally {
    if (-not [string]::IsNullOrWhiteSpace($MysqlOptionsPath) -and
        (Test-Path -LiteralPath $MysqlOptionsPath -PathType Leaf)) {
        Remove-Item -LiteralPath $MysqlOptionsPath -Force -ErrorAction SilentlyContinue
    }

    Set-Location $OriginalLocation
}
