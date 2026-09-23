$ErrorActionPreference = "Continue"

$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Launcher = Join-Path $Root "run-kmitora-assistant-runtime.ps1"
$LogDir = Join-Path $Root "runtime\assistant_logs"
$SupervisorLog = Join-Path $LogDir "assistant_supervisor.log"
$LockFile = Join-Path $Root "runtime\assistant_state\assistant_supervisor.lock"
$HealthUrl = "http://127.0.0.1:8083/health"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path $LockFile) -Force | Out-Null

function Write-SupervisorLog([string]$Message) {
    $Line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | $Message"
    Add-Content -LiteralPath $SupervisorLog -Value $Line -Encoding UTF8
}

function Test-AssistantHealth {
    try {
        $r = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2 -ErrorAction Stop
        return ($null -ne $r -and "$($r.status)".ToUpperInvariant() -eq "HEALTHY")
    }
    catch {
        return $false
    }
}

# Prevent duplicate supervisors for the same KMITORA workspace.
$ExistingLockPid = $null
if (Test-Path -LiteralPath $LockFile) {
    try {
        $ExistingLockPid = [int](Get-Content -LiteralPath $LockFile -Raw)
        if (Get-Process -Id $ExistingLockPid -ErrorAction SilentlyContinue) {
            Write-SupervisorLog "Supervisor already running as PID $ExistingLockPid. Exiting duplicate."
            exit 0
        }
    }
    catch {}
}

[System.IO.File]::WriteAllText($LockFile,[string]$PID,(New-Object System.Text.UTF8Encoding($false)))
Write-SupervisorLog "Supervisor started. PID=$PID"

$ConsecutiveFailures = 0

try {
    while ($true) {
        if (Test-AssistantHealth) {
            if ($ConsecutiveFailures -gt 0) {
                Write-SupervisorLog "Runtime recovered and is HEALTHY."
            }
            $ConsecutiveFailures = 0
            Start-Sleep -Seconds 10
            continue
        }

        $ConsecutiveFailures++
        Write-SupervisorLog "Runtime health check failed. Attempt=$ConsecutiveFailures"

        try {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Launcher *> $null
        }
        catch {
            Write-SupervisorLog "Launcher error: $($_.Exception.Message)"
        }

        if (Test-AssistantHealth) {
            Write-SupervisorLog "Runtime restarted successfully."
            $ConsecutiveFailures = 0
            Start-Sleep -Seconds 10
            continue
        }

        # Backoff prevents a restart storm if Python/runtime itself is broken.
        $Delay = [Math]::Min(60, 5 * [Math]::Max(1,$ConsecutiveFailures))
        Write-SupervisorLog "Runtime still unavailable. Backoff=${Delay}s."
        Start-Sleep -Seconds $Delay
    }
}
finally {
    try {
        if (Test-Path -LiteralPath $LockFile) {
            $LockPid = Get-Content -LiteralPath $LockFile -Raw -ErrorAction SilentlyContinue
            if ("$LockPid".Trim() -eq "$PID") {
                Remove-Item -LiteralPath $LockFile -Force -ErrorAction SilentlyContinue
            }
        }
    }
    catch {}
    Write-SupervisorLog "Supervisor stopped. PID=$PID"
}