"""Safe controller for the KMITORA Mega Enterprise backend demo.

The controller starts the existing backend E2E runner as a child process, exposes
status/report information, and never grants production authority.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import re
import sys
import threading
from typing import Any

_LOCK = threading.Lock()
_PROCESS: subprocess.Popen[str] | None = None
_STATE: dict[str, Any] = {
    "status": "IDLE",
    "started_at": None,
    "finished_at": None,
    "pid": None,
    "exit_code": None,
    "message": "Mega demo has not been started.",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _paths() -> tuple[Path, Path, Path, Path]:
    repo_root = Path(__file__).resolve().parents[2]
    demo_dir = repo_root / "demo_backend_mega_e2e"
    runner = demo_dir / "run_mega_backend_e2e.py"
    scenario = demo_dir / "mega_enterprise_scenario.json"
    output = demo_dir / "output"
    return repo_root, runner, scenario, output


def _refresh_state() -> None:
    global _PROCESS
    if _PROCESS is None:
        return
    code = _PROCESS.poll()
    if code is None:
        return
    with _LOCK:
        _STATE["status"] = "PASS" if code == 0 else "FAIL"
        _STATE["finished_at"] = _utc_now()
        _STATE["exit_code"] = code
        _STATE["message"] = (
            "Mega Enterprise backend E2E completed successfully."
            if code == 0
            else "Mega Enterprise backend E2E completed with failures."
        )
        _PROCESS = None



_CHECK_LINE = re.compile(
    r"^\[(PASS|FAIL)\]\s+(.+?)\s{2,}(.+?)\s{2,}HTTP\s+(\d+)\s+(\d+)ms$"
)


def _live_checks() -> list[dict[str, Any]]:
    _, _, _, output = _paths()
    log_path = output / "mega_e2e_live.log"
    if not log_path.exists():
        return []

    checks: list[dict[str, Any]] = []
    try:
        lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []

    for line in lines:
        match = _CHECK_LINE.match(line.strip())
        if not match:
            continue
        outcome, phase, name, status, elapsed = match.groups()
        checks.append(
            {
                "name": name.strip(),
                "phase": phase.strip(),
                "method": "",
                "path": "",
                "expected_status": [],
                "actual_status": int(status),
                "passed": outcome == "PASS",
                "elapsed_ms": int(elapsed),
                "detail": "live runner progress",
                "response_kind": None,
            }
        )
    return checks

def status_payload() -> dict[str, Any]:
    _refresh_state()
    repo_root, runner, scenario, output = _paths()
    report_path = output / "mega_e2e_report.json"
    with _LOCK:
        state = dict(_STATE)
    live_checks = _live_checks()
    state.update(
        {
            "live_checks": live_checks,
            "progress_completed": len(live_checks),
            "progress_passed": sum(1 for item in live_checks if item["passed"]),
            "progress_failed": sum(1 for item in live_checks if not item["passed"]),
            "kind": "kmitora_mega_demo_status",
            "runner_exists": runner.exists(),
            "scenario_exists": scenario.exists(),
            "report_exists": report_path.exists(),
            "report_path": str(report_path),
            "repo_root": str(repo_root),
            "production_action_executed": False,
            "production_write_allowed": False,
            "production_cutover_allowed": False,
            "destructive_action_allowed": False,
            "policy_bypass_allowed": False,
        }
    )
    return state


def start_payload(base_url: str = "http://127.0.0.1:8080") -> dict[str, Any]:
    global _PROCESS
    _refresh_state()

    repo_root, runner, scenario, output = _paths()
    if not runner.exists():
        raise ValueError(f"Mega demo runner not found: {runner}")
    if not scenario.exists():
        raise ValueError(f"Mega demo scenario not found: {scenario}")

    with _LOCK:
        if _PROCESS is not None and _PROCESS.poll() is None:
            return {
                **dict(_STATE),
                "kind": "kmitora_mega_demo_start",
                "already_running": True,
                "production_action_executed": False,
            }

        output.mkdir(parents=True, exist_ok=True)
        log_path = output / "mega_e2e_live.log"
        log_handle = log_path.open("w", encoding="utf-8")

        _PROCESS = subprocess.Popen(
            [
                sys.executable,
                str(runner),
                "--base-url",
                base_url,
                "--repo-root",
                str(repo_root),
                "--scenario",
                str(scenario),
                "--output",
                str(output),
            ],
            cwd=repo_root,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            text=True,
        )
        log_handle.close()

        _STATE.update(
            {
                "status": "RUNNING",
                "started_at": _utc_now(),
                "finished_at": None,
                "pid": _PROCESS.pid,
                "exit_code": None,
                "message": "Mega Enterprise backend E2E is running.",
            }
        )

    return {
        **dict(_STATE),
        "kind": "kmitora_mega_demo_start",
        "already_running": False,
        "log_path": str(log_path),
        "production_action_executed": False,
        "production_write_allowed": False,
        "production_cutover_allowed": False,
        "destructive_action_allowed": False,
        "policy_bypass_allowed": False,
    }


def report_payload() -> dict[str, Any]:
    _refresh_state()
    _, _, _, output = _paths()
    report_path = output / "mega_e2e_report.json"

    if not report_path.exists():
        sample_path = (
            Path(__file__).resolve().parents[2]
            / "demo_backend_mega_e2e"
            / "sample_validation"
            / "mega_e2e_report.json"
        )
        if sample_path.exists():
            report_path = sample_path
        else:
            raise FileNotFoundError("No Mega E2E report is available yet.")

    report = json.loads(report_path.read_text(encoding="utf-8"))
    report["source_report_path"] = str(report_path)
    report["production_action_executed"] = False
    return report
