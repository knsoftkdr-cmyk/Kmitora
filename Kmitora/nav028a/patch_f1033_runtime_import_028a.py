from __future__ import annotations
import re
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("usage: patch_f1033_runtime_import_028a.py <F1033_server.py>")

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8-sig")
start = "# BEGIN KMITORA_A000_LIVE_UNIFIED_RUNTIME_027"
end = "# END KMITORA_A000_LIVE_UNIFIED_RUNTIME_027"
pattern = re.compile(rf"(?ms)^(?P<indent>[ \t]+){re.escape(start)}\s*$.*?^(?P=indent){re.escape(end)}\s*$")
m = pattern.search(text)
if not m:
    raise SystemExit("Existing 027 managed integration block not found; no source modified.")

indent = m.group("indent")
i = indent
block = f'''{i}{start}
{i}# 028A: make backend sibling package imports reliable when F1033_server.py
{i}# is launched directly by absolute path from any working directory.
{i}try:
{i}    import os as _kmitora_os_028a
{i}    import sys as _kmitora_sys_028a
{i}    _kmitora_backend_root_028a = _kmitora_os_028a.path.dirname(
{i}        _kmitora_os_028a.path.dirname(_kmitora_os_028a.path.abspath(__file__))
{i}    )
{i}    if _kmitora_backend_root_028a not in _kmitora_sys_028a.path:
{i}        _kmitora_sys_028a.path.insert(0, _kmitora_backend_root_028a)
{i}
{i}    from a000_core.live_bridge import (
{i}        run_live_unified_runtime as _kmitora_run_live_027,
{i}        fail_closed_live_runtime as _kmitora_fail_closed_027,
{i}    )
{i}    _kmitora_live_027 = _kmitora_run_live_027(
{i}        message=message,
{i}        request=data,
{i}        current_reply=reply,
{i}        learning_context=(
{i}            learning_context
{i}            if "learning_context" in locals()
{i}            else None
{i}        ),
{i}    )
{i}except Exception as _kmitora_live_027_error:
{i}    try:
{i}        # If the bridge module imported successfully but execution failed,
{i}        # use its governed fail-closed response.
{i}        _kmitora_live_027 = _kmitora_fail_closed_027(
{i}            message, _kmitora_live_027_error
{i}        )
{i}    except Exception as _kmitora_live_027_fallback_error:
{i}        # Last-resort response stays schema-compatible so live qualification
{i}        # reports the real error instead of failing on a missing property.
{i}        _kmitora_live_027 = {{
{i}            "patch_id": "A000_LIVE_UNIFIED_RUNTIME_027",
{i}            "runtime_hardening_patch": "A000_LIVE_RUNTIME_IMPORT_028A",
{i}            "status": "REVIEW",
{i}            "decision": "ABSTAIN_REVIEW",
{i}            "mode": "PLAN_ONLY",
{i}            "normal_message_path_integrated": True,
{i}            "error": str(_kmitora_live_027_error),
{i}            "fallback_error": str(_kmitora_live_027_fallback_error),
{i}            "safety": {{
{i}                "execution_authority": "NONE",
{i}                "source_write_executed": False,
{i}                "target_write_executed": False,
{i}                "production_action_executed": False,
{i}                "cutover_executed": False,
{i}            }},
{i}        }}
{i}if isinstance(reply, dict):
{i}    reply["unified_runtime"] = _kmitora_live_027
{i}{end}'''

updated = text[:m.start()] + block + text[m.end():]
path.write_text(updated, encoding="utf-8")
print("PATCHED 027 managed block with 028A backend import-path hardening.")
