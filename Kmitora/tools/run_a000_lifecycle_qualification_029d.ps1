$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Base = 'http://127.0.0.1:8080'

function Pass([string]$Message) {
    Write-Host ("PASS  " + $Message) -ForegroundColor Green
}

function Fail([string]$Message) {
    throw $Message
}

function Has-Property($Object, [string]$Name) {
    return ($null -ne $Object) -and ($Object.PSObject.Properties.Name -contains $Name)
}

function Invoke-KmitoraJson {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [ValidateSet('GET','POST')][string]$Method = 'GET',
        $Body = $null
    )

    $Uri = $Base + $Path
    try {
        if ($Method -eq 'POST') {
            $Json = if ($null -eq $Body) { '{}' } else { $Body | ConvertTo-Json -Depth 30 }
            return Invoke-RestMethod -Uri $Uri -Method Post -ContentType 'application/json' -Body $Json -TimeoutSec 20 -ErrorAction Stop
        }
        return Invoke-RestMethod -Uri $Uri -Method Get -TimeoutSec 20 -ErrorAction Stop
    }
    catch {
        $raw = $null
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $raw = $_.ErrorDetails.Message
        }

        if ([string]::IsNullOrWhiteSpace($raw) -and $_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $raw = $reader.ReadToEnd()
                    $reader.Dispose()
                    $stream.Dispose()
                }
            }
            catch {}
        }

        if ([string]::IsNullOrWhiteSpace($raw)) {
            throw
        }

        try {
            return ($raw | ConvertFrom-Json -ErrorAction Stop)
        }
        catch {
            throw "HTTP error response from $Path was not valid JSON: $raw"
        }
    }
}

function Check-LifecycleRuntime {
    param(
        [Parameter(Mandatory=$true)]$Response,
        [Parameter(Mandatory=$true)][string]$Stage,
        [Parameter(Mandatory=$true)][string]$Label,
        [int]$ExpectedStatus = 200,
        [switch]$ExpectGuarded
    )

    if (-not (Has-Property $Response 'payload')) { Fail "payload missing: $Label" }
    Pass "payload present: $Label"

    $Payload = $Response.payload
    if (-not (Has-Property $Payload 'lifecycle_runtime')) { Fail "lifecycle runtime missing: $Label" }
    Pass "lifecycle runtime present: $Label"

    $L = $Payload.lifecycle_runtime
    if ($L.patch_id -ne 'A000_LIFECYCLE_UNIFIED_RUNTIME_029') { Fail "029 not active: $Label" }
    Pass "029 active: $Label"

    if ((Has-Property $L 'hardening_patch_id') -and $L.hardening_patch_id -eq 'A000_LIFECYCLE_RUNTIME_SCHEMA_029C') {
        Pass "029C schema active: $Label"
    }

    if ([string]$L.stage -ne $Stage) { Fail "stage mismatch $Label expected=$Stage actual=$($L.stage)" }
    Pass "stage mapped $Stage"

    if ([string]$L.mode -ne 'PLAN_ONLY') { Fail "mode changed for ${Stage}: $($L.mode)" }
    Pass "PLAN_ONLY $Stage"

    if ([int]$L.response_status_code -ne $ExpectedStatus) { Fail "response status mismatch $Stage expected=$ExpectedStatus actual=$($L.response_status_code)" }
    Pass "response status projected $ExpectedStatus $Stage"

    if ($ExpectGuarded) {
        if ($L.guarded_or_error_response -ne $true) { Fail "guarded response flag missing $Stage" }
        Pass "guarded response preserved $Stage"
    }

    if (-not (Has-Property $L 'safety')) { Fail "safety envelope missing $Stage" }
    Pass "safety envelope present $Stage"

    $S = $L.safety
    if ([string]$S.execution_authority -ne 'NONE') { Fail "execution authority changed $Stage" }
    Pass "execution authority NONE $Stage"

    if ($S.source_write_executed -ne $false) { Fail "source write detected $Stage" }
    Pass "source writes zero $Stage"

    if ($S.target_write_executed -ne $false) { Fail "target write detected $Stage" }
    Pass "target writes zero $Stage"

    if ($S.production_action_executed -ne $false) { Fail "production action detected $Stage" }
    Pass "production actions zero $Stage"

    if ($S.cutover_executed -ne $false) { Fail "cutover detected $Stage" }
    Pass "cutover zero $Stage"
}

Write-Host '=== KMITORA A000 LIFECYCLE HTTP QUALIFICATION 029D ===' -ForegroundColor Cyan

$Health = Invoke-KmitoraJson -Path '/health' -Method GET
if (-not (Has-Property $Health 'payload')) { Fail 'Core health payload missing' }
if ([string]$Health.payload.status -ne 'UP') { Fail "Core health is not UP: $($Health.payload.status)" }
Pass 'Core health responds'

$Detect = Invoke-KmitoraJson -Path '/v1/issues' -Method GET
Check-LifecycleRuntime -Response $Detect -Stage 'DETECT' -Label '/v1/issues' -ExpectedStatus 200

$ExecuteGuard = Invoke-KmitoraJson -Path '/v1/migrations' -Method POST -Body @{}
if ([string]$ExecuteGuard.kind -ne 'migration_gate_error') { Fail "Expected migration_gate_error, got $($ExecuteGuard.kind)" }
Pass 'guarded Execute rejects missing migration_id'
Check-LifecycleRuntime -Response $ExecuteGuard -Stage 'EXECUTE' -Label '/v1/migrations guarded 400' -ExpectedStatus 400 -ExpectGuarded

$Test = Invoke-KmitoraJson -Path '/v1/tests' -Method POST -Body @{
    test_type = 'LIFECYCLE_RUNTIME_029D_QUALIFICATION'
    read_only = $true
}

if ([string]$Test.kind -ne 'test_error') {
    Fail "Expected test_error, got $($Test.kind)"
}

if ([string]$Test.payload.message -ne 'execution_id is required') {
    Fail "Unexpected TEST guard message: $($Test.payload.message)"
}

Pass 'guarded TEST rejects missing execution_id'

Check-LifecycleRuntime `
    -Response $Test `
    -Stage 'TEST' `
    -Label '/v1/tests guarded 400' `
    -ExpectedStatus 400 `
    -ExpectGuarded

$Evidence = Invoke-KmitoraJson -Path '/v1/evidence' -Method POST -Body @{
    purpose = 'LIFECYCLE_RUNTIME_029D_QUALIFICATION'
    read_only = $true
}

if ([string]$Evidence.kind -ne 'evidence_error') {
    Fail "Expected evidence_error, got $($Evidence.kind)"
}

if ([string]$Evidence.payload.message -ne 'reconciliation_id is required') {
    Fail "Unexpected EVIDENCE guard message: $($Evidence.payload.message)"
}

Pass 'guarded EVIDENCE rejects missing reconciliation_id'

Check-LifecycleRuntime `
    -Response $Evidence `
    -Stage 'EVIDENCE' `
    -Label '/v1/evidence guarded 400' `
    -ExpectedStatus 400 `
    -ExpectGuarded

$Message = Invoke-KmitoraJson -Path '/v1/a000/messages' -Method POST -Body @{ message = 'Plan a PostgreSQL to SQL Server migration in DEV only, no writes.' }
if (-not (Has-Property $Message 'payload')) { Fail 'A000 message payload missing' }
if (-not (Has-Property $Message.payload 'unified_runtime')) { Fail '027 unified runtime missing from A000 message path' }
Pass '027 unified runtime remains active on normal A000 message path'

$U = $Message.payload.unified_runtime
if ([string]$U.mode -ne 'PLAN_ONLY') { Fail '027 runtime no longer PLAN_ONLY' }
if ($U.safety.target_write_executed -ne $false) { Fail '027 target write detected' }
if ($U.safety.production_action_executed -ne $false) { Fail '027 production action detected' }
Pass '027 safety unchanged'

Write-Host ''
Write-Host 'A000_LIFECYCLE_QUALIFICATION_029D live HTTP qualification passed.' -ForegroundColor Green
