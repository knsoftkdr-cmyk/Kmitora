$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$File = Join-Path $Root "frontend\src\services\devValidation.ts"
Write-Host "=== KMITORA VALIDATION_STORAGE_001 verification ==="
if (-not (Test-Path $File)) { throw "Missing: $File" }
$Text = Get-Content $File -Raw

function Pass($name) { Write-Host "PASS  $name" -ForegroundColor Green }
function Fail($name) { throw "FAIL  $name" }

if ($Text -match 'VALIDATION_STORAGE_001') { Pass 'Patch marker' } else { Fail 'Patch marker' }
if ($Text -match 'compactValidationEvidence') { Pass 'Compact certificate' } else { Fail 'Compact certificate' }
if ($Text -match 'localStorage\.removeItem\(VALIDATION_KEY\)') { Pass 'Legacy oversized key cleanup' } else { Fail 'Legacy oversized key cleanup' }
if ($Text -match 'Browser cache is non-authoritative') { Pass 'Quota failure isolation' } else { Fail 'Quota failure isolation' }
if ($Text -notmatch 'localStorage\.setItem\(COMPAT_KEY,\s*JSON\.stringify\(updated\)\)') { Pass 'No full discovery rewrite' } else { Fail 'No full discovery rewrite' }

# VALIDATION_STORAGE_001A: verify what is actually persisted, not what exists in the in-memory result.
# The full result intentionally keeps quality_findings and record_dispositions for live validation UI use.
# Only the object passed to localStorage.setItem(VALIDATION_KEY, ...) must be compact.
if ($Text -match 'localStorage\.setItem\(VALIDATION_KEY,\s*JSON\.stringify\(compactValidationEvidence\)\)') {
    Pass 'Validation cache writes compact certificate only'
} else {
    Fail 'Validation cache writes compact certificate only'
}

$CompactMatch = [regex]::Match($Text, '(?s)const\s+compactValidationEvidence\s*=\s*\{(.*?)\n\s*\};\s*\n\s*try\s*\{')
if (-not $CompactMatch.Success) { Fail 'Compact certificate body detectable' }
$CompactBody = $CompactMatch.Groups[1].Value

if ($CompactBody -notmatch '(?m)^\s*quality_findings\s*:\s*findings\s*,') {
    Pass 'No full validation findings in browser certificate'
} else {
    Fail 'No full validation findings in browser certificate'
}

if ($CompactBody -notmatch '(?m)^\s*record_dispositions\s*:\s*dispositions\s*,') {
    Pass 'No full disposition list in browser certificate'
} else {
    Fail 'No full disposition list in browser certificate'
}

if ($CompactBody -notmatch '(?m)^\s*validation_evidence\s*:\s*validationEvidence\s*,') {
    Pass 'No full validation evidence list in browser certificate'
} else {
    Fail 'No full validation evidence list in browser certificate'
}

if ($CompactBody -match 'quality_findings\s*:\s*findings\.length' -and
    $CompactBody -match 'record_dispositions\s*:\s*dispositions\.length' -and
    $CompactBody -match 'validation_evidence\s*:\s*validationEvidence\.length') {
    Pass 'Compact evidence counts retained'
} else {
    Fail 'Compact evidence counts retained'
}

Write-Host "VALIDATION_STORAGE_001 code verification passed." -ForegroundColor Green
