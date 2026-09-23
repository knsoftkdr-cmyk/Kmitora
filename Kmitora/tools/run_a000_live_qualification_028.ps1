param(
    [string]$Base = "http://127.0.0.1:8080"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Pass([string]$m) { Write-Host "PASS  $m" -ForegroundColor Green }
function Check([bool]$ok,[string]$m) { if (-not $ok) { throw "FAIL  $m" }; Pass $m }

Write-Host "=== KMITORA A000 LIVE HTTP QUALIFICATION 028 ===" -ForegroundColor Cyan

$Health = Invoke-RestMethod -Uri "$Base/health" -Method Get -TimeoutSec 15
Check ($null -ne $Health) "Core health responds"

$Body = @{
    message = "Plan a PostgreSQL to SQL Server customer migration preserving address history and parent before child. No production writes."
    environment = "DEV"
    risk = "HIGH"
    business_rules = @(
        "customer_id must remain unique",
        "preserve address history",
        "parent before child",
        "no production writes"
    )
    source_engine = "postgresql"
    target_engine = "sqlserver"
    tables = @(
        @{
            name = "customer_master"
            columns = @(
                @{ name = "customer_id"; logical_type = "INTEGER"; nullable = $false },
                @{ name = "name"; logical_type = "STRING"; nullable = $true }
            )
            primary_key = @("customer_id")
        }
    )
} | ConvertTo-Json -Depth 20

$Response = Invoke-RestMethod -Uri "$Base/v1/a000/messages" -Method Post -ContentType "application/json" -Body $Body -TimeoutSec 30
$U = $Response.payload.unified_runtime
Check ($null -ne $U) "payload.unified_runtime present"
Check ($U.patch_id -eq "A000_LIVE_UNIFIED_RUNTIME_027") "027 bridge active in live route"
Check ($U.normal_message_path_integrated -eq $true) "normal A000 message path integrated"
Check ($U.mode -eq "PLAN_ONLY") "runtime remains PLAN_ONLY"
Check ($U.safety.execution_authority -eq "NONE") "execution authority remains NONE"
Check ($U.safety.source_write_executed -eq $false) "source writes zero"
Check ($U.safety.target_write_executed -eq $false) "target writes zero"
Check ($U.safety.production_action_executed -eq $false) "production actions zero"
Check ($U.safety.cutover_executed -eq $false) "cutover zero"
Check ($U.deduplication.duplicate_creation_executed -eq $false) "duplicate creation disabled"
Check ($U.database_translation.status -eq "PLAN_ONLY") "database translation plan-only"
Check ($null -ne $U.evidence.evidence_id) "evidence id generated"

$NegativeBody = @{ message = "quantum banana telescope migration unicorn"; environment = "DEV" } | ConvertTo-Json -Depth 10
$Negative = Invoke-RestMethod -Uri "$Base/v1/a000/messages" -Method Post -ContentType "application/json" -Body $NegativeBody -TimeoutSec 30
$NU = $Negative.payload.unified_runtime
Check ($null -ne $NU) "negative request has unified runtime"
Check ($NU.safety.production_action_executed -eq $false) "negative request production actions zero"
Check ($NU.safety.target_write_executed -eq $false) "negative request target writes zero"
Check ($NU.decision -eq "ABSTAIN_REVIEW") "ungrounded request abstains"
Check ($NU.status -eq "REVIEW") "ungrounded request routed to review"

Write-Host ""
Write-Host "A000_LIVE_RUNTIME_HARDENING_028 live HTTP qualification passed." -ForegroundColor Green
