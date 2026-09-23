from __future__ import annotations
from typing import Any, Dict, List
from .database_universe import universe, norm

CATEGORY_CAPS = {
    "relational": ["KDBC-0003","KDBC-0005","KDBC-0009","KDBC-0010","KDBC-0011","KDBC-0012","KDBC-0013","KDBC-0015"],
    "distributed sql": ["KDBC-0017","KDBC-0018","KDBC-0021","KDBC-0044","KDBC-0072"],
    "document": ["KDBC-0049","KDBC-0061","KDBC-0037"],
    "key-value": ["KDBC-0059","KDBC-0060","KDBC-0023"],
    "wide-column": ["KDBC-0060","KDBC-0017","KDBC-0018"],
    "graph": ["KDBC-0051","KDBC-0035","KDBC-0009"],
    "vector": ["KDBC-0052","KDBC-0053","KDBC-0023"],
    "time-series": ["KDBC-0054","KDBC-0025","KDBC-0026"],
    "search": ["KDBC-0053","KDBC-0023","KDBC-0025"],
    "warehouse": ["KDBC-0056","KDBC-0024","KDBC-0067"],
    "analytics": ["KDBC-0056","KDBC-0024","KDBC-0058"],
    "lakehouse": ["KDBC-0057","KDBC-0037","KDBC-0035"],
    "stream": ["KDBC-0047","KDBC-0062","KDBC-0019"],
    "embedded": ["KDBC-0064","KDBC-0020","KDBC-0048"],
    "mobile": ["KDBC-0064","KDBC-0037","KDBC-0030"],
    "ledger": ["KDBC-0062","KDBC-0029","KDBC-0035"],
    "immutable": ["KDBC-0062","KDBC-0029","KDBC-0041"],
    "feature": ["KDBC-0065","KDBC-0035","KDBC-0046"],
    "federat": ["KDBC-0045","KDBC-0048","KDBC-0035"],
    "virtual": ["KDBC-0045","KDBC-0035","KDBC-0073"],
}

BASE_SAFE = ["KDBC-0074","KDBC-0075","KDBC-0076","KDBC-0029","KDBC-0070"]

def _unique(seq):
    out=[]; seen=set()
    for x in seq:
        if x not in seen:
            seen.add(x); out.append(x)
    return out


def route(context: Dict[str, Any]) -> Dict[str, Any]:
    database_name=str(context.get("database") or context.get("technology") or "")
    objective=str(context.get("objective") or "")
    problem=str(context.get("problem") or "")
    rules=context.get("business_rules") or []
    if isinstance(rules,str): rules=[rules]
    text=" ".join([database_name, objective, problem, *map(str,rules), " ".join(map(str,context.get("tags") or []))])
    db=universe.database(database_name)
    cap_ids=[]
    if db:
        cat=norm(db.get("category",""))
        for needle, ids in CATEGORY_CAPS.items():
            if needle in cat: cap_ids.extend(ids)
    cap_ids.extend(x["id"] for x in universe.search_capabilities(text, limit=24))
    cap_ids.extend(BASE_SAFE)
    cap_ids=_unique(cap_ids)
    caps=[universe._cap_by_id[x] for x in cap_ids if x in universe._cap_by_id]
    risk=str(context.get("risk") or "MEDIUM").upper()
    environment=str(context.get("environment") or "DEV").upper()
    return {
        "status":"ROUTED",
        "database":db,
        "matched_capabilities":caps,
        "business_rules":rules,
        "risk":risk,
        "environment":environment,
        "execution_authority":"NONE",
        "mode":"KNOWLEDGE_AND_ROUTING_ONLY",
        "source_write_executed":False,
        "target_write_executed":False,
        "production_action_executed":False,
        "cutover_executed":False,
        "note":"A000 may plan and select capabilities; governed execution remains a separate authorized runtime concern.",
    }
