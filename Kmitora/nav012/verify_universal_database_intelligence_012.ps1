param([string]$ProjectRoot = "C:\KMITORA\Kmitora-main\Kmitora-main")
$ErrorActionPreference="Stop"
$Backend=Join-Path $ProjectRoot "backend"
$Base=Join-Path $Backend "a000_training"
$Checks=@(
 @{N="Database universe module";P=(Join-Path $Base "database_universe.py")},
 @{N="Dedup registry module";P=(Join-Path $Base "dedup_registry.py")},
 @{N="Business rule database router";P=(Join-Path $Base "database_router.py")},
 @{N="Database API router";P=(Join-Path $Base "database_api_router.py")},
 @{N="224 database catalog";P=(Join-Path $Base "data\database_universe_224.json")},
 @{N="Universal capability catalog";P=(Join-Path $Base "data\universal_database_capabilities.json")}
)
foreach($c in $Checks){ if(Test-Path $c.P){Write-Host "PASS  $($c.N)" -ForegroundColor Green}else{throw "FAIL  $($c.N)"}}
$Universe = Get-Content (Join-Path $Base "data\database_universe_224.json") -Raw | ConvertFrom-Json
$Caps = Get-Content (Join-Path $Base "data\universal_database_capabilities.json") -Raw | ConvertFrom-Json
if([int]$Universe.count -ne 224){throw "FAIL  expected 224 database entries"} else {Write-Host "PASS  224 database entries" -ForegroundColor Green}
if($Caps.capabilities.Count -lt 70){throw "FAIL  universal capability catalog too small"} else {Write-Host "PASS  universal capability catalog $($Caps.capabilities.Count)" -ForegroundColor Green}
$Entry=Join-Path $Backend "main_api\F1033_server.py"
$Text=Get-Content $Entry -Raw
if(([regex]::Matches($Text,"BEGIN KMITORA_A000_DATABASE_INTELLIGENCE_012")).Count -ne 1){throw "FAIL  router marker not exactly once"} else {Write-Host "PASS  router attached exactly once" -ForegroundColor Green}
$Python=Join-Path $Backend ".venv\Scripts\python.exe"; if(-not(Test-Path $Python)){$Python="python"}
& $Python -c "import sys; sys.path.insert(0, r'$Backend'); from a000_training.database_universe import universe; from a000_training.database_router import route; assert len(universe.databases)==224; assert len(universe.capabilities)>=70; r=route({'database':'PostgreSQL','objective':'migration','business_rules':['preserve integrity'],'environment':'DEV'}); assert r['execution_authority']=='NONE'; assert r['production_action_executed'] is False; print('PASS  Python routing smoke')"
if($LASTEXITCODE -ne 0){throw "FAIL Python smoke"}
Write-Host "A000_UNIVERSAL_DATABASE_INTELLIGENCE_012 code verification passed." -ForegroundColor Green
