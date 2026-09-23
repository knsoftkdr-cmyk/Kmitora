from __future__ import annotations
import re
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("usage: patch_f1033_lifecycle_runtime_029.py <F1033_server.py>")

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8-sig")
start = "# BEGIN KMITORA_A000_LIFECYCLE_UNIFIED_RUNTIME_029"
end = "# END KMITORA_A000_LIFECYCLE_UNIFIED_RUNTIME_029"

if start in text:
    print("SKIP 029 lifecycle send projection already exists.")
    raise SystemExit(0)

method_re = re.compile(r'(?m)^(?P<indent>[ \t]+)def _send\(self, code: int, obj: dict\[str, Any\]\) -> None:\s*$')
m = method_re.search(text)
if not m:
    method_re = re.compile(r'(?m)^(?P<indent>[ \t]+)def _send\(self, code: int, obj:[^\n]*\) -> None:\s*$')
    m = method_re.search(text)
if not m:
    raise SystemExit("Handler._send method not found; no source modified.")

indent = m.group("indent")
body = indent + "    "
body_re = re.compile(rf'(?m)^{re.escape(body)}body\s*=\s*json\.dumps\(obj,')
bm = body_re.search(text, m.end())
if not bm:
    raise SystemExit("Handler._send JSON serialization line not found; no source modified.")

block = f'''{body}{start}\n{body}try:\n{body}    import os as _kmitora_os_029\n{body}    import sys as _kmitora_sys_029\n{body}    _kmitora_backend_root_029 = _kmitora_os_029.path.dirname(\n{body}        _kmitora_os_029.path.dirname(_kmitora_os_029.path.abspath(__file__))\n{body}    )\n{body}    if _kmitora_backend_root_029 not in _kmitora_sys_029.path:\n{body}        _kmitora_sys_029.path.insert(0, _kmitora_backend_root_029)\n{body}    from a000_core.lifecycle_bridge import (\n{body}        project_lifecycle_response as _kmitora_project_lifecycle_029,\n{body}    )\n{body}    obj = _kmitora_project_lifecycle_029(\n{body}        path=getattr(self, "path", ""),\n{body}        code=code,\n{body}        envelope_obj=obj,\n{body}    )\n{body}except Exception:\n{body}    # Projection is additive only. Existing lifecycle response always wins.\n{body}    pass\n{body}{end}\n'''

updated = text[:bm.start()] + block + text[bm.start():]
path.write_text(updated, encoding="utf-8")
print("PATCHED Handler._send with centralized lifecycle unified runtime 029 projection.")
