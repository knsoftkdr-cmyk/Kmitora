param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "stop", "status", "restart", "preflight")]
    [string]$Action = "status",

    [string]$ReleaseRoot = "C:\KMITORA\RELEASES\KMITORA_v0_3_1_demo_ops",
    [string]$RuntimeRoot = "C:\KMITORA\DEMO_RUNTIME\v0.3.1-demo-ops",
    [string]$Python = "C:\Python312\python.exe",
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$SupervisorPort = 8090
$BackendPort = 8080
$FrontendPort = 5173
$SupervisorUrl = "http://127.0.0.1:$SupervisorPort"
$SupervisorScript = Join-Path $ReleaseRoot "supervisor\kmitora_demo_supervisor.py"
$BuildZip = Get-ChildItem `
    -Path (Join-Path $ReleaseRoot "artifacts") `
    -Filter "KmitoraBuild_*_Full_Integrated.zip" `
    -File `
    -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

function Write-Section {
    param([string]$Text)

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
}

function Test-Port {
    param([int]$Port)

    return [bool](
        Get-NetTCPConnection `
            -LocalPort $Port `
            -State Listen `
            -ErrorAction SilentlyContinue
    )
}

function Test-Supervisor {
    try {
        $Health = Invoke-RestMethod `
            -Uri "$SupervisorUrl/health" `
            -TimeoutSec 2

        return $Health.status -eq "OK"
    }
    catch {
        return $false
    }
}

function Wait-Supervisor {
    param([int]$TimeoutSeconds = 20)

    $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $Deadline) {
        if (Test-Supervisor) {
            return $true
        }

        Start-Sleep -Milliseconds 300
    }

    return $false
}

function Get-ExpectedBuildHash {
    param([string]$RelativePath)

    $ChecksumFile = Join-Path $ReleaseRoot "CHECKSUMS_SHA256.txt"

    if (-not (Test-Path $ChecksumFile)) {
        throw "Checksum file not found: $ChecksumFile"
    }

    $NormalizedPath = $RelativePath.Replace("\", "/")

    foreach ($Line in Get-Content $ChecksumFile) {
        $Parts = $Line.Trim() -split "\s{2,}", 2

        if (
            $Parts.Count -eq 2 -and
            $Parts[1].Replace("\", "/") -eq $NormalizedPath
        ) {
            return $Parts[0].ToLowerInvariant()
        }
    }

    throw "Build checksum entry not found for: $RelativePath"
}

function Ensure-Runtime {
    if (-not $BuildZip) {
        throw "No certified full integrated build ZIP was found in $ReleaseRoot\artifacts."
    }

    $RuntimeRepo = Join-Path $RuntimeRoot "Kmitora"

    if (Test-Path $RuntimeRepo) {
        return
    }

    Write-Section "EXTRACT CERTIFIED RUNTIME"

    New-Item `
        -ItemType Directory `
        -Path $RuntimeRoot `
        -Force |
        Out-Null

    Expand-Archive `
        -Path $BuildZip.FullName `
        -DestinationPath $RuntimeRoot `
        -Force

    if (-not (Test-Path $RuntimeRepo)) {
        throw "Runtime extraction failed: $RuntimeRepo"
    }

    Write-Host "Runtime extracted: $RuntimeRepo" -ForegroundColor Green
}

function Verify-CertifiedBuild {
    if (-not $BuildZip) {
        throw "Certified build ZIP not found."
    }

    $RelativePath = $BuildZip.FullName.Substring($ReleaseRoot.Length + 1)
    $Expected = Get-ExpectedBuildHash -RelativePath $RelativePath
    $Actual = (
        Get-FileHash `
            -Algorithm SHA256 `
            -Path $BuildZip.FullName
    ).Hash.ToLowerInvariant()

    if ($Expected -ne $Actual) {
        throw @"
Certified build SHA-256 mismatch.
Expected: $Expected
Actual:   $Actual
"@
    }

    Write-Host "Certified build SHA-256: PASS" -ForegroundColor Green
}

function Ensure-Supervisor {
    if (Test-Supervisor) {
        return
    }

    if (-not (Test-Path $SupervisorScript)) {
        throw "Demo Supervisor script not found: $SupervisorScript"
    }

    if (-not (Test-Path $Python)) {
        throw "Python executable not found: $Python"
    }

    Write-Section "START PERSISTENT DEMO SUPERVISOR"

    $Arguments = @(
        $SupervisorScript,
        "--release-root", $ReleaseRoot,
        "--runtime-root", $RuntimeRoot,
        "--python", $Python,
        "--port", "$SupervisorPort"
    )

    Start-Process `
        -FilePath $Python `
        -ArgumentList $Arguments `
        -WindowStyle Hidden |
        Out-Null

    if (-not (Wait-Supervisor)) {
        throw "KMITORA Demo Supervisor did not become ready on port $SupervisorPort."
    }

    Write-Host "Demo Supervisor ${SupervisorPort}: PASS" -ForegroundColor Green
}

function Invoke-SupervisorGet {
    param([string]$Path)

    return Invoke-RestMethod `
        -Uri "$SupervisorUrl$Path" `
        -Method Get `
        -TimeoutSec 15
}

function Invoke-SupervisorPost {
    param(
        [string]$Path,
        [int]$TimeoutSeconds = 90
    )

    return Invoke-RestMethod `
        -Uri "$SupervisorUrl$Path" `
        -Method Post `
        -ContentType "application/json" `
        -Body "{}" `
        -TimeoutSec $TimeoutSeconds
}

function Show-Status {
    $Status = Invoke-SupervisorGet -Path "/v1/demo/status"

    Write-Section "KMITORA DEMO STATUS"

    Write-Host "Supervisor 8090: $($Status.supervisor.status)"
    Write-Host "Backend 8080:    $($Status.backend.status)"
    Write-Host "Frontend 5173:   $($Status.frontend.status)"
    Write-Host "Demo ready:      $($Status.demo_ready)"
    Write-Host "Mega Demo:       $($Status.mega_demo_status)"
    Write-Host "Report exists:   $($Status.report_exists)"
    Write-Host "Safety OK:       $($Status.safety_ok)"
    Write-Host "Last action:     $($Status.last_action)"

    if ($Status.last_error) {
        Write-Host "Last error:      $($Status.last_error)" -ForegroundColor Red
    }
}

function Show-Preflight {
    $Result = Invoke-SupervisorGet -Path "/v1/demo/preflight"

    Write-Section "KMITORA CLIENT-DEMO PREFLIGHT"

    foreach ($Check in $Result.checks) {
        $Label = if ($Check.passed) { "PASS" } else { "FAIL" }
        $Color = if ($Check.passed) { "Green" } else { "Red" }

        Write-Host (
            "{0,-5} {1,-28} {2}" -f
            $Label,
            $Check.name,
            $Check.detail
        ) -ForegroundColor $Color
    }

    Write-Host ""
    Write-Host (
        "Preflight: {0}/{1} passed" -f
        $Result.passed,
        $Result.total
    )

    if (-not $Result.ready) {
        throw "KMITORA preflight failed."
    }

    Write-Host "KMITORA PREFLIGHT: PASS" -ForegroundColor Green
}

Write-Section "KMITORA DEMO OPERATIONS"
Write-Host "Action:  $Action"
Write-Host "Release: $ReleaseRoot"
Write-Host "Runtime: $RuntimeRoot"

if (-not (Test-Path $ReleaseRoot)) {
    throw "Release folder not found: $ReleaseRoot"
}

Verify-CertifiedBuild
Ensure-Runtime
Ensure-Supervisor

switch ($Action) {
    "preflight" {
        Show-Preflight
    }

    "status" {
        Show-Status
    }

    "start" {
        Show-Preflight

        Write-Section "START KMITORA DEMO"

        $Result = Invoke-SupervisorPost `
            -Path "/v1/demo/start" `
            -TimeoutSeconds 120

        Show-Status

        if (-not $Result.demo_ready) {
            throw "KMITORA demo did not reach READY state."
        }

        if (-not $NoBrowser) {
            Start-Process "http://127.0.0.1:${FrontendPort}/?page=demoOperations"
        }

        Write-Host ""
        Write-Host "Use Operations -> Demo Operations for all further controls." -ForegroundColor Green
    }

    "stop" {
        Write-Section "STOP BACKEND + FRONTEND"

        Invoke-SupervisorPost `
            -Path "/v1/demo/stop" `
            -TimeoutSeconds 45 |
            Out-Null

        Show-Status

        Write-Host ""
        Write-Host (
            "Supervisor remains running on port $SupervisorPort so the loaded " +
            "Demo Operations page can start the demo again."
        ) -ForegroundColor Yellow
    }

    "restart" {
        Write-Section "RESTART BACKEND + FRONTEND"

        Invoke-SupervisorPost `
            -Path "/v1/demo/restart" `
            -TimeoutSeconds 120 |
            Out-Null

        Show-Status
    }
}
