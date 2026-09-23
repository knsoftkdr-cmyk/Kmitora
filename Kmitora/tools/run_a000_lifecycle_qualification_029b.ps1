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
        if ($Method -eq 'GET') {
            return Invoke-RestMethod ($Base + $Path) -Method Get -TimeoutSec 15
        }
        $Json = $Body | ConvertTo-Json -Depth 20
        return Invoke-RestMethod ($Base + $Path) -Method Post -ContentType 'application/json' -Body $Json -TimeoutSec 15
    }
    catch [System.Net.WebException] {
        # Guarded lifecycle endpoints may intentionally return 4xx when mandatory
        # execution identity/approval is absent. Qualification still needs to
        # inspect the A000 envelope and 029 lifecycle projection without turning
        # the guard rejection into a script failure.
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
        [Parameter(Mandatory=$true)][string]$Label
    )
    $P = $Response.payload
    Check ($null -ne $P) "payload present: $Label"
    $L = $P.lifecycle_runtime
    Check ($null -ne $L) "lifecycle runtime present: $Label"
    Check ($L.patch_id -eq 'A000_LIFECYCLE_UNIFIED_RUNTIME_029') "029 active: $Label"
    Check ([string]$L.stage -eq $Stage) "stage mapped $Stage"
    Check ([string]$L.mode -eq 'PLAN_ONLY') "PLAN_ONLY $Stage"
    Check ([string]$L.execution_authority -eq 'NONE') "execution authority NONE $Stage"
    Check ($L.source_write_executed -eq $false) "source writes zero $Stage"
    Check ($L.target_write_executed -eq $false) "target writes zero $Stage"
    Check ($L.production_action_executed -eq $false) "production actions zero $Stage"
    Check ($L.cutover_executed -eq $false) "cutover zero $Stage"
}

Write-Host "=== KMITORA A000 LIFECYCLE HTTP QUALIFICATION 029B ===" -ForegroundColor Cyan

$Health = Invoke-KmitoraJson -Path '/health' -Method GET
Check ($null -ne $Health) 'Core health responds'

# DETECT: existing issues route, fully read-only.
$Detect = Invoke-KmitoraJson -Path '/v1/issues' -Method GET
Check-LifecycleRuntime -Response $Detect -Stage 'DETECT' -Label '/v1/issues'

# EXECUTE: deliberately exercise the existing governed migration gate with an
# incomplete request. A 400 migration_gate_error is EXPECTED and proves that:
#   1) the authoritative execution guard remains intact,
#   2) 029 still projects EXECUTE lifecycle runtime onto the response,
#   3) no target/production write can occur during qualification.
$Execute = Invoke-KmitoraJson -Path '/v1/migrations' -Method POST -Body @{}
Check ([string]$Execute.kind -eq 'migration_gate_error') 'Execute guard rejects missing migration identity'
Check ([string]$Execute.payload.message -eq 'migration_id is required') 'Execute guard requires migration_id'
Check-LifecycleRuntime -Response $Execute -Stage 'EXECUTE' -Label '/v1/migrations guarded rejection'

# TEST: candidate/read-only operational path.
$Test = Invoke-KmitoraJson -Path '/v1/tests' -Method POST -Body @{ qualification = '029B'; mode = 'READ_ONLY' }
Check-LifecycleRuntime -Response $Test -Stage 'TEST' -Label '/v1/tests'

# EVIDENCE: candidate/read-only path.
$Evidence = Invoke-KmitoraJson -Path '/v1/evidence' -Method POST -Body @{ qualification = '029B'; mode = 'READ_ONLY' }
Check-LifecycleRuntime -Response $Evidence -Stage 'EVIDENCE' -Label '/v1/evidence'

# Regression: normal A000 message runtime from 027/028A must remain active.
$MsgBody = @{ message = 'Explain the current KMITORA DEV migration state without performing any write.' } | ConvertTo-Json -Depth 10
$Msg = Invoke-RestMethod ($Base + '/v1/a000/messages') -Method Post -ContentType 'application/json' -Body $MsgBody -TimeoutSec 15
Check ($null -ne $Msg.payload.unified_runtime) '027 unified runtime remains present'
Check ($Msg.payload.unified_runtime.normal_message_path_integrated -eq $true) 'normal A000 message path remains integrated'
Check ($Msg.payload.unified_runtime.production_action_executed -eq $false) 'message path production actions zero'
Check ($Msg.payload.unified_runtime.target_write_executed -eq $false) 'message path target writes zero'

Write-Host "" 
Write-Host "A000_LIFECYCLE_UNIFIED_RUNTIME_029B live HTTP qualification passed." -ForegroundColor Green
