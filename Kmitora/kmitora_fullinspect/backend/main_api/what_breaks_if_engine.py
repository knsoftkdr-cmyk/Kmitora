from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any
import uuid


ENGINE_VERSION = "1.0.0"

ALLOWED_RELATIONSHIPS = {
    "DEPENDS_ON",
    "CALLS",
    "CONSUMES",
    "PUBLISHES",
    "READS",
    "WRITES",
    "CONTAINS",
    "RELATES_TO",
    "MAPS_TO",
    "IMPLEMENTS",
    "IMPLEMENTS_BY",
    "VALIDATED_BY",
    "IMPACTS",
    "RUNS_ON",
    "AUTHENTICATES_VIA",
    "USES",
    "PRODUCES",
    "TRIGGERS",
    "OWNED_BY",
}

CATEGORY_WEIGHTS = {
    "BUSINESS_PROCESS": 1.00,
    "BUSINESS_CAPABILITY": 1.00,
    "APPLICATION": 0.95,
    "SERVICE": 0.90,
    "API": 0.88,
    "DATABASE": 0.90,
    "TABLE": 0.82,
    "COLUMN": 0.72,
    "QUEUE": 0.80,
    "EVENT": 0.80,
    "JOB": 0.78,
    "REPORT": 0.72,
    "DASHBOARD": 0.70,
    "SECURITY_CONTROL": 0.90,
    "IDENTITY": 0.90,
    "INFRASTRUCTURE": 0.82,
    "TEST": 0.55,
    "USER_GROUP": 0.70,
    "UNKNOWN": 0.50,
}

CHANGE_SEVERITY = {
    "DROP": 100,
    "DELETE": 100,
    "REMOVE": 100,
    "RETIRE": 95,
    "BREAKING_API": 95,
    "TYPE_CHANGE": 88,
    "RENAME": 82,
    "MIGRATE": 75,
    "UPGRADE": 68,
    "CONFIG_CHANGE": 60,
    "BUSINESS_RULE_CHANGE": 72,
    "SECURITY_CHANGE": 78,
    "PERFORMANCE_CHANGE": 52,
    "GENERIC": 55,
}


@dataclass(frozen=True)
class Node:
    id: str
    label: str
    kind: str
    criticality: int
    metadata: dict[str, Any]


@dataclass(frozen=True)
class Edge:
    source: str
    target: str
    relationship: str
    confidence: int
    evidence: list[str]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bounded(value: float) -> int:
    return max(0, min(100, int(round(value))))


def _norm_kind(value: Any) -> str:
    text = str(value or "UNKNOWN").strip().upper()
    return text or "UNKNOWN"


def _norm_change_type(value: Any) -> str:
    raw = str(value or "GENERIC").strip().upper().replace(" ", "_")
    aliases = {
        "DROP_COLUMN": "DROP",
        "DROP_TABLE": "DROP",
        "DROP_API": "DROP",
        "DELETE": "DELETE",
        "REMOVE": "REMOVE",
        "RETIRE_API": "RETIRE",
        "API_BREAK": "BREAKING_API",
        "BREAK_API": "BREAKING_API",
        "DATA_TYPE_CHANGE": "TYPE_CHANGE",
        "SCHEMA_CHANGE": "TYPE_CHANGE",
        "RULE_CHANGE": "BUSINESS_RULE_CHANGE",
        "POLICY_CHANGE": "BUSINESS_RULE_CHANGE",
    }
    return aliases.get(raw, raw if raw in CHANGE_SEVERITY else "GENERIC")


def _build_nodes(raw_nodes: list[dict[str, Any]]) -> dict[str, Node]:
    nodes: dict[str, Node] = {}

    for item in raw_nodes:
        node_id = str(item.get("id") or "").strip()
        if not node_id:
            continue

        criticality = _bounded(float(item.get("criticality", 50)))

        nodes[node_id] = Node(
            id=node_id,
            label=str(item.get("label") or item.get("name") or node_id),
            kind=_norm_kind(item.get("kind") or item.get("type")),
            criticality=criticality,
            metadata=dict(item.get("metadata") or {}),
        )

    return nodes


def _build_edges(
    raw_edges: list[dict[str, Any]],
    nodes: dict[str, Node],
) -> list[Edge]:
    edges: list[Edge] = []

    for item in raw_edges:
        source = str(
            item.get("source")
            or item.get("from")
            or ""
        ).strip()

        target = str(
            item.get("target")
            or item.get("to")
            or ""
        ).strip()

        relationship = str(
            item.get("relationship")
            or item.get("type")
            or "DEPENDS_ON"
        ).strip().upper()

        if not source or not target:
            continue

        if source not in nodes or target not in nodes:
            continue

        if relationship not in ALLOWED_RELATIONSHIPS:
            relationship = "DEPENDS_ON"

        edges.append(
            Edge(
                source=source,
                target=target,
                relationship=relationship,
                confidence=_bounded(
                    float(item.get("confidence", 80))
                ),
                evidence=[
                    str(x)
                    for x in (item.get("evidence") or [])
                ],
            )
        )

    return edges


def _adjacency(edges: list[Edge]):
    downstream: dict[str, list[Edge]] = defaultdict(list)
    upstream: dict[str, list[Edge]] = defaultdict(list)

    for edge in edges:
        downstream[edge.source].append(edge)
        upstream[edge.target].append(edge)

    return downstream, upstream


def _walk(
    start: str,
    graph: dict[str, list[Edge]],
    reverse: bool,
    max_depth: int,
):
    queue = deque([(start, [start], [], 0)])
    best_depth: dict[str, int] = {start: 0}
    paths: list[dict[str, Any]] = []

    while queue:
        current, node_path, edge_path, depth = queue.popleft()

        if depth >= max_depth:
            continue

        for edge in graph.get(current, []):
            nxt = edge.source if reverse else edge.target

            if nxt in node_path:
                continue

            new_nodes = node_path + [nxt]
            new_edges = edge_path + [edge]
            new_depth = depth + 1

            previous = best_depth.get(nxt)

            if previous is None or new_depth <= previous:
                best_depth[nxt] = new_depth

                confidence = 100
                for item in new_edges:
                    confidence = min(
                        confidence,
                        item.confidence,
                    )

                paths.append(
                    {
                        "asset_id": nxt,
                        "depth": new_depth,
                        "node_path": new_nodes,
                        "relationships": [
                            e.relationship for e in new_edges
                        ],
                        "confidence": confidence,
                        "evidence": sorted(
                            {
                                evidence
                                for e in new_edges
                                for evidence in e.evidence
                            }
                        ),
                    }
                )

                queue.append(
                    (
                        nxt,
                        new_nodes,
                        new_edges,
                        new_depth,
                    )
                )

    return paths


def _detect_cycles(
    nodes: dict[str, Node],
    downstream: dict[str, list[Edge]],
):
    cycles: list[list[str]] = []
    seen_signatures: set[tuple[str, ...]] = set()

    def canonical(cycle: list[str]):
        body = cycle[:-1]
        rotations = [
            tuple(body[i:] + body[:i])
            for i in range(len(body))
        ]
        return min(rotations)

    def dfs(
        current: str,
        path: list[str],
        visiting: set[str],
    ):
        visiting.add(current)
        path.append(current)

        for edge in downstream.get(current, []):
            nxt = edge.target

            if nxt in visiting:
                idx = path.index(nxt)
                cycle = path[idx:] + [nxt]
                sig = canonical(cycle)

                if sig not in seen_signatures:
                    seen_signatures.add(sig)
                    cycles.append(cycle)

            elif len(path) < 20:
                dfs(nxt, path, visiting)

        path.pop()
        visiting.discard(current)

    for node_id in nodes:
        dfs(node_id, [], set())

    return cycles[:50]


def _impact_score(
    node: Node,
    depth: int,
    path_confidence: int,
    change_type: str,
):
    severity = CHANGE_SEVERITY.get(change_type, 55)
    category_weight = CATEGORY_WEIGHTS.get(
        node.kind,
        CATEGORY_WEIGHTS["UNKNOWN"],
    )

    depth_factor = max(0.30, 1.0 - (depth - 1) * 0.12)
    confidence_factor = path_confidence / 100.0
    criticality_factor = node.criticality / 100.0

    raw = (
        severity * 0.35
        + node.criticality * 0.35
        + 100 * category_weight * 0.15
        + 100 * depth_factor * confidence_factor * 0.15
    )

    raw *= 0.75 + 0.25 * criticality_factor

    return _bounded(raw)


def _risk_level(score: int) -> str:
    if score >= 85:
        return "CRITICAL"
    if score >= 70:
        return "HIGH"
    if score >= 45:
        return "MEDIUM"
    return "LOW"


def _required_tests(kinds: set[str], change_type: str):
    tests = {
        "Dependency graph integrity",
        "Negative impact simulation",
        "Regression verification",
        "Rollback verification",
    }

    if {"DATABASE", "TABLE", "COLUMN"} & kinds:
        tests |= {
            "Schema compatibility",
            "Referential integrity",
            "Data reconciliation",
            "Query regression",
        }

    if {"API", "SERVICE", "APPLICATION"} & kinds:
        tests |= {
            "API contract",
            "Integration",
            "Service regression",
            "Backward compatibility",
        }

    if {"BUSINESS_PROCESS", "BUSINESS_CAPABILITY"} & kinds:
        tests |= {
            "Business rule validation",
            "End-to-end business process",
            "SLA validation",
        }

    if {"SECURITY_CONTROL", "IDENTITY"} & kinds:
        tests |= {
            "Authorization",
            "Authentication",
            "Security regression",
            "Least-privilege validation",
        }

    if change_type in {
        "DROP",
        "DELETE",
        "REMOVE",
        "RETIRE",
        "BREAKING_API",
    }:
        tests.add("Consumer survivability")

    return sorted(tests)


def analyze_what_breaks_if(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Deterministic read-only impact analysis.

    No source write.
    No target write.
    No infrastructure mutation.
    No production action.
    """

    analysis_id = "IMPACT-" + uuid.uuid4().hex[:12].upper()

    raw_nodes = payload.get("nodes") or []
    raw_edges = payload.get("relationships") or payload.get("edges") or []

    nodes = _build_nodes(raw_nodes)
    edges = _build_edges(raw_edges, nodes)

    change = payload.get("change") or {}

    asset_id = str(
        change.get("asset_id")
        or payload.get("asset_id")
        or ""
    ).strip()

    if not asset_id:
        raise ValueError("change.asset_id is required")

    if asset_id not in nodes:
        raise ValueError(
            f"Changed asset not found in graph: {asset_id}"
        )

    change_type = _norm_change_type(
        change.get("type")
        or payload.get("change_type")
    )

    description = str(
        change.get("description")
        or payload.get("description")
        or ""
    ).strip()

    max_depth = int(payload.get("max_depth", 8))
    max_depth = max(1, min(20, max_depth))

    downstream, upstream = _adjacency(edges)

    downstream_paths = _walk(
        asset_id,
        downstream,
        False,
        max_depth,
    )

    upstream_paths = _walk(
        asset_id,
        upstream,
        True,
        max_depth,
    )

    impacted_by_id: dict[str, dict[str, Any]] = {}

    for path in downstream_paths:
        node = nodes[path["asset_id"]]
        score = _impact_score(
            node,
            path["depth"],
            path["confidence"],
            change_type,
        )

        current = impacted_by_id.get(node.id)

        candidate = {
            "asset_id": node.id,
            "label": node.label,
            "kind": node.kind,
            "depth": path["depth"],
            "risk_score": score,
            "risk_level": _risk_level(score),
            "criticality": node.criticality,
            "confidence": path["confidence"],
            "path": path["node_path"],
            "relationships": path["relationships"],
            "evidence": path["evidence"],
            "metadata": node.metadata,
        }

        if (
            current is None
            or candidate["risk_score"] > current["risk_score"]
            or candidate["depth"] < current["depth"]
        ):
            impacted_by_id[node.id] = candidate

    impacted = sorted(
        impacted_by_id.values(),
        key=lambda x: (
            -x["risk_score"],
            x["depth"],
            x["label"],
        ),
    )

    impacted_kinds = {item["kind"] for item in impacted}

    business_impact = [
        x for x in impacted
        if x["kind"] in {
            "BUSINESS_PROCESS",
            "BUSINESS_CAPABILITY",
            "USER_GROUP",
            "REPORT",
            "DASHBOARD",
        }
    ]

    technical_impact = [
        x for x in impacted
        if x["kind"] not in {
            "BUSINESS_PROCESS",
            "BUSINESS_CAPABILITY",
            "USER_GROUP",
            "REPORT",
            "DASHBOARD",
        }
    ]

    cycles = _detect_cycles(nodes, downstream)

    referenced_nodes = {
        edge.source for edge in edges
    } | {
        edge.target for edge in edges
    }

    blind_spots = []

    for node in nodes.values():
        if node.id == asset_id:
            continue

        if node.id not in referenced_nodes:
            blind_spots.append(
                {
                    "asset_id": node.id,
                    "label": node.label,
                    "kind": node.kind,
                    "reason": "Asset has no observed dependency relationships",
                    "severity": "MEDIUM",
                }
            )

        if node.criticality >= 80 and not node.metadata.get(
            "owner"
        ):
            blind_spots.append(
                {
                    "asset_id": node.id,
                    "label": node.label,
                    "kind": node.kind,
                    "reason": "Critical asset has no recorded owner",
                    "severity": "HIGH",
                }
            )

    critical_paths = [
        item
        for item in impacted
        if item["risk_score"] >= 70
    ][:20]

    rollback_set = sorted(
        {
            asset_id,
            *[
                item["asset_id"]
                for item in impacted
                if item["risk_score"] >= 70
            ],
        }
    )

    direct_count = sum(
        1 for item in impacted
        if item["depth"] == 1
    )

    transitive_count = sum(
        1 for item in impacted
        if item["depth"] > 1
    )

    highest_score = max(
        [item["risk_score"] for item in impacted],
        default=0,
    )

    changed = nodes[asset_id]

    if highest_score >= 85:
        decision = "BLOCK_AND_REDESIGN"
    elif highest_score >= 70:
        decision = "SIMULATE_AND_APPROVE"
    elif highest_score >= 45:
        decision = "SIMULATE_AND_TEST"
    else:
        decision = "LOW_RISK_REVIEW"

    evidence_material = {
        "asset_id": asset_id,
        "change_type": change_type,
        "nodes": sorted(nodes),
        "edges": [
            asdict(edge)
            for edge in edges
        ],
        "impacted": [
            x["asset_id"]
            for x in impacted
        ],
    }

    evidence_hash = sha256(
        repr(evidence_material).encode("utf-8")
    ).hexdigest()

    return {
        "analysis_id": analysis_id,
        "engine": "KMITORA What Breaks If Engine",
        "engine_version": ENGINE_VERSION,
        "generated_at": _now(),
        "status": "COMPLETE",
        "mode": "READ_ONLY_SIMULATION",
        "changed_asset": {
            "id": changed.id,
            "label": changed.label,
            "kind": changed.kind,
            "criticality": changed.criticality,
        },
        "change": {
            "type": change_type,
            "description": description,
            "base_severity": CHANGE_SEVERITY.get(
                change_type,
                55,
            ),
        },
        "summary": {
            "graph_nodes": len(nodes),
            "graph_relationships": len(edges),
            "direct_impacts": direct_count,
            "transitive_impacts": transitive_count,
            "total_impacted_assets": len(impacted),
            "business_impacts": len(business_impact),
            "technical_impacts": len(technical_impact),
            "critical_paths": len(critical_paths),
            "cycles_detected": len(cycles),
            "blind_spots": len(blind_spots),
            "highest_risk_score": highest_score,
            "highest_risk_level": _risk_level(
                highest_score
            ),
        },
        "decision": {
            "recommendation": decision,
            "approval_required":
                highest_score >= 70,
            "simulation_required":
                highest_score >= 45,
            "reason":
                "Decision derived from deterministic dependency "
                "closure, asset criticality, change severity, "
                "path depth and evidence confidence.",
        },
        "impacted_assets": impacted,
        "business_impact": business_impact,
        "technical_impact": technical_impact,
        "upstream_dependencies": upstream_paths,
        "downstream_dependencies": downstream_paths,
        "critical_paths": critical_paths,
        "cycles": cycles,
        "blind_spots": blind_spots,
        "required_tests": _required_tests(
            impacted_kinds,
            change_type,
        ),
        "rollback_set": rollback_set,
        "executive_summary": {
            "headline":
                f"{changed.label}: "
                f"{len(impacted)} impacted asset(s), "
                f"highest risk {_risk_level(highest_score)}",
            "business_message":
                f"{len(business_impact)} business-facing "
                "asset(s) may be affected.",
            "technical_message":
                f"{len(technical_impact)} technical asset(s) "
                "are within the dependency blast radius.",
            "recommended_action": decision,
        },
        "evidence": {
            "evidence_hash_sha256": evidence_hash,
            "graph_complete":
                len(blind_spots) == 0,
            "evidence_confidence":
                _bounded(
                    100
                    - min(40, len(blind_spots) * 5)
                ),
        },
        "safety": {
            "authoritative": False,
            "read_only": True,
            "source_write_executed": False,
            "target_write_executed": False,
            "infrastructure_change_executed": False,
            "network_change_executed": False,
            "security_change_executed": False,
            "production_action_executed": False,
            "cutover_executed": False,
        },
    }


def engine_status() -> dict[str, Any]:
    return {
        "engine": "KMITORA What Breaks If Engine",
        "version": ENGINE_VERSION,
        "status": "READY",
        "capabilities": [
            "direct_dependency_analysis",
            "transitive_dependency_closure",
            "upstream_dependency_analysis",
            "downstream_blast_radius",
            "business_impact",
            "technical_impact",
            "risk_scoring",
            "critical_path_detection",
            "cycle_detection",
            "blind_spot_detection",
            "required_test_generation",
            "rollback_set_generation",
            "executive_summary",
            "evidence_hashing",
            "counterfactual_read_only_simulation",
        ],
        "safety": {
            "read_only": True,
            "production_action_executed": False,
            "target_write_executed": False,
            "cutover_executed": False,
        },
    }
