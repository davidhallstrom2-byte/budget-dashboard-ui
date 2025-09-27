# C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\tools\verify-ci-artifacts.ps1
[CmdletBinding()]
param(
  [string]$RepoDir      = "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui",
  [string]$WorkflowName = "ci",
  [string]$Branch       = "main",
  [string]$Commit,                 # full or short SHA, optional
  [string]$ArtifactName = "dist",  # expected artifact name
  [string]$OutDir       = "$env:TEMP\ci-artifacts",
  [int]$Limit           = 20,
  [switch]$Json
)

$ErrorActionPreference = "Stop"

function Require-Cmd {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found on PATH: $Name"
  }
}

function Find-GitRoot {
  param([string]$StartDir)
  $d = (Resolve-Path -LiteralPath $StartDir).Path
  for ($i=0; $i -lt 8; $i++) {
    try {
      $inside = (& git -C $d rev-parse --is-inside-work-tree 2>$null | Select-Object -First 1).Trim()
      if ($inside -eq "true") { return $d }
    } catch {}
    $parent = Split-Path -Path $d -Parent
    if (-not $parent -or $parent -eq $d) { break }
    $d = $parent
  }
  return $null
}

function Parse-GhRepo {
  param([string]$RemoteUrl)
  # Supports git@github.com:owner/repo.git and https://github.com/owner/repo(.git)
  if ($RemoteUrl -match "github\.com[:/](.+?)/(.+?)(\.git)?$") {
    return "$($Matches[1])/$($Matches[2])"
  }
  throw "Could not parse GitHub repo from remote URL: $RemoteUrl"
}

Require-Cmd git
Require-Cmd gh

$gitRoot = Find-GitRoot -StartDir $RepoDir
if (-not $gitRoot) { throw "Not a git repo, searched up from: $RepoDir" }
$RepoDir = $gitRoot

$remoteUrl = (git -C $RepoDir config --get remote.origin.url | Select-Object -First 1).Trim()
if (-not $remoteUrl) { throw "No 'origin' remote found in $RepoDir" }
$repo = Parse-GhRepo -RemoteUrl $remoteUrl

# Fetch for good measure, then query runs
git -C $RepoDir fetch origin --tags --prune | Out-Null

# List runs on the workflow and branch
$runs = gh run list --repo $repo --workflow "$WorkflowName" --branch "$Branch" --limit $Limit --json databaseId,headSha,headBranch,conclusion,workflowName,createdAt,url |
        ConvertFrom-Json

if ($Commit) {
  $commitFull = (git -C $RepoDir rev-parse "$Commit" | Select-Object -First 1).Trim()
  if (-not $commitFull) { throw "Commit not found: $Commit" }
  $runs = $runs | Where-Object { $_.headSha -eq $commitFull }
}

if (-not $runs -or $runs.Count -eq 0) {
  $msg = "No runs found for workflow '$WorkflowName' on branch '$Branch'" + ($Commit ? " for commit $Commit" : "")
  if ($Json) { @{ ok=$false; message=$msg } | ConvertTo-Json; exit 1 } else { Write-Output $msg; exit 1 }
}

# Prefer the most recent successful run
$successful = $runs | Where-Object { $_.conclusion -eq "success" }
$target = if ($successful) { $successful | Select-Object -First 1 } else { $runs | Select-Object -First 1 }

$runId = $target.databaseId
$run = gh run view $runId --repo $repo --json artifacts,conclusion,url,workflowName,headSha,createdAt | ConvertFrom-Json

$artNames = @()
if ($run.artifacts) { $artNames = $run.artifacts | ForEach-Object { $_.name } }

$result = [pscustomobject]@{
  Repo        = $repo
  RunId       = $runId
  Url         = $run.url
  Conclusion  = $run.conclusion
  HeadSha     = $run.headSha
  CreatedAt   = $run.createdAt
  Artifacts   = ($artNames -join ", ")
  ArtifactHit = ($artNames -contains $ArtifactName)
  DownloadDir = $OutDir
}

if ($Json) {
  $result | ConvertTo-Json -Depth 6
} else {
  Write-Output ("Repo:        {0}" -f $result.Repo)
  Write-Output ("RunId:       {0}" -f $result.RunId)
  Write-Output ("URL:         {0}" -f $result.Url)
  Write-Output ("Conclusion:  {0}" -f $result.Conclusion)
  Write-Output ("HeadSha:     {0}" -f $result.HeadSha)
  Write-Output ("Artifacts:   {0}" -f $result.Artifacts)
  Write-Output ("ArtifactHit: {0}" -f $result.ArtifactHit)
}

if (-not ($artNames -contains $ArtifactName)) {
  Write-Output "Expected artifact not found: $ArtifactName"
  exit 1
}

# Download the artifact
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
gh run download $runId --repo $repo -n "$ArtifactName" -D "$OutDir" | Out-Null

# If a zip exists, expand it
$zip = Join-Path $OutDir "$ArtifactName.zip"
$extractDir = Join-Path $OutDir $ArtifactName
if (Test-Path $zip) {
  if (Test-Path $extractDir) { Remove-Item -Recurse -Force $extractDir }
  Expand-Archive -Path $zip -DestinationPath $extractDir
}

# Print a short file listing
if (Test-Path $extractDir) {
  Get-ChildItem -Recurse -File $extractDir | Select-Object FullName,Length | Format-Table -AutoSize
} else {
  # Some workflows upload a folder as-is, so if the zip is not present, list whatever was downloaded
  Get-ChildItem -Recurse -File $OutDir | Select-Object FullName,Length | Format-Table -AutoSize
}

exit 0
