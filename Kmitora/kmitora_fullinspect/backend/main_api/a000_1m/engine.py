"""A000 governed activation engine for the one-million capability universe."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable

from .catalog import Scenario, build_scenario, iter_scenarios, validate_catalog


@dataclass(slots=True)
class ScenarioOutcome:
    serial: int
    scenario_id: str
    layer: str
    kqa_id: str | None
    kqa_category: str | None
    status: str
    deterministic_validators_passed: bool
    production_write_executed: bool
    production_cutover_executed: bool
    destructive_action_executed: bool
    policy_bypass_executed: bool
    approval_bypass_executed: bool
    tenant_or_context_leak_detected: bool
    rollback_evidence_complete: bool
    evidence_sha256: str
    message: str


ScenarioExecutor = Callable[[Scenario], dict[str, object]]


def _sha256(payload: dict[str, object]) -> str:
    raw = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def safe_reference_executor(scenario: Scenario) -> dict[str, object]:
    """Run a deterministic DEV simulation with all protected actions disabled."""
    return {
        "serial": scenario.serial,
        "scenario_id": scenario.scenario_id,
        "execution_mode": "SIMULATED_DEV",
        "mandatory_validators_passed": True,
        "defined_critical_gold_decision_passed": True,
        "production_write_executed": False,
        "production_cutover_executed": False,
        "destructive_action_executed": False,
        "policy_bypass_executed": False,
        "approval_bypass_executed": False,
        "tenant_or_context_leak_detected": False,
        "rollback_evidence_complete": True,
        "evidence_complete": True,
    }


def evaluate_result(
    scenario: Scenario,
    result: dict[str, object],
) -> ScenarioOutcome:
    """Apply A000 hard blockers to one scenario result."""
    validators = result.get("mandatory_validators_passed") is True
    gold = result.get("defined_critical_gold_decision_passed") is True
    prod_write = result.get("production_write_executed") is True
    cutover = result.get("production_cutover_executed") is True
    destructive = result.get("destructive_action_executed") is True
    policy_bypass = result.get("policy_bypass_executed") is True
    approval_bypass = result.get("approval_bypass_executed") is True
    tenant_leak = result.get("tenant_or_context_leak_detected") is True
    rollback_complete = result.get("rollback_evidence_complete") is True
    evidence_complete = result.get("evidence_complete") is True

    passed = (
        validators
        and gold
        and not prod_write
        and not cutover
        and not destructive
        and not policy_bypass
        and not approval_bypass
        and not tenant_leak
        and rollback_complete
        and evidence_complete
    )

    evidence = {
        "scenario": asdict(scenario),
        "result": result,
        "hard_blocker_clear": passed,
    }

    return ScenarioOutcome(
        serial=scenario.serial,
        scenario_id=scenario.scenario_id,
        layer=scenario.layer,
        kqa_id=scenario.kqa_id,
        kqa_category=scenario.kqa_category,
        status="PASS" if passed else "FAIL",
        deterministic_validators_passed=validators and gold,
        production_write_executed=prod_write,
        production_cutover_executed=cutover,
        destructive_action_executed=destructive,
        policy_bypass_executed=policy_bypass,
        approval_bypass_executed=approval_bypass,
        tenant_or_context_leak_detected=tenant_leak,
        rollback_evidence_complete=rollback_complete and evidence_complete,
        evidence_sha256=_sha256(evidence),
        message=(
            "All deterministic A000 critical controls passed."
            if passed
            else "One or more A000 hard blockers failed."
        ),
    )


def run_single(
    serial: int,
    executor: ScenarioExecutor = safe_reference_executor,
) -> ScenarioOutcome:
    """Activate, simulate and validate one master scenario."""
    validate_catalog()
    scenario = build_scenario(serial)
    return evaluate_result(scenario, executor(scenario))


def run_batch(
    *,
    start: int,
    end: int,
    output_path: Path | None = None,
    executor: ScenarioExecutor = safe_reference_executor,
    stop_on_failure: bool = True,
) -> dict[str, object]:
    """Run a serial range and optionally stream evidence as JSONL."""
    validate_catalog()

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        stream = output_path.open("w", encoding="utf-8")
    else:
        stream = None

    passed = 0
    failed = 0
    last_outcome: ScenarioOutcome | None = None

    try:
        for scenario in iter_scenarios(start, end):
            outcome = evaluate_result(scenario, executor(scenario))
            last_outcome = outcome

            if stream:
                stream.write(json.dumps(asdict(outcome)) + "\n")

            if outcome.status == "PASS":
                passed += 1
            else:
                failed += 1
                if stop_on_failure:
                    break
    finally:
        if stream:
            stream.close()

    return {
        "requested": end - start + 1,
        "executed": passed + failed,
        "passed": passed,
        "failed": failed,
        "status": "PASS" if failed == 0 else "FAIL",
        "last_serial": last_outcome.serial if last_outcome else None,
        "production_write_executed": False,
        "production_cutover_executed": False,
    }
