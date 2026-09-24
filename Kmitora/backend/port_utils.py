from __future__ import annotations
import socket
import json
from pathlib import Path


def find_free_port(preferred: int, max_tries: int = 20) -> int:
    for port in range(preferred, preferred + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"No free port found in range {preferred}-{preferred + max_tries}")


def write_active_port(service_name: str, port: int, project_root: Path) -> None:
    state_dir = project_root / "runtime" / "port_state"
    state_dir.mkdir(parents=True, exist_ok=True)
    path = state_dir / f"{service_name}.json"
    path.write_text(json.dumps({"service": service_name, "port": port}), encoding="utf-8")
