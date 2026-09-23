$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"

Write-Host "=== KMITORA DEV_DRY_RUN_001 verification ===" -ForegroundColor Cyan

$checks = @(
    @{ Path = "$Root\frontend\src\pages\Migrate.tsx"; Pattern = "Run DEV Dry Run"; Name = "Dry-run UI" },
    @{ Path = "$Root\frontend\src\pages\Migrate.tsx"; Pattern = "Execute DEV Replace-Load"; Name = "Separate DEV load UI" },
    @{ Path = "$Root\backend\main_api\F1033_server.py"; Pattern = "PASS_WITH_HELD_RECORDS"; Name = "Dry-run held-record backend" },
    @{ Path = "$Root\backend\target_api\kmitora_target_api.py"; Pattern = "Governed DEV execution evidence is required before replace-load"; Name = "Target API execution proof" }
)

$failed = $false
foreach ($check in $checks) {
    if ((Test-Path $check.Path) -and (Select-String -Path $check.Path -Pattern $check.Pattern -Quiet)) {
        Write-Host "PASS  $($check.Name)" -ForegroundColor Green
    } else {
        Write-Host "FAIL  $($check.Name)" -ForegroundColor Red
        $failed = $true
    }
}

$listeners = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if ($listeners) {
    $owners = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    Write-Host "Port 8080 listener PID(s): $($owners -join ', ')" -ForegroundColor Yellow
} else {
    Write-Host "Port 8080 currently has no listener." -ForegroundColor Yellow
}

if ($failed) { exit 1 }
Write-Host "DEV_DRY_RUN_001 code verification passed." -ForegroundColor Green
