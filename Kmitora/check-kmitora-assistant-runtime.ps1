$ErrorActionPreference = "Continue"

$HealthUrl = "http://127.0.0.1:8083/health"
$Launcher = "C:\KMITORA\Kmitora-main\Kmitora-main\run-kmitora-assistant-runtime.ps1"

try {
    $Result = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 3 -ErrorAction Stop
    Write-Host "KMITORA Assistant Runtime : HEALTHY" -ForegroundColor Green
    $Result | ConvertTo-Json -Depth 10
    exit 0
}
catch {
    Write-Host "KMITORA Assistant Runtime : DOWN" -ForegroundColor Red
    Write-Host "Attempting self-repair..." -ForegroundColor Yellow
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Launcher
    Start-Sleep -Seconds 2

    try {
        $Result = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 3 -ErrorAction Stop
        Write-Host "KMITORA Assistant Runtime : RECOVERED" -ForegroundColor Green
        $Result | ConvertTo-Json -Depth 10
        exit 0
    }
    catch {
        Write-Host "KMITORA Assistant Runtime : STILL DOWN" -ForegroundColor Red
        exit 1
    }
}