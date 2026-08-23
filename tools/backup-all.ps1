# backup-all.ps1 - Budget Dashboard complete backup script
# Creates a verified local project snapshot, exports the LocalWP database,
# validates the Vite build, and optionally commits and pushes the UI repository.
# Location: C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\backup-all.ps1

[CmdletBinding()]
param(
    [string]$CommitMessage = "",
    [switch]$CreateTag = $false,
    [string]$TagName = "",
    [switch]$SkipGit = $false,
    [switch]$SkipBuild = $false,
    [switch]$SkipDatabase = $false,
    [string]$AppDataExportPath = ""
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

function Invoke-NativeCapture {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string[]]$ArgumentList,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    $Output = & $FilePath @ArgumentList 2>&1
    $ExitCode = $LASTEXITCODE

    if ($ExitCode -ne 0) {
        $Details = ($Output | Out-String).Trim()
        if ($Details) {
            throw "$Description failed with exit code $ExitCode.`n$Details"
        }
        throw "$Description failed with exit code $ExitCode."
    }

    return ($Output | Out-String).Trim()
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

function Enable-LocalWpMysqlTools {
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

        $RunningMysqlDumpPath = Join-Path (Split-Path -Parent $MysqlExecutablePath) "mysqldump.exe"
        if (Test-Path -LiteralPath $RunningMysqlDumpPath -PathType Leaf) {
            $MysqlBinFolder = Split-Path -Parent $RunningMysqlDumpPath
            $PathEntries = @($env:Path -split ';')
            if ($PathEntries -notcontains $MysqlBinFolder) {
                $env:Path = "$MysqlBinFolder;$env:Path"
            }
            return $RunningMysqlDumpPath
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
        $MysqlDumpCandidates | Where-Object {
            $_.FullName -match $VersionPattern
        }
    )

    $PreferredCandidates = if ($MatchingVersionCandidates.Count -gt 0) {
        $MatchingVersionCandidates
    } else {
        $MysqlDumpCandidates
    }

    $MysqlDump = $PreferredCandidates |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

    if ($null -eq $MysqlDump) {
        return $null
    }

    $MysqlBinFolder = $MysqlDump.DirectoryName
    $PathEntries = @($env:Path -split ';')
    if ($PathEntries -notcontains $MysqlBinFolder) {
        $env:Path = "$MysqlBinFolder;$env:Path"
    }

    $ResolvedMysqlDump = Resolve-ApplicationCommand -Names @("mysqldump.exe", "mysqldump")
    if ([string]::IsNullOrWhiteSpace($ResolvedMysqlDump)) {
        return $null
    }

    return $ResolvedMysqlDump
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
                throw "LocalWP found the main-dashboard site in sites.json, but its MySQL port is missing. Restart the site in LocalWP and try again."
            }

            return [pscustomobject]@{
                ConfigPath = $SitesJsonPath
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

    $LocalRunRoot = Join-Path $env:APPDATA "Local\run"
    if (!(Test-Path -LiteralPath $LocalRunRoot -PathType Container)) {
        throw "LocalWP's active run folder was not found: $LocalRunRoot"
    }

    $MysqlConfigs = @(
        Get-ChildItem `
            -LiteralPath $LocalRunRoot `
            -Filter "my.cnf" `
            -Recurse `
            -Force `
            -File `
            -ErrorAction SilentlyContinue
    )

    if ($MysqlConfigs.Count -eq 0) {
        throw "No active LocalWP MySQL configuration was found. Start the main-dashboard site in LocalWP and try again."
    }

    $MatchingConfigs = @()

    foreach ($MysqlConfig in $MysqlConfigs) {
        $MysqlConfigContent = Get-Content -LiteralPath $MysqlConfig.FullName -Raw
        $NormalizedConfigContent = $MysqlConfigContent.Replace('\', '/')

        if ($NormalizedConfigContent.IndexOf(
                $NormalizedSiteRoot,
                [System.StringComparison]::OrdinalIgnoreCase
            ) -ge 0) {
            $MatchingConfigs += [pscustomobject]@{
                File = $MysqlConfig
                Content = $MysqlConfigContent
            }
        }
    }

    if ($MatchingConfigs.Count -eq 0) {
        if ($MysqlConfigs.Count -eq 1) {
            $OnlyConfig = $MysqlConfigs[0]
            $MatchingConfigs = @(
                [pscustomobject]@{
                    File = $OnlyConfig
                    Content = Get-Content -LiteralPath $OnlyConfig.FullName -Raw
                }
            )
        } else {
            throw "Could not match an active LocalWP MySQL configuration to $LocalSiteRoot. Confirm only the intended site is running and try again."
        }
    }

    $SelectedConfig = $MatchingConfigs |
        Sort-Object { $_.File.LastWriteTimeUtc } -Descending |
        Select-Object -First 1

    $PortMatch = [regex]::Match(
        $SelectedConfig.Content,
        '(?im)^\s*port\s*=\s*["'']?(\d+)'
    )

    if (!$PortMatch.Success) {
        throw "Could not read the LocalWP MySQL port from $($SelectedConfig.File.FullName)."
    }

    $HostMatch = [regex]::Match(
        $SelectedConfig.Content,
        '(?im)^\s*bind-address\s*=\s*["'']?([^"''\s#]+)'
    )

    $MysqlHost = if ($HostMatch.Success) { $HostMatch.Groups[1].Value } else { "127.0.0.1" }
    if ($MysqlHost -eq "0.0.0.0" -or $MysqlHost -eq "localhost") {
        $MysqlHost = "127.0.0.1"
    }

    return [pscustomobject]@{
        ConfigPath = $SelectedConfig.File.FullName
        Host = $MysqlHost
        Port = [int]$PortMatch.Groups[1].Value
        SiteId = ""
        MysqlVersion = ""
    }
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

function Get-FolderStatistics {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $Files = @(Get-ChildItem -LiteralPath $Path -Recurse -Force -File)
    $TotalBytes = [int64]0

    foreach ($File in $Files) {
        $TotalBytes += [int64]$File.Length
    }

    return [pscustomobject]@{
        FileCount = $Files.Count
        TotalBytes = $TotalBytes
    }
}

function Write-RunManifest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Folder,

        [Parameter(Mandatory = $true)]
        [System.Collections.IDictionary]$State
    )

    if (!(Test-Path -LiteralPath $Folder)) {
        return
    }

    $Manifest = [ordered]@{
        ScriptVersion = "2026-08-23.5"
        Timestamp = $State.Timestamp
        BackupLabel = $State.BackupLabel
        ProjectRoot = $State.ProjectRoot
        BackupFolder = $State.BackupFolder
        LocalBackupStatus = $State.LocalBackupStatus
        DatabaseStatus = $State.DatabaseStatus
        BuildStatus = $State.BuildStatus
        GitStatus = $State.GitStatus
        GitBranch = $State.GitBranch
        GitRemote = $State.GitRemote
        GitTag = $State.GitTag
        AppDataExportStatus = $State.AppDataExportStatus
        BrowserLocalStorage = "Not captured directly. Use the app Data export and pass its path with -AppDataExportPath."
        ProjectFileCount = $State.ProjectFileCount
        ProjectTotalBytes = $State.ProjectTotalBytes
        ChecksumFile = $State.ChecksumFile
        ExcludedDirectories = @("backups", "node_modules", "dist", ".vite", ".git")
        Error = $State.Error
        FinishedAt = (Get-Date).ToString("o")
    }

    $ManifestPath = Join-Path $Folder "manifest.json"
    $Manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8
}

function Get-SafeFolderLabel {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $SafeValue = $Value -replace '[^A-Za-z0-9._-]+', '-'
    $SafeValue = $SafeValue.Trim([char[]]@('-', '.', '_'))

    if ([string]::IsNullOrWhiteSpace($SafeValue)) {
        return "Backup"
    }

    if ($SafeValue.Length -gt 50) {
        return $SafeValue.Substring(0, 50).Trim([char[]]@('-', '.', '_'))
    }

    return $SafeValue
}

$OriginalLocation = Get-Location
$ScriptDir = Split-Path -Parent $PSCommandPath
$UIFolder = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent $UIFolder
$WordPressRoot = Split-Path -Parent $ProjectRoot
$BackupsFolder = Join-Path $ProjectRoot "backups"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
    $CommitMessage = Read-Host "Backup label"
}

if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
    $CommitMessage = "Backup"
}

$SafeLabel = Get-SafeFolderLabel -Value $CommitMessage
$BackupFolderName = "backup-$Timestamp-$SafeLabel"
$BackupFolder = Join-Path $BackupsFolder $BackupFolderName
$CollisionNumber = 1

while (Test-Path -LiteralPath $BackupFolder) {
    $BackupFolder = Join-Path $BackupsFolder "$BackupFolderName-$CollisionNumber"
    $CollisionNumber += 1
}

$StagingFolder = Join-Path $BackupsFolder ".incomplete-$Timestamp-$([guid]::NewGuid().ToString('N'))"
$ProjectBackupFolder = Join-Path $StagingFolder "project"
$DatabaseBackupFolder = Join-Path $StagingFolder "database"
$CopyLogPath = Join-Path $StagingFolder "robocopy.log"
$ChecksumPath = Join-Path $StagingFolder "checksums.sha256.csv"

$RunState = [ordered]@{
    Timestamp = $Timestamp
    BackupLabel = $CommitMessage
    ProjectRoot = $ProjectRoot
    BackupFolder = $BackupFolder
    LocalBackupStatus = "Not started"
    DatabaseStatus = if ($SkipDatabase) { "Skipped by request" } else { "Not started" }
    BuildStatus = if ($SkipBuild) { "Skipped by request" } else { "Not started" }
    GitStatus = if ($SkipGit) { "Skipped by request" } else { "Not started" }
    GitBranch = ""
    GitRemote = ""
    GitTag = ""
    AppDataExportStatus = if ([string]::IsNullOrWhiteSpace($AppDataExportPath)) {
        "Not supplied"
    } else {
        "Not started"
    }
    ProjectFileCount = 0
    ProjectTotalBytes = 0
    ChecksumFile = "checksums.sha256.csv"
    Error = ""
}

$RequiredUIFiles = @(
    "vite.config.js",
    "package.json",
    "src\components\BudgetDashboard.jsx",
    "src\components\todo\TodoListSection.jsx",
    "src\components\tabs\TodoTab.jsx",
    "src\components\tabs\DashboardTab.jsx",
    "src\components\tabs\CscOpportunitiesTab.jsx",
    "src\components\tabs\CscShiftsTab.jsx",
    "src\components\tabs\PaychecksTab.jsx",
    "src\components\tabs\RidesTab.jsx",
    "src\utils\state.js"
)

$RequiredProjectFiles = @(
    "save.php",
    "mobile-auth.php",
    "csc-event-watch-feed.php",
    "upload-paycheck-file.php",
    "upload-credit-report.php"
)

$RequiredGitFiles = @(
    "src/components/BudgetDashboard.jsx",
    "src/components/todo/TodoListSection.jsx",
    "src/components/tabs/TodoTab.jsx",
    "src/components/tabs/DashboardTab.jsx",
    "src/components/tabs/CscOpportunitiesTab.jsx",
    "src/components/tabs/CscShiftsTab.jsx",
    "src/components/tabs/PaychecksTab.jsx",
    "src/components/tabs/RidesTab.jsx",
    "src/utils/state.js",
    "vite.config.js"
)

try {
    Write-Host "PowerShell $($PSVersionTable.PSVersion)" -ForegroundColor Cyan
    Write-Host "Backup destination: $BackupFolder" -ForegroundColor Yellow
    Write-Host ""

    Write-Host "Checking required project files..." -ForegroundColor Green

    foreach ($RequiredFile in $RequiredUIFiles) {
        $RequiredPath = Join-Path $UIFolder $RequiredFile
        if (!(Test-Path -LiteralPath $RequiredPath -PathType Leaf)) {
            throw "Required UI file is missing: $RequiredPath"
        }
    }

    foreach ($RequiredFile in $RequiredProjectFiles) {
        $RequiredPath = Join-Path $ProjectRoot $RequiredFile
        if (!(Test-Path -LiteralPath $RequiredPath -PathType Leaf)) {
            throw "Required project file is missing: $RequiredPath"
        }
    }

    $BudgetDataRootPath = Join-Path $ProjectRoot "budget-data.json"
    $BudgetDataRestorePath = Join-Path $UIFolder "public\restore\budget-data.json"
    if (!(Test-Path -LiteralPath $BudgetDataRootPath -PathType Leaf) -and
        !(Test-Path -LiteralPath $BudgetDataRestorePath -PathType Leaf)) {
        throw "Neither budget-data.json source exists. Expected $BudgetDataRootPath or $BudgetDataRestorePath."
    }

    if (-not $SkipDatabase) {
        $WordPressConfigPath = Join-Path $WordPressRoot "wp-config.php"
        if (!(Test-Path -LiteralPath $WordPressConfigPath -PathType Leaf)) {
            throw "WordPress configuration is missing: $WordPressConfigPath"
        }
    }

    Write-Host "Required project files found." -ForegroundColor Green
    Write-Host ""

    New-Item -ItemType Directory -Path $BackupsFolder -Force | Out-Null
    New-Item -ItemType Directory -Path $StagingFolder -Force | Out-Null
    New-Item -ItemType Directory -Path $ProjectBackupFolder -Force | Out-Null

    Write-Host "Copying the complete Budget Dashboard project..." -ForegroundColor Green

    $RoboCopyPath = Resolve-ApplicationCommand -Names @("robocopy.exe", "robocopy")
    if ([string]::IsNullOrWhiteSpace($RoboCopyPath)) {
        throw "Robocopy was not found. This script requires the Windows robocopy command."
    }

    $RoboCopyArguments = @(
        $ProjectRoot,
        $ProjectBackupFolder,
        "/E",
        "/COPY:DAT",
        "/DCOPY:DAT",
        "/R:2",
        "/W:1",
        "/XJ",
        "/SL",
        "/NFL",
        "/NDL",
        "/NP",
        "/LOG:$CopyLogPath",
        "/XD",
        $BackupsFolder,
        "node_modules",
        "dist",
        ".vite",
        ".git"
    )

    & $RoboCopyPath @RoboCopyArguments
    $RoboCopyExitCode = $LASTEXITCODE
    if ($RoboCopyExitCode -ge 8) {
        throw "Robocopy failed with exit code $RoboCopyExitCode. Review $CopyLogPath."
    }

    $RunState.LocalBackupStatus = "Project copied"

    if (-not $SkipDatabase) {
        Write-Host "Exporting the LocalWP WordPress database..." -ForegroundColor Green
        New-Item -ItemType Directory -Path $DatabaseBackupFolder -Force | Out-Null

        $LocalSiteRoot = Split-Path -Parent (Split-Path -Parent $WordPressRoot)
        $MysqlConnection = Get-LocalWpMysqlConnection -LocalSiteRoot $LocalSiteRoot

        if ([string]::IsNullOrWhiteSpace($MysqlConnection.SiteId)) {
            throw "LocalWP did not return a site ID for $LocalSiteRoot."
        }

        if ([string]::IsNullOrWhiteSpace($MysqlConnection.MysqlVersion)) {
            throw "LocalWP did not return a MySQL version for site $($MysqlConnection.SiteId)."
        }

        $MysqlPortListeners = @(
            Get-NetTCPConnection `
                -State Listen `
                -LocalPort $MysqlConnection.Port `
                -ErrorAction SilentlyContinue
        )

        if ($MysqlPortListeners.Count -eq 0) {
            throw "LocalWP site $($MysqlConnection.SiteId) is not listening on MySQL port $($MysqlConnection.Port). Start main-dashboard in LocalWP and try again."
        }

        $MysqlDumpPath = Enable-LocalWpMysqlTools `
            -SiteId $MysqlConnection.SiteId `
            -MysqlVersion $MysqlConnection.MysqlVersion
        if ([string]::IsNullOrWhiteSpace($MysqlDumpPath)) {
            throw "LocalWP mysqldump.exe was not found. Confirm LocalWP is installed and the main-dashboard site is running."
        }

        Write-Host "Using LocalWP site ID: $($MysqlConnection.SiteId)" -ForegroundColor Cyan
        Write-Host "Using LocalWP MySQL port: $($MysqlConnection.Port)" -ForegroundColor Cyan
        Write-Host "Using LocalWP MySQL version: $($MysqlConnection.MysqlVersion)" -ForegroundColor Cyan
        Write-Host "Using LocalWP MySQL tools from: $(Split-Path -Parent $MysqlDumpPath)" -ForegroundColor Cyan

        $WordPressConfigPath = Join-Path $WordPressRoot "wp-config.php"
        $DatabaseName = Get-WordPressConfigValue -ConfigPath $WordPressConfigPath -ConstantName "DB_NAME"
        $DatabaseUser = Get-WordPressConfigValue -ConfigPath $WordPressConfigPath -ConstantName "DB_USER"
        $DatabasePassword = Get-WordPressConfigValue -ConfigPath $WordPressConfigPath -ConstantName "DB_PASSWORD"

        $MysqlOptionsPath = Join-Path $StagingFolder ".mysql-client-$Timestamp.cnf"
        $DatabaseBackupPath = Join-Path $DatabaseBackupFolder "wordpress-database-$Timestamp.sql"
        $DatabaseErrorLogPath = Join-Path $DatabaseBackupFolder "mysqldump-error.log"

        $MysqlOptionLines = @(
            "[client]",
            "user=$(ConvertTo-MySqlOptionValue -Value $DatabaseUser)",
            "password=$(ConvertTo-MySqlOptionValue -Value $DatabasePassword)",
            "host=$(ConvertTo-MySqlOptionValue -Value $MysqlConnection.Host)",
            "port=$($MysqlConnection.Port)",
            "protocol=tcp",
            "default-character-set=utf8mb4"
        )

        $Utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllLines(
            $MysqlOptionsPath,
            [string[]]$MysqlOptionLines,
            $Utf8WithoutBom
        )

        $MysqlDumpArguments = @(
            "--defaults-extra-file=`"$MysqlOptionsPath`"",
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
            "--result-file=`"$DatabaseBackupPath`"",
            "--databases",
            $DatabaseName
        )

        try {
            $MysqlDumpProcess = Start-Process `
                -FilePath $MysqlDumpPath `
                -ArgumentList $MysqlDumpArguments `
                -Wait `
                -PassThru `
                -NoNewWindow `
                -RedirectStandardError $DatabaseErrorLogPath

            if ($MysqlDumpProcess.ExitCode -ne 0) {
                $DatabaseError = if (Test-Path -LiteralPath $DatabaseErrorLogPath) {
                    (Get-Content -LiteralPath $DatabaseErrorLogPath -Raw).Trim()
                } else {
                    "No mysqldump error details were returned."
                }

                throw "WordPress database export failed with exit code $($MysqlDumpProcess.ExitCode). $DatabaseError"
            }
        } finally {
            if (Test-Path -LiteralPath $MysqlOptionsPath) {
                Remove-Item -LiteralPath $MysqlOptionsPath -Force
            }
        }

        if (!(Test-Path -LiteralPath $DatabaseBackupPath -PathType Leaf)) {
            throw "The database export command completed but did not create $DatabaseBackupPath."
        }

        $DatabaseFile = Get-Item -LiteralPath $DatabaseBackupPath
        if ($DatabaseFile.Length -le 0) {
            throw "The database export file is empty: $DatabaseBackupPath"
        }

        if (Test-Path -LiteralPath $DatabaseErrorLogPath -PathType Leaf) {
            $DatabaseErrorLog = Get-Item -LiteralPath $DatabaseErrorLogPath
            if ($DatabaseErrorLog.Length -eq 0) {
                Remove-Item -LiteralPath $DatabaseErrorLogPath -Force
            }
        }

        $RunState.DatabaseStatus = "Included, $($DatabaseFile.Length) bytes"
    }

    if (-not [string]::IsNullOrWhiteSpace($AppDataExportPath)) {
        Write-Host "Including the supplied app Data export..." -ForegroundColor Green
        if (!(Test-Path -LiteralPath $AppDataExportPath)) {
            throw "The supplied app Data export does not exist: $AppDataExportPath"
        }

        $AppDataDestination = Join-Path $StagingFolder "app-data-export"
        New-Item -ItemType Directory -Path $AppDataDestination -Force | Out-Null
        Copy-Item -LiteralPath $AppDataExportPath -Destination $AppDataDestination -Recurse -Force
        $RunState.AppDataExportStatus = "Included from $AppDataExportPath"
    }

    $LocalStorageNoticePath = Join-Path $StagingFolder "BROWSER-LOCAL-STORAGE-NOT-INCLUDED.txt"
    @(
        "Browser localStorage cannot be captured safely by this PowerShell script.",
        "Before a major recovery checkpoint, use the app Data export function.",
        "Pass that exported file to this script with -AppDataExportPath to include it."
    ) | Set-Content -LiteralPath $LocalStorageNoticePath -Encoding UTF8

    Write-Host "Creating SHA-256 checksums..." -ForegroundColor Green
    $FilesToHash = @(
        Get-ChildItem -LiteralPath $StagingFolder -Recurse -Force -File |
            Where-Object { $_.FullName -ne $ChecksumPath } |
            Sort-Object FullName
    )

    $ChecksumRecords = foreach ($File in $FilesToHash) {
        $RelativePath = $File.FullName.Substring($StagingFolder.Length) -replace '^[\\/]+', ''
        $Hash = Get-FileHash -LiteralPath $File.FullName -Algorithm SHA256
        [pscustomobject]@{
            SHA256 = $Hash.Hash
            Bytes = $File.Length
            Path = $RelativePath
        }
    }

    $ChecksumRecords | Export-Csv -LiteralPath $ChecksumPath -NoTypeInformation -Encoding UTF8

    $ProjectStatistics = Get-FolderStatistics -Path $ProjectBackupFolder
    $RunState.ProjectFileCount = $ProjectStatistics.FileCount
    $RunState.ProjectTotalBytes = $ProjectStatistics.TotalBytes

    Move-Item -LiteralPath $StagingFolder -Destination $BackupFolder
    $RunState.LocalBackupStatus = "Complete"
    Write-Host "Local backup completed: $BackupFolder" -ForegroundColor Green
    Write-Host ""

    Set-Location $UIFolder

    if (-not $SkipBuild) {
        if (!(Test-Path -LiteralPath (Join-Path $UIFolder "node_modules") -PathType Container)) {
            $PackageLockPath = Join-Path $UIFolder "package-lock.json"
            if (Test-Path -LiteralPath $PackageLockPath -PathType Leaf) {
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

        Write-Host "Validating the Vite build..." -ForegroundColor Green
        Invoke-NativeCommand `
            -FilePath "npm.cmd" `
            -ArgumentList @("run", "build") `
            -Description "Vite build"
        $RunState.BuildStatus = "Passed"
        Write-Host "Build passed." -ForegroundColor Green
        Write-Host ""
    }

    if (-not $SkipGit) {
        Write-Host "Checking and backing up the UI repository to Git..." -ForegroundColor Green

        $GitPath = Resolve-ApplicationCommand -Names @("git.exe", "git")
        if ([string]::IsNullOrWhiteSpace($GitPath)) {
            throw "Git was not found. Install Git or rerun with -SkipGit."
        }

        $GitRoot = Invoke-NativeCapture `
            -FilePath $GitPath `
            -ArgumentList @("-C", $UIFolder, "rev-parse", "--show-toplevel") `
            -Description "Git repository check"

        if ([string]::IsNullOrWhiteSpace($GitRoot)) {
            throw "The UI folder is not inside a valid Git repository: $UIFolder"
        }

        $CurrentBranch = Invoke-NativeCapture `
            -FilePath $GitPath `
            -ArgumentList @("-C", $UIFolder, "branch", "--show-current") `
            -Description "Git branch check"

        if ([string]::IsNullOrWhiteSpace($CurrentBranch)) {
            throw "Git is in detached HEAD state. Check out a branch before running the backup."
        }

        $RunState.GitBranch = $CurrentBranch

        $OriginUrl = Invoke-NativeCapture `
            -FilePath $GitPath `
            -ArgumentList @("-C", $UIFolder, "remote", "get-url", "origin") `
            -Description "Git origin check"

        if ([string]::IsNullOrWhiteSpace($OriginUrl)) {
            throw "The Git origin remote is not configured."
        }

        $RunState.GitRemote = "origin configured"

        $ModifiedGitFiles = Invoke-NativeCapture `
            -FilePath $GitPath `
            -ArgumentList @("-C", $UIFolder, "diff", "--name-only") `
            -Description "Git modified-file check"

        $StagedGitFiles = Invoke-NativeCapture `
            -FilePath $GitPath `
            -ArgumentList @("-C", $UIFolder, "diff", "--cached", "--name-only") `
            -Description "Git staged-file check"

        $UntrackedGitFiles = Invoke-NativeCapture `
            -FilePath $GitPath `
            -ArgumentList @("-C", $UIFolder, "ls-files", "--others", "--exclude-standard") `
            -Description "Git untracked-file check"

        $CandidateGitFiles = @(
            @($ModifiedGitFiles, $StagedGitFiles, $UntrackedGitFiles) |
                ForEach-Object { $_ -split "`r?`n" } |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
                ForEach-Object { $_.Trim().Replace('\', '/') } |
                Sort-Object -Unique
        )

        $SensitiveGitFiles = @(
            $CandidateGitFiles | Where-Object {
                $_ -match '(^|/)\.env($|\.)' -or
                $_ -match '(^|/)private-data/' -or
                $_ -match '(^|/)uploads/' -or
                $_ -match '(^|/)certs/.*(key|private).*\.pem$' -or
                $_ -match '\.(key|pfx|p12)$'
            }
        )

        if ($SensitiveGitFiles.Count -gt 0) {
            throw "Sensitive files were detected in the Git change set and were not staged: $($SensitiveGitFiles -join ', ')"
        }

        Invoke-NativeCommand `
            -FilePath $GitPath `
            -ArgumentList @("-C", $UIFolder, "add", "--all") `
            -Description "Git staging"

        foreach ($RequiredGitFile in $RequiredGitFiles) {
            & $GitPath -C $UIFolder ls-files --error-unmatch -- $RequiredGitFile *> $null
            $TrackedExitCode = $LASTEXITCODE
            if ($TrackedExitCode -ne 0) {
                throw "Required file is not tracked by Git after staging: $RequiredGitFile"
            }
        }

        $GitStatusOutput = Invoke-NativeCapture `
            -FilePath $GitPath `
            -ArgumentList @("-C", $UIFolder, "status", "--porcelain") `
            -Description "Git status check"

        if ([string]::IsNullOrWhiteSpace($GitStatusOutput)) {
            $RunState.GitStatus = "No changes to commit"
            Write-Host "No Git changes to commit." -ForegroundColor Yellow
        } else {
            Write-Host "Committing UI changes..." -ForegroundColor Green
            Invoke-NativeCommand `
                -FilePath $GitPath `
                -ArgumentList @("-C", $UIFolder, "commit", "-m", "$CommitMessage - $Timestamp") `
                -Description "Git commit"

            Write-Host "Pushing UI changes to GitHub..." -ForegroundColor Green
            Invoke-NativeCommand `
                -FilePath $GitPath `
                -ArgumentList @("-C", $UIFolder, "push", "origin", $CurrentBranch) `
                -Description "Git push"

            $RunState.GitStatus = "Committed and pushed"
            Write-Host "Git push completed." -ForegroundColor Green
        }

        if ($CreateTag) {
            if ([string]::IsNullOrWhiteSpace($TagName)) {
                $TagName = "backup-$Timestamp"
            }

            Invoke-NativeCommand `
                -FilePath $GitPath `
                -ArgumentList @("check-ref-format", "refs/tags/$TagName") `
                -Description "Git tag-name validation"

            & $GitPath -C $UIFolder rev-parse --quiet --verify "refs/tags/$TagName" *> $null
            $TagExists = $LASTEXITCODE -eq 0
            if ($TagExists) {
                throw "Git tag already exists: $TagName"
            }

            Write-Host "Creating Git tag: $TagName" -ForegroundColor Green
            Invoke-NativeCommand `
                -FilePath $GitPath `
                -ArgumentList @("-C", $UIFolder, "tag", "-a", $TagName, "-m", $CommitMessage) `
                -Description "Git tag creation"

            Invoke-NativeCommand `
                -FilePath $GitPath `
                -ArgumentList @("-C", $UIFolder, "push", "origin", $TagName) `
                -Description "Git tag push"

            $RunState.GitTag = $TagName
        }
    }

    Write-RunManifest -Folder $BackupFolder -State $RunState

    Write-Host ""
    Write-Host "Backup completed successfully." -ForegroundColor Green
    Write-Host "Location: $BackupFolder" -ForegroundColor Cyan
    Write-Host "Database: $($RunState.DatabaseStatus)" -ForegroundColor Cyan
    Write-Host "Build: $($RunState.BuildStatus)" -ForegroundColor Cyan
    Write-Host "Git: $($RunState.GitStatus)" -ForegroundColor Cyan

    if ([string]::IsNullOrWhiteSpace($AppDataExportPath)) {
        Write-Host "Browser localStorage was not captured. Use the app Data export for a complete application-data checkpoint." -ForegroundColor Yellow
    }
} catch {
    $RunState.Error = $_.Exception.Message

    if (Test-Path -LiteralPath $BackupFolder) {
        Write-RunManifest -Folder $BackupFolder -State $RunState
        Write-Host "The local project backup remains available at: $BackupFolder" -ForegroundColor Yellow
    } elseif (Test-Path -LiteralPath $StagingFolder) {
        $RunState.LocalBackupStatus = "Incomplete"
        $IncompleteMessage = @(
            "This backup did not complete successfully.",
            "Error: $($RunState.Error)",
            "Created: $((Get-Date).ToString('o'))"
        )
        $IncompleteMessage | Set-Content -LiteralPath (Join-Path $StagingFolder "INCOMPLETE-BACKUP.txt") -Encoding UTF8
        Write-RunManifest -Folder $StagingFolder -State $RunState
        Write-Host "An incomplete backup was retained at: $StagingFolder" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "BACKUP FAILED: $($RunState.Error)" -ForegroundColor Red
    exit 1
} finally {
    Set-Location $OriginalLocation
}
