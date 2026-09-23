from __future__ import annotations

from datetime import datetime
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[2]
SERVER = ROOT / "backend" / "main_api" / "F1033_server.py"

AUTONOMY_IMPORT_MARKER = "from backend.autonomy import A000AutonomyOrchestrator"
AUTONOMY_IMPORT_BLOCK = '''\n_REPO_ROOT = str(Path(__file__).resolve().parents[2])\nif _REPO_ROOT not in sys.path:\n    sys.path.insert(0, _REPO_ROOT)\nfrom backend.autonomy import A000AutonomyOrchestrator\n\n_AUTONOMY_137 = A000AutonomyOrchestrator()\n'''

GET_BLOCK = '''        if path == "/v1/a000/autonomy-137/catalog":\n            return self._send(\n                200,\n                envelope("a000_autonomy_137_catalog", {\n                    "capabilities": _AUTONOMY_137.catalog(),\n                    "count": 137,\n                    "production_authorized": False,\n                    "cutover_authorized": False,\n                }),\n            )\n\n        if path == "/v1/a000/autonomy-137/status":\n            return self._send(\n                200,\n                envelope("a000_autonomy_137_status", _AUTONOMY_137.full_status()),\n            )\n\n'''

POST_BLOCK = '''        if path == "/v1/a000/autonomy-137/execute":\n            try:\n                capability_ids = data.get("capability_ids") or []\n                if capability_ids == "ALL":\n                    capability_ids = [f"KCAP-{i:03d}" for i in range(1, 138)]\n                if not isinstance(capability_ids, list) or not capability_ids:\n                    raise ValueError("capability_ids must be a non-empty list or ALL")\n                context = data.get("context") or {}\n                if not isinstance(context, dict):\n                    raise ValueError("context must be an object")\n                result = _AUTONOMY_137.execute(capability_ids, context)\n            except (ValueError, TypeError, KeyError, RuntimeError) as exc:\n                return self._send(\n                    400,\n                    envelope("a000_autonomy_137_error", {\n                        "message": str(exc),\n                        "production_authorized": False,\n                        "cutover_authorized": False,\n                    }),\n                )\n            return self._send(200, envelope("a000_autonomy_137", result))\n\n'''


def insert_after(text: str, anchor: str, block: str, label: str) -> str:
    pos = text.find(anchor)
    if pos < 0:
        raise RuntimeError(f"required anchor missing: {label}")
    end = pos + len(anchor)
    return text[:end] + block + text[end:]


def insert_before(text: str, anchors: tuple[str, ...], block: str, label: str) -> str:
    for anchor in anchors:
        pos = text.find(anchor)
        if pos >= 0:
            return text[:pos] + block + text[pos:]
    raise RuntimeError(f"required anchor missing: {label}; tried {anchors}")


def main() -> int:
    if not SERVER.exists():
        raise RuntimeError(f"missing server: {SERVER}")

    text = SERVER.read_text(encoding="utf-8")
    original = text
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = SERVER.with_name(f"F1033_server.py.before_autonomy137_r2_{stamp}.bak")
    shutil.copy2(SERVER, backup)

    # Ensure sys is available.
    if not any(line.strip() == "import sys" for line in text.splitlines()[:80]):
        text = insert_after(text, "import re\n", "import sys\n", "import re")

    # Insert autonomy runtime independently of Universal Problem Solver presence.
    if AUTONOMY_IMPORT_MARKER not in text:
        pathlib_anchor = "from pathlib import Path\n"
        text = insert_after(text, pathlib_anchor, AUTONOMY_IMPORT_BLOCK, "from pathlib import Path")
    elif "_AUTONOMY_137 = A000AutonomyOrchestrator()" not in text:
        text = insert_after(text, AUTONOMY_IMPORT_MARKER + "\n", "\n_AUTONOMY_137 = A000AutonomyOrchestrator()\n", "autonomy import")

    # GET routes: use stable A000 status first, then self-healing fallback.
    if '/v1/a000/autonomy-137/catalog' not in text:
        text = insert_before(
            text,
            (
                '        if path == "/v1/a000/status":\n',
                '        if path == "/v1/self-healing/status":\n',
            ),
            GET_BLOCK,
            "GET route insertion point",
        )

    # POST route: use A000 messages first; UPS route only as fallback.
    if '/v1/a000/autonomy-137/execute' not in text:
        text = insert_before(
            text,
            (
                '        if path == "/v1/a000/messages":\n',
                '        if path == "/v1/a000/universal-problem-solver":\n',
            ),
            POST_BLOCK,
            "POST route insertion point",
        )

    SERVER.write_text(text, encoding="utf-8")

    # Verify required integration markers after write.
    verify = SERVER.read_text(encoding="utf-8")
    required = {
        "orchestrator import": AUTONOMY_IMPORT_MARKER,
        "orchestrator singleton": "_AUTONOMY_137 = A000AutonomyOrchestrator()",
        "catalog endpoint": '/v1/a000/autonomy-137/catalog',
        "status endpoint": '/v1/a000/autonomy-137/status',
        "execute endpoint": '/v1/a000/autonomy-137/execute',
    }
    missing = [name for name, marker in required.items() if marker not in verify]
    if missing:
        shutil.copy2(backup, SERVER)
        raise RuntimeError("post-patch verification failed; restored backup; missing: " + ", ".join(missing))

    print(f"PASS: patched {SERVER}")
    print(f"BACKUP: {backup}")
    print("CHANGED:", text != original)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise
