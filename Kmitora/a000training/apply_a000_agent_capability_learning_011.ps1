param([string]$ProjectRoot = "C:\KMITORA\Kmitora-main\Kmitora-main")
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Payload = Join-Path $PSScriptRoot "payload\backend\a000_training"
$Backend = Join-Path $ProjectRoot "backend"
$Target = Join-Path $Backend "a000_training"
$Entry = Join-Path $Backend "main_api\F1033_server.py"

if (-not (Test-Path $Entry)) { throw "Main API entry not found: $Entry" }
if (-not (Test-Path $Payload)) { throw "Payload not found: $Payload" }

New-Item -ItemType Directory -Path $Target -Force | Out-Null
Copy-Item -Path (Join-Path $Payload "*") -Destination $Target -Recurse -Force

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item $Entry "$Entry.bak_A000_AGENT_CAPABILITY_LEARNING_011_$stamp" -Force

$text = Get-Content $Entry -Raw
$start = "# BEGIN KMITORA_A000_AGENT_CAPABILITY_LEARNING_011"
$end = "# END KMITORA_A000_AGENT_CAPABILITY_LEARNING_011"
$block = @'
try:
    from backend.a000_training.api_router import router as kmitora_a000_training_router
except Exception:
    from a000_training.api_router import router as kmitora_a000_training_router

if not any(getattr(r, "path", "").startswith("/api/a000/training") for r in app.routes):
    app.include_router(kmitora_a000_training_router)
'@

$managed = "$start`r`n$block`r`n$end"
$pattern = "(?s)" + [regex]::Escape($start) + ".*?" + [regex]::Escape($end)
if ($text -match $pattern) {
    $text = [regex]::Replace($text, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $managed }, 1)
} else {
    $text = $text.TrimEnd() + "`r`n`r`n" + $managed + "`r`n"
}
Set-Content -Path $Entry -Value $text -Encoding UTF8

$Python = Join-Path $Backend ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) { throw "Python venv not found: $Python" }
& $Python -m compileall $Target | Out-Host
if ($LASTEXITCODE -ne 0) { throw "A000 training package compile failed." }
& $Python -m py_compile $Entry
if ($LASTEXITCODE -ne 0) { throw "F1033_server.py compile failed." }

Write-Host ""; Write-Host "A000_AGENT_CAPABILITY_LEARNING_011 applied successfully." -ForegroundColor Green
Write-Host "Created/updated : $Target"
Write-Host "Updated         : $Entry"
Write-Host "Deduplication   : fingerprint based; duplicates ignored"
Write-Host "Authority       : knowledge/routing only; production writes remain disabled"
