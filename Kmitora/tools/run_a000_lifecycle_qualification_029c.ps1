$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Base = "http://127.0.0.1:8080"

function Check([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL  $Message" }
    Write-Host "PASS  $Message" -ForegroundColor Green
}

function Invoke-KmitoraJson {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [ValidateSet('GET','POST')][string]$Method = 'GET',
        [hashtable]$Body = @{}
    )
    try {
        if ($Method -eq 'GET') { return Invoke-RestMethod ($Base + $Path) -Method Get -TimeoutSec 15 }
        $Json = $Body | ConvertTo-Json -Depth 20
        return Invoke-RestMethod ($Base + $Path) -Method Post -ContentType 'application/json' -Body $Json -TimeoutSec 15
    }
    catch [System.Net.WebException] {
        $Response = $_.Exception.Response
        if ($null -eq $Response) { throw }
        $Stream = $Response.GetResponseStream()
        $Reader = New-Object System.IO.StreamReader($Stream)
        try { $Raw = $Reader.ReadToEnd() } finally { $Reader.Dispose(); $Stream.Dispose() }
        if ([string]::IsNullOrWhiteSpace($Raw)) { throw }
        return $Raw | ConvertFrom-Json
    }
}

function Check-LifecycleRuntime {
    param(
        [Parameter(Mandatory=$true)]$Response,
        [Parameter(Mandatory=$true)][string]$Stage,
        [Parameter(Mandatory=$true)][string]$Label,
        [int]$ExpectedCode = 200
    )
    $P = $Response.payload
    Check ($null -ne $P) "payload present: $Label"
    $L = $P.lifecycle_runtime
    Check ($null -ne $L) "lifecycle runtime present: $Label"
    Check ([string]$L.patch_id -eq 'A000_LIFECYCLE_UNIFIED_RUNTIME_029') "029 active: $Label"
    Check ([string]$L.hardening_patch_id -eq 'A000_LIFECYCLE_RUNTIME_SCHEMA_029C') "029C schema active: $Label"
    Check ([string]$L.stage -eq $Stage) "stage mapped $Stage"
    Check ([string]$L.mode -eq 'PLAN_ONLY') "PLAN_ONLY $Stage"
    Check ([int]$L.response_status_code -eq $ExpectedCode) "response status projected $ExpectedCode $Stage"

    $S = $L.safety
    Check ($null -ne $S) "safety envelope present $Stage"
    Check ([string]$S.execution_authority -eq 'NONE') "execution authority NONE $Stage"
    Check ($S.source_write_executed -eq $false) "source writes zero $Stage"
    Check ($S.target_write_executed -eq $false) "target writes zero $Stage"
    Check ($S.production_action_executed -eq $false) "production actions zero $Stage"
    Check ($S.cutover_executed -eq $false) "cutover zero $Stage"
}

Write-Host "=== KMITORA A000 LIFECYCLE HTTP QUALIFICATION 029C ===" -ForegroundColor Cyan
$Health = Invoke-KmitoraJson -Path '/health' -Method GET
Check ($null -ne $Health) 'Core health responds'

$Detect = Invoke-KmitoraJson -Path '/v1/issues' -Method GET
Check-LifecycleRuntime -Response $Detect -Stage 'DETECT' -Label '/v1/issues' -ExpectedCode 200

$Execute = Invoke-KmitoraJson -Path '/v1/migrations' -Method POST -Body @{}
Check ([string]$Execute.kind -eq 'migration_gate_error') 'Execute guard rejects missing migration identity'
Check ([string]$Execute.payload.message -eq 'migration_id is required') 'Execute guard requires migration_id'
Check-LifecycleRuntime -Response $Execute -Stage 'EXECUTE' -Label '/v1/migrations guarded rejection' -ExpectedCode 400
Check ($Execute.payload.lifecycle_runtime.guarded_or_error_response -eq $true) 'Execute guard remains classified as guarded/error response'

$Test = Invoke-KmitoraJson -Path '/v1/tests' -Method POST -Body @{ qualification = '029C'; mode = 'READ_ONLY' }
Check-LifecycleRuntime -Response $Test -Stage 'TEST' -Label '/v1/tests' -ExpectedCode 202

$Evidence = Invoke-KmitoraJson -Path '/v1/evidence' -Method POST -Body @{ qualification = '029C'; mode = 'READ_ONLY' }
Check-LifecycleRuntime -Response $Evidence -Stage 'EVIDENCE' -Label '/v1/evidence' -ExpectedCode 202

$MsgBody = @{ message = 'Explain the current KMITORA DEV migration state without performing any write.' } | ConvertTo-Json -Depth 10
$Msg = Invoke-RestMethod ($Base + '/v1/a000/messages') -Method Post -ContentType 'application/json' -Body $MsgBody -TimeoutSec 15
Check ($null -ne $Msg.payload.unified_runtime) '027 unified runtime remains present'
Check ($Msg.payload.unified_runtime.normal_message_path_integrated -eq $true) 'normal A000 message path remains integrated'
Check ($Msg.payload.unified_runtime.production_action_executed -eq $false) 'message path production actions zero'
Check ($Msg.payload.unified_runtime.target_write_executed -eq $false) 'message path target writes zero'

Write-Host ""
Write-Host "A000_LIFECYCLE_RUNTIME_SCHEMA_029C live HTTP qualification passed." -ForegroundColor Green
