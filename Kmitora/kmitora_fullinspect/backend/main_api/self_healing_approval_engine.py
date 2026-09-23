from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Any
import json
import uuid


ENGINE_VERSION = "1.0.0"

ALLOWED_ENVIRONMENTS = {
    "DEV",
    "QA",
    "UAT",
    "PREPROD",
}

PRODUCTION_ENVIRONMENTS = {
    "PROD",
    "PRODUCTION",
}

RISK_LEVELS = {
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL",
}

AUTHORITY_LEVELS = {
    "L0_OBSERVE": 0,
    "L1_RECOMMEND": 1,
    "L2_SIMULATE": 2,
    "L3_PREPARE_EXECUTION": 3,
    "L4_CONTROLLED_NONPROD": 4,
    "L5_PRODUCTION": 5,
}

CURRENT_MAX_AUTHORITY = "L3_PREPARE_EXECUTION"

RISK_WEIGHTS = {
    "LOW": 20,
    "MEDIUM": 45,
    "HIGH": 75,
    "CRITICAL": 100,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _stable_json(value: Any) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
        default=str,
    )


def _hash(value: Any) -> str:
    return sha256(
        _stable_json(value).encode("utf-8")
    ).hexdigest()


def _bounded(
    value: Any,
    low: float = 0.0,
    high: float = 100.0,
) -> float:
    try:
        numeric = float(value)
    except Exception:
        numeric = low

    return max(
        low,
        min(high, numeric),
    )


def _safety() -> dict[str, Any]:
    return {
        "authoritative": False,
        "read_only": True,
        "simulation_only": True,
        "approval_package_only": True,
        "execution_authorized": False,
        "source_write_executed": False,
        "target_write_executed": False,
        "remediation_executed": False,
        "production_action_executed": False,
        "cutover_executed": False,
    }


def _normalize_environment(
    environment: Any
) -> str:

    env = str(
        environment
        or "DEV"
    ).upper().strip()

    return env


def _normalize_risk(
    risk: Any
) -> str:

    normalized = str(
        risk
        or "MEDIUM"
    ).upper().strip()

    if normalized not in RISK_LEVELS:
        normalized = "MEDIUM"

    return normalized


def propose_fix(
    payload: dict[str, Any]
) -> dict[str, Any]:

    issue = payload.get(
        "issue"
    )

    if not isinstance(issue, dict):
        raise ValueError(
            "issue is required"
        )

    root_cause = payload.get(
        "root_cause"
    ) or {}

    if not isinstance(root_cause, dict):
        raise ValueError(
            "root_cause must be an object"
        )

    environment = _normalize_environment(
        payload.get("environment")
    )

    asset_scope = sorted(
        {
            str(item).strip()
            for item in (
                payload.get(
                    "asset_scope"
                )
                or []
            )
            if str(item).strip()
        }
    )

    root_domain = str(
        root_cause.get("domain")
        or issue.get("domain")
        or "UNKNOWN"
    ).upper()

    root_confidence = _bounded(
        root_cause.get(
            "confidence",
            0,
        )
    )

    fix_title = str(
        payload.get("fix_title")
        or ""
    ).strip()

    if not fix_title:

        templates = {
            "DATA": (
                "Repair authoritative data and replay affected dependency scope"
            ),
            "MIGRATION": (
                "Correct migration sequencing or transformation and replay affected scope"
            ),
            "DATABASE": (
                "Correct validated database configuration or constraint defect"
            ),
            "API": (
                "Restore compatible API contract or routing"
            ),
            "BUSINESS_RULE": (
                "Restore verified Business Rule DNA behavior"
            ),
            "APPLICATION": (
                "Correct verified failing application path"
            ),
            "INFRASTRUCTURE": (
                "Restore validated infrastructure capacity or configuration"
            ),
            "SECURITY": (
                "Apply approved least-privilege security correction"
            ),
        }

        fix_title = templates.get(
            root_domain,
            (
                "Collect additional evidence and prepare bounded remediation"
            ),
        )

    fix_id = (
        "HEALFIX-"
        + uuid.uuid4().hex[:12].upper()
    )

    remediation_plan = {
        "fix_id": fix_id,
        "title": fix_title,
        "environment": environment,
        "asset_scope": asset_scope,
        "root_cause_domain": (
            root_domain
        ),
        "root_cause_confidence": (
            root_confidence
        ),
        "proposed_change": deepcopy(
            payload.get(
                "proposed_change"
            )
            or {}
        ),
        "preconditions": list(
            payload.get(
                "preconditions"
            )
            or []
        ),
        "expected_outcomes": list(
            payload.get(
                "expected_outcomes"
            )
            or []
        ),
        "rollback_conditions": list(
            payload.get(
                "rollback_conditions"
            )
            or []
        ),
        "generated_at": _now_iso(),
    }

    fix_hash = _hash(
        remediation_plan
    )

    return {
        "proposal_id": (
            "HEALPROP-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "status": (
            "FIX_PROPOSED"
        ),
        "fix": remediation_plan,
        "fix_hash_sha256": (
            fix_hash
        ),
        "execution_authorized": False,
        "safety": _safety(),
    }


def assess_risk(
    payload: dict[str, Any]
) -> dict[str, Any]:

    environment = _normalize_environment(
        payload.get("environment")
    )

    blast_radius = _bounded(
        payload.get(
            "blast_radius_score",
            0,
        )
    )

    root_cause_confidence = _bounded(
        payload.get(
            "root_cause_confidence",
            0,
        )
    )

    rollback_readiness = _bounded(
        payload.get(
            "rollback_readiness",
            0,
        )
    )

    test_coverage = _bounded(
        payload.get(
            "test_coverage",
            0,
        )
    )

    business_criticality = _bounded(
        payload.get(
            "business_criticality",
            50,
        )
    )

    production_penalty = (
        100.0
        if environment
        in PRODUCTION_ENVIRONMENTS
        else 0.0
    )

    uncertainty_penalty = (
        100.0
        - root_cause_confidence
    )

    rollback_penalty = (
        100.0
        - rollback_readiness
    )

    coverage_penalty = (
        100.0
        - test_coverage
    )

    score = (
        blast_radius * 0.25
        + business_criticality * 0.20
        + uncertainty_penalty * 0.20
        + rollback_penalty * 0.15
        + coverage_penalty * 0.10
        + production_penalty * 0.10
    )

    score = round(
        _bounded(score),
        2,
    )

    if score >= 85:
        risk = "CRITICAL"
    elif score >= 65:
        risk = "HIGH"
    elif score >= 35:
        risk = "MEDIUM"
    else:
        risk = "LOW"

    if risk == "LOW":
        required_authority = (
            "L3_PREPARE_EXECUTION"
        )
    elif risk == "MEDIUM":
        required_authority = (
            "L4_CONTROLLED_NONPROD"
        )
    else:
        required_authority = (
            "L5_PRODUCTION"
        )

    return {
        "risk_analysis_id": (
            "HEALRISK-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "risk_score": score,
        "risk_level": risk,
        "required_authority": (
            required_authority
        ),
        "current_max_authority": (
            CURRENT_MAX_AUTHORITY
        ),
        "execution_possible_now": (
            AUTHORITY_LEVELS[
                CURRENT_MAX_AUTHORITY
            ]
            >= AUTHORITY_LEVELS[
                required_authority
            ]
            and environment
            in ALLOWED_ENVIRONMENTS
        ),
        "factors": {
            "blast_radius_score": (
                blast_radius
            ),
            "business_criticality": (
                business_criticality
            ),
            "root_cause_confidence": (
                root_cause_confidence
            ),
            "rollback_readiness": (
                rollback_readiness
            ),
            "test_coverage": (
                test_coverage
            ),
            "production_penalty": (
                production_penalty
            ),
        },
        "safety": _safety(),
    }


def calculate_healing_confidence(
    payload: dict[str, Any]
) -> dict[str, Any]:

    root_cause = _bounded(
        payload.get(
            "root_cause_confidence",
            0,
        )
    )

    fix_confidence = _bounded(
        payload.get(
            "fix_confidence",
            0,
        )
    )

    simulation_success = _bounded(
        payload.get(
            "simulation_success",
            0,
        )
    )

    test_coverage = _bounded(
        payload.get(
            "test_coverage",
            0,
        )
    )

    rollback_readiness = _bounded(
        payload.get(
            "rollback_readiness",
            0,
        )
    )

    evidence_completeness = _bounded(
        payload.get(
            "evidence_completeness",
            0,
        )
    )

    score = (
        root_cause * 0.20
        + fix_confidence * 0.20
        + simulation_success * 0.20
        + test_coverage * 0.15
        + rollback_readiness * 0.15
        + evidence_completeness * 0.10
    )

    score = round(
        score,
        2,
    )

    if score >= 90:
        status = "HIGH_CONFIDENCE"
    elif score >= 80:
        status = "ACCEPTABLE_CONFIDENCE"
    elif score >= 65:
        status = "REVIEW_REQUIRED"
    else:
        status = "BLOCKED_LOW_CONFIDENCE"

    return {
        "confidence_id": (
            "HEALCONF-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "healing_confidence": score,
        "status": status,
        "minimum_execution_threshold": 80,
        "execution_confidence_gate_passed": (
            score >= 80
        ),
        "safety": _safety(),
    }


def detect_conflicts(
    payload: dict[str, Any]
) -> dict[str, Any]:

    active_actions = payload.get(
        "active_actions"
    ) or []

    target_assets = {
        str(item).strip()
        for item in (
            payload.get(
                "asset_scope"
            )
            or []
        )
        if str(item).strip()
    }

    conflicts = []

    for action in active_actions:

        if not isinstance(
            action,
            dict,
        ):
            continue

        action_assets = {
            str(item).strip()
            for item in (
                action.get(
                    "asset_scope"
                )
                or []
            )
            if str(item).strip()
        }

        overlap = sorted(
            target_assets
            & action_assets
        )

        if overlap:

            conflicts.append(
                {
                    "action_id": (
                        action.get(
                            "action_id"
                        )
                    ),
                    "action_type": (
                        action.get(
                            "action_type"
                        )
                    ),
                    "status": (
                        action.get(
                            "status"
                        )
                    ),
                    "overlapping_assets": (
                        overlap
                    ),
                }
            )

    return {
        "conflict_check_id": (
            "HEALCONFLICT-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "conflict_count": len(
            conflicts
        ),
        "conflicts": conflicts,
        "execution_blocked": (
            len(conflicts) > 0
        ),
        "safety": _safety(),
    }


def simulate_fix(
    payload: dict[str, Any]
) -> dict[str, Any]:

    fix = payload.get(
        "fix"
    )

    if not isinstance(fix, dict):
        raise ValueError(
            "fix is required"
        )

    environment = _normalize_environment(
        fix.get(
            "environment"
        )
        or payload.get(
            "environment"
        )
    )

    if environment in PRODUCTION_ENVIRONMENTS:

        return {
            "simulation_id": (
                "HEALSIM-"
                + uuid.uuid4().hex[:12].upper()
            ),
            "status": (
                "PRODUCTION_SIMULATION_ONLY"
            ),
            "environment": environment,
            "real_execution_allowed": False,
            "predicted_outcome": deepcopy(
                payload.get(
                    "predicted_outcome"
                )
                or {}
            ),
            "safety": _safety(),
        }

    test_results = payload.get(
        "test_results"
    ) or []

    failures = [
        item
        for item in test_results
        if isinstance(item, dict)
        and str(
            item.get(
                "status"
            )
            or ""
        ).upper()
        not in {
            "PASS",
            "PASSED",
            "OK",
        }
    ]

    status = (
        "SIMULATION_PASS"
        if not failures
        else "SIMULATION_FAIL"
    )

    return {
        "simulation_id": (
            "HEALSIM-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "status": status,
        "environment": environment,
        "fix_hash_sha256": (
            _hash(fix)
        ),
        "test_count": len(
            test_results
        ),
        "failure_count": len(
            failures
        ),
        "failures": failures,
        "predicted_outcome": deepcopy(
            payload.get(
                "predicted_outcome"
            )
            or {}
        ),
        "digital_twin_replay": (
            "REQUIRED"
        ),
        "what_breaks_if": (
            "REQUIRED"
        ),
        "business_rule_dna_check": (
            "REQUIRED"
        ),
        "real_execution_allowed": False,
        "safety": _safety(),
    }


def build_test_plan(
    payload: dict[str, Any]
) -> dict[str, Any]:

    domain = str(
        payload.get(
            "domain"
        )
        or "UNKNOWN"
    ).upper()

    common_tests = [
        "Reproduce original failure",
        "Validate root cause",
        "Run What Breaks If blast-radius analysis",
        "Validate Business Rule DNA preservation",
        "Run Digital Twin Replay",
        "Run deterministic regression tests",
        "Validate rollback readiness",
        "Validate Evidence-by-Design completeness",
    ]

    domain_tests = {
        "DATA": [
            "Validate business keys",
            "Validate referential integrity",
            "Validate data quality",
            "Run source/target reconciliation",
        ],
        "MIGRATION": [
            "Validate dependency wave order",
            "Validate mappings",
            "Validate transformations",
            "Replay affected migration scope",
        ],
        "DATABASE": [
            "Validate constraints",
            "Validate query behavior",
            "Validate connection health",
            "Validate lock behavior",
        ],
        "API": [
            "Validate API contract",
            "Validate authentication",
            "Validate response codes",
            "Validate latency thresholds",
        ],
        "BUSINESS_RULE": [
            "Compare F1/F2 rule fingerprints",
            "Run behavioral equivalence tests",
            "Validate business outcomes",
        ],
        "APPLICATION": [
            "Run unit tests",
            "Run integration tests",
            "Run failing-path regression",
        ],
        "SECURITY": [
            "Validate least privilege",
            "Validate identity policy",
            "Validate certificates and secrets",
            "Run security regression",
        ],
    }

    tests = (
        common_tests
        + domain_tests.get(
            domain,
            [],
        )
    )

    return {
        "test_plan_id": (
            "HEALTEST-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "domain": domain,
        "test_count": len(
            tests
        ),
        "tests": tests,
        "all_tests_mandatory": True,
        "pre_execution_required": True,
        "post_execution_required": True,
        "safety": _safety(),
    }


def build_canary_plan(
    payload: dict[str, Any]
) -> dict[str, Any]:

    scope_size = int(
        payload.get(
            "scope_size",
            1,
        )
    )

    scope_size = max(
        1,
        scope_size,
    )

    if scope_size <= 10:

        stages = [
            {
                "stage": 1,
                "percentage": 100,
                "validation_required": True,
            }
        ]

    else:

        stages = [
            {
                "stage": 1,
                "percentage": 1,
                "validation_required": True,
            },
            {
                "stage": 2,
                "percentage": 10,
                "validation_required": True,
            },
            {
                "stage": 3,
                "percentage": 25,
                "validation_required": True,
            },
            {
                "stage": 4,
                "percentage": 100,
                "validation_required": True,
            },
        ]

    return {
        "canary_plan_id": (
            "HEALCANARY-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "scope_size": scope_size,
        "stages": stages,
        "automatic_promotion": False,
        "approval_required_between_stages": True,
        "safety": _safety(),
    }


def determine_approval_requirement(
    payload: dict[str, Any]
) -> dict[str, Any]:

    environment = _normalize_environment(
        payload.get(
            "environment"
        )
    )

    risk_level = _normalize_risk(
        payload.get(
            "risk_level"
        )
    )

    healing_confidence = _bounded(
        payload.get(
            "healing_confidence",
            0,
        )
    )

    if environment in PRODUCTION_ENVIRONMENTS:

        return {
            "approval_requirement_id": (
                "HEALAPRREQ-"
                + uuid.uuid4().hex[:12].upper()
            ),
            "status": (
                "PRODUCTION_EXECUTION_BLOCKED"
            ),
            "environment": environment,
            "risk_level": risk_level,
            "required_authority": (
                "L5_PRODUCTION"
            ),
            "approval_required": True,
            "execution_available": False,
            "reason": (
                "Production execution is disabled in the current KMITORA build."
            ),
            "safety": _safety(),
        }

    if risk_level == "LOW":

        required_authority = (
            "L3_PREPARE_EXECUTION"
        )

    elif risk_level == "MEDIUM":

        required_authority = (
            "L4_CONTROLLED_NONPROD"
        )

    else:

        required_authority = (
            "L5_PRODUCTION"
        )

    confidence_passed = (
        healing_confidence >= 80
    )

    available = (
        AUTHORITY_LEVELS[
            CURRENT_MAX_AUTHORITY
        ]
        >= AUTHORITY_LEVELS[
            required_authority
        ]
        and confidence_passed
        and environment
        in ALLOWED_ENVIRONMENTS
    )

    return {
        "approval_requirement_id": (
            "HEALAPRREQ-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "status": (
            "APPROVAL_PACKAGE_AVAILABLE"
            if available
            else "EXECUTION_AUTHORITY_NOT_AVAILABLE"
        ),
        "environment": environment,
        "risk_level": risk_level,
        "healing_confidence": (
            healing_confidence
        ),
        "confidence_gate_passed": (
            confidence_passed
        ),
        "required_authority": (
            required_authority
        ),
        "current_max_authority": (
            CURRENT_MAX_AUTHORITY
        ),
        "approval_required": True,
        "execution_available": False,
        "reason": (
            "Stage 1 supports approval preparation only; execution remains disabled."
        ),
        "safety": _safety(),
    }


def create_approval_token(
    payload: dict[str, Any]
) -> dict[str, Any]:

    fix = payload.get(
        "fix"
    )

    if not isinstance(fix, dict):
        raise ValueError(
            "fix is required"
        )

    environment = _normalize_environment(
        payload.get(
            "environment"
        )
        or fix.get(
            "environment"
        )
    )

    approved_by = str(
        payload.get(
            "approved_by"
        )
        or ""
    ).strip()

    if not approved_by:
        raise ValueError(
            "approved_by is required"
        )

    duration_minutes = int(
        payload.get(
            "duration_minutes",
            30,
        )
    )

    duration_minutes = max(
        1,
        min(
            duration_minutes,
            240,
        ),
    )

    issued_at = _now()
    expires_at = (
        issued_at
        + timedelta(
            minutes=duration_minutes
        )
    )

    fix_hash = _hash(
        fix
    )

    asset_scope = sorted(
        {
            str(item).strip()
            for item in (
                fix.get(
                    "asset_scope"
                )
                or []
            )
            if str(item).strip()
        }
    )

    token_material = {
        "approval_id": (
            "HEALAPR-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "fix_id": str(
            fix.get("fix_id")
            or ""
        ),
        "fix_hash_sha256": (
            fix_hash
        ),
        "environment": (
            environment
        ),
        "asset_scope": (
            asset_scope
        ),
        "approved_by": (
            approved_by
        ),
        "approved_at": (
            issued_at.isoformat()
        ),
        "expires_at": (
            expires_at.isoformat()
        ),
        "authority": str(
            payload.get(
                "authority"
            )
            or CURRENT_MAX_AUTHORITY
        ),
        "risk_level": _normalize_risk(
            payload.get(
                "risk_level"
            )
        ),
        "rollback_plan_hash": str(
            payload.get(
                "rollback_plan_hash"
            )
            or ""
        ),
        "test_plan_hash": str(
            payload.get(
                "test_plan_hash"
            )
            or ""
        ),
    }

    approval_hash = _hash(
        token_material
    )

    return {
        **token_material,
        "approval_hash_sha256": (
            approval_hash
        ),
        "status": (
            "APPROVAL_TOKEN_CREATED"
        ),
        "execution_authorized": False,
        "safety": _safety(),
    }


def verify_approval(
    payload: dict[str, Any]
) -> dict[str, Any]:

    approval = payload.get(
        "approval"
    )

    fix = payload.get(
        "fix"
    )

    if not isinstance(
        approval,
        dict,
    ):
        raise ValueError(
            "approval is required"
        )

    if not isinstance(
        fix,
        dict,
    ):
        raise ValueError(
            "fix is required"
        )

    expected_fix_hash = _hash(
        fix
    )

    approved_fix_hash = str(
        approval.get(
            "fix_hash_sha256"
        )
        or ""
    )

    hash_matches = (
        expected_fix_hash
        == approved_fix_hash
    )

    environment = _normalize_environment(
        fix.get(
            "environment"
        )
        or payload.get(
            "environment"
        )
    )

    approval_environment = (
        _normalize_environment(
            approval.get(
                "environment"
            )
        )
    )

    environment_matches = (
        environment
        == approval_environment
    )

    current_scope = sorted(
        {
            str(item).strip()
            for item in (
                fix.get(
                    "asset_scope"
                )
                or []
            )
            if str(item).strip()
        }
    )

    approved_scope = sorted(
        {
            str(item).strip()
            for item in (
                approval.get(
                    "asset_scope"
                )
                or []
            )
            if str(item).strip()
        }
    )

    scope_matches = (
        current_scope
        == approved_scope
    )

    expires_at_raw = str(
        approval.get(
            "expires_at"
        )
        or ""
    )

    expired = True

    if expires_at_raw:

        expires_at = datetime.fromisoformat(
            expires_at_raw.replace(
                "Z",
                "+00:00",
            )
        )

        expired = (
            _now()
            > expires_at
        )

    production_block = (
        environment
        in PRODUCTION_ENVIRONMENTS
    )

    valid = (
        hash_matches
        and environment_matches
        and scope_matches
        and not expired
        and not production_block
    )

    reasons = []

    if not hash_matches:
        reasons.append(
            "FIX_HASH_CHANGED"
        )

    if not environment_matches:
        reasons.append(
            "ENVIRONMENT_MISMATCH"
        )

    if not scope_matches:
        reasons.append(
            "SCOPE_MISMATCH"
        )

    if expired:
        reasons.append(
            "APPROVAL_EXPIRED"
        )

    if production_block:
        reasons.append(
            "PRODUCTION_DISABLED"
        )

    return {
        "approval_verification_id": (
            "HEALAPRVERIFY-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "status": (
            "APPROVAL_VALID"
            if valid
            else "APPROVAL_INVALID"
        ),
        "valid": valid,
        "fix_hash_matches": (
            hash_matches
        ),
        "environment_matches": (
            environment_matches
        ),
        "scope_matches": (
            scope_matches
        ),
        "expired": expired,
        "production_blocked": (
            production_block
        ),
        "reasons": reasons,
        "execution_authorized": False,
        "safety": _safety(),
    }


def build_rollback_plan(
    payload: dict[str, Any]
) -> dict[str, Any]:

    fix = payload.get(
        "fix"
    )

    if not isinstance(
        fix,
        dict,
    ):
        raise ValueError(
            "fix is required"
        )

    triggers = list(
        payload.get(
            "rollback_triggers"
        )
        or [
            "New critical error",
            "Business Rule DNA drift",
            "Reconciliation variance > 0",
            "Regression test failure",
            "Security validation failure",
            "Evidence integrity failure",
        ]
    )

    plan = {
        "rollback_plan_id": (
            "HEALROLLBACK-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "fix_id": str(
            fix.get(
                "fix_id"
            )
            or ""
        ),
        "checkpoint_required": True,
        "rollback_triggers": (
            triggers
        ),
        "verification_required": True,
        "automatic_rollback_allowed": False,
        "manual_or_policy_authorization_required": True,
    }

    return {
        **plan,
        "rollback_plan_hash_sha256": (
            _hash(plan)
        ),
        "safety": _safety(),
    }


def build_execution_package(
    payload: dict[str, Any]
) -> dict[str, Any]:

    fix = payload.get(
        "fix"
    )

    approval = payload.get(
        "approval"
    )

    simulation = payload.get(
        "simulation"
    )

    test_plan = payload.get(
        "test_plan"
    )

    rollback_plan = payload.get(
        "rollback_plan"
    )

    if not isinstance(
        fix,
        dict,
    ):
        raise ValueError(
            "fix is required"
        )

    if not isinstance(
        approval,
        dict,
    ):
        raise ValueError(
            "approval is required"
        )

    verification = verify_approval(
        {
            "approval": approval,
            "fix": fix,
        }
    )

    simulation_passed = (
        isinstance(
            simulation,
            dict,
        )
        and str(
            simulation.get(
                "status"
            )
            or ""
        ).upper()
        == "SIMULATION_PASS"
    )

    test_plan_present = (
        isinstance(
            test_plan,
            dict,
        )
    )

    rollback_present = (
        isinstance(
            rollback_plan,
            dict,
        )
    )

    gates = {
        "approval_valid": (
            verification[
                "valid"
            ]
        ),
        "simulation_passed": (
            simulation_passed
        ),
        "test_plan_present": (
            test_plan_present
        ),
        "rollback_plan_present": (
            rollback_present
        ),
    }

    gates_passed = all(
        gates.values()
    )

    idempotency_key = _hash(
        {
            "fix_hash": _hash(fix),
            "approval_hash": (
                approval.get(
                    "approval_hash_sha256"
                )
            ),
            "environment": fix.get(
                "environment"
            ),
            "scope": fix.get(
                "asset_scope"
            ),
        }
    )

    package = {
        "execution_package_id": (
            "HEALEXEC-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "status": (
            "EXECUTION_PACKAGE_READY"
            if gates_passed
            else "EXECUTION_PACKAGE_BLOCKED"
        ),
        "gates": gates,
        "fix_hash_sha256": (
            _hash(fix)
        ),
        "approval_hash_sha256": (
            approval.get(
                "approval_hash_sha256"
            )
        ),
        "simulation_id": (
            simulation.get(
                "simulation_id"
            )
            if isinstance(
                simulation,
                dict,
            )
            else None
        ),
        "test_plan_id": (
            test_plan.get(
                "test_plan_id"
            )
            if isinstance(
                test_plan,
                dict,
            )
            else None
        ),
        "rollback_plan_id": (
            rollback_plan.get(
                "rollback_plan_id"
            )
            if isinstance(
                rollback_plan,
                dict,
            )
            else None
        ),
        "idempotency_key": (
            idempotency_key
        ),
        "execution_authorized": False,
        "execution_mode": (
            "PACKAGE_ONLY"
        ),
    }

    package[
        "package_hash_sha256"
    ] = _hash(package)

    return {
        **package,
        "safety": _safety(),
    }


def verify_outcome(
    payload: dict[str, Any]
) -> dict[str, Any]:

    expected = payload.get(
        "expected"
    ) or {}

    actual = payload.get(
        "actual"
    ) or {}

    validations = payload.get(
        "validations"
    ) or []

    if not isinstance(
        expected,
        dict,
    ):
        raise ValueError(
            "expected must be an object"
        )

    if not isinstance(
        actual,
        dict,
    ):
        raise ValueError(
            "actual must be an object"
        )

    expected_hash = _hash(
        expected
    )

    actual_hash = _hash(
        actual
    )

    state_match = (
        expected_hash
        == actual_hash
    )

    failed_validations = [
        item
        for item in validations
        if isinstance(item, dict)
        and str(
            item.get(
                "status"
            )
            or ""
        ).upper()
        not in {
            "PASS",
            "PASSED",
            "OK",
        }
    ]

    verified = (
        state_match
        and not failed_validations
    )

    return {
        "outcome_verification_id": (
            "HEALOUTCOME-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "status": (
            "HEALING_VERIFIED"
            if verified
            else "HEALING_NOT_VERIFIED"
        ),
        "expected_hash_sha256": (
            expected_hash
        ),
        "actual_hash_sha256": (
            actual_hash
        ),
        "state_match": (
            state_match
        ),
        "validation_count": len(
            validations
        ),
        "validation_failure_count": (
            len(
                failed_validations
            )
        ),
        "failed_validations": (
            failed_validations
        ),
        "rollback_required": (
            not verified
        ),
        "safety": _safety(),
    }


def build_healing_report(
    payload: dict[str, Any]
) -> dict[str, Any]:

    proposal = payload.get(
        "proposal"
    ) or {}

    risk = payload.get(
        "risk"
    ) or {}

    confidence = payload.get(
        "confidence"
    ) or {}

    simulation = payload.get(
        "simulation"
    ) or {}

    approval = payload.get(
        "approval"
    ) or {}

    execution_package = payload.get(
        "execution_package"
    ) or {}

    report_material = {
        "proposal": proposal,
        "risk": risk,
        "confidence": confidence,
        "simulation": simulation,
        "approval": approval,
        "execution_package": (
            execution_package
        ),
    }

    return {
        "report_id": (
            "HEALREPORT-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "generated_at": _now_iso(),
        "status": (
            "HEALING_PREPARED"
        ),
        "execution_performed": False,
        "report": deepcopy(
            report_material
        ),
        "evidence_hash_sha256": (
            _hash(
                report_material
            )
        ),
        "integrations": {
            "root_cause_investigator": (
                "SUPPORTED"
            ),
            "business_rule_dna": (
                "SUPPORTED"
            ),
            "what_breaks_if": (
                "SUPPORTED"
            ),
            "migration_autopilot": (
                "SUPPORTED"
            ),
            "digital_twin_replay": (
                "SUPPORTED"
            ),
            "cutover_simulator": (
                "SUPPORTED"
            ),
            "evidence_by_design": (
                "SUPPORTED"
            ),
        },
        "safety": _safety(),
    }


def engine_status() -> dict[str, Any]:

    return {
        "engine": (
            "KMITORA Self-Healing with Approval Gates"
        ),
        "version": ENGINE_VERSION,
        "status": "READY",
        "authority": (
            CURRENT_MAX_AUTHORITY
        ),
        "execution_mode": (
            "SIMULATION_AND_PACKAGE_ONLY"
        ),
        "capabilities": [
            "fix_proposal",
            "risk_classification",
            "healing_confidence",
            "conflict_detection",
            "digital_twin_simulation_binding",
            "what_breaks_if_binding",
            "business_rule_dna_binding",
            "pre_fix_test_plan",
            "post_fix_test_plan",
            "approval_requirement",
            "approval_token_binding",
            "approval_expiry",
            "approval_scope_binding",
            "approval_environment_binding",
            "stale_approval_invalidation",
            "canary_plan",
            "idempotency_key",
            "rollback_plan",
            "execution_package",
            "post_fix_verification",
            "automatic_rollback_criteria",
            "evidence_by_design_binding",
        ],
        "production_execution_enabled": (
            False
        ),
        "controlled_nonprod_execution_enabled": (
            False
        ),
        "safety": _safety(),
    }
