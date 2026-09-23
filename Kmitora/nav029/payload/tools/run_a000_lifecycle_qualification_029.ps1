$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Base = "http://127.0.0.1:8080"
function Pass([string]$m) { Write-Host "PASS  $m" -ForegroundColor Green }
function Check([bool]$ok,[string]$m) { if (-not $ok) { throw "FAIL  $m" }; Pass $m }
function Prop($obj,[string]$name) {
    if ($null -eq $obj) { return $null }
    $p = $obj.PSObject.Properties[$name]
    if ($null -eq $p) { return $null }
    return $p.Value
}

Write-Host "=== KMITORA A000 LIFECYCLE HTTP QUALIFICATION 029 ===" -ForegroundColor Cyan
$Health = Invoke-RestMethod "$Base/health" -TimeoutSec 15
Check ($null -ne $Health) "Core health responds"

$Checks = @(
    @{ Method='GET';  Path='/v1/issues';     Stage='DETECT';   Body=$null },
    @{ Method='POST'; Path='/v1/migrations'; Stage='EXECUTE';  Body=@{} },
    @{ Method='POST'; Path='/v1/tests';      Stage='TEST';     Body=@{} },
    @{ Method='POST'; Path='/v1/evidence';   Stage='EVIDENCE'; Body=@{} }
)

foreach ($C in $Checks) {
    if ($C.Method -eq 'GET') {
        $R = Invoke-RestMethod ($Base + $C.Path) -Method Get -TimeoutSec 15
    } else {
        $Json = $C.Body | ConvertTo-Json -Depth 10
        $R = Invoke-RestMethod ($Base + $C.Path) -Method Post -ContentType 'application/json' -Body $Json -TimeoutSec 15
    }
    $P = Prop $R 'payload'
    $L = Prop $P 'lifecycle_runtime'
    Check ($null -ne $L) ("lifecycle runtime present: " + $C.Path)
    Check ((Prop $L 'patch_id') -eq 'A000_LIFECYCLE_UNIFIED_RUNTIME_029') ("029 active: " + $C.Path)
    Check ((Prop $L 'stage') -eq $C.Stage) ("stage mapped " + $C.Stage)
    Check ((Prop $L 'mode') -eq 'PLAN_ONLY') ("PLAN_ONLY " + $C.Stage)
    $S = Prop $L 'safety'
    Check ((Prop $S 'execution_authority') -eq 'NONE') ("execution authority NONE " + $C.Stage)
    Check ((Prop $S 'source_write_executed') -eq $false) ("source writes zero " + $C.Stage)
    Check ((Prop $S 'target_write_executed') -eq $false) ("target writes zero " + $C.Stage)
    Check ((Prop $S 'production_action_executed') -eq $false) ("production actions zero " + $C.Stage)
    Check ((Prop $S 'cutover_executed') -eq $false) ("cutover zero " + $C.Stage)
}

$Msg = @{message='Explain current migration readiness without executing writes.'} | ConvertTo-Json
$A = Invoke-RestMethod "$Base/v1/a000/messages" -Method Post -ContentType 'application/json' -Body $Msg -TimeoutSec 15
$U = Prop (Prop $A 'payload') 'unified_runtime'
Check ($null -ne $U) "027 unified message runtime remains present"
Check ((Prop $U 'normal_message_path_integrated') -eq $true) "027 normal message path remains integrated"

Write-Host ""
Write-Host "A000_LIFECYCLE_UNIFIED_RUNTIME_029 live HTTP qualification passed." -ForegroundColor Green
