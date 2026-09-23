from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = (ROOT / 'backend/main_api/F1033_server.py').read_text(encoding='utf-8')
TARGET = (ROOT / 'backend/target_api/kmitora_target_api.py').read_text(encoding='utf-8')
MIGRATE = (ROOT / 'frontend/src/pages/Migrate.tsx').read_text(encoding='utf-8')


def test_explicit_dev_dry_run_ui():
    assert 'Run DEV Dry Run' in MIGRATE
    assert 'const dryRunAllowed' in MIGRATE
    assert 'const devLoadAllowed' in MIGRATE
    assert 'Execute DEV Replace-Load' in MIGRATE


def test_review_records_do_not_block_dry_run():
    dry_gate = MIGRATE.split('const dryRunAllowed =', 1)[1].split('const devLoadAllowed', 1)[0]
    assert 'review.length === 0' not in dry_gate
    assert 'quarantine.length === 0' not in dry_gate
    assert 'rejected.length === 0' not in dry_gate
    assert 'totalPlannedRecords > 0' in dry_gate


def test_backend_preserves_held_dispositions_in_dry_run():
    assert 'held_record_count' in MAIN
    assert 'PASS_WITH_HELD_RECORDS' in MAIN
    assert 'review_records_written": False' in MAIN
    assert 'quarantine_records_written": False' in MAIN
    assert 'rejected_records_written": False' in MAIN


def test_target_replace_load_requires_dry_run_evidence():
    assert 'Governed DEV execution evidence is required before replace-load.' in TARGET
    assert 'dry_run_status != "DRY_RUN_COMPLETED"' in TARGET
    assert 'migration_id, approval_id and execution_id are required' in TARGET


def test_target_mapping_is_discovery_driven_not_prefix_driven():
    assert 'resolve the target table from the authoritative' in MIGRATE
    helper = MIGRATE.split('function tableNameFromEntity', 1)[1].split('async function writeReadyRecordsToTarget', 1)[0]
    assert '"target_" + name' not in helper
    assert 'mapping?.target' in helper


def test_universal_certification_not_embedded_in_migration_execution_flow():
    assert '<DevE2ECertificationPanel' not in MIGRATE
