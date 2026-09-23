from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any
import json
import uuid


ENGINE_VERSION = "1.0.0"

SUPPORTED_EVENT_TYPES = {
    "ADD_ASSET",
    "UPDATE_ASSET",
    "REMOVE_ASSET",
    "ADD_RELATIONSHIP",
    "REMOVE_RELATIONSHIP",
    "SET_ATTRIBUTE",
}

FIDELITY_KINDS = {
    "data": {"TABLE", "COLUMN", "DATABASE", "SCHEMA", "DATASET"},
    "application": {"APPLICATION", "SERVICE", "JOB"},
    "business_rule": {"BUSINESS_RULE", "RULE"},
    "integration": {"API", "QUEUE", "EVENT", "INTERFACE"},
    "infrastructure": {
        "SERVER",
        "HOST",
        "CONTAINER",
        "CLUSTER",
        "NETWORK",
        "INFRASTRUCTURE",
    },
    "security": {
        "ROLE",
        "PERMISSION",
        "SECRET",
        "CERTIFICATE",
        "SECURITY_CONTROL",
    },
    "process": {"PROCESS", "WORKFLOW", "ACTIVITY"},
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash(value: Any) -> str:
    return sha256(
        json.dumps(
            value,
            sort_keys=True,
            ensure_ascii=False,
            default=str,
        ).encode("utf-8")
    ).hexdigest()


def _safety() -> dict[str, Any]:
    return {
        "authoritative": False,
        "read_only": True,
        "simulation_only": True,
        "source_write_executed": False,
        "target_write_executed": False,
        "production_action_executed": False,
        "cutover_executed": False,
    }


def _asset_id(asset: dict[str, Any]) -> str:
    return str(
        asset.get("id")
        or asset.get("asset_id")
        or ""
    ).strip()


def _relationship_id(rel: dict[str, Any]) -> str:
    explicit = str(
        rel.get("id")
        or rel.get("relationship_id")
        or ""
    ).strip()

    if explicit:
        return explicit

    source = str(
        rel.get("source")
        or rel.get("from")
        or ""
    ).strip()

    target = str(
        rel.get("target")
        or rel.get("to")
        or ""
    ).strip()

    relation = str(
        rel.get("type")
        or rel.get("relationship")
        or "DEPENDS_ON"
    ).upper()

    return f"{source}|{relation}|{target}"


def _normalize_state(raw: dict[str, Any]) -> dict[str, Any]:
    assets: dict[str, dict[str, Any]] = {}

    for item in raw.get("assets") or []:
        if not isinstance(item, dict):
            continue

        asset_id = _asset_id(item)

        if not asset_id:
            continue

        asset = deepcopy(item)
        asset["id"] = asset_id
        asset["kind"] = str(
            asset.get("kind")
            or asset.get("type")
            or "UNKNOWN"
        ).upper()

        asset["domain"] = str(
            asset.get("domain")
            or "UNCLASSIFIED"
        ).upper()

        assets[asset_id] = asset

    relationships: dict[str, dict[str, Any]] = {}

    for item in raw.get("relationships") or []:
        if not isinstance(item, dict):
            continue

        rel = deepcopy(item)
        rel_id = _relationship_id(rel)

        rel["id"] = rel_id
        rel["source"] = str(
            rel.get("source")
            or rel.get("from")
            or ""
        ).strip()

        rel["target"] = str(
            rel.get("target")
            or rel.get("to")
            or ""
        ).strip()

        rel["type"] = str(
            rel.get("type")
            or rel.get("relationship")
            or "DEPENDS_ON"
        ).upper()

        relationships[rel_id] = rel

    return {
        "assets": assets,
        "relationships": relationships,
        "metadata": deepcopy(
            raw.get("metadata") or {}
        ),
    }


def _serializable_state(
    state: dict[str, Any]
) -> dict[str, Any]:

    return {
        "assets": [
            state["assets"][asset_id]
            for asset_id in sorted(state["assets"])
        ],
        "relationships": [
            state["relationships"][rel_id]
            for rel_id in sorted(state["relationships"])
        ],
        "metadata": deepcopy(state["metadata"]),
    }


def _state_hash(state: dict[str, Any]) -> str:
    return _hash(_serializable_state(state))


def _state_delta(
    before: dict[str, Any],
    after: dict[str, Any],
) -> dict[str, Any]:

    before_assets = before["assets"]
    after_assets = after["assets"]

    before_ids = set(before_assets)
    after_ids = set(after_assets)

    added_assets = sorted(after_ids - before_ids)
    removed_assets = sorted(before_ids - after_ids)

    changed_assets = []

    for asset_id in sorted(before_ids & after_ids):
        if before_assets[asset_id] != after_assets[asset_id]:
            changed_assets.append(
                {
                    "asset_id": asset_id,
                    "before": deepcopy(before_assets[asset_id]),
                    "after": deepcopy(after_assets[asset_id]),
                }
            )

    before_rels = set(before["relationships"])
    after_rels = set(after["relationships"])

    added_rels = sorted(after_rels - before_rels)
    removed_rels = sorted(before_rels - after_rels)

    changed_rels = []

    for rel_id in sorted(before_rels & after_rels):
        if (
            before["relationships"][rel_id]
            != after["relationships"][rel_id]
        ):
            changed_rels.append(rel_id)

    return {
        "assets_added": added_assets,
        "assets_removed": removed_assets,
        "assets_changed": changed_assets,
        "relationships_added": added_rels,
        "relationships_removed": removed_rels,
        "relationships_changed": changed_rels,
        "change_count": (
            len(added_assets)
            + len(removed_assets)
            + len(changed_assets)
            + len(added_rels)
            + len(removed_rels)
            + len(changed_rels)
        ),
    }


def _validate_event(
    event: dict[str, Any]
) -> tuple[str, str]:

    event_type = str(
        event.get("type")
        or event.get("event_type")
        or ""
    ).upper()

    if event_type not in SUPPORTED_EVENT_TYPES:
        raise ValueError(
            f"Unsupported event type: {event_type}"
        )

    event_id = str(
        event.get("id")
        or event.get("event_id")
        or ""
    ).strip()

    if not event_id:
        event_id = (
            "EVT-" + uuid.uuid4().hex[:10].upper()
        )

    return event_id, event_type


def _apply_event(
    current: dict[str, Any],
    event: dict[str, Any],
) -> dict[str, Any]:

    state = deepcopy(current)

    event_id, event_type = _validate_event(event)

    payload = event.get("payload") or {}

    if not isinstance(payload, dict):
        raise ValueError(
            f"{event_id}: payload must be an object"
        )

    if event_type == "ADD_ASSET":
        asset = payload.get("asset") or payload

        asset_id = _asset_id(asset)

        if not asset_id:
            raise ValueError(
                f"{event_id}: asset id required"
            )

        if asset_id in state["assets"]:
            raise ValueError(
                f"{event_id}: asset already exists: {asset_id}"
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
            or "UNCLASSIFIED"
        ).upper()

        state["assets"][asset_id] = normalized

    elif event_type == "UPDATE_ASSET":
        asset_id = str(
            payload.get("asset_id")
            or payload.get("id")
            or ""
        ).strip()

        changes = payload.get("changes") or {}

        if asset_id not in state["assets"]:
            raise ValueError(
                f"{event_id}: unknown asset: {asset_id}"
            )

        if not isinstance(changes, dict):
            raise ValueError(
                f"{event_id}: changes must be an object"
            )

        state["assets"][asset_id].update(
            deepcopy(changes)
        )

        state["assets"][asset_id]["id"] = asset_id

    elif event_type == "REMOVE_ASSET":
        asset_id = str(
            payload.get("asset_id")
            or payload.get("id")
            or ""
        ).strip()

        if asset_id not in state["assets"]:
            raise ValueError(
                f"{event_id}: unknown asset: {asset_id}"
            )

        del state["assets"][asset_id]

        dependent_relationships = [
            rel_id
            for rel_id, rel
            in state["relationships"].items()
            if (
                rel.get("source") == asset_id
                or rel.get("target") == asset_id
            )
        ]

        for rel_id in dependent_relationships:
            del state["relationships"][rel_id]

    elif event_type == "ADD_RELATIONSHIP":
        rel = payload.get("relationship") or payload

        source = str(
            rel.get("source")
            or rel.get("from")
            or ""
        ).strip()

        target = str(
            rel.get("target")
            or rel.get("to")
            or ""
        ).strip()

        if source not in state["assets"]:
            raise ValueError(
                f"{event_id}: unknown source: {source}"
            )

        if target not in state["assets"]:
            raise ValueError(
                f"{event_id}: unknown target: {target}"
            )

        rel_id = _relationship_id(rel)

        normalized = deepcopy(rel)
        normalized["id"] = rel_id
        normalized["source"] = source
        normalized["target"] = target
        normalized["type"] = str(
            normalized.get("type")
            or normalized.get("relationship")
            or "DEPENDS_ON"
        ).upper()

        state["relationships"][rel_id] = normalized

    elif event_type == "REMOVE_RELATIONSHIP":
        rel_id = str(
            payload.get("relationship_id")
            or payload.get("id")
            or ""
        ).strip()

        if rel_id not in state["relationships"]:
            raise ValueError(
                f"{event_id}: unknown relationship: {rel_id}"
            )

        del state["relationships"][rel_id]

    elif event_type == "SET_ATTRIBUTE":
        asset_id = str(
            payload.get("asset_id")
            or ""
        ).strip()

        key = str(
            payload.get("key")
            or ""
        ).strip()

        if asset_id not in state["assets"]:
            raise ValueError(
                f"{event_id}: unknown asset: {asset_id}"
            )

        if not key:
            raise ValueError(
                f"{event_id}: attribute key required"
            )

        state["assets"][asset_id][key] = deepcopy(
            payload.get("value")
        )

    return state


def create_snapshot(
    payload: dict[str, Any]
) -> dict[str, Any]:

    raw_state = payload.get("state")

    if not isinstance(raw_state, dict):
        raise ValueError("state is required")

    state = _normalize_state(raw_state)

    state_hash = _state_hash(state)

    return {
        "snapshot_id": (
            "TWIN-" + uuid.uuid4().hex[:12].upper()
        ),
        "label": str(
            payload.get("label")
            or "Enterprise Twin Snapshot"
        ),
        "twin_role": str(
            payload.get("twin_role")
            or "F1_CURRENT"
        ).upper(),
        "generated_at": _now(),
        "asset_count": len(state["assets"]),
        "relationship_count": len(
            state["relationships"]
        ),
        "state": _serializable_state(state),
        "state_hash_sha256": state_hash,
        "safety": _safety(),
    }


def replay(
    payload: dict[str, Any]
) -> dict[str, Any]:

    raw_state = payload.get("initial_state")
    events = payload.get("events") or []

    if not isinstance(raw_state, dict):
        raise ValueError(
            "initial_state is required"
        )

    if not isinstance(events, list):
        raise ValueError(
            "events must be a list"
        )

    current = _normalize_state(raw_state)
    initial = deepcopy(current)

    include_states = bool(
        payload.get(
            "include_checkpoint_states",
            True,
        )
    )

    checkpoints = [
        {
            "sequence": 0,
            "time_label": "T0",
            "event_id": None,
            "event_type": "INITIAL_STATE",
            "state_hash_sha256": (
                _state_hash(current)
            ),
            "asset_count": len(
                current["assets"]
            ),
            "relationship_count": len(
                current["relationships"]
            ),
            "delta": {
                "change_count": 0
            },
            "state": (
                _serializable_state(current)
                if include_states
                else None
            ),
        }
    ]

    evidence = []

    for index, event in enumerate(
        events,
        start=1,
    ):
        if not isinstance(event, dict):
            raise ValueError(
                f"event {index} must be an object"
            )

        event_id, event_type = _validate_event(event)

        before = deepcopy(current)

        current = _apply_event(
            current,
            event,
        )

        delta = _state_delta(
            before,
            current,
        )

        state_hash = _state_hash(current)

        checkpoints.append(
            {
                "sequence": index,
                "time_label": f"T{index}",
                "event_id": event_id,
                "event_type": event_type,
                "description": str(
                    event.get("description")
                    or ""
                ),
                "state_hash_sha256": state_hash,
                "asset_count": len(
                    current["assets"]
                ),
                "relationship_count": len(
                    current["relationships"]
                ),
                "delta": delta,
                "state": (
                    _serializable_state(current)
                    if include_states
                    else None
                ),
            }
        )

        evidence.append(
            {
                "sequence": index,
                "event_id": event_id,
                "event_type": event_type,
                "event_hash_sha256": _hash(event),
                "resulting_state_hash_sha256": (
                    state_hash
                ),
            }
        )

    final_delta = _state_delta(
        initial,
        current,
    )

    return {
        "replay_id": (
            "TWINREPLAY-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "engine": "KMITORA Digital Twin Replay",
        "engine_version": ENGINE_VERSION,
        "generated_at": _now(),
        "status": "REPLAY_COMPLETE",
        "mode": "READ_ONLY_FUTURE_STATE_REPLAY",
        "summary": {
            "event_count": len(events),
            "checkpoint_count": len(checkpoints),
            "initial_assets": len(
                initial["assets"]
            ),
            "final_assets": len(
                current["assets"]
            ),
            "initial_relationships": len(
                initial["relationships"]
            ),
            "final_relationships": len(
                current["relationships"]
            ),
            "total_state_changes": (
                final_delta["change_count"]
            ),
        },
        "initial_state_hash_sha256": (
            _state_hash(initial)
        ),
        "final_state_hash_sha256": (
            _state_hash(current)
        ),
        "checkpoints": checkpoints,
        "future_state": (
            _serializable_state(current)
        ),
        "final_delta": final_delta,
        "event_evidence": evidence,
        "integration": {
            "business_rule_dna": "SUPPORTED",
            "what_breaks_if": "SUPPORTED",
            "migration_autopilot": "SUPPORTED",
            "cutover_simulator": "SUPPORTED",
            "reconciliation": "SUPPORTED",
            "evidence": "SUPPORTED",
        },
        "evidence": {
            "replay_hash_sha256": _hash(
                {
                    "initial": _state_hash(initial),
                    "final": _state_hash(current),
                    "events": evidence,
                }
            ),
            "deterministic": True,
        },
        "safety": _safety(),
    }


def replay_step(
    payload: dict[str, Any]
) -> dict[str, Any]:

    if not isinstance(
        payload.get("state"),
        dict,
    ):
        raise ValueError("state is required")

    if not isinstance(
        payload.get("event"),
        dict,
    ):
        raise ValueError("event is required")

    before = _normalize_state(
        payload["state"]
    )

    event_id, event_type = _validate_event(
        payload["event"]
    )

    after = _apply_event(
        before,
        payload["event"],
    )

    return {
        "step_id": (
            "TWINSTEP-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "event_id": event_id,
        "event_type": event_type,
        "before_hash_sha256": (
            _state_hash(before)
        ),
        "after_hash_sha256": (
            _state_hash(after)
        ),
        "delta": _state_delta(
            before,
            after,
        ),
        "future_state": (
            _serializable_state(after)
        ),
        "safety": _safety(),
    }


def compare_states(
    payload: dict[str, Any]
) -> dict[str, Any]:

    if not isinstance(
        payload.get("left_state"),
        dict,
    ):
        raise ValueError(
            "left_state is required"
        )

    if not isinstance(
        payload.get("right_state"),
        dict,
    ):
        raise ValueError(
            "right_state is required"
        )

    left = _normalize_state(
        payload["left_state"]
    )

    right = _normalize_state(
        payload["right_state"]
    )

    return {
        "comparison_id": (
            "TWINCMP-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "left_hash_sha256": (
            _state_hash(left)
        ),
        "right_hash_sha256": (
            _state_hash(right)
        ),
        "exact_match": (
            _state_hash(left)
            == _state_hash(right)
        ),
        "delta": _state_delta(
            left,
            right,
        ),
        "safety": _safety(),
    }


def branch_scenarios(
    payload: dict[str, Any]
) -> dict[str, Any]:

    initial_state = payload.get(
        "initial_state"
    )

    branches = payload.get(
        "branches"
    ) or []

    if not isinstance(initial_state, dict):
        raise ValueError(
            "initial_state is required"
        )

    if not isinstance(branches, list):
        raise ValueError(
            "branches must be a list"
        )

    results = []

    for index, branch in enumerate(
        branches,
        start=1,
    ):
        if not isinstance(branch, dict):
            continue

        result = replay(
            {
                "initial_state": initial_state,
                "events": (
                    branch.get("events")
                    or []
                ),
                "include_checkpoint_states": False,
            }
        )

        results.append(
            {
                "name": str(
                    branch.get("name")
                    or f"Scenario {index}"
                ),
                "event_count": (
                    result["summary"][
                        "event_count"
                    ]
                ),
                "total_state_changes": (
                    result["summary"][
                        "total_state_changes"
                    ]
                ),
                "final_state_hash_sha256": (
                    result[
                        "final_state_hash_sha256"
                    ]
                ),
                "future_state": (
                    result["future_state"]
                ),
            }
        )

    return {
        "branch_analysis_id": (
            "TWINBRANCH-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "branch_count": len(results),
        "unique_future_states": len(
            {
                item[
                    "final_state_hash_sha256"
                ]
                for item in results
            }
        ),
        "branches": results,
        "safety": _safety(),
    }


def fidelity(
    payload: dict[str, Any]
) -> dict[str, Any]:

    predicted_raw = payload.get(
        "predicted_state"
    )

    actual_raw = payload.get(
        "actual_state"
    )

    if not isinstance(predicted_raw, dict):
        raise ValueError(
            "predicted_state is required"
        )

    if not isinstance(actual_raw, dict):
        raise ValueError(
            "actual_state is required"
        )

    predicted = _normalize_state(
        predicted_raw
    )

    actual = _normalize_state(
        actual_raw
    )

    scores = {}
    blind_spots = []

    for domain, kinds in FIDELITY_KINDS.items():

        predicted_assets = {
            asset_id: asset
            for asset_id, asset
            in predicted["assets"].items()
            if str(
                asset.get("kind")
                or ""
            ).upper() in kinds
        }

        actual_assets = {
            asset_id: asset
            for asset_id, asset
            in actual["assets"].items()
            if str(
                asset.get("kind")
                or ""
            ).upper() in kinds
        }

        predicted_ids = set(
            predicted_assets
        )

        actual_ids = set(
            actual_assets
        )

        if (
            not predicted_ids
            and not actual_ids
        ):
            scores[domain] = None

            blind_spots.append(
                {
                    "domain": domain,
                    "reason": (
                        "No modeled assets "
                        "available"
                    ),
                }
            )

            continue

        union = predicted_ids | actual_ids
        intersection = (
            predicted_ids & actual_ids
        )

        existence_score = (
            len(intersection)
            / len(union)
            * 100
            if union
            else 100.0
        )

        exact_matches = sum(
            1
            for asset_id in intersection
            if (
                predicted_assets[asset_id]
                == actual_assets[asset_id]
            )
        )

        property_score = (
            exact_matches
            / len(intersection)
            * 100
            if intersection
            else 0.0
        )

        scores[domain] = round(
            existence_score * 0.60
            + property_score * 0.40,
            2,
        )

    available_scores = [
        score
        for score in scores.values()
        if score is not None
    ]

    overall = (
        round(
            sum(available_scores)
            / len(available_scores),
            2,
        )
        if available_scores
        else 0.0
    )

    return {
        "fidelity_id": (
            "TWINFID-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "overall_fidelity_percent": overall,
        "domain_fidelity": scores,
        "blind_spots": blind_spots,
        "predicted_hash_sha256": (
            _state_hash(predicted)
        ),
        "actual_hash_sha256": (
            _state_hash(actual)
        ),
        "exact_state_match": (
            _state_hash(predicted)
            == _state_hash(actual)
        ),
        "drift": _state_delta(
            predicted,
            actual,
        ),
        "safety": _safety(),
    }


def predicted_vs_actual(
    payload: dict[str, Any]
) -> dict[str, Any]:

    result = fidelity(payload)

    drift_count = result[
        "drift"
    ]["change_count"]

    if drift_count == 0:
        status = "MATCH"
    elif (
        result[
            "overall_fidelity_percent"
        ] >= 95
    ):
        status = "MINOR_DRIFT"
    elif (
        result[
            "overall_fidelity_percent"
        ] >= 80
    ):
        status = "REVIEW_REQUIRED"
    else:
        status = "MATERIAL_DRIFT"

    return {
        "analysis_id": (
            "TWINPVA-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "status": status,
        "overall_fidelity_percent": (
            result[
                "overall_fidelity_percent"
            ]
        ),
        "domain_fidelity": (
            result["domain_fidelity"]
        ),
        "drift": result["drift"],
        "blind_spots": (
            result["blind_spots"]
        ),
        "reconciliation_required": (
            status != "MATCH"
        ),
        "evidence_hash_sha256": _hash(
            {
                "predicted": result[
                    "predicted_hash_sha256"
                ],
                "actual": result[
                    "actual_hash_sha256"
                ],
                "drift": result["drift"],
            }
        ),
        "safety": _safety(),
    }


def engine_status() -> dict[str, Any]:
    return {
        "engine": "KMITORA Digital Twin Replay",
        "version": ENGINE_VERSION,
        "status": "READY",
        "authority": "SIMULATION_ONLY",
        "capabilities": [
            "f1_snapshot",
            "f2_future_state_reconstruction",
            "migration_twin_replay",
            "temporal_time_machine",
            "event_replay",
            "immutable_checkpoints",
            "state_hashing",
            "before_after_delta",
            "single_step_replay",
            "scenario_branching",
            "predicted_vs_actual",
            "domain_fidelity",
            "drift_detection",
            "blind_spot_detection",
            "business_rule_dna_binding",
            "what_breaks_if_binding",
            "migration_autopilot_binding",
            "cutover_simulator_binding",
            "reconciliation_binding",
            "evidence_hashing",
        ],
        "supported_event_types": sorted(
            SUPPORTED_EVENT_TYPES
        ),
        "safety": {
            "read_only": True,
            "simulation_only": True,
            "direct_target_write_path": False,
            "production_action_executed": False,
            "cutover_executed": False,
        },
    }
