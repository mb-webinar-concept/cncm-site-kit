<#
  Publish the CNCM site kit to GitHub from a Windows PC, in one run.

  What it does:
    1. Unzips cncm-site-kit.zip (from Downloads by default) into %USERPROFILE%\Projects
    2. Installs Git and the GitHub CLI with winget if they are missing
    3. Signs in to GitHub: it shows a one-time code; approve it on any phone or computer
       at https://github.com/login/device (your normal Google login and passkey work)
    4. Creates the repository, uploads the code, history and version tag
    5. Turns on GitHub Pages for the test site (public repositories)

  Run in PowerShell:
    powershell -ExecutionPolicy Bypass -File .\publish-to-github.ps1
  Options:
    -Visibility private      (default public; Pages on private repos needs a paid plan)
    -Owner my-org-name       (default: your personal account)
    -Zip C:\path\to\cncm-site-kit.zip
#>
param(
  [string]$Zip = (Join-Path $env:USERPROFILE 'Downloads\cncm-site-kit.zip'),
  [string]$Owner = '',
  [ValidateSet('public', 'private')][string]$Visibility = 'public',
  [string]$Name = 'cncm-site-kit'
)
$ErrorActionPreference = 'Stop'

function Step($msg) { Write-Host "`n== $msg" -ForegroundColor Cyan }
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Ensure-Tool($cmd, $wingetId) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Host "Installing $wingetId ..."
    winget install --id $wingetId -e --silent --accept-source-agreements --accept-package-agreements | Out-Host
    Refresh-Path
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd is still not available. Close and reopen PowerShell, then run this script again." }
  }
}

Step 'Unzip'
if (-not (Test-Path $Zip)) { throw "Cannot find $Zip. Download cncm-site-kit.zip first, or pass -Zip <path>." }
$projects = Join-Path $env:USERPROFILE 'Projects'
New-Item -ItemType Directory -Force -Path $projects | Out-Null
$dir = Join-Path $projects 'cncm-site-kit'
if (Test-Path $dir) { throw "$dir already exists. Rename or remove it, then run again." }
Expand-Archive -Path $Zip -DestinationPath $projects
if (-not (Test-Path (Join-Path $dir '.git'))) { throw "$dir has no .git folder; the zip may be incomplete." }

Step 'Tools'
Ensure-Tool git 'Git.Git'
Ensure-Tool gh 'GitHub.cli'

Step 'Sign in to GitHub'
gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'A one-time code will appear. On your phone, open https://github.com/login/device and enter it.' -ForegroundColor Yellow
  gh auth login --hostname github.com --git-protocol https --web --scopes 'repo,workflow'
  if ($LASTEXITCODE -ne 0) { throw 'GitHub sign-in did not complete.' }
}
gh auth setup-git | Out-Null
$me = gh api user --jq .login
if (-not $Owner) { $Owner = $me }
$full = "$Owner/$Name"

Step "Create $full ($Visibility) and upload"
Set-Location $dir
git config user.name 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { git config user.name $me }
gh repo create $full "--$Visibility" --source . --remote origin --push --description 'CNCM website modules, data and tests'
if ($LASTEXITCODE -ne 0) { throw "Could not create $full. If it already exists, delete it on github.com or choose another -Name." }
git push origin --tags

if ($Visibility -eq 'public') {
  Step 'Turn on the test site (GitHub Pages)'
  gh api -X POST "repos/$full/pages" -f build_type=workflow 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host 'Pages may already be on, or needs turning on by hand: repository Settings > Pages > Source: GitHub Actions.' -ForegroundColor Yellow }
}

Step 'Done'
Write-Host "Repository: https://github.com/$full"
Write-Host "Test runs:  https://github.com/$full/actions"
if ($Visibility -eq 'public') { Write-Host "Test site:  https://$($Owner.ToLower()).github.io/$Name/  (ready a few minutes after the tests pass)" }
