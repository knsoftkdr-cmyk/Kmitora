$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Repo

function Invoke-CheckedPython {
    param([Parameter(Mandatory=$true)][string[]]$Arguments)
    & python @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Python command failed with exit code $LASTEXITCODE : python $($Arguments -join ' ')"
    }
}

Write-Host "KMITORA A000 AUTONOMY-137 DEV PATCH R2" -ForegroundColor Cyan
Write-Host "Repo: $Repo" -ForegroundColor DarkGray

Invoke-CheckedPython @(".\tools\autonomy_137\apply_autonomy_137.py")

# compileall is portable on Windows and does not depend on shell wildcard expansion.
Invoke-CheckedPython @("-m", "compileall", "-q", ".\backend\autonomy", ".\backend\main_api\F1033_server.py")
Invoke-CheckedPython @("-m", "unittest", "backend.autonomy.test_autonomy_137", "-v")

Write-Host "" 
Write-Host "PASS - AUTONOMY-137 integration applied and tests passed." -ForegroundColor Green
Write-Host "Production authorization remains FALSE." -ForegroundColor Yellow
Write-Host "Cutover authorization remains FALSE." -ForegroundColor Yellow
