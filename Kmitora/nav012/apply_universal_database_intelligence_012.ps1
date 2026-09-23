param([string]$ProjectRoot = "C:\KMITORA\Kmitora-main\Kmitora-main")
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$PatchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Payload = Join-Path $PatchRoot "payload"
$Backend = Join-Path $ProjectRoot "backend"
$Dest = Join-Path $Backend "a000_training"
if (-not (Test-Path $ProjectRoot)) { throw "Project root not found: $ProjectRoot" }
if (-not (Test-Path $Payload)) { throw "Patch payload missing: $Payload" }
New-Item -ItemType Directory -Path $Dest -Force | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = Join-Path $ProjectRoot "_kmitora_backups\A000_DATABASE_INTELLIGENCE_012_$Stamp"
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

# Copy only 012-owned files. Existing 011 files are not overwritten.
$relativeFiles = @(
  "backend\a000_training\database_universe.py",
  "backend\a000_training\dedup_registry.py",
  "backend\a000_training\database_router.py",
  "backend\a000_training\database_api_router.py",
  "backend\a000_training\data\database_universe_224.json",
  "backend\a000_training\data\universal_database_capabilities.json",
  "backend\a000_training\tests\test_database_intelligence_012.py"
)
foreach ($rel in $relativeFiles) {
  $src = Join-Path $Payload $rel
  $dst = Join-Path $ProjectRoot $rel
  $parent = Split-Path $dst -Parent
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  if (Test-Path $dst) {
    Copy-Item $dst (Join-Path $BackupDir ([IO.Path]::GetFileName($dst))) -Force
    $oldHash=(Get-FileHash $dst -Algorithm SHA256).Hash
    $newHash=(Get-FileHash $src -Algorithm SHA256).Hash
    if ($oldHash -eq $newHash) {
      Write-Host "SKIP duplicate file unchanged: $rel" -ForegroundColor DarkGray
      continue
    }
  }
  Copy-Item $src $dst -Force
  Write-Host "UPSERT 012-owned file: $rel" -ForegroundColor Green
}

# Preserve package init; create only if missing.
$Init = Join-Path $Dest "__init__.py"
if (-not (Test-Path $Init)) { Set-Content $Init "# KMITORA A000 training package`r`n" -Encoding UTF8 }

# Wire router once into the actual FastAPI entry point.
$Entry = Join-Path $Backend "main_api\F1033_server.py"
if (-not (Test-Path $Entry)) { throw "Expected Core API entry not found: $Entry" }
$Text = Get-Content $Entry -Raw
$Start = "# BEGIN KMITORA_A000_DATABASE_INTELLIGENCE_012"
$End = "# END KMITORA_A000_DATABASE_INTELLIGENCE_012"
$Block = @'
# BEGIN KMITORA_A000_DATABASE_INTELLIGENCE_012
try:
    from a000_training.database_api_router import router as kmitora_a000_database_router
    if not any(getattr(r, "path", "").startswith("/api/a000/database-intelligence") for r in app.routes):
        app.include_router(kmitora_a000_database_router)
except Exception as kmitora_database_intelligence_error:
    print(f"[KMITORA] A000 database intelligence router not loaded: {kmitora_database_intelligence_error}")
# END KMITORA_A000_DATABASE_INTELLIGENCE_012
'@
if ($Text -notmatch [regex]::Escape($Start)) {
  Copy-Item $Entry (Join-Path $BackupDir "F1033_server.py") -Force
  Add-Content $Entry "`r`n$Block`r`n" -Encoding UTF8
  Write-Host "Router attached exactly once." -ForegroundColor Green
} else {
  Write-Host "SKIP duplicate router block already exists." -ForegroundColor DarkGray
}

$Python = Join-Path $Backend ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) { $Python = "python" }
& $Python -m py_compile $Entry
if ($LASTEXITCODE -ne 0) { throw "Core API compile failed." }
& $Python -m compileall $Dest | Out-Null
if ($LASTEXITCODE -ne 0) { throw "A000 database intelligence compile failed." }
Write-Host ""
Write-Host "A000_UNIVERSAL_DATABASE_INTELLIGENCE_012 applied successfully." -ForegroundColor Green
Write-Host "Database universe : 224 supplied database / technology entries"
Write-Host "Universal functions: 76 canonical capabilities, defined once"
Write-Host "Duplicate rule     : reuse existing functionality; 012 adds only missing 012-owned code"
Write-Host "Execution authority: NONE (knowledge/routing only)"
Write-Host "Production actions : DISABLED"
