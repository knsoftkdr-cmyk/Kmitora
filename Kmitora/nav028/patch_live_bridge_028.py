from __future__ import annotations
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("usage: patch_live_bridge_028.py <live_bridge.py>")

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8-sig")
marker = "# KMITORA_A000_LIVE_RUNTIME_HARDENING_028"
if marker in text:
    print("SKIP 028 grounding hardening already present.")
    raise SystemExit(0)

needle = '''    abstain = bool(confidence.get("abstain")) or validation.get("status") != "PASS"\n    decision = "ABSTAIN_REVIEW" if abstain else "PLAN_READY"\n'''
if needle not in text:
    raise SystemExit("Expected 027 confidence decision block not found; no source modified.")

replacement = '''    # KMITORA_A000_LIVE_RUNTIME_HARDENING_028\n    # Reuse the existing shadow-grounding result when it is already attached\n    # to the normal A000 reply.  Do not create a second retrieval/grounding\n    # implementation here.\n    shadow = (current_reply or {}).get("shadow_runtime") if isinstance(current_reply, Mapping) else None\n    comparison = shadow.get("comparison") if isinstance(shadow, Mapping) else None\n    grounding_available = isinstance(comparison, Mapping) and "shadow_grounded" in comparison\n    grounding_value = (\n        bool(comparison.get("shadow_grounded"))\n        if grounding_available\n        else None\n    )\n    retrieved_count = (\n        int(comparison.get("retrieved_count", 0) or 0)\n        if isinstance(comparison, Mapping)\n        else 0\n    )\n    grounding_abstain = bool(grounding_available and not grounding_value and retrieved_count == 0)\n    if grounding_abstain:\n        confidence = dict(confidence)\n        confidence["abstain"] = True\n        confidence["grounding_reason"] = "EXISTING_SHADOW_RUNTIME_UNGROUNDED"\n\n    abstain = (\n        bool(confidence.get("abstain"))\n        or validation.get("status") != "PASS"\n        or grounding_abstain\n    )\n    decision = "ABSTAIN_REVIEW" if abstain else "PLAN_READY"\n'''
text = text.replace(needle, replacement, 1)

needle2 = '''        "confidence": confidence,\n        "execution_dispatch": {\n'''
if needle2 not in text:
    raise SystemExit("Expected 027 result confidence block not found; no source modified.")
replacement2 = '''        "confidence": confidence,\n        "grounding_guard": {\n            "available": grounding_available,\n            "grounded": grounding_value,\n            "retrieved_count": retrieved_count,\n            "reused_existing_shadow_runtime": True,\n            "abstain": grounding_abstain,\n        },\n        "execution_dispatch": {\n'''
text = text.replace(needle2, replacement2, 1)
path.write_text(text, encoding="utf-8")
print("PATCHED live_bridge.py with 028 shadow-grounding reuse guard.")
