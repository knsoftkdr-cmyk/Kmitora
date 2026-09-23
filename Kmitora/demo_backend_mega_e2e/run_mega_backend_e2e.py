#!/usr/bin/env python3
"""KMITORA backend mega enterprise E2E live-demo runner.

Runs a broad, backend-only, governed scenario against an already running KMITORA
Core/A000 HTTP API. The runner is intentionally safe: it requests only analytical
operations plus the existing DEV DRY_RUN governed migration path.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass
class Check:
    name: str
    phase: str
    method: str
    path: str
    expected_status: list[int]
    actual_status: int
    passed: bool
    elapsed_ms: int
    detail: str
    response_kind: str | None = None


class Api:
    def __init__(self, base_url: str, timeout: float = 20.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def call(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
    ) -> tuple[int, dict[str, Any]]:
        data = None
        headers = {"Accept": "application/json"}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = Request(
            f"{self.base_url}{path}",
            data=data,
            headers=headers,
            method=method,
        )
        try:
            with urlopen(req, timeout=self.timeout) as response:
                body = response.read().decode("utf-8")
                return response.status, json.loads(body)
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(body)
            except json.JSONDecodeError:
                parsed = {"payload": {"message": body}}
            return exc.code, parsed


class MegaRunner:
    def __init__(
        self,
        api: Api,
        root: Path,
        scenario: dict[str, Any],
        output_dir: Path,
    ) -> None:
        self.api = api
        self.root = root
        self.scenario = scenario
        self.output_dir = output_dir
        self.checks: list[Check] = []
        self.artifacts: dict[str, Any] = {}

    def run_check(
        self,
        name: str,
        phase: str,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
        expected_status: tuple[int, ...] = (200,),
        validator: Any = None,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        try:
            status, body = self.api.call(method, path, payload)
        except (URLError, TimeoutError, OSError) as exc:
            elapsed = int((time.perf_counter() - started) * 1000)
            self.checks.append(
                Check(
                    name=name,
                    phase=phase,
                    method=method,
                    path=path,
                    expected_status=list(expected_status),
                    actual_status=0,
                    passed=False,
                    elapsed_ms=elapsed,
                    detail=f"connection error: {exc}",
                )
            )
            raise RuntimeError(f"{name}: connection error: {exc}") from exc

        elapsed = int((time.perf_counter() - started) * 1000)
        payload_body = body.get("payload", {}) if isinstance(body, dict) else {}
        valid = status in expected_status
        detail = "status matched"

        if valid and validator is not None:
            try:
                validator(payload_body, body)
                detail = "status + assertions passed"
            except AssertionError as exc:
                valid = False
                detail = str(exc) or "assertion failed"

        self.checks.append(
            Check(
                name=name,
                phase=phase,
                method=method,
                path=path,
                expected_status=list(expected_status),
                actual_status=status,
                passed=valid,
                elapsed_ms=elapsed,
                detail=detail,
                response_kind=body.get("kind") if isinstance(body, dict) else None,
            )
        )

        print(
            f"[{'PASS' if valid else 'FAIL'}] "
            f"{phase:<12} {name:<42} HTTP {status} {elapsed:>5}ms"
        )
        if not valid:
            print(json.dumps(body, indent=2)[:5000])
            raise AssertionError(f"{name} failed: {detail}")
        return payload_body

    @staticmethod
    def assert_safe(payload: dict[str, Any], _: dict[str, Any]) -> None:
        forbidden_true_keys = {
            "production_action_executed",
            "production_executed",
            "target_write_executed",
            "source_write_executed",
            "destructive_action_executed",
            "policy_bypass_executed",
            "production_cutover_executed",
        }

        def walk(value: Any) -> None:
            if isinstance(value, dict):
                for key, item in value.items():
                    if key in forbidden_true_keys:
                        assert item is not True, f"unsafe flag became true: {key}"
                    walk(item)
            elif isinstance(value, list):
                for item in value:
                    walk(item)

        walk(payload)

    def phase_platform(self) -> None:
        self.run_check("Health", "Platform", "GET", "/health")
        self.run_check("Capabilities", "Platform", "GET", "/v1/capabilities")
        self.run_check("Environments", "Platform", "GET", "/v1/environments")
        self.run_check("A000 status", "Platform", "GET", "/v1/a000/status", validator=self.assert_safe)
        self.run_check("A000 intelligence status", "Platform", "GET", "/v1/a000/intelligence/status", validator=self.assert_safe)
        self.run_check("A000 intelligence capabilities", "Platform", "GET", "/v1/a000/intelligence/capabilities", validator=self.assert_safe)
        self.run_check("A000 self-test", "Platform", "POST", "/v1/a000/self-test", {}, validator=self.assert_safe)

    def context_payload(self) -> dict[str, Any]:
        return {
            "description": self.scenario["description"],
            "systems": self.scenario["systems"],
            "processes": self.scenario["processes"],
            "issues": self.scenario["issues"],
            "technologies": self.scenario["technologies"],
        }

    def phase_domain(self) -> None:
        catalog = self.run_check(
            "Universal domain catalog",
            "Understand",
            "GET",
            "/v1/a000/domains",
            validator=lambda p, _: (
                self.assert_safe(p, _),
                (_ for _ in ()).throw(AssertionError("expected 170 seeded domains"))
                if p.get("total_seeded_domains") != 170
                else None,
            ),
        )
        self.artifacts["domain_catalog_counts"] = {
            "industry_count": catalog.get("industry_count"),
            "enterprise_function_count": catalog.get("enterprise_function_count"),
            "total_seeded_domains": catalog.get("total_seeded_domains"),
        }

        inferred = self.run_check(
            "Smart domain inference",
            "Understand",
            "POST",
            "/v1/a000/domains/infer",
            self.context_payload(),
            validator=self.assert_safe,
        )
        self.artifacts["domain_inference"] = inferred

        context = self.run_check(
            "Client business context",
            "Understand",
            "POST",
            "/v1/a000/domains/context",
            self.context_payload(),
            validator=self.assert_safe,
        )
        self.artifacts["client_context"] = context

        allocation_payload = {
            **self.context_payload(),
            "domain_name": context.get("domain", "Banking"),
            "functions": context.get("functions", []),
        }
        agents = self.run_check(
            "Dynamic A000 agent allocation",
            "Understand",
            "POST",
            "/v1/a000/domains/allocate",
            allocation_payload,
            validator=self.assert_safe,
        )
        self.artifacts["agent_allocation"] = agents

        scenarios = self.run_check(
            "Dynamic 13-stage scenario synthesis",
            "Understand",
            "POST",
            "/v1/a000/domains/scenarios",
            allocation_payload,
            validator=lambda p, b: (
                self.assert_safe(p, b),
                (_ for _ in ()).throw(AssertionError("scenario synthesis returned no scenarios"))
                if int(p.get("scenario_count", 0)) <= 0 else None,
            ),
        )
        self.artifacts["dynamic_scenario_count"] = scenarios.get("scenario_count", 0)

    def phase_intelligence(self) -> None:
        self.run_check(
            "Deep enterprise discovery plan",
            "Discover",
            "POST",
            "/v1/a000/deep-discovery",
            {"layers": ["business", "application", "data", "process", "runtime", "security", "governance"]},
            validator=self.assert_safe,
        )
        self.run_check(
            "Process mining",
            "Discover",
            "POST",
            "/v1/a000/process-mine",
            {
                "events": [
                    {"case_id": "C1", "activity": "Receive Application", "timestamp": "2026-09-10T09:00:00Z"},
                    {"case_id": "C1", "activity": "KYC Check", "timestamp": "2026-09-10T09:02:00Z"},
                    {"case_id": "C1", "activity": "Risk Review", "timestamp": "2026-09-10T09:05:00Z"},
                    {"case_id": "C1", "activity": "Approve", "timestamp": "2026-09-10T09:08:00Z"},
                    {"case_id": "C2", "activity": "Receive Application", "timestamp": "2026-09-10T09:01:00Z"},
                    {"case_id": "C2", "activity": "KYC Check", "timestamp": "2026-09-10T09:04:00Z"},
                    {"case_id": "C2", "activity": "Exception Review", "timestamp": "2026-09-10T09:10:00Z"},
                ]
            },
            validator=self.assert_safe,
        )
        self.run_check(
            "Business-rule mining",
            "Discover",
            "POST",
            "/v1/a000/rule-mine",
            {
                "source": "mega-demo requirements",
                "text": (
                    "Customer onboarding must validate identity. Payments above the configured threshold "
                    "require approval. Production changes must not execute without authoritative approval. "
                    "All migration outcomes must be reconciled and evidenced."
                ),
            },
            validator=self.assert_safe,
        )
        self.run_check(
            "Entity resolution",
            "Detect",
            "POST",
            "/v1/a000/entity-resolve",
            {
                "left": {"customer_id": "C100", "email": "client@example.com", "country": "US"},
                "right": {"customer_id": "C100", "email": "client@example.com", "country": "US"},
                "keys": ["customer_id", "email"],
            },
            validator=self.assert_safe,
        )
        self.run_check(
            "Privacy classification",
            "Detect",
            "POST",
            "/v1/a000/privacy-assess",
            {"field": "customer_email", "sample_values": ["client@example.com", "person@example.org"]},
            validator=self.assert_safe,
        )
        self.run_check(
            "Data observability",
            "Detect",
            "POST",
            "/v1/a000/data-observe",
            {"values": [100, 101, 99, 100, 102, 98, 100, 350]},
            validator=self.assert_safe,
        )
        self.run_check(
            "Root-cause ranking",
            "Diagnose",
            "POST",
            "/v1/a000/root-cause",
            {
                "symptom": "Payment API latency and failed customer onboarding",
                "candidates": [
                    {"cause": "database connection saturation", "prior": 0.7, "likelihood": 0.9},
                    {"cause": "schema mismatch", "prior": 0.5, "likelihood": 0.8},
                    {"cause": "identity provider timeout", "prior": 0.4, "likelihood": 0.7},
                ],
            },
            validator=self.assert_safe,
        )
        self.run_check(
            "What-if simulation",
            "Simulate",
            "POST",
            "/v1/a000/simulate",
            {
                "baseline": {"latency_ms": 900, "error_rate": 0.08, "capacity": 100},
                "changes": {"latency_ms": 250, "error_rate": 0.01, "capacity": 180},
            },
            validator=self.assert_safe,
        )
        self.run_check(
            "Dependency optimization",
            "Recommend",
            "POST",
            "/v1/a000/optimize",
            {
                "tasks": ["discover", "map", "simulate", "approve", "execute", "test", "reconcile", "evidence"],
                "dependencies": [
                    {"before": "discover", "after": "map"},
                    {"before": "map", "after": "simulate"},
                    {"before": "simulate", "after": "approve"},
                    {"before": "approve", "after": "execute"},
                    {"before": "execute", "after": "test"},
                    {"before": "test", "after": "reconcile"},
                    {"before": "reconcile", "after": "evidence"},
                ],
            },
            validator=self.assert_safe,
        )
        self.run_check(
            "Dynamic specialist plan",
            "Recommend",
            "POST",
            "/v1/a000/agent-plan",
            {
                "purpose": "Resolve cross-domain migration defects while preserving governance",
                "skills": ["domain reasoning", "data mapping", "RCA", "testing", "reconciliation"],
                "knowledge_packs": ["Banking", "Payments", "Data", "Security", "KQA"],
            },
            validator=self.assert_safe,
        )

    def phase_governance_negative(self) -> None:
        self.run_check(
            "DEV policy evaluation",
            "Governance",
            "POST",
            "/v1/a000/policy-evaluate",
            {"action": "simulate migration", "environment": "DEV", "destructive": False},
            validator=self.assert_safe,
        )
        self.run_check(
            "PROD destructive request governed",
            "Governance",
            "POST",
            "/v1/a000/policy-evaluate",
            {"action": "delete production customer table", "environment": "PROD", "destructive": True},
            validator=self.assert_safe,
        )
        self.run_check(
            "Invalid capability serial rejected",
            "Governance",
            "POST",
            "/v1/a000/master-capabilities/run-one",
            {"serial": 1000001},
            expected_status=(400,),
        )
        self.run_check(
            "Oversized HTTP batch rejected",
            "Governance",
            "POST",
            "/v1/a000/master-capabilities/run",
            {"start": 1, "end": 10001, "persist_evidence": False},
            expected_status=(400,),
        )
        self.run_check(
            "Direct PROD migration blocked",
            "Governance",
            "POST",
            "/v1/migrations",
            {
                "migration_id": "UNAUTHORIZED-PROD-DEMO",
                "approval_id": "NONE",
                "environment": "PROD",
                "execution_mode": "LIVE",
                "target_write_requested": True,
            },
            expected_status=(403,),
        )

    def phase_digital_twin(self) -> None:
        graph = self.run_check(
            "Live Digital Twin graph",
            "DigitalTwin",
            "GET",
            "/v1/a000/digital-twin/graph?temporal_state=CURRENT",
            validator=self.assert_safe,
        )
        nodes = graph.get("nodes", [])
        node_ids = {str(node.get("id")) for node in nodes if isinstance(node, dict)}
        source = "risk" if "risk" in node_ids else ("data" if "data" in node_ids else next(iter(node_ids), "a000"))

        self.run_check(
            "Digital Twin blast radius",
            "DigitalTwin",
            "POST",
            "/v1/a000/digital-twin/impact",
            {"node_id": source, "max_depth": 4},
            validator=self.assert_safe,
        )
        self.run_check(
            "Digital Twin RCA path",
            "DigitalTwin",
            "POST",
            "/v1/a000/digital-twin/rca",
            {"node_id": source},
            validator=self.assert_safe,
        )
        self.run_check(
            "Digital Twin future simulation",
            "DigitalTwin",
            "POST",
            "/v1/a000/digital-twin/simulate",
            {"node_id": source, "scenario": "Mega enterprise migration risk propagation"},
            validator=self.assert_safe,
        )

    def phase_capability_universe(self) -> None:
        self.run_check(
            "1M capability catalog summary",
            "1M Universe",
            "GET",
            "/v1/a000/master-capabilities",
            validator=self.assert_safe,
        )
        outcomes: list[dict[str, Any]] = []
        for serial in self.scenario["representative_capability_serials"]:
            descriptor = self.run_check(
                f"Capability descriptor {serial}",
                "1M Universe",
                "GET",
                f"/v1/a000/master-capabilities/{serial}",
                validator=self.assert_safe,
            )
            outcome = self.run_check(
                f"Capability execution {serial}",
                "1M Universe",
                "POST",
                "/v1/a000/master-capabilities/run-one",
                {"serial": serial},
                validator=self.assert_safe,
            )
            outcomes.append(outcome)
            if serial in {1, 825251, 1000000}:
                self.run_check(
                    f"Learning classification {serial}",
                    "Learn",
                    "POST",
                    "/v1/a000/master-capabilities/learn",
                    {"outcome": outcome},
                    validator=self.assert_safe,
                )

        self.artifacts["representative_capability_executions"] = len(outcomes)

        for start, end in [
            (1, 25),
            (100251, 100275),
            (250251, 250275),
            (525251, 525275),
            (825251, 825275),
            (975251, 975275),
            (999976, 1000000),
        ]:
            self.run_check(
                f"Safe batch {start}-{end}",
                "1M Universe",
                "POST",
                "/v1/a000/master-capabilities/run",
                {
                    "start": start,
                    "end": end,
                    "persist_evidence": False,
                    "stop_on_failure": True,
                },
                validator=self.assert_safe,
            )

    def phase_governed_migration(self) -> None:
        base = self.root / "TEST_DATA" / "REFERENCE_MIGRATION_002_DRY_RUN_CLEAN"
        source = base / "F1_SOURCE"
        target = base / "F2_TARGET" / "target_schema.txt"
        rules = base / "BUSINESS_RULES" / "requirements.txt"

        for required in [source, target, rules]:
            assert required.exists(), f"required demo fixture missing: {required}"

        migration_id = f"MEGA-DEMO-{int(time.time())}"

        discovery = self.run_check(
            "Clean enterprise source discovery",
            "Discover",
            "POST",
            "/v1/discovery/jobs",
            {
                "migration_id": migration_id,
                "source_path": str(source),
                "target_path": str(target),
                "business_rules_path": str(rules),
            },
            validator=self.assert_safe,
        )
        self.artifacts["migration_id"] = migration_id
        self.artifacts["discovery_summary"] = discovery.get("summary", {})

        validation = self.run_check(
            "Governed migration validation",
            "Validate",
            "POST",
            "/v1/validations/resolve-governed",
            {"migration_id": migration_id},
            validator=self.assert_safe,
        )
        assert validation.get("validation_ready") is True, "clean demo fixture is not execution-ready"

        counts = validation.get("counts", {})
        approval_request = self.run_check(
            "Authoritative approval request",
            "Approval",
            "POST",
            "/v1/approvals",
            {
                "migration_id": migration_id,
                "purpose": "Future live-demo governed DEV dry-run",
                "environment": "DEV",
                "execution_mode": "DRY_RUN",
                "validation_snapshot": {
                    "validation_ready": bool(validation.get("validation_ready")),
                    "blocking_findings": int(counts.get("blocking_findings", 0)),
                },
                "staging_snapshot": {
                    "ready_records": int(counts.get("ready_records", 0)),
                    "blocked_records": int(counts.get("unresolved_referential", 0)),
                    "review_records": int(counts.get("review_records", 0)),
                    "quarantine_records": int(counts.get("quarantine_records", 0)),
                    "rejected_records": int(counts.get("rejected_records", 0)),
                },
                "target_write_requested": False,
            },
            expected_status=(202,),
            validator=self.assert_safe,
        )
        approval_id = str(approval_request.get("id"))
        self.artifacts["approval_id"] = approval_id

        approval = self.run_check(
            "Authoritative approval decision",
            "Approval",
            "PATCH",
            f"/v1/approvals/{approval_id}",
            {
                "decision": "APPROVE",
                "decision_by": "KMITORA-DEMO-AUTHORIZED-APPROVER",
                "decision_reason": "Approved for governed DEV DRY_RUN live demonstration only.",
            },
            validator=self.assert_safe,
        )
        assert approval.get("status") == "APPROVED", "approval did not become APPROVED"

        execution = self.run_check(
            "Governed DEV dry-run execution",
            "Execute",
            "POST",
            "/v1/migrations",
            {
                "migration_id": migration_id,
                "approval_id": approval_id,
                "environment": "DEV",
                "execution_mode": "DRY_RUN",
                "target_write_requested": False,
            },
            expected_status=(202,),
            validator=self.assert_safe,
        )
        execution_id = str(execution.get("execution_id"))
        self.artifacts["execution_id"] = execution_id

        reconciliation = self.run_check(
            "Exact dry-run reconciliation",
            "Reconcile",
            "POST",
            "/v1/reconciliations",
            {"execution_id": execution_id},
            expected_status=(202,),
            validator=self.assert_safe,
        )
        assert reconciliation.get("status") == "PASS", "reconciliation did not PASS"
        reconciliation_id = str(reconciliation.get("reconciliation_id"))
        self.artifacts["reconciliation_id"] = reconciliation_id

        evidence = self.run_check(
            "Evidence package generation",
            "Evidence",
            "POST",
            "/v1/evidence",
            {"reconciliation_id": reconciliation_id},
            expected_status=(202,),
            validator=self.assert_safe,
        )
        assert evidence.get("status") == "COMPLETE", "evidence package is not COMPLETE"
        self.artifacts["evidence_id"] = evidence.get("evidence_id")

    def write_report(self, started_at: str, finished_at: str) -> bool:
        passed = sum(1 for item in self.checks if item.passed)
        failed = len(self.checks) - passed
        report = {
            "scenario_id": self.scenario["scenario_id"],
            "scenario_name": self.scenario["name"],
            "started_at": started_at,
            "finished_at": finished_at,
            "total_checks": len(self.checks),
            "passed": passed,
            "failed": failed,
            "pass_rate": round((passed / len(self.checks) * 100) if self.checks else 0, 2),
            "hard_safety": {
                "production_write_allowed": False,
                "production_cutover_allowed": False,
                "destructive_action_allowed": False,
                "policy_bypass_allowed": False,
            },
            "artifacts": self.artifacts,
            "checks": [asdict(item) for item in self.checks],
        }
        canonical = json.dumps(report, sort_keys=True, separators=(",", ":")).encode("utf-8")
        report["report_sha256"] = hashlib.sha256(canonical).hexdigest()

        self.output_dir.mkdir(parents=True, exist_ok=True)
        json_path = self.output_dir / "mega_e2e_report.json"
        json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

        lines = [
            "# KMITORA Mega Enterprise Backend E2E Report",
            "",
            f"- Scenario: `{report['scenario_id']}` — {report['scenario_name']}",
            f"- Total checks: **{report['total_checks']}**",
            f"- Passed: **{passed}**",
            f"- Failed: **{failed}**",
            f"- Pass rate: **{report['pass_rate']}%**",
            f"- Report SHA-256: `{report['report_sha256']}`",
            "",
            "## Hard safety",
            "",
            "- Production writes: **DENIED**",
            "- Production cutover: **DENIED**",
            "- Destructive actions: **DENIED**",
            "- Policy bypass: **DENIED**",
            "",
            "## Checks",
            "",
            "| Phase | Check | Result | HTTP | ms |",
            "|---|---|---:|---:|---:|",
        ]
        for item in self.checks:
            lines.append(
                f"| {item.phase} | {item.name} | {'PASS' if item.passed else 'FAIL'} | "
                f"{item.actual_status} | {item.elapsed_ms} |"
            )
        (self.output_dir / "mega_e2e_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        return failed == 0

    def run(self) -> bool:
        started_at = datetime.now(timezone.utc).isoformat()
        try:
            self.phase_platform()
            self.phase_domain()
            self.phase_intelligence()
            self.phase_governance_negative()
            self.phase_digital_twin()
            self.phase_capability_universe()
            self.phase_governed_migration()
            ok = True
        except Exception as exc:
            print(f"\nMEGA E2E STOPPED: {exc}", file=sys.stderr)
            ok = False
        finished_at = datetime.now(timezone.utc).isoformat()
        report_ok = self.write_report(started_at, finished_at)
        return ok and report_ok


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument(
        "--scenario",
        default=str(Path(__file__).with_name("mega_enterprise_scenario.json")),
    )
    parser.add_argument(
        "--repo-root",
        default=str(Path(__file__).resolve().parents[1]),
    )
    parser.add_argument(
        "--output",
        default=str(Path(__file__).with_name("output")),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    scenario = json.loads(Path(args.scenario).read_text(encoding="utf-8"))
    runner = MegaRunner(
        api=Api(args.base_url),
        root=Path(args.repo_root).resolve(),
        scenario=scenario,
        output_dir=Path(args.output).resolve(),
    )
    ok = runner.run()
    print()
    print("=" * 78)
    print("KMITORA MEGA ENTERPRISE BACKEND E2E:", "PASS" if ok else "FAIL")
    print(f"Checks: {sum(c.passed for c in runner.checks)}/{len(runner.checks)} passed")
    print(f"Report: {Path(args.output).resolve() / 'mega_e2e_report.json'}")
    print("=" * 78)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
