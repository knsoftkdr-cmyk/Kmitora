from __future__ import annotations
import hashlib
import json
from typing import Dict, List, Tuple
from .model import SemanticFlow, SemanticOperation


def semantic_fingerprint(op: SemanticOperation) -> str:
    payload = json.dumps(op.canonical_payload(), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def collapse_exact_semantic_duplicates(flow: SemanticFlow) -> Tuple[SemanticFlow, Dict[str, str]]:
    fp_to_keep: Dict[str, str] = {}
    redirect: Dict[str, str] = {}
    kept = {}

    for op in flow.operations.values():
        fp = semantic_fingerprint(op)
        if fp in fp_to_keep:
            redirect[op.id] = fp_to_keep[fp]
        else:
            fp_to_keep[fp] = op.id
            kept[op.id] = op

    new_edges = []
    for a, b in flow.edges:
        a2 = redirect.get(a, a)
        b2 = redirect.get(b, b)
        if a2 != b2 and (a2, b2) not in new_edges:
            new_edges.append((a2, b2))

    flow.operations = kept
    flow.edges = new_edges
    return flow, redirect

