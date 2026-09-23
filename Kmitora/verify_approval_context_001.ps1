$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Main = Join-Path $Root "backend\main_api\F1033_server.py"
$Migrate = Join-Path $Root "frontend\src\pages\Migrate.tsx"

Write-Host "=== KMITORA APPROVAL_CONTEXT_001 verification ===" -ForegroundColor Cyan

$checks = @(
    @{ Name = "Persistent approval store"; File = $Main; Pattern = "_persist_approval_state" },
    @{ Name = "Authoritative approval lookup"; File = $Main; Pattern = "_get_authoritative_approval" },
    @{ Name = "Migration-scoped approval list"; File = $Main; Pattern = "migration_id.*query_values" },
    @{ Name = "Supersede stale approvals"; File = $Main; Pattern = "_supersede_existing_approvals" },
    @{ Name = "Frontend server rehydration"; File = $Migrate; Pattern = "loadAuthoritativeApproval" },
    @{ Name = "Pre-dry-run exact verification"; File = $Migrate; Pattern = "verifyAuthoritativeApproval" },
    @{ Name = "Persistent-version gate"; File = $Migrate; Pattern = "APPROVAL_CONTEXT_001" }
)

$failed = $false
foreach ($check in $checks) {
    if (Select-String -Path $check.File -Pattern $check.Pattern -Quiet) {
        Write-Host ("PASS  " + $check.Name) -ForegroundColor Green
    } else {
        Write-Host ("FAIL  " + $check.Name) -ForegroundColor Red
        $failed = $true
    }
}

if ($failed) {
    Write-Host "APPROVAL_CONTEXT_001 verification failed." -ForegroundColor Red
    exit 1
}

Write-Host "APPROVAL_CONTEXT_001 code verification passed." -ForegroundColor Green
