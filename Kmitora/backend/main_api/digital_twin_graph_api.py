"""Read-only A000 Digital Twin Graph API helpers.

The graph is a projection of the current reference runtime state plus explicit
platform topology. It never authorizes source/target/production mutations.
"""

from __future__ import annotations

from collections import deque
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _node(
    node_id: str,
    label: str,
    layer: str,
    node_type: str,
    x: int,
    y: int,
    *,
    state: str = "HEALTHY",
    risk: int = 0,
    confidence: int = 100,
    environment: str = "DEV",
    evidence_ids: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "id": node_id,
        "label": label,
        "layer": layer,
        "type": node_type,
        "x": x,
        "y": y,
        "environment": environment,
        "state": state,
        "risk": risk,
        "confidence": confidence,
        "evidenceIds": evidence_ids or [],
        "metadata": metadata or {},
    }


def _edge(
    edge_id: str,
    source: str,
    target: str,
    relationship: str,
    *,
    confidence: int = 100,
    evidence_ids: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "id": edge_id,
        "source": source,
        "target": target,
        "type": relationship,
        "confidence": confidence,
        "evidenceIds": evidence_ids or [],
    }


def _latest_execution(
    runtime_state: dict[str, Any],
    migration_id: str = "",
) -> dict[str, Any]:
    """Most recent execution, preferring one for the projected migration."""
    executions = runtime_state.get("executions", {})

    if not isinstance(executions, dict) or not executions:
        return {}

    if migration_id:
        for item in reversed(list(executions.values())):
            if (
                isinstance(item, dict)
                and item.get("migration_id") == migration_id
            ):
                return item

    last_id = runtime_state.get("last_execution_id")

    if last_id and isinstance(executions.get(last_id), dict):
        return executions[last_id]

    item = next(reversed(executions.values()), {})
    return item if isinstance(item, dict) else {}


def _latest_mapping(runtime_state: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    mappings = runtime_state.get("mappings", {})
    if isinstance(mappings, dict) and mappings:
        mapping_id = str(runtime_state.get("last_mapping_id") or next(reversed(mappings)))
        item = mappings.get(mapping_id)
        if isinstance(item, dict):
            return mapping_id, item
    return "", {}


def _latest_discovery(
    runtime_state: dict[str, Any],
    requested_migration_id: str = "",
) -> tuple[str, dict[str, Any]]:
    """Resolve which discovery the twin projects.

    An explicit migration id wins, so the operator's active migration is
    shown rather than whichever run happened to finish last - a demo or
    batch run would otherwise hijack the view.
    """
    discoveries = runtime_state.get("discoveries", {})

    if not isinstance(discoveries, dict) or not discoveries:
        return "", {}

    if requested_migration_id:
        item = discoveries.get(requested_migration_id)
        if isinstance(item, dict):
            return requested_migration_id, item

    migration_id = str(
        runtime_state.get("last_migration_id")
        or runtime_state.get("last_discovery_id")
        or next(reversed(discoveries))
    )

    item = discoveries.get(migration_id)
    if isinstance(item, dict):
        return migration_id, item

    return "", {}


def build_runtime_graph(
    runtime_state: dict[str, Any],
    *,
    temporal_state: str = "CURRENT",
    migration_id: str = "",
) -> dict[str, Any]:
    """Project the current A000 reference runtime into a typed twin graph."""
    temporal_state = temporal_state.upper()
    if temporal_state not in {"BEFORE", "CURRENT", "PROPOSED", "SIMULATED", "AFTER"}:
        raise ValueError("invalid temporal_state")

    migration_id, discovery = _latest_discovery(runtime_state, migration_id)
    mapping_id, mapping = _latest_mapping(runtime_state)

    issues = runtime_state.get("issues", [])
    approvals = runtime_state.get("approvals", {})
    executions = runtime_state.get("executions", {})
    reconciliations = runtime_state.get("reconciliations", {})
    # The runtime stores generated packages under "evidence_packages";
    # "evidence" is kept as a fallback for older snapshots.
    evidence_store = runtime_state.get("evidence_packages") or runtime_state.get(
        "evidence", {}
    )

    issue_count = len(issues) if isinstance(issues, list) else 0
    approval_count = len(approvals) if isinstance(approvals, dict) else 0
    execution_count = len(executions) if isinstance(executions, dict) else 0
    reconciliation_count = (
        len(reconciliations) if isinstance(reconciliations, dict) else 0
    )
    evidence_count = len(evidence_store) if isinstance(evidence_store, dict) else 0

    summary = discovery.get("summary", {}) if isinstance(discovery, dict) else {}
    source_entities = int(summary.get("source_entity_count", 0) or 0)
    target_entities = int(summary.get("target_entity_count", 0) or 0)
    findings = int(summary.get("quality_finding_count", issue_count) or issue_count)

    mapping_count = 0
    if isinstance(mapping, dict):
        candidates = mapping.get("items") or mapping.get("mappings") or []
        if isinstance(candidates, list):
            mapping_count = len(candidates)

    risk_value = min(100, findings * 12)
    risk_state = "RISK" if findings else "HEALTHY"

    # ------------------------------------------------------------------
    # Temporal projection.
    #
    # The five states are the same migration seen at different points on
    # its timeline, so each one reports different counts for the target,
    # evidence and risk nodes. Without this every state renders an
    # identical graph and the timeline control appears inert.
    # ------------------------------------------------------------------
    staging = discovery.get("target_staging_plan", {}) if isinstance(discovery, dict) else {}
    staging = staging if isinstance(staging, dict) else {}

    def _count(key: str) -> int:
        value = staging.get(key)
        return len(value) if isinstance(value, list) else 0

    ready_records = _count("ready_records")
    blocked_records = (
        _count("review_records")
        + _count("rejected_records")
        + _count("quarantine_records")
    )

    execution = _latest_execution(runtime_state, migration_id)
    simulated_records = int(execution.get("simulated_record_count", 0) or 0)
    target_writes = int(execution.get("target_write_count", 0) or 0)
    execution_status = str(execution.get("status", "") or "NOT_STARTED")

    if temporal_state == "BEFORE":
        # Pre-migration: source exists, nothing has reached the target.
        target_entity_count = 0
        target_record_count = 0
        target_node_state = "PLANNED"
        evidence_shown = 0
        reconciliation_shown = 0
        execution_shown = 0
        risk_now = risk_value
        risk_label = f"{findings} finding(s) present before migration"
        simulation_state = "PLANNED"
    elif temporal_state == "PROPOSED":
        # The plan: what the staging plan intends to land.
        target_entity_count = target_entities
        target_record_count = ready_records
        target_node_state = "PLANNED"
        evidence_shown = 0
        reconciliation_shown = 0
        execution_shown = 0
        risk_now = min(100, blocked_records * 12)
        risk_label = f"{blocked_records} record(s) would not migrate"
        simulation_state = "PLANNED"
    elif temporal_state == "SIMULATED":
        # Dry run: records simulated, target deliberately untouched.
        target_entity_count = target_entities
        target_record_count = 0
        target_node_state = "PLANNED"
        evidence_shown = evidence_count
        reconciliation_shown = reconciliation_count
        execution_shown = execution_count
        risk_now = min(100, blocked_records * 12)
        risk_label = f"{simulated_records} record(s) simulated, 0 written"
        simulation_state = "HEALTHY" if simulated_records else "PLANNED"
    elif temporal_state == "AFTER":
        # Post-migration end state.
        target_entity_count = target_entities
        target_record_count = target_writes or ready_records
        target_node_state = "HEALTHY" if (target_writes or ready_records) else "PLANNED"
        evidence_shown = evidence_count
        reconciliation_shown = reconciliation_count
        execution_shown = execution_count
        risk_now = 0 if not blocked_records else min(100, blocked_records * 12)
        risk_label = (
            "All staged records accounted for"
            if not blocked_records
            else f"{blocked_records} record(s) never migrated"
        )
        simulation_state = "HEALTHY"
    else:  # CURRENT
        target_entity_count = target_entities
        target_record_count = target_writes
        target_node_state = "HEALTHY" if target_entities else "PLANNED"
        evidence_shown = evidence_count
        reconciliation_shown = reconciliation_count
        execution_shown = execution_count
        risk_now = risk_value
        risk_label = f"{findings} open quality finding(s)"
        simulation_state = "PLANNED"

    risk_state_now = "RISK" if risk_now else "HEALTHY"

    nodes = [
        _node(
            "enterprise",
            "KMITORA Enterprise",
            "L0_ENTERPRISE",
            "ENTERPRISE",
            500,
            50,
            environment="GLOBAL",
            evidence_ids=["RUNTIME-STATE"],
            metadata={
                "temporalState": temporal_state,
                "migrationId": migration_id or "NONE",
            },
        ),
        _node(
            "source",
            "Source Estate",
            "L1_SYSTEM",
            "SOURCE_SYSTEM",
            150,
            185,
            state="REVIEW" if source_entities == 0 else "HEALTHY",
            risk=25 if source_entities == 0 else 8,
            evidence_ids=[migration_id] if migration_id else [],
            metadata={
                "discoveredEntities": source_entities,
                "readyRecords": ready_records,
                "blockedRecords": blocked_records,
            },
        ),
        _node(
            "target",
            "DEV Target Estate",
            "L1_SYSTEM",
            "TARGET_SYSTEM",
            850,
            185,
            state=target_node_state,
            risk=18 if target_entity_count == 0 else 7,
            evidence_ids=[migration_id] if migration_id else [],
            metadata={
                "discoveredEntities": target_entity_count,
                "recordsInTarget": target_record_count,
                "production": False,
            },
        ),
        _node(
            "data",
            "Discovered Data Model",
            "L2_DATA",
            "DATA_MODEL",
            160,
            330,
            state="REVIEW" if source_entities == 0 else "HEALTHY",
            risk=18,
            evidence_ids=[migration_id] if migration_id else [],
            metadata={"sourceEntities": source_entities, "targetEntities": target_entities},
        ),
        _node(
            "process",
            "Migration Process",
            "L3_PROCESS",
            "PROCESS",
            500,
            260,
            state="HEALTHY",
            risk=12,
            evidence_ids=[migration_id] if migration_id else [],
            metadata={
                "mappingCount": mapping_count,
                "mappingId": mapping_id or "NONE",
                "executionStatus": execution_status if execution_shown else "NOT_STARTED",
            },
        ),
        _node(
            "runtime",
            "Core Runtime",
            "L4_RUNTIME",
            "SERVICE",
            500,
            405,
            state="HEALTHY",
            risk=5,
            evidence_ids=["CORE-8080"],
            metadata={"port": 8080, "executions": execution_shown},
        ),
        _node(
            "a000",
            "A000",
            "L5_INTELLIGENCE",
            "MASTER_ORCHESTRATOR",
            500,
            125,
            environment="GLOBAL",
            state="HEALTHY",
            risk=2,
            evidence_ids=["A000-RUNTIME"],
            metadata={
                "authority": "GOVERNED",
                "productionWriteAllowed": False,
                "lastAction": runtime_state.get("last_agent_action", "A000 initialized"),
            },
        ),
        _node(
            "governance",
            "Governance & Approval",
            "L6_GOVERNANCE",
            "POLICY_GATE",
            845,
            330,
            state="HEALTHY",
            risk=4,
            evidence_ids=["GOVERNANCE-RUNTIME"],
            metadata={"approvalRecords": approval_count, "bypassAllowed": False},
        ),
        _node(
            "risk",
            "Quality / Failure Risk",
            "L7_RISK",
            "RISK_AGGREGATE",
            155,
            485,
            state=risk_state_now,
            risk=risk_now,
            confidence=100 if findings else 95,
            evidence_ids=[migration_id] if migration_id else [],
            metadata={
                "qualityFindings": findings,
                "runtimeIssues": issue_count,
                "assessment": risk_label,
            },
        ),
        _node(
            "simulation",
            "Future-State Simulation",
            "L8_SIMULATION",
            "DIGITAL_REHEARSAL",
            850,
            485,
            state=simulation_state,
            risk=8,
            confidence=98,
            evidence_ids=["SIMULATION-REFERENCE"],
            metadata={
                # Nothing has been simulated yet at BEFORE/PROPOSED, so the
                # count only appears once an execution is in scope.
                "simulatedRecords": simulated_records if execution_shown else 0,
                "targetWrites": 0,
                "productionCutover": False,
                "temporalState": temporal_state,
            },
        ),
        _node(
            "evidence",
            "Evidence & Reconciliation",
            "L9_EVIDENCE",
            "EVIDENCE",
            500,
            535,
            state="HEALTHY" if evidence_shown else "PLANNED",
            risk=3,
            evidence_ids=["EVIDENCE-RUNTIME"],
            metadata={
                "evidencePackages": evidence_shown,
                "reconciliations": reconciliation_shown,
            },
        ),
    ]

    edges = [
        _edge("e01", "enterprise", "source", "CONTAINS"),
        _edge("e02", "enterprise", "target", "CONTAINS"),
        _edge("e03", "a000", "process", "EXECUTED_BY", evidence_ids=["A000-RUNTIME"]),
        _edge("e04", "source", "data", "CONTAINS"),
        _edge("e05", "data", "process", "READS_FROM"),
        _edge("e06", "process", "target", "MIGRATES_TO"),
        _edge("e07", "process", "runtime", "EXECUTED_BY"),
        _edge("e08", "process", "governance", "GOVERNED_BY"),
        _edge("e09", "data", "risk", "IMPACTS"),
        _edge("e10", "risk", "simulation", "PREDICTED_TO_IMPACT", confidence=95),
        _edge("e11", "governance", "simulation", "GOVERNED_BY"),
        _edge("e12", "simulation", "evidence", "EVIDENCED_BY"),
        _edge("e13", "runtime", "evidence", "EVIDENCED_BY"),
        _edge("e14", "evidence", "target", "RECONCILED_WITH"),
    ]

    return {
        "kind": "a000_digital_twin_graph",
        "generatedAt": _utc_now(),
        "temporalState": temporal_state,
        "nodes": nodes,
        "edges": edges,
        "projection": {
            "source": "A000_REFERENCE_RUNTIME",
            "authoritative": False,
            "liveRuntimeProjection": True,
            "fabricatedToolResults": False,
        },
        "safety": {
            "readOnly": True,
            "productionWriteAllowed": False,
            "productionCutoverAllowed": False,
            "destructiveActionAllowed": False,
            "policyBypassAllowed": False,
            "productionActionExecuted": False,
        },
    }


def _adjacency(graph: dict[str, Any]) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for edge in graph.get("edges", []):
        if not isinstance(edge, dict):
            continue
        source = str(edge.get("source", ""))
        target = str(edge.get("target", ""))
        result.setdefault(source, []).append(target)
    return result


def impact_analysis(
    graph: dict[str, Any],
    node_id: str,
    *,
    max_depth: int = 4,
) -> dict[str, Any]:
    """Return deterministic downstream blast radius from a selected node."""
    ids = {str(node.get("id")) for node in graph.get("nodes", [])}
    if node_id not in ids:
        raise ValueError(f"unknown node_id: {node_id}")
    max_depth = max(1, min(int(max_depth), 8))

    adjacency = _adjacency(graph)
    queue: deque[tuple[str, int]] = deque([(node_id, 0)])
    seen = {node_id}
    impacted: list[dict[str, Any]] = []

    while queue:
        current, depth = queue.popleft()
        if depth >= max_depth:
            continue
        for target in adjacency.get(current, []):
            if target in seen:
                continue
            seen.add(target)
            impacted.append({"nodeId": target, "depth": depth + 1})
            queue.append((target, depth + 1))

    edge_ids = [
        edge["id"]
        for edge in graph.get("edges", [])
        if edge.get("source") in seen and edge.get("target") in seen
    ]

    return {
        "kind": "a000_twin_impact_analysis",
        "sourceNodeId": node_id,
        "impactedNodes": impacted,
        "highlightNodeIds": [node_id, *[item["nodeId"] for item in impacted]],
        "highlightEdgeIds": edge_ids,
        "maxDepth": max_depth,
        "production_action_executed": False,
    }


def rca_path(graph: dict[str, Any], node_id: str) -> dict[str, Any]:
    """Return an evidence-backed reference causal path to the selected node."""
    ids = {str(node.get("id")) for node in graph.get("nodes", [])}
    if node_id not in ids:
        raise ValueError(f"unknown node_id: {node_id}")

    preferred_paths = {
        "risk": ["source", "data", "risk"],
        "simulation": ["source", "data", "risk", "simulation"],
        "evidence": ["a000", "process", "runtime", "evidence"],
        "target": ["a000", "process", "target"],
    }
    path = preferred_paths.get(node_id, ["a000", node_id] if node_id != "a000" else ["a000"])

    edge_ids: list[str] = []
    for left, right in zip(path, path[1:]):
        for edge in graph.get("edges", []):
            if edge.get("source") == left and edge.get("target") == right:
                edge_ids.append(str(edge.get("id")))
                break

    return {
        "kind": "a000_twin_rca",
        "selectedNodeId": node_id,
        "pathNodeIds": path,
        "pathEdgeIds": edge_ids,
        "classification": "REFERENCE_CAUSAL_PATH",
        "authoritativeCause": False,
        "requiresEvidenceValidation": True,
        "production_action_executed": False,
    }


def simulate_overlay(
    graph: dict[str, Any],
    node_id: str,
    *,
    scenario: str,
) -> dict[str, Any]:
    """Return a read-only future-state overlay; never executes the change."""
    ids = {str(node.get("id")) for node in graph.get("nodes", [])}
    if node_id not in ids:
        raise ValueError(f"unknown node_id: {node_id}")

    impact = impact_analysis(graph, node_id, max_depth=3)

    overlays = []
    for node in graph.get("nodes", []):
        node_copy = deepcopy(node)
        nid = str(node_copy.get("id"))
        if nid in impact["highlightNodeIds"]:
            node_copy["simulationState"] = "PREDICTED_IMPACT"
            node_copy["simulated"] = True
        else:
            node_copy["simulationState"] = "UNCHANGED"
            node_copy["simulated"] = False
        overlays.append(node_copy)

    return {
        "kind": "a000_twin_simulation_overlay",
        "scenario": scenario.strip() or "Reference what-if simulation",
        "sourceNodeId": node_id,
        "temporalState": "SIMULATED",
        "nodes": overlays,
        "highlightNodeIds": impact["highlightNodeIds"],
        "highlightEdgeIds": impact["highlightEdgeIds"],
        "simulationTruth": "READ_ONLY_REFERENCE_PROJECTION",
        "target_write_executed": False,
        "production_action_executed": False,
        "production_cutover_executed": False,
    }
