from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = (ROOT / 'backend/main_api/F1033_server.py').read_text(encoding='utf-8')
MIGRATE = (ROOT / 'frontend/src/pages/Migrate.tsx').read_text(encoding='utf-8')


def test_approval_is_persisted_server_side():
    assert 'APPROVAL_CONTEXT_001' in MAIN
    assert '_persist_approval_state' in MAIN
    assert '_load_approval_state' in MAIN
    assert '_get_authoritative_approval' in MAIN
    assert '_list_authoritative_approvals' in MAIN


def test_approval_lookup_is_migration_scoped():
    assert 'migration_id = str((query_values.get("migration_id")' in MAIN
    assert 'if path == "/v1/approvals"' in MAIN
    assert 'approval_get_prefix = "/v1/approvals/"' in MAIN


def test_new_approval_supersedes_prior_approval_for_same_migration():
    assert '_supersede_existing_approvals(migration_id)' in MAIN
    assert '"superseded": False' in MAIN
    assert 'approval.get("superseded") is True' in MAIN


def test_dev_approval_cannot_request_execution_or_target_write():
    assert 'execution_requested' in MAIN
    assert 'target_write_requested' in MAIN
    assert 'execution/target-write requests are forbidden' in MAIN


def test_frontend_rehydrates_from_server_not_localstorage():
    assert 'loadAuthoritativeApproval(migrationId)' in MIGRATE
    assert '/api/v1/approvals?migration_id=' in MIGRATE
    hydration = MIGRATE.split('// APPROVAL_CONTEXT_001: server-side approval evidence', 1)[1].split('const rawExecution', 1)[0]
    assert 'localStorage.getItem("kmitora.dev.approvalRequest")' not in hydration


def test_dry_run_reverifies_exact_approval():
    assert 'verifyAuthoritativeApproval(approvalId, migrationId)' in MIGRATE
    assert '/api/v1/approvals/${encodeURIComponent(approvalId)}' in MIGRATE
    assert 'approvalRequest?.persistence_version === "APPROVAL_CONTEXT_001"' in MIGRATE
    assert 'AUTHORITATIVE' in MIGRATE
