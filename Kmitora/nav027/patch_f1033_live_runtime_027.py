from __future__ import annotations
import re
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("usage: patch_f1033_live_runtime_027.py <F1033_server.py>")

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8-sig")
start_marker = "# BEGIN KMITORA_A000_LIVE_UNIFIED_RUNTIME_027"
end_marker = "# END KMITORA_A000_LIVE_UNIFIED_RUNTIME_027"

if start_marker in text:
    print("SKIP 027 live runtime block already exists.")
    raise SystemExit(0)

route_re = re.compile(r'(?m)^(?P<indent>[ \t]+)if path == [\"\']/v1/a000/messages[\"\']:\s*$')
m = route_re.search(text)
if not m:
    raise SystemExit("A000 /v1/a000/messages handler not found; no source modified.")

indent = m.group("indent")
body_indent = indent + "    "
next_route_re = re.compile(rf'(?m)^{re.escape(indent)}if path (?:==|\.startswith\()')
next_m = next_route_re.search(text, m.end())
segment_end = next_m.start() if next_m else len(text)
segment = text[m.start():segment_end]

required_signals = ["message =", "reply"]
missing = [s for s in required_signals if s not in segment]
if missing:
    raise SystemExit(
        "A000 handler shape is not compatible with safe 027 attachment; missing "
        + ", ".join(missing)
        + ". No source modified."
    )

return_matches = list(re.finditer(rf'(?m)^{re.escape(body_indent)}return self\._send\s*\(', segment))
if not return_matches:
    raise SystemExit("Final A000 message return was not found; no source modified.")
insert_rel = return_matches[-1].start()
insert_at = m.start() + insert_rel

block = f'''{body_indent}{start_marker}\n{body_indent}try:\n{body_indent}    from a000_core.live_bridge import (\n{body_indent}        run_live_unified_runtime as _kmitora_run_live_027,\n{body_indent}        fail_closed_live_runtime as _kmitora_fail_closed_027,\n{body_indent}    )\n{body_indent}    _kmitora_live_027 = _kmitora_run_live_027(\n{body_indent}        message=message,\n{body_indent}        request=data,\n{body_indent}        current_reply=reply,\n{body_indent}        learning_context=(\n{body_indent}            learning_context\n{body_indent}            if "learning_context" in locals()\n{body_indent}            else None\n{body_indent}        ),\n{body_indent}    )\n{body_indent}except Exception as _kmitora_live_027_error:\n{body_indent}    try:\n{body_indent}        _kmitora_live_027 = _kmitora_fail_closed_027(\n{body_indent}            message, _kmitora_live_027_error\n{body_indent}        )\n{body_indent}    except Exception:\n{body_indent}        _kmitora_live_027 = {{\n{body_indent}            "patch_id": "A000_LIVE_UNIFIED_RUNTIME_027",\n{body_indent}            "status": "REVIEW",\n{body_indent}            "decision": "ABSTAIN_REVIEW",\n{body_indent}            "mode": "PLAN_ONLY",\n{body_indent}            "error": str(_kmitora_live_027_error),\n{body_indent}            "safety": {{\n{body_indent}                "execution_authority": "NONE",\n{body_indent}                "source_write_executed": False,\n{body_indent}                "target_write_executed": False,\n{body_indent}                "production_action_executed": False,\n{body_indent}                "cutover_executed": False,\n{body_indent}            }},\n{body_indent}        }}\n{body_indent}if isinstance(reply, dict):\n{body_indent}    reply["unified_runtime"] = _kmitora_live_027\n{body_indent}{end_marker}\n\n'''

updated = text[:insert_at] + block + text[insert_at:]
path.write_text(updated, encoding="utf-8")
print("PATCHED /v1/a000/messages with A000 live unified runtime 027.")
