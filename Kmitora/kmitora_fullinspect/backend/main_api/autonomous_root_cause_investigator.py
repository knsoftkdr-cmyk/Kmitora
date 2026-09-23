from __future__ import annotations

from collections import defaultdict, deque
from copy import deepcopy
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any
import json
import math
import uuid


ENGINE_VERSION = "1.0.0"

SUPPORTED_DOMAINS = {
    "APPLICATION",
    "API",
    "DATABASE",
    "DATA",
    "MIGRATION",
    "BUSINESS_RULE",
    "INTEGRATION",
    "MESSAGING",
    "INFRASTRUCTURE",
    "NETWORK",
    "SECURITY",
    "IAM",
    "OBSERVABILITY",
    "PERFORMANCE",
    "UNKNOWN",
}

SUPPORTED_SIGNAL_TYPES = {
    "ERROR",
    "LOG",
    "TRACE",
    "METRIC",
    "TEST_FAILURE",
    "VALIDATION_FAILURE",
    "RECONCILIATION_VARIANCE",
    "ALERT",
    "USER_REPORT",
    "DATA_QUALITY",
    "DEPENDENCY_FAILURE",
    "CHANGE_EVENT",
    "POLICY_FINDING",
    "SILENT_FAILURE",
}

ROOT_CAUSE_THRESHOLD = 70.0
STRONG_CAUSE_THRESHOLD = 85.0


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _stable_json(value: Any) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
        default=str,
    )


def _hash(value: Any) -> str:
    return sha256(
        _stable_json(value).encode("utf-8")
    ).hexdigest()


def _bounded(
    value: Any,
    low: float = 0.0,
    high: float = 100.0,
) -> float:
    try:
        number = float(value)
    except Exception:
        number = low

    return max(low, min(high, number))


def _safety() -> dict[str, Any]:
    return {
        "authoritative": False,
        "read_only": True,
        "investigation_only": True,
        "source_write_executed": False,
        "target_write_executed": False,
        "production_action_executed": False,
        "remediation_executed": False,
        "cutover_executed": False,
    }


def _normalize_asset(
    asset: dict[str, Any]
) -> dict[str, Any]:

    asset_id = str(
        asset.get("id")
        or asset.get("asset_id")
        or ""
    ).strip()

    if not asset_id:
        raise ValueError(
            "asset id is required"
        )

    normalized = deepcopy(asset)

    normalized["id"] = asset_id

    normalized["kind"] = str(
        normalized.get("kind")
        or normalized.get("type")
        or "UNKNOWN"
    ).upper()

    normalized["domain"] = str(
        normalized.get("domain")
        or normalized.get("kind")
        or "UNKNOWN"
    ).upper()

    if normalized["domain"] not in SUPPORTED_DOMAINS:
        normalized["domain"] = "UNKNOWN"

    normalized["criticality"] = str(
        normalized.get("criticality")
        or "MEDIUM"
    ).upper()

    return normalized


def _normalize_relationship(
    relationship: dict[str, Any]
) -> dict[str, Any]:

    source = str(
        relationship.get("source")
        or relationship.get("from")
        or ""
    ).strip()

    target = str(
        relationship.get("target")
        or relationship.get("to")
        or ""
    ).strip()

    relation_type = str(
        relationship.get("type")
        or relationship.get("relationship")
        or "DEPENDS_ON"
    ).upper()

    relationship_id = str(
        relationship.get("id")
        or ""
    ).strip()

    if not relationship_id:
        relationship_id = (
            f"{source}|{relation_type}|{target}"
        )

    return {
        **deepcopy(relationship),
        "id": relationship_id,
        "source": source,
        "target": target,
        "type": relation_type,
        "confidence": _bounded(
            relationship.get(
                "confidence",
                100,
            )
        ),
    }


def _normalize_signal(
    signal: dict[str, Any],
    sequence: int,
) -> dict[str, Any]:

    signal_id = str(
        signal.get("id")
        or signal.get("signal_id")
        or ""
    ).strip()

    if not signal_id:
        signal_id = (
            f"SIG-{sequence:04d}"
        )

    signal_type = str(
        signal.get("type")
        or signal.get("signal_type")
        or "ALERT"
    ).upper()

    if signal_type not in SUPPORTED_SIGNAL_TYPES:
        signal_type = "ALERT"

    domain = str(
        signal.get("domain")
        or "UNKNOWN"
    ).upper()

    if domain not in SUPPORTED_DOMAINS:
        domain = "UNKNOWN"

    return {
        **deepcopy(signal),
        "id": signal_id,
        "type": signal_type,
        "domain": domain,
        "asset_id": str(
            signal.get("asset_id")
            or ""
        ).strip(),
        "severity": str(
            signal.get("severity")
            or "MEDIUM"
        ).upper(),
        "confidence": _bounded(
            signal.get(
                "confidence",
                70,
            )
        ),
        "timestamp": str(
            signal.get("timestamp")
            or ""
        ),
        "message": str(
            signal.get("message")
            or signal.get("description")
            or ""
        ),
        "tags": sorted(
            {
                str(item).lower()
                for item in (
                    signal.get("tags")
                    or []
                )
            }
        ),
    }


def normalize_incident(
    payload: dict[str, Any]
) -> dict[str, Any]:

    incident = payload.get(
        "incident"
    )

    if not isinstance(incident, dict):
        raise ValueError(
            "incident is required"
        )

    signals = payload.get(
        "signals"
    ) or []

    if not isinstance(signals, list):
        raise ValueError(
            "signals must be a list"
        )

    normalized_signals = []

    for index, signal in enumerate(
        signals,
        start=1,
    ):
        if not isinstance(signal, dict):
            continue

        normalized_signals.append(
            _normalize_signal(
                signal,
                index,
            )
        )

    incident_id = str(
        incident.get("id")
        or incident.get("incident_id")
        or ""
    ).strip()

    if not incident_id:
        incident_id = (
            "INC-"
            + uuid.uuid4().hex[:12].upper()
        )

    normalized_incident = {
        "incident_id": incident_id,
        "title": str(
            incident.get("title")
            or "Enterprise incident"
        ),
        "description": str(
            incident.get("description")
            or ""
        ),
        "reported_at": str(
            incident.get("reported_at")
            or _now()
        ),
        "severity": str(
            incident.get("severity")
            or "MEDIUM"
        ).upper(),
        "environment": str(
            incident.get("environment")
            or "DEV"
        ).upper(),
        "primary_asset_id": str(
            incident.get(
                "primary_asset_id"
            )
            or ""
        ),
        "symptoms": [
            str(item)
            for item in (
                incident.get("symptoms")
                or []
            )
        ],
    }

    material = {
        "incident": normalized_incident,
        "signals": normalized_signals,
    }

    return {
        "status": "NORMALIZED",
        "incident": normalized_incident,
        "signals": normalized_signals,
        "signal_count": len(
            normalized_signals
        ),
        "incident_hash_sha256": (
            _hash(material)
        ),
        "safety": _safety(),
    }


def build_dependency_graph(
    payload: dict[str, Any]
) -> dict[str, Any]:

    assets_raw = payload.get(
        "assets"
    ) or []

    relationships_raw = payload.get(
        "relationships"
    ) or []

    if not isinstance(assets_raw, list):
        raise ValueError(
            "assets must be a list"
        )

    if not isinstance(
        relationships_raw,
        list,
    ):
        raise ValueError(
            "relationships must be a list"
        )

    assets = {}

    for raw in assets_raw:
        if not isinstance(raw, dict):
            continue

        asset = _normalize_asset(raw)
        assets[asset["id"]] = asset

    relationships = []

    adjacency = defaultdict(list)
    reverse_adjacency = defaultdict(list)

    for raw in relationships_raw:
        if not isinstance(raw, dict):
            continue

        rel = _normalize_relationship(
            raw
        )

        if (
            rel["source"] not in assets
            or rel["target"] not in assets
        ):
            continue

        relationships.append(rel)

        adjacency[
            rel["source"]
        ].append(rel)

        reverse_adjacency[
            rel["target"]
        ].append(rel)

    graph_material = {
        "assets": [
            assets[key]
            for key in sorted(assets)
        ],
        "relationships": sorted(
            relationships,
            key=lambda item: item["id"],
        ),
    }

    return {
        "status": "GRAPH_READY",
        "assets": assets,
        "relationships": relationships,
        "adjacency": dict(adjacency),
        "reverse_adjacency": dict(
            reverse_adjacency
        ),
        "asset_count": len(assets),
        "relationship_count": len(
            relationships
        ),
        "graph_hash_sha256": (
            _hash(graph_material)
        ),
        "safety": _safety(),
    }


def trace_dependencies(
    payload: dict[str, Any]
) -> dict[str, Any]:

    graph = build_dependency_graph(
        payload
    )

    start_asset = str(
        payload.get("start_asset_id")
        or ""
    ).strip()

    if start_asset not in graph["assets"]:
        raise ValueError(
            "start_asset_id is unknown"
        )

    max_depth = int(
        payload.get(
            "max_depth",
            6,
        )
    )

    max_depth = max(
        1,
        min(12, max_depth),
    )

    include_upstream = bool(
        payload.get(
            "include_upstream",
            True,
        )
    )

    include_downstream = bool(
        payload.get(
            "include_downstream",
            True,
        )
    )

    paths = []
    reached = {
        start_asset
    }

    queue = deque(
        [
            (
                start_asset,
                [start_asset],
                0,
                "START",
            )
        ]
    )

    while queue:
        node, path, depth, direction = (
            queue.popleft()
        )

        if depth >= max_depth:
            continue

        candidate_edges = []

        if include_downstream:
            for edge in graph[
                "adjacency"
            ].get(node, []):
                candidate_edges.append(
                    (
                        edge["target"],
                        edge,
                        "DOWNSTREAM",
                    )
                )

        if include_upstream:
            for edge in graph[
                "reverse_adjacency"
            ].get(node, []):
                candidate_edges.append(
                    (
                        edge["source"],
                        edge,
                        "UPSTREAM",
                    )
                )

        for next_node, edge, next_direction in candidate_edges:

            if next_node in path:
                continue

            next_path = (
                path + [next_node]
            )

            paths.append(
                {
                    "direction": (
                        next_direction
                    ),
                    "depth": depth + 1,
                    "asset_path": next_path,
                    "relationship_id": (
                        edge["id"]
                    ),
                    "relationship_type": (
                        edge["type"]
                    ),
                    "edge_confidence": (
                        edge["confidence"]
                    ),
                }
            )

            reached.add(next_node)

            queue.append(
                (
                    next_node,
                    next_path,
                    depth + 1,
                    next_direction,
                )
            )

    impacted_assets = [
        graph["assets"][asset_id]
        for asset_id in sorted(reached)
        if asset_id != start_asset
    ]

    return {
        "trace_id": (
            "RCATRACE-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "start_asset_id": start_asset,
        "max_depth": max_depth,
        "path_count": len(paths),
        "paths": paths,
        "impacted_asset_count": len(
            impacted_assets
        ),
        "impacted_assets": (
            impacted_assets
        ),
        "safety": _safety(),
    }


def reconstruct_timeline(
    payload: dict[str, Any]
) -> dict[str, Any]:

    signals = payload.get(
        "signals"
    ) or []

    changes = payload.get(
        "changes"
    ) or []

    if not isinstance(signals, list):
        raise ValueError(
            "signals must be a list"
        )

    if not isinstance(changes, list):
        raise ValueError(
            "changes must be a list"
        )

    events = []

    for index, raw in enumerate(
        signals,
        start=1,
    ):
        if not isinstance(raw, dict):
            continue

        signal = _normalize_signal(
            raw,
            index,
        )

        events.append(
            {
                "event_type": "SIGNAL",
                "event_id": signal["id"],
                "timestamp": signal[
                    "timestamp"
                ],
                "asset_id": signal[
                    "asset_id"
                ],
                "domain": signal[
                    "domain"
                ],
                "summary": signal[
                    "message"
                ],
                "severity": signal[
                    "severity"
                ],
            }
        )

    for index, change in enumerate(
        changes,
        start=1,
    ):
        if not isinstance(change, dict):
            continue

        events.append(
            {
                "event_type": (
                    "CHANGE"
                ),
                "event_id": str(
                    change.get("id")
                    or f"CHG-{index:04d}"
                ),
                "timestamp": str(
                    change.get("timestamp")
                    or ""
                ),
                "asset_id": str(
                    change.get("asset_id")
                    or ""
                ),
                "domain": str(
                    change.get("domain")
                    or "UNKNOWN"
                ).upper(),
                "summary": str(
                    change.get("description")
                    or change.get("change")
                    or ""
                ),
                "severity": str(
                    change.get("risk")
                    or "UNKNOWN"
                ).upper(),
            }
        )

    events.sort(
        key=lambda item: (
            item["timestamp"],
            item["event_type"],
            item["event_id"],
        )
    )

    correlated_changes = [
        item
        for item in events
        if item["event_type"] == "CHANGE"
    ]

    return {
        "timeline_id": (
            "RCATIME-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "event_count": len(events),
        "events": events,
        "change_count": len(
            correlated_changes
        ),
        "correlated_changes": (
            correlated_changes
        ),
        "timeline_hash_sha256": (
            _hash(events)
        ),
        "safety": _safety(),
    }


def _domain_match_score(
    hypothesis_domain: str,
    signals: list[dict[str, Any]],
) -> float:

    relevant = [
        signal
        for signal in signals
        if signal["domain"] == hypothesis_domain
    ]

    if not relevant:
        return 0.0

    average = sum(
        signal["confidence"]
        for signal in relevant
    ) / len(relevant)

    return _bounded(average)


def _tag_match_score(
    keywords: set[str],
    signals: list[dict[str, Any]],
) -> float:

    hits = 0
    total = 0

    for signal in signals:
        text = (
            signal["message"].lower()
            + " "
            + " ".join(signal["tags"])
        )

        total += len(keywords)

        for keyword in keywords:
            if keyword in text:
                hits += 1

    if total == 0:
        return 0.0

    return _bounded(
        hits / total * 100
    )


def generate_hypotheses(
    payload: dict[str, Any]
) -> dict[str, Any]:

    normalized = normalize_incident(
        payload
    )

    signals = normalized["signals"]

    hypotheses = [
        {
            "hypothesis_id": "RCA-DATA-001",
            "title": (
                "Data integrity or authoritative-data defect"
            ),
            "domain": "DATA",
            "keywords": {
                "orphan",
                "missing",
                "null",
                "duplicate",
                "referential",
                "foreign key",
                "variance",
                "mismatch",
            },
            "base_probability": 35.0,
            "recommended_validation": [
                "Compare source and target business keys",
                "Validate referential integrity",
                "Trace authoritative source lineage",
                "Compare reconciliation variance",
            ],
        },
        {
            "hypothesis_id": "RCA-MIG-001",
            "title": (
                "Migration sequencing, mapping or transformation defect"
            ),
            "domain": "MIGRATION",
            "keywords": {
                "mapping",
                "wave",
                "load",
                "migration",
                "transform",
                "sequence",
                "target",
                "source",
            },
            "base_probability": 35.0,
            "recommended_validation": [
                "Review load-wave dependency order",
                "Compare mapping and transformation rules",
                "Replay affected migration events",
                "Check blocked and rejected records",
            ],
        },
        {
            "hypothesis_id": "RCA-DB-001",
            "title": (
                "Database constraint, connection, query or locking defect"
            ),
            "domain": "DATABASE",
            "keywords": {
                "database",
                "sql",
                "constraint",
                "lock",
                "deadlock",
                "connection",
                "timeout",
                "query",
            },
            "base_probability": 30.0,
            "recommended_validation": [
                "Review DB errors and SQL state",
                "Inspect locks and connection saturation",
                "Validate schema and constraints",
                "Check slow-query evidence",
            ],
        },
        {
            "hypothesis_id": "RCA-API-001",
            "title": (
                "API contract, authentication or availability defect"
            ),
            "domain": "API",
            "keywords": {
                "api",
                "http",
                "500",
                "401",
                "403",
                "404",
                "429",
                "contract",
                "endpoint",
            },
            "base_probability": 30.0,
            "recommended_validation": [
                "Compare API contract and version",
                "Validate request/response schema",
                "Check authentication and authorization",
                "Review latency and error-rate traces",
            ],
        },
        {
            "hypothesis_id": "RCA-INFRA-001",
            "title": (
                "Infrastructure or capacity defect"
            ),
            "domain": "INFRASTRUCTURE",
            "keywords": {
                "cpu",
                "memory",
                "disk",
                "capacity",
                "host",
                "container",
                "server",
                "resource",
            },
            "base_probability": 25.0,
            "recommended_validation": [
                "Review CPU, memory and disk metrics",
                "Check capacity headroom",
                "Inspect process/container health",
                "Correlate saturation with incident time",
            ],
        },
        {
            "hypothesis_id": "RCA-NET-001",
            "title": (
                "Network, DNS or connectivity defect"
            ),
            "domain": "NETWORK",
            "keywords": {
                "network",
                "dns",
                "latency",
                "connection refused",
                "route",
                "firewall",
                "packet",
                "connectivity",
            },
            "base_probability": 25.0,
            "recommended_validation": [
                "Trace network path",
                "Validate DNS resolution",
                "Check connection failures",
                "Review firewall and routing evidence",
            ],
        },
        {
            "hypothesis_id": "RCA-SEC-001",
            "title": (
                "Identity, permission, certificate or secret defect"
            ),
            "domain": "SECURITY",
            "keywords": {
                "permission",
                "access",
                "certificate",
                "secret",
                "token",
                "iam",
                "authentication",
                "authorization",
            },
            "base_probability": 30.0,
            "recommended_validation": [
                "Validate effective identity and permissions",
                "Check certificate validity",
                "Verify secret/version references",
                "Compare policy decision evidence",
            ],
        },
        {
            "hypothesis_id": "RCA-RULE-001",
            "title": (
                "Business-rule drift or behavioral defect"
            ),
            "domain": "BUSINESS_RULE",
            "keywords": {
                "business rule",
                "logic",
                "rule",
                "behavior",
                "approval",
                "eligibility",
                "calculation",
                "policy",
            },
            "base_probability": 35.0,
            "recommended_validation": [
                "Compare Business Rule DNA F1 vs F2",
                "Replay rule evaluation",
                "Check rule provenance and fingerprint",
                "Verify expected business outcome",
            ],
        },
        {
            "hypothesis_id": "RCA-APP-001",
            "title": (
                "Application code or runtime defect"
            ),
            "domain": "APPLICATION",
            "keywords": {
                "exception",
                "stack",
                "error",
                "application",
                "code",
                "service",
                "runtime",
                "crash",
            },
            "base_probability": 30.0,
            "recommended_validation": [
                "Correlate application logs and traces",
                "Identify failing code path",
                "Compare recent application changes",
                "Reproduce in controlled environment",
            ],
        },
    ]

    ranked = []

    for hypothesis in hypotheses:

        domain_score = (
            _domain_match_score(
                hypothesis["domain"],
                signals,
            )
        )

        keyword_score = (
            _tag_match_score(
                hypothesis["keywords"],
                signals,
            )
        )

        evidence_match = (
            domain_score * 0.55
            + keyword_score * 0.45
        )

        signal_count = sum(
            1
            for signal in signals
            if (
                signal["domain"]
                == hypothesis["domain"]
                or any(
                    keyword
                    in (
                        signal["message"].lower()
                        + " "
                        + " ".join(
                            signal["tags"]
                        )
                    )
                    for keyword
                    in hypothesis[
                        "keywords"
                    ]
                )
            )
        )

        support_score = min(
            100.0,
            signal_count * 20.0,
        )

        confidence = (
            hypothesis[
                "base_probability"
            ] * 0.20
            + evidence_match * 0.60
            + support_score * 0.20
        )

        supporting = []

        contradicting = []

        for signal in signals:

            text = (
                signal["message"].lower()
                + " "
                + " ".join(signal["tags"])
            )

            matched = (
                signal["domain"]
                == hypothesis["domain"]
                or any(
                    keyword in text
                    for keyword in hypothesis[
                        "keywords"
                    ]
                )
            )

            if matched:
                supporting.append(
                    {
                        "signal_id": signal["id"],
                        "message": signal[
                            "message"
                        ],
                        "confidence": signal[
                            "confidence"
                        ],
                    }
                )

            if (
                "healthy" in text
                or "passed" in text
                or "no error" in text
            ):
                if signal[
                    "domain"
                ] == hypothesis["domain"]:
                    contradicting.append(
                        {
                            "signal_id": (
                                signal["id"]
                            ),
                            "message": (
                                signal["message"]
                            ),
                        }
                    )

        contradiction_penalty = min(
            30.0,
            len(contradicting) * 10.0,
        )

        confidence = _bounded(
            confidence
            - contradiction_penalty
        )

        ranked.append(
            {
                "hypothesis_id": (
                    hypothesis[
                        "hypothesis_id"
                    ]
                ),
                "title": hypothesis[
                    "title"
                ],
                "domain": hypothesis[
                    "domain"
                ],
                "confidence": round(
                    confidence,
                    2,
                ),
                "evidence_match_score": (
                    round(
                        evidence_match,
                        2,
                    )
                ),
                "supporting_evidence": (
                    supporting
                ),
                "contradicting_evidence": (
                    contradicting
                ),
                "recommended_validation": (
                    hypothesis[
                        "recommended_validation"
                    ]
                ),
            }
        )

    ranked.sort(
        key=lambda item: (
            -item["confidence"],
            item["hypothesis_id"],
        )
    )

    top_confidence = (
        ranked[0]["confidence"]
        if ranked
        else 0.0
    )

    status = (
        "ROOT_CAUSE_STRONGLY_SUPPORTED"
        if top_confidence
        >= STRONG_CAUSE_THRESHOLD
        else (
            "ROOT_CAUSE_CANDIDATE"
            if top_confidence
            >= ROOT_CAUSE_THRESHOLD
            else "ROOT_CAUSE_NOT_PROVEN"
        )
    )

    return {
        "hypothesis_analysis_id": (
            "RCAHYP-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "status": status,
        "hypothesis_count": len(
            ranked
        ),
        "ranked_hypotheses": ranked,
        "top_hypothesis": (
            ranked[0]
            if ranked
            else None
        ),
        "minimum_proof_threshold": (
            ROOT_CAUSE_THRESHOLD
        ),
        "safety": _safety(),
    }


def verify_cause(
    payload: dict[str, Any]
) -> dict[str, Any]:

    hypothesis = payload.get(
        "hypothesis"
    )

    observations = payload.get(
        "observations"
    ) or []

    if not isinstance(
        hypothesis,
        dict,
    ):
        raise ValueError(
            "hypothesis is required"
        )

    if not isinstance(
        observations,
        list,
    ):
        raise ValueError(
            "observations must be a list"
        )

    support_weight = 0.0
    contradiction_weight = 0.0

    supporting = []
    contradicting = []
    unknown = []

    for index, observation in enumerate(
        observations,
        start=1,
    ):

        if not isinstance(
            observation,
            dict,
        ):
            continue

        result = str(
            observation.get("result")
            or "UNKNOWN"
        ).upper()

        weight = _bounded(
            observation.get(
                "weight",
                50,
            )
        )

        normalized = {
            "observation_id": str(
                observation.get("id")
                or f"OBS-{index:03d}"
            ),
            "description": str(
                observation.get(
                    "description"
                )
                or ""
            ),
            "result": result,
            "weight": weight,
        }

        if result in {
            "SUPPORT",
            "SUPPORTED",
            "PASS",
            "MATCH",
        }:
            support_weight += weight
            supporting.append(
                normalized
            )

        elif result in {
            "CONTRADICT",
            "CONTRADICTED",
            "FAIL",
            "NO_MATCH",
        }:
            contradiction_weight += (
                weight
            )
            contradicting.append(
                normalized
            )

        else:
            unknown.append(
                normalized
            )

    total = (
        support_weight
        + contradiction_weight
    )

    verified_score = (
        support_weight / total * 100
        if total > 0
        else 0.0
    )

    verified_score = round(
        verified_score,
        2,
    )

    status = (
        "CAUSE_VERIFIED"
        if verified_score >= 80
        and not contradicting
        else (
            "CAUSE_SUPPORTED"
            if verified_score >= 70
            else (
                "CAUSE_DISPROVED"
                if contradiction_weight
                > support_weight
                else "INSUFFICIENT_EVIDENCE"
            )
        )
    )

    return {
        "verification_id": (
            "RCAVERIFY-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "status": status,
        "verified_score": (
            verified_score
        ),
        "supporting_observations": (
            supporting
        ),
        "contradicting_observations": (
            contradicting
        ),
        "unknown_observations": (
            unknown
        ),
        "hypothesis": deepcopy(
            hypothesis
        ),
        "safety": _safety(),
    }


def counterfactual(
    payload: dict[str, Any]
) -> dict[str, Any]:

    observed_failure_score = (
        _bounded(
            payload.get(
                "observed_failure_score",
                100,
            )
        )
    )

    counterfactual_failure_score = (
        _bounded(
            payload.get(
                "counterfactual_failure_score",
                100,
            )
        )
    )

    causal_uplift = max(
        0.0,
        observed_failure_score
        - counterfactual_failure_score,
    )

    normalized_uplift = (
        causal_uplift
        / observed_failure_score
        * 100
        if observed_failure_score > 0
        else 0.0
    )

    normalized_uplift = round(
        normalized_uplift,
        2,
    )

    if normalized_uplift >= 70:
        status = "STRONGLY_CAUSAL"
    elif normalized_uplift >= 40:
        status = "CAUSAL_SUPPORT"
    elif normalized_uplift >= 15:
        status = "WEAK_CAUSAL_SUPPORT"
    else:
        status = "CAUSALITY_NOT_SUPPORTED"

    return {
        "counterfactual_id": (
            "RCACF-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "status": status,
        "observed_failure_score": (
            observed_failure_score
        ),
        "counterfactual_failure_score": (
            counterfactual_failure_score
        ),
        "causal_uplift_percent": (
            normalized_uplift
        ),
        "simulation_only": True,
        "safety": _safety(),
    }


def rank_fix_options(
    payload: dict[str, Any]
) -> dict[str, Any]:

    hypothesis = payload.get(
        "hypothesis"
    ) or {}

    domain = str(
        hypothesis.get("domain")
        or payload.get("domain")
        or "UNKNOWN"
    ).upper()

    templates = {
        "DATA": [
            {
                "title": (
                    "Repair from authoritative data source"
                ),
                "risk": "LOW",
                "confidence": 92,
                "rollback": "AVAILABLE",
            },
            {
                "title": (
                    "Quarantine invalid records and reload dependency chain"
                ),
                "risk": "LOW",
                "confidence": 88,
                "rollback": "AVAILABLE",
            },
        ],
        "MIGRATION": [
            {
                "title": (
                    "Correct dependency wave and replay affected migration scope"
                ),
                "risk": "LOW",
                "confidence": 93,
                "rollback": "AVAILABLE",
            },
            {
                "title": (
                    "Correct mapping/transformation and rerun governed DEV rehearsal"
                ),
                "risk": "MEDIUM",
                "confidence": 89,
                "rollback": "AVAILABLE",
            },
        ],
        "DATABASE": [
            {
                "title": (
                    "Correct DB constraint/query/configuration after validation"
                ),
                "risk": "MEDIUM",
                "confidence": 84,
                "rollback": "REQUIRED",
            }
        ],
        "API": [
            {
                "title": (
                    "Restore compatible API contract or version routing"
                ),
                "risk": "MEDIUM",
                "confidence": 87,
                "rollback": "AVAILABLE",
            }
        ],
        "SECURITY": [
            {
                "title": (
                    "Apply least-privilege identity or certificate correction"
                ),
                "risk": "HIGH",
                "confidence": 82,
                "rollback": "REQUIRED",
            }
        ],
        "BUSINESS_RULE": [
            {
                "title": (
                    "Restore verified Business Rule DNA behavior"
                ),
                "risk": "MEDIUM",
                "confidence": 91,
                "rollback": "AVAILABLE",
            }
        ],
        "INFRASTRUCTURE": [
            {
                "title": (
                    "Restore capacity/headroom or resource configuration"
                ),
                "risk": "MEDIUM",
                "confidence": 80,
                "rollback": "AVAILABLE",
            }
        ],
        "APPLICATION": [
            {
                "title": (
                    "Correct verified failing code path and rerun regression suite"
                ),
                "risk": "MEDIUM",
                "confidence": 84,
                "rollback": "REQUIRED",
            }
        ],
    }

    options = deepcopy(
        templates.get(
            domain,
            [
                {
                    "title": (
                        "Collect additional evidence before remediation"
                    ),
                    "risk": "LOW",
                    "confidence": 60,
                    "rollback": (
                        "NOT_APPLICABLE"
                    ),
                }
            ],
        )
    )

    for index, option in enumerate(
        options,
        start=1,
    ):
        option["fix_id"] = (
            f"FIX-{index:03d}"
        )

        option[
            "simulation_required"
        ] = True

        option[
            "approval_required"
        ] = (
            option["risk"]
            in {"MEDIUM", "HIGH"}
        )

        option[
            "remediation_executed"
        ] = False

    options.sort(
        key=lambda item: (
            -item["confidence"],
            item["risk"],
        )
    )

    return {
        "fix_analysis_id": (
            "RCAFIX-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "domain": domain,
        "option_count": len(options),
        "ranked_fix_options": options,
        "execution_authorized": False,
        "safety": _safety(),
    }


def build_test_plan(
    payload: dict[str, Any]
) -> dict[str, Any]:

    domain = str(
        payload.get("domain")
        or "UNKNOWN"
    ).upper()

    common = [
        "Reproduce original failure",
        "Validate proposed fix in DEV",
        "Run regression tests",
        "Run dependency validation",
        "Run What Breaks If impact check",
        "Run Digital Twin Replay",
        "Run reconciliation where applicable",
        "Capture Evidence-by-Design package",
    ]

    domain_tests = {
        "DATA": [
            "Validate business keys",
            "Validate referential integrity",
            "Compare source/target counts",
            "Validate data-quality rules",
        ],
        "MIGRATION": [
            "Validate dependency wave order",
            "Validate mapping rules",
            "Validate transformation rules",
            "Replay affected migration scope",
        ],
        "DATABASE": [
            "Validate DB constraints",
            "Validate query behavior",
            "Validate connections and locks",
        ],
        "API": [
            "Validate API contract",
            "Validate authentication",
            "Validate response codes",
            "Validate latency thresholds",
        ],
        "BUSINESS_RULE": [
            "Compare F1/F2 rule fingerprints",
            "Validate rule outputs",
            "Run behavioral equivalence tests",
        ],
        "SECURITY": [
            "Validate least privilege",
            "Validate authentication",
            "Validate certificate/secret references",
            "Run security regression",
        ],
    }

    tests = (
        common
        + domain_tests.get(
            domain,
            [],
        )
    )

    return {
        "test_plan_id": (
            "RCATEST-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "domain": domain,
        "test_count": len(tests),
        "tests": tests,
        "required_before_execution": True,
        "safety": _safety(),
    }


def investigate(
    payload: dict[str, Any]
) -> dict[str, Any]:

    normalized = normalize_incident(
        payload
    )

    hypotheses = generate_hypotheses(
        payload
    )

    timeline = reconstruct_timeline(
        {
            "signals": payload.get(
                "signals"
            ) or [],
            "changes": payload.get(
                "changes"
            ) or [],
        }
    )

    top = hypotheses[
        "top_hypothesis"
    ]

    domain = (
        top["domain"]
        if top
        else "UNKNOWN"
    )

    fixes = rank_fix_options(
        {
            "hypothesis": (
                top or {}
            )
        }
    )

    tests = build_test_plan(
        {
            "domain": domain
        }
    )

    confidence = (
        top["confidence"]
        if top
        else 0.0
    )

    proven = (
        confidence
        >= ROOT_CAUSE_THRESHOLD
    )

    return {
        "investigation_id": (
            "RCAINV-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "generated_at": _now(),
        "status": (
            hypotheses["status"]
        ),
        "incident": normalized[
            "incident"
        ],
        "root_cause_proven": (
            proven
        ),
        "top_hypothesis": top,
        "ranked_hypotheses": (
            hypotheses[
                "ranked_hypotheses"
            ]
        ),
        "timeline": timeline[
            "events"
        ],
        "ranked_fix_options": (
            fixes[
                "ranked_fix_options"
            ]
        ),
        "required_test_plan": (
            tests
        ),
        "next_action": (
            "VERIFY_TOP_CAUSE"
            if proven
            else "COLLECT_MORE_EVIDENCE"
        ),
        "integrations": {
            "business_rule_dna": (
                "SUPPORTED"
            ),
            "what_breaks_if": (
                "SUPPORTED"
            ),
            "migration_autopilot": (
                "SUPPORTED"
            ),
            "cutover_simulator": (
                "SUPPORTED"
            ),
            "digital_twin_replay": (
                "SUPPORTED"
            ),
            "evidence_by_design": (
                "SUPPORTED"
            ),
        },
        "evidence": {
            "incident_hash_sha256": (
                normalized[
                    "incident_hash_sha256"
                ]
            ),
            "investigation_hash_sha256": (
                _hash(
                    {
                        "incident": (
                            normalized[
                                "incident"
                            ]
                        ),
                        "hypotheses": (
                            hypotheses[
                                "ranked_hypotheses"
                            ]
                        ),
                        "timeline": (
                            timeline["events"]
                        ),
                        "fixes": (
                            fixes[
                                "ranked_fix_options"
                            ]
                        ),
                    }
                )
            ),
        },
        "safety": _safety(),
    }


def build_report(
    payload: dict[str, Any]
) -> dict[str, Any]:

    investigation = investigate(
        payload
    )

    top = investigation[
        "top_hypothesis"
    ]

    return {
        "report_id": (
            "RCAREPORT-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "generated_at": _now(),
        "executive_summary": {
            "incident": (
                investigation[
                    "incident"
                ]["title"]
            ),
            "status": (
                investigation[
                    "status"
                ]
            ),
            "root_cause_proven": (
                investigation[
                    "root_cause_proven"
                ]
            ),
            "top_root_cause": (
                top["title"]
                if top
                else None
            ),
            "confidence": (
                top["confidence"]
                if top
                else 0.0
            ),
            "recommended_next_action": (
                investigation[
                    "next_action"
                ]
            ),
        },
        "investigation": investigation,
        "audit_ready": True,
        "safety": _safety(),
    }


def engine_status() -> dict[str, Any]:
    return {
        "engine": (
            "KMITORA Autonomous Root-Cause Investigator"
        ),
        "version": ENGINE_VERSION,
        "status": "READY",
        "authority": (
            "INVESTIGATION_ONLY"
        ),
        "root_cause_threshold": (
            ROOT_CAUSE_THRESHOLD
        ),
        "capabilities": [
            "incident_normalization",
            "signal_normalization",
            "dependency_graph",
            "upstream_dependency_trace",
            "downstream_dependency_trace",
            "timeline_reconstruction",
            "change_correlation",
            "root_cause_hypothesis_generation",
            "transparent_hypothesis_scoring",
            "supporting_evidence",
            "contradicting_evidence",
            "insufficient_evidence_detection",
            "cause_verification",
            "counterfactual_analysis",
            "data_root_cause",
            "migration_root_cause",
            "database_root_cause",
            "api_root_cause",
            "application_root_cause",
            "infrastructure_root_cause",
            "network_root_cause",
            "security_root_cause",
            "business_rule_root_cause",
            "ranked_fix_options",
            "regression_test_plan",
            "rollback_requirement_model",
            "what_breaks_if_binding",
            "business_rule_dna_binding",
            "migration_autopilot_binding",
            "cutover_simulator_binding",
            "digital_twin_replay_binding",
            "evidence_by_design_binding",
        ],
        "supported_domains": sorted(
            SUPPORTED_DOMAINS
        ),
        "supported_signal_types": sorted(
            SUPPORTED_SIGNAL_TYPES
        ),
        "safety": _safety(),
    }
