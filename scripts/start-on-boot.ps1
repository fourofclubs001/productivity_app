# Starts the prod Docker stack and opens the app in the default browser.
# Intended to run automatically on Windows login via a Task Scheduler
# entry -- see the registration command in this file's header comment
# below. Safe to run manually too (e.g. to bring the stack back up after
# a reboot without waiting for the next login).
#
# One-time setup to register this as a login task (run once, as the user
# who should own the task -- elevated PowerShell not required):
#
#   $action = New-ScheduledTaskAction -Execute "powershell.exe" `
#     -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\Users\shimi\repositories\productivity_app\scripts\start-on-boot.ps1"'
#   $trigger = New-ScheduledTaskTrigger -AtLogOn
#   Register-ScheduledTask -TaskName "ProductivityAppStartOnBoot" -Action $action -Trigger $trigger -RunLevel Limited
#
# To remove it later:
#   Unregister-ScheduledTask -TaskName "ProductivityAppStartOnBoot" -Confirm:$false

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$healthUrl = "http://localhost:8000/health"
$appUrl = "http://localhost:5173"
$dockerDesktopExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

if (-not (Get-Process "Docker Desktop" -ErrorAction SilentlyContinue)) {
    Write-Host "Starting Docker Desktop..."
    Start-Process $dockerDesktopExe
}

Write-Host "Waiting for the Docker daemon to become ready..."
$maxDockerAttempts = 90
for ($i = 0; $i -lt $maxDockerAttempts; $i++) {
    try {
        docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
}

Set-Location $repoRoot
docker compose up --build -d

Write-Host "Waiting for the backend to become healthy..."
$maxAttempts = 60
for ($i = 0; $i -lt $maxAttempts; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200) {
            break
        }
    } catch {
        # Not up yet -- keep polling.
    }
    Start-Sleep -Seconds 2
}

Start-Process $appUrl
