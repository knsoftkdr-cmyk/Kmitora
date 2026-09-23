$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Entry = Join-Path $Root "backend\main_api\F1033_server.py"
$Tool = Join-Path $Root "tools\run_a000_live_qualification_028a.ps1"
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
function Pass([string]$m) { Write-Host "PASS  $m" -ForegroundColor Green }
function Check([bool]$ok,[string]$m) { if (-not $ok) { throw "FAIL  $m" }; Pass $m }

Write-Host "=== A000_LIVE_RUNTIME_IMPORT_028A verification ===" -ForegroundColor Cyan
Check (Test-Path $Entry) "F1033 server exists"
Check (Test-Path $Tool) "028A live qualifier installed"
$T = Get-Content -LiteralPath $Entry -Raw
Check ($T.Contains('A000_LIVE_RUNTIME_IMPORT_028A')) "028A runtime marker present"
Check ($T.Contains('_kmitora_backend_root_028a')) "backend import path hardening present"
Check ($T.Contains('normal_message_path_integrated')) "fallback schema compatibility present"
Check (($T | Select-String -Pattern 'BEGIN KMITORA_A000_LIVE_UNIFIED_RUNTIME_027' -AllMatches).Matches.Count -eq 1) "027 managed block remains exactly once"
& $Python -m py_compile $Entry
if ($LASTEXITCODE -ne 0) { throw "FAIL  F1033 compile" }
Pass "F1033 compiles"
Write-Host ""
Write-Host "A000_LIVE_RUNTIME_IMPORT_028A code verification passed." -ForegroundColor Green
