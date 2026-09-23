$ErrorActionPreference = "Stop"

$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Runtime = Join-Path $Root "runtime\kmitora_assistant_runtime.py"
$LogDir = Join-Path $Root "runtime\assistant_logs"
$StateDir = Join-Path $Root "runtime\assistant_state"
$Port = 8083
$HealthUrl = "http://127.0.0.1:$Port/health"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
New-Item -ItemType Directory -Path $StateDir -Force | Out-Null

function Test-KmitoraAssistantHealth {
    try {
        $r = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2 -ErrorAction Stop
        return ($null -ne $r -and "$($r.status)".ToUpperInvariant() -eq "HEALTHY")
    }
    catch {
        return $false
    }
}

if (Test-KmitoraAssistantHealth) {
    Write-Host "KMITORA Assistant runtime is already HEALTHY on 127.0.0.1:8083." -ForegroundColor Green
    exit 0
}

if (-not (Test-Path -LiteralPath $Runtime)) {
    throw "Runtime not found: $Runtime"
}

$Python = $null
foreach ($Candidate in @("py","python","python3")) {
    try {
        & $Candidate --version *> $null
        if ($LASTEXITCODE -eq 0) {
            $Python = $Candidate
            break
        }
    }
    catch {}
}

if (-not $Python) {
    throw "Python was not found in PATH."
}

$PortOwner = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1

if ($PortOwner) {
    $Owner = Get-Process -Id $PortOwner.OwningProcess -ErrorAction SilentlyContinue
    $OwnerName = if ($Owner) { $Owner.ProcessName } else { "PID $($PortOwner.OwningProcess)" }
    throw "Port $Port is already occupied by $OwnerName, but KMITORA /health is not healthy. Refusing to kill an unknown process."
}

$RunStamp = Get-Date -Format "yyyyMMdd_HHmmss"
$StdOut = Join-Path $LogDir "assistant_runtime_$RunStamp.out.log"
$StdErr = Join-Path $LogDir "assistant_runtime_$RunStamp.err.log"
$PidFile = Join-Path $StateDir "assistant_runtime.pid"

$PythonCommand = if ($Python -eq "py") { "py.exe" } elseif ($Python -eq "python") { "python.exe" } else { "python3.exe" }

$Process = Start-Process `
    -FilePath $PythonCommand `
    -ArgumentList @($Runtime) `
    -WorkingDirectory $Root `
    -RedirectStandardOutput $StdOut `
    -RedirectStandardError $StdErr `
    -PassThru `
    -WindowStyle Hidden

[System.IO.File]::WriteAllText($PidFile,[string]$Process.Id,(New-Object System.Text.UTF8Encoding($false)))

$Healthy = $false
for ($i = 1; $i -le 30; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-KmitoraAssistantHealth) {
        $Healthy = $true
        break
    }
    if ($Process.HasExited) {
        break
    }
}

if (-not $Healthy) {
    if (Test-Path -LiteralPath $StdErr) {
        Write-Host "---- Assistant stderr ----" -ForegroundColor Yellow
        Get-Content -LiteralPath $StdErr -Tail 50 -ErrorAction SilentlyContinue
    }
    throw "KMITORA Assistant runtime failed to become healthy on port 8083."
}

Write-Host "KMITORA Assistant runtime: HEALTHY" -ForegroundColor Green
Write-Host "Port                    : 8083"
Write-Host "PID                     : $($Process.Id)"
Write-Host "Workspace               : $Root"
Write-Host "Production mutation     : DISABLED"
Write-Host "stdout                  : $StdOut"
Write-Host "stderr                  : $StdErr"