"""KMITORA local demo supervisor.

The supervisor is intentionally separate from backend and frontend processes so
the browser can request backend/frontend restarts without losing the control
plane that performs the restart.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

SUPERVISOR_VERSION = "0.3.1-demo-ops"
SUPERVISOR_PORT = 8090
BACKEND_PORT = 8080
FRONTEND_PORT = 5173


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def port_open(port: int, timeout: float = 0.35) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=timeout):
            return True
    except OSError:
        return False


def http_json(url: str, timeout: float = 2.5) -> dict[str, Any] | None:
    try:
        request = Request(url, headers={"Accept": "application/json"})
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (OSError, URLError, json.JSONDecodeError):
        return None


@dataclass
class ManagedProcess:
    name: str
    process: subprocess.Popen[str] | None = None
    started_at: str | None = None

    @property
    def owned(self) -> bool:
        return self.process is not None and self.process.poll() is None

    @property
    def pid(self) -> int | None:
        return self.process.pid if self.owned else None


class DemoSupervisor:
    def __init__(
        self,
        release_root: Path,
        runtime_root: Path,
        python_executable: Path,
    ) -> None:
        self.release_root = release_root.resolve()
        self.runtime_root = runtime_root.resolve()
        self.runtime_repo = self.runtime_root / "Kmitora"
        self.python_executable = python_executable.resolve()
        self.backend = ManagedProcess("backend")
        self.frontend = ManagedProcess("frontend")
        self.lock = threading.RLock()
        self.last_action = "supervisor_started"
        self.last_error: str | None = None
        self.started_at = utc_now()

    def _runtime_backend(self) -> Path:
        return self.runtime_repo / "backend" / "main_api" / "F1033_server.py"

    def _frontend_dir(self) -> Path:
        return self.runtime_repo / "frontend"

    def _npm_command(self) -> str:
        npm = shutil.which("npm.cmd") or shutil.which("npm")
        if not npm:
            raise RuntimeError("npm executable not found in PATH.")
        return npm

    def _node_command(self) -> str | None:
        return shutil.which("node.exe") or shutil.which("node")

    def _expected_build_hash(self) -> tuple[Path, str | None]:
        artifact_dir = self.release_root / "artifacts"
        candidates = sorted(
            artifact_dir.glob("KmitoraBuild_*_Full_Integrated.zip"),
            key=lambda item: item.stat().st_mtime,
            reverse=True,
        )
        if not candidates:
            return artifact_dir / "MISSING_BUILD.zip", None

        build = candidates[0]
        checksum_file = self.release_root / "CHECKSUMS_SHA256.txt"
        if not checksum_file.exists():
            return build, None

        rel = build.relative_to(self.release_root).as_posix()
        expected = None
        for line in checksum_file.read_text(encoding="utf-8").splitlines():
            parts = line.strip().split("  ", 1)
            if len(parts) == 2 and parts[1].replace("\\", "/") == rel:
                expected = parts[0].lower()
                break
        return build, expected

    def preflight(self) -> dict[str, Any]:
        build, expected_hash = self._expected_build_hash()
        actual_hash = sha256_file(build) if build.exists() else None
        backend_entry = self._runtime_backend()
        frontend_package = self._frontend_dir() / "package.json"
        node = self._node_command()
        npm = shutil.which("npm.cmd") or shutil.which("npm")

        checks = [
            {
                "name": "Release root",
                "passed": self.release_root.exists(),
                "detail": str(self.release_root),
            },
            {
                "name": "Certified build",
                "passed": build.exists(),
                "detail": str(build),
            },
            {
                "name": "Certified build SHA-256",
                "passed": bool(
                    build.exists()
                    and expected_hash
                    and actual_hash
                    and expected_hash == actual_hash
                ),
                "detail": (
                    f"expected={expected_hash or 'missing'} "
                    f"actual={actual_hash or 'missing'}"
                ),
            },
            {
                "name": "Python",
                "passed": self.python_executable.exists(),
                "detail": str(self.python_executable),
            },
            {
                "name": "Node",
                "passed": bool(node),
                "detail": node or "not found",
            },
            {
                "name": "npm",
                "passed": bool(npm),
                "detail": npm or "not found",
            },
            {
                "name": "Runtime backend",
                "passed": backend_entry.exists(),
                "detail": str(backend_entry),
            },
            {
                "name": "Runtime frontend",
                "passed": frontend_package.exists(),
                "detail": str(frontend_package),
            },
            {
                "name": "Mega scenario",
                "passed": (
                    self.runtime_repo
                    / "demo_backend_mega_e2e"
                    / "mega_enterprise_scenario.json"
                ).exists(),
                "detail": "demo_backend_mega_e2e/mega_enterprise_scenario.json",
            },
            {
                "name": "Mega report",
                "passed": (
                    self.runtime_repo
                    / "demo_backend_mega_e2e"
                    / "output"
                    / "mega_e2e_report.json"
                ).exists()
                or (
                    self.runtime_repo
                    / "demo_backend_mega_e2e"
                    / "sample_validation"
                    / "mega_e2e_report.json"
                ).exists(),
                "detail": "saved Mega E2E report",
            },
        ]

        passed = sum(1 for check in checks if check["passed"])
        return {
            "kind": "kmitora_demo_preflight",
            "timestamp": utc_now(),
            "passed": passed,
            "total": len(checks),
            "failed": len(checks) - passed,
            "ready": passed == len(checks),
            "checks": checks,
        }

    def _terminate_process(self, managed: ManagedProcess) -> None:
        process = managed.process
        if process is None:
            return
        if process.poll() is not None:
            managed.process = None
            return

        pid = process.pid
        if os.name == "nt":
            subprocess.run(
                ["taskkill.exe", "/PID", str(pid), "/T", "/F"],
                capture_output=True,
                text=True,
                check=False,
            )
        else:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        managed.process = None

    def _wait_port(self, port: int, open_state: bool, timeout: float) -> bool:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if port_open(port) is open_state:
                return True
            time.sleep(0.25)
        return port_open(port) is open_state

    def start_backend(self) -> dict[str, Any]:
        with self.lock:
            if self.backend.owned:
                return self.status()

            if port_open(BACKEND_PORT):
                self.last_action = "backend_reused_external"
                return self.status()

            entry = self._runtime_backend()
            if not entry.exists():
                raise RuntimeError(f"Backend entrypoint not found: {entry}")

            creationflags = 0
            if os.name == "nt":
                creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

            self.backend.process = subprocess.Popen(
                [str(self.python_executable), str(entry)],
                cwd=entry.parent,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                text=True,
                creationflags=creationflags,
            )
            self.backend.started_at = utc_now()
            self.last_action = "backend_started"

        if not self._wait_port(BACKEND_PORT, True, 45):
            raise RuntimeError("Backend did not become reachable on port 8080.")
        return self.status()

    def start_frontend(self) -> dict[str, Any]:
        with self.lock:
            if self.frontend.owned:
                return self.status()

            if port_open(FRONTEND_PORT):
                self.last_action = "frontend_reused_external"
                return self.status()

            frontend_dir = self._frontend_dir()
            if not (frontend_dir / "package.json").exists():
                raise RuntimeError(f"Frontend package.json not found: {frontend_dir}")

            npm = self._npm_command()
            creationflags = 0
            command = [npm, "run", "dev"]
            if os.name == "nt":
                creationflags = subprocess.CREATE_NEW_PROCESS_GROUP
                command = [
                    os.environ.get("COMSPEC", "cmd.exe"),
                    "/d",
                    "/s",
                    "/c",
                    npm,
                    "run",
                    "dev",
                ]

            self.frontend.process = subprocess.Popen(
                command,
                cwd=frontend_dir,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                text=True,
                creationflags=creationflags,
            )
            self.frontend.started_at = utc_now()
            self.last_action = "frontend_started"

        if not self._wait_port(FRONTEND_PORT, True, 60):
            raise RuntimeError("Frontend did not become reachable on port 5173.")
        return self.status()

    def start_all(self) -> dict[str, Any]:
        preflight = self.preflight()
        if not preflight["ready"]:
            raise RuntimeError("Preflight failed. Resolve failed checks before start.")
        self.start_backend()
        self.start_frontend()
        self.last_action = "demo_started"
        return self.status()

    def stop_backend(self) -> dict[str, Any]:
        with self.lock:
            self._terminate_process(self.backend)
            self.last_action = "backend_stopped"
        return self.status()

    def stop_frontend(self) -> dict[str, Any]:
        with self.lock:
            self._terminate_process(self.frontend)
            self.last_action = "frontend_stopped"
        return self.status()

    def stop_all(self) -> dict[str, Any]:
        with self.lock:
            self._terminate_process(self.frontend)
            self._terminate_process(self.backend)
            self.last_action = "demo_stopped"
        return self.status()

    def restart_backend(self) -> dict[str, Any]:
        with self.lock:
            self._terminate_process(self.backend)
        self._wait_port(BACKEND_PORT, False, 12)
        result = self.start_backend()
        self.last_action = "backend_restarted"
        return result

    def restart_frontend(self) -> dict[str, Any]:
        with self.lock:
            self._terminate_process(self.frontend)
        self._wait_port(FRONTEND_PORT, False, 12)
        result = self.start_frontend()
        self.last_action = "frontend_restarted"
        return result

    def restart_all(self) -> dict[str, Any]:
        with self.lock:
            self._terminate_process(self.frontend)
            self._terminate_process(self.backend)
        self._wait_port(FRONTEND_PORT, False, 12)
        self._wait_port(BACKEND_PORT, False, 12)
        self.start_backend()
        self.start_frontend()
        self.last_action = "demo_restarted"
        return self.status()

    def status(self) -> dict[str, Any]:
        backend_open = port_open(BACKEND_PORT)
        frontend_open = port_open(FRONTEND_PORT)
        backend_health = http_json(
            f"http://127.0.0.1:{BACKEND_PORT}/health"
        ) if backend_open else None
        mega_status = http_json(
            f"http://127.0.0.1:{BACKEND_PORT}/v1/a000/mega-demo/status"
        ) if backend_open else None

        payload = mega_status.get("payload", {}) if mega_status else {}
        safety = {
            "production_write_allowed": payload.get(
                "production_write_allowed", False
            ),
            "production_cutover_allowed": payload.get(
                "production_cutover_allowed", False
            ),
            "destructive_action_allowed": payload.get(
                "destructive_action_allowed", False
            ),
            "policy_bypass_allowed": payload.get(
                "policy_bypass_allowed", False
            ),
        }
        safety_ok = not any(safety.values())

        return {
            "kind": "kmitora_demo_supervisor_status",
            "version": SUPERVISOR_VERSION,
            "timestamp": utc_now(),
            "supervisor": {
                "status": "RUNNING",
                "port": SUPERVISOR_PORT,
                "started_at": self.started_at,
            },
            "backend": {
                "status": "RUNNING" if backend_open else "STOPPED",
                "port": BACKEND_PORT,
                "owned": self.backend.owned,
                "pid": self.backend.pid,
                "health_ok": backend_health is not None,
            },
            "frontend": {
                "status": "RUNNING" if frontend_open else "STOPPED",
                "port": FRONTEND_PORT,
                "owned": self.frontend.owned,
                "pid": self.frontend.pid,
            },
            "demo_ready": bool(
                backend_open
                and frontend_open
                and backend_health is not None
                and safety_ok
            ),
            "mega_demo_status": payload.get("status", "UNAVAILABLE"),
            "report_exists": payload.get("report_exists", False),
            "safety": safety,
            "safety_ok": safety_ok,
            "last_action": self.last_action,
            "last_error": self.last_error,
        }


class SupervisorHandler(BaseHTTPRequestHandler):
    server_version = "KMITORA-Demo-Supervisor/0.3.1"

    @property
    def supervisor(self) -> DemoSupervisor:
        return self.server.supervisor  # type: ignore[attr-defined]

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, OPTIONS",
        )
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type",
        )
        self.send_header("Cache-Control", "no-store")

    def _send(self, code: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send(
                200,
                {
                    "kind": "kmitora_demo_supervisor_health",
                    "status": "OK",
                    "version": SUPERVISOR_VERSION,
                },
            )
            return

        if self.path == "/v1/demo/status":
            self._send(200, self.supervisor.status())
            return

        if self.path == "/v1/demo/preflight":
            self._send(200, self.supervisor.preflight())
            return

        self._send(404, {"error": "not_found", "path": self.path})

    def do_POST(self) -> None:
        routes = {
            "/v1/demo/start": self.supervisor.start_all,
            "/v1/demo/stop": self.supervisor.stop_all,
            "/v1/demo/restart": self.supervisor.restart_all,
            "/v1/demo/backend/restart": self.supervisor.restart_backend,
            "/v1/demo/frontend/restart": self.supervisor.restart_frontend,
        }
        action = routes.get(self.path)
        if action is None:
            self._send(404, {"error": "not_found", "path": self.path})
            return

        try:
            result = action()
            self.supervisor.last_error = None
            self._send(200, result)
        except Exception as exc:
            self.supervisor.last_error = str(exc)
            self._send(
                500,
                {
                    "kind": "kmitora_demo_supervisor_error",
                    "error": str(exc),
                    "status": self.supervisor.status(),
                },
            )

    def log_message(self, format: str, *args: object) -> None:
        message = format % args
        print(f"[{utc_now()}] {self.client_address[0]} {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--release-root", required=True)
    parser.add_argument("--runtime-root", required=True)
    parser.add_argument("--python", required=True)
    parser.add_argument("--port", type=int, default=SUPERVISOR_PORT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    supervisor = DemoSupervisor(
        Path(args.release_root),
        Path(args.runtime_root),
        Path(args.python),
    )
    server = ThreadingHTTPServer(
        ("127.0.0.1", args.port),
        SupervisorHandler,
    )
    server.supervisor = supervisor  # type: ignore[attr-defined]

    print(
        f"KMITORA Demo Supervisor {SUPERVISOR_VERSION} "
        f"listening on http://127.0.0.1:{args.port}"
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        supervisor.stop_all()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

