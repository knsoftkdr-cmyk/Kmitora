from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


PRODUCT = "KMITORA"
COMPONENT = "ENTERPRISE_XRAY"
VERSION = "0.1.0-dev"
READ_ONLY = True
PRODUCTION_WRITE = False

_LOCK = threading.RLock()

_DEFAULT_DB = (
    Path(__file__).resolve().parent
    / "data"
    / "kmitora_enterprise_xray_dev.sqlite3"
)

DB_PATH = Path(
    os.environ.get(
        "KMITORA_XRAY_DB",
        str(_DEFAULT_DB),
    )
).resolve()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def stable_id(prefix: str, *parts: Any) -> str:
    value = "|".join(str(item or "").strip().lower() for item in parts)
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}-{digest.upper()}"


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _from_json(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(DB_PATH), timeout=30.0)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def initialize() -> None:
    with _LOCK:
        with _connect() as db:
            db.executescript(
                """
                CREATE TABLE IF NOT EXISTS xray_scans (
                    scan_id TEXT PRIMARY KEY,
                    migration_id TEXT,
                    created_at TEXT NOT NULL,
                    completed_at TEXT,
                    status TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    source_type TEXT,
                    target_type TEXT,
                    asset_count INTEGER NOT NULL DEFAULT 0,
                    relationship_count INTEGER NOT NULL DEFAULT 0,
                    business_rule_count INTEGER NOT NULL DEFAULT 0,
                    blind_spot_count INTEGER NOT NULL DEFAULT 0,
                    risk_count INTEGER NOT NULL DEFAULT 0,
                    understanding_score REAL NOT NULL DEFAULT 0,
                    payload_json TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_xray_scans_created
                    ON xray_scans(created_at DESC);

                CREATE INDEX IF NOT EXISTS idx_xray_scans_migration
                    ON xray_scans(migration_id);

                CREATE TABLE IF NOT EXISTS xray_assets (
                    scan_id TEXT NOT NULL,
                    asset_id TEXT NOT NULL,
                    asset_type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    system_id TEXT,
                    parent_asset_id TEXT,
                    environment TEXT,
                    technology TEXT,
                    criticality TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    verified INTEGER NOT NULL,
                    owner TEXT,
                    classification_json TEXT NOT NULL,
                    attributes_json TEXT NOT NULL,
                    evidence_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (scan_id, asset_id),
                    FOREIGN KEY (scan_id)
                        REFERENCES xray_scans(scan_id)
                        ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_xray_assets_type
                    ON xray_assets(scan_id, asset_type);

                CREATE INDEX IF NOT EXISTS idx_xray_assets_name
                    ON xray_assets(scan_id, name);

                CREATE TABLE IF NOT EXISTS xray_relationships (
                    scan_id TEXT NOT NULL,
                    relationship_id TEXT NOT NULL,
                    from_asset_id TEXT NOT NULL,
                    to_asset_id TEXT NOT NULL,
                    relationship_type TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    verified INTEGER NOT NULL,
                    source TEXT NOT NULL,
                    evidence_json TEXT NOT NULL,
                    attributes_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (scan_id, relationship_id),
                    FOREIGN KEY (scan_id)
                        REFERENCES xray_scans(scan_id)
                        ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_xray_rel_from
                    ON xray_relationships(scan_id, from_asset_id);

                CREATE INDEX IF NOT EXISTS idx_xray_rel_to
                    ON xray_relationships(scan_id, to_asset_id);

                CREATE TABLE IF NOT EXISTS xray_facts (
                    scan_id TEXT NOT NULL,
                    fact_id TEXT NOT NULL,
                    subject_asset_id TEXT,
                    statement TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    verified INTEGER NOT NULL,
                    source TEXT NOT NULL,
                    evidence_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (scan_id, fact_id),
                    FOREIGN KEY (scan_id)
                        REFERENCES xray_scans(scan_id)
                        ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS xray_blind_spots (
                    scan_id TEXT NOT NULL,
                    blind_spot_id TEXT NOT NULL,
                    category TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    asset_id TEXT,
                    message TEXT NOT NULL,
                    recommendation TEXT NOT NULL,
                    evidence_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (scan_id, blind_spot_id),
                    FOREIGN KEY (scan_id)
                        REFERENCES xray_scans(scan_id)
                        ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS xray_risks (
                    scan_id TEXT NOT NULL,
                    risk_id TEXT NOT NULL,
                    category TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    asset_id TEXT,
                    score REAL NOT NULL,
                    message TEXT NOT NULL,
                    recommendation TEXT NOT NULL,
                    evidence_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (scan_id, risk_id),
                    FOREIGN KEY (scan_id)
                        REFERENCES xray_scans(scan_id)
                        ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS xray_snapshots (
                    snapshot_id TEXT PRIMARY KEY,
                    scan_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    fingerprint TEXT NOT NULL,
                    summary_json TEXT NOT NULL,
                    graph_json TEXT NOT NULL,
                    FOREIGN KEY (scan_id)
                        REFERENCES xray_scans(scan_id)
                        ON DELETE CASCADE
                );
                """
            )


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _name(value: Any, fallback: str) -> str:
    if isinstance(value, dict):
        for key in ("name", "entity", "table", "id"):
            candidate = value.get(key)
            if candidate:
                return str(candidate)
    if value:
        return str(value)
    return fallback


def _field_name(value: Any, fallback: str) -> str:
    if isinstance(value, dict):
        for key in ("name", "field", "column"):
            candidate = value.get(key)
            if candidate:
                return str(candidate)
    return fallback


def _entity_fields(entity: dict[str, Any]) -> list[Any]:
    for key in ("fields", "columns", "schema"):
        value = entity.get(key)
        if isinstance(value, list):
            return value
    return []


def _make_asset(
    *,
    scan_id: str,
    asset_type: str,
    name: str,
    system_id: str | None = None,
    parent_asset_id: str | None = None,
    environment: str | None = None,
    technology: str | None = None,
    criticality: str = "UNKNOWN",
    confidence: float = 1.0,
    verified: bool = True,
    owner: str | None = None,
    classification: list[str] | None = None,
    attributes: dict[str, Any] | None = None,
    evidence: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    asset_id = stable_id(
        "AST",
        asset_type,
        system_id,
        parent_asset_id,
        name,
    )

    return {
        "scan_id": scan_id,
        "asset_id": asset_id,
        "asset_type": asset_type,
        "name": name,
        "system_id": system_id,
        "parent_asset_id": parent_asset_id,
        "environment": environment,
        "technology": technology,
        "criticality": criticality,
        "confidence": float(confidence),
        "verified": bool(verified),
        "owner": owner,
        "classification": classification or [],
        "attributes": attributes or {},
        "evidence": evidence or [],
        "created_at": utc_now(),
    }


def _make_relationship(
    *,
    scan_id: str,
    from_asset_id: str,
    to_asset_id: str,
    relationship_type: str,
    confidence: float = 1.0,
    verified: bool = True,
    source: str = "KMITORA_DISCOVERY",
    evidence: list[dict[str, Any]] | None = None,
    attributes: dict[str, Any] | None = None,
) -> dict[str, Any]:
    relationship_id = stable_id(
        "REL",
        from_asset_id,
        to_asset_id,
        relationship_type,
    )

    return {
        "scan_id": scan_id,
        "relationship_id": relationship_id,
        "from_asset_id": from_asset_id,
        "to_asset_id": to_asset_id,
        "relationship_type": relationship_type,
        "confidence": float(confidence),
        "verified": bool(verified),
        "source": source,
        "evidence": evidence or [],
        "attributes": attributes or {},
        "created_at": utc_now(),
    }


def _relationship_entities(
    relationship: Any,
) -> tuple[str | None, str | None, dict[str, Any]]:
    if isinstance(relationship, dict):
        parent = (
            relationship.get("parent_entity")
            or relationship.get("source_entity")
            or relationship.get("from_entity")
            or relationship.get("parent")
            or relationship.get("source")
        )

        child = (
            relationship.get("child_entity")
            or relationship.get("target_entity")
            or relationship.get("to_entity")
            or relationship.get("child")
            or relationship.get("target")
        )

        return (
            str(parent) if parent else None,
            str(child) if child else None,
            relationship,
        )

    text = str(relationship or "").strip()

    if "->" in text:
        left, right = text.split("->", 1)

        left = left.strip().split(".", 1)[0].strip()
        right = right.strip().split(".", 1)[0].strip()

        return left or None, right or None, {"raw": text}

    return None, None, {"raw": text}


def _insert_asset(db: sqlite3.Connection, asset: dict[str, Any]) -> None:
    db.execute(
        """
        INSERT OR REPLACE INTO xray_assets (
            scan_id,
            asset_id,
            asset_type,
            name,
            system_id,
            parent_asset_id,
            environment,
            technology,
            criticality,
            confidence,
            verified,
            owner,
            classification_json,
            attributes_json,
            evidence_json,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            asset["scan_id"],
            asset["asset_id"],
            asset["asset_type"],
            asset["name"],
            asset.get("system_id"),
            asset.get("parent_asset_id"),
            asset.get("environment"),
            asset.get("technology"),
            asset.get("criticality", "UNKNOWN"),
            asset.get("confidence", 1.0),
            1 if asset.get("verified") else 0,
            asset.get("owner"),
            _json(asset.get("classification", [])),
            _json(asset.get("attributes", {})),
            _json(asset.get("evidence", [])),
            asset["created_at"],
        ),
    )


def _insert_relationship(
    db: sqlite3.Connection,
    relationship: dict[str, Any],
) -> None:
    db.execute(
        """
        INSERT OR REPLACE INTO xray_relationships (
            scan_id,
            relationship_id,
            from_asset_id,
            to_asset_id,
            relationship_type,
            confidence,
            verified,
            source,
            evidence_json,
            attributes_json,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            relationship["scan_id"],
            relationship["relationship_id"],
            relationship["from_asset_id"],
            relationship["to_asset_id"],
            relationship["relationship_type"],
            relationship["confidence"],
            1 if relationship["verified"] else 0,
            relationship["source"],
            _json(relationship.get("evidence", [])),
            _json(relationship.get("attributes", {})),
            relationship["created_at"],
        ),
    )


def _latest_scan_id(db: sqlite3.Connection) -> str | None:
    row = db.execute(
        """
        SELECT scan_id
        FROM xray_scans
        WHERE status = 'COMPLETED'
        ORDER BY completed_at DESC, created_at DESC
        LIMIT 1
        """
    ).fetchone()

    return str(row["scan_id"]) if row else None


def _rows_to_assets(rows: Iterable[sqlite3.Row]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []

    for row in rows:
        item = dict(row)
        item["verified"] = bool(item["verified"])
        item["classification"] = _from_json(
            item.pop("classification_json", "[]"),
            [],
        )
        item["attributes"] = _from_json(
            item.pop("attributes_json", "{}"),
            {},
        )
        item["evidence"] = _from_json(
            item.pop("evidence_json", "[]"),
            [],
        )
        output.append(item)

    return output


def _rows_to_relationships(
    rows: Iterable[sqlite3.Row],
) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []

    for row in rows:
        item = dict(row)
        item["verified"] = bool(item["verified"])
        item["evidence"] = _from_json(
            item.pop("evidence_json", "[]"),
            [],
        )
        item["attributes"] = _from_json(
            item.pop("attributes_json", "{}"),
            {},
        )
        output.append(item)

    return output


def ingest_discovery(discovery: dict[str, Any]) -> dict[str, Any]:
    """
    Build a read-only Enterprise X-Ray snapshot from an existing KMITORA
    discovery result.

    This function does not write to source or target systems.
    It only persists normalized control-plane intelligence in the local
    X-Ray DEV database.
    """

    initialize()

    migration_id = str(
        discovery.get("migration_id")
        or discovery.get("id")
        or uuid.uuid4()
    )

    scan_id = stable_id(
        "XRAY",
        migration_id,
        discovery.get("generated_at")
        or discovery.get("generatedAt")
        or utc_now(),
    )

    source = (
        discovery.get("source")
        if isinstance(discovery.get("source"), dict)
        else {}
    )

    target = (
        discovery.get("target")
        if isinstance(discovery.get("target"), dict)
        else {}
    )

    source_type = str(
        source.get("type")
        or source.get("technology")
        or "SOURCE"
    )

    target_type = str(
        target.get("type")
        or target.get("technology")
        or "TARGET"
    )

    created_at = utc_now()

    assets: list[dict[str, Any]] = []
    relationships: list[dict[str, Any]] = []

    source_system = _make_asset(
        scan_id=scan_id,
        asset_type="SYSTEM",
        name=str(source.get("name") or "KMITORA Source"),
        system_id="SOURCE",
        environment="DEV",
        technology=source_type,
        criticality="HIGH",
        evidence=[
            {
                "type": "DISCOVERY",
                "migration_id": migration_id,
            }
        ],
    )

    target_system = _make_asset(
        scan_id=scan_id,
        asset_type="SYSTEM",
        name=str(target.get("name") or "KMITORA Target"),
        system_id="TARGET",
        environment="DEV",
        technology=target_type,
        criticality="HIGH",
        evidence=[
            {
                "type": "DISCOVERY",
                "migration_id": migration_id,
            }
        ],
    )

    assets.extend([source_system, target_system])

    entity_lookup: dict[str, str] = {}

    def add_entities(
        system_asset: dict[str, Any],
        system_payload: dict[str, Any],
        role: str,
    ) -> None:
        raw_entities = _as_list(system_payload.get("entities"))

        for index, raw in enumerate(raw_entities, start=1):
            entity = raw if isinstance(raw, dict) else {"name": str(raw)}
            entity_name = _name(entity, f"{role}_entity_{index}")

            entity_asset = _make_asset(
                scan_id=scan_id,
                asset_type="DATA_ENTITY",
                name=entity_name,
                system_id=system_asset["asset_id"],
                parent_asset_id=system_asset["asset_id"],
                environment="DEV",
                technology=system_asset.get("technology"),
                criticality="MEDIUM",
                attributes={
                    "role": role,
                    "row_count": entity.get("row_count")
                    or entity.get("record_count")
                    or entity.get("count"),
                },
                evidence=[
                    {
                        "type": "DISCOVERY_ENTITY",
                        "migration_id": migration_id,
                        "role": role,
                    }
                ],
            )

            assets.append(entity_asset)
            entity_lookup[
                f"{role}:{entity_name}".lower()
            ] = entity_asset["asset_id"]

            entity_lookup.setdefault(
                entity_name.lower(),
                entity_asset["asset_id"],
            )

            relationships.append(
                _make_relationship(
                    scan_id=scan_id,
                    from_asset_id=system_asset["asset_id"],
                    to_asset_id=entity_asset["asset_id"],
                    relationship_type="CONTAINS",
                    evidence=[
                        {
                            "type": "DISCOVERY_STRUCTURE",
                            "migration_id": migration_id,
                        }
                    ],
                )
            )

            fields = _entity_fields(entity)

            for field_index, raw_field in enumerate(fields, start=1):
                field = (
                    raw_field
                    if isinstance(raw_field, dict)
                    else {"name": str(raw_field)}
                )

                field_name = _field_name(
                    field,
                    f"field_{field_index}",
                )

                field_asset = _make_asset(
                    scan_id=scan_id,
                    asset_type="DATA_FIELD",
                    name=field_name,
                    system_id=system_asset["asset_id"],
                    parent_asset_id=entity_asset["asset_id"],
                    environment="DEV",
                    technology=system_asset.get("technology"),
                    criticality="LOW",
                    attributes={
                        "role": role,
                        "definition": field.get("definition"),
                        "type": field.get("type")
                        or field.get("data_type"),
                        "nullable": field.get("nullable"),
                    },
                    evidence=[
                        {
                            "type": "DISCOVERY_FIELD",
                            "migration_id": migration_id,
                            "entity": entity_name,
                        }
                    ],
                )

                assets.append(field_asset)

                relationships.append(
                    _make_relationship(
                        scan_id=scan_id,
                        from_asset_id=entity_asset["asset_id"],
                        to_asset_id=field_asset["asset_id"],
                        relationship_type="HAS_FIELD",
                    )
                )

    add_entities(source_system, source, "SOURCE")
    add_entities(target_system, target, "TARGET")

    # Business rules become first-class X-Ray assets.
    business_rules = _as_list(discovery.get("business_rules"))

    for index, raw_rule in enumerate(business_rules, start=1):
        rule = (
            raw_rule
            if isinstance(raw_rule, dict)
            else {"rule": str(raw_rule)}
        )

        rule_id = str(
            rule.get("id")
            or rule.get("rule_id")
            or f"BR-{index:03d}"
        )

        description = str(
            rule.get("description")
            or rule.get("rule")
            or rule.get("text")
            or rule_id
        )

        rule_asset = _make_asset(
            scan_id=scan_id,
            asset_type="BUSINESS_RULE",
            name=rule_id,
            system_id="BUSINESS",
            criticality="MEDIUM",
            attributes={
                "description": description,
                "raw": rule,
            },
            evidence=[
                {
                    "type": "BUSINESS_RULE_DISCOVERY",
                    "migration_id": migration_id,
                }
            ],
        )

        assets.append(rule_asset)

    # Explicit and inferred relationships from KMITORA discovery.
    for raw_relationship in _as_list(
        discovery.get("relationships")
    ):
        parent_name, child_name, relation_payload = (
            _relationship_entities(raw_relationship)
        )

        if not parent_name or not child_name:
            continue

        parent_id = (
            entity_lookup.get(f"SOURCE:{parent_name}".lower())
            or entity_lookup.get(parent_name.lower())
        )

        child_id = (
            entity_lookup.get(f"SOURCE:{child_name}".lower())
            or entity_lookup.get(child_name.lower())
        )

        if not parent_id or not child_id:
            continue

        relationships.append(
            _make_relationship(
                scan_id=scan_id,
                from_asset_id=parent_id,
                to_asset_id=child_id,
                relationship_type="DEPENDS_ON",
                confidence=float(
                    relation_payload.get("confidence", 1.0)
                    if isinstance(relation_payload, dict)
                    else 1.0
                ),
                verified=True,
                source="KMITORA_DISCOVERY_RELATIONSHIP",
                evidence=[
                    {
                        "type": "RELATIONSHIP_DISCOVERY",
                        "migration_id": migration_id,
                    }
                ],
                attributes=relation_payload,
            )
        )

    # Mapping candidates create source-to-target traceability.
    for mapping in _as_list(discovery.get("suggested_mappings")):
        if not isinstance(mapping, dict):
            continue

        source_ref = str(mapping.get("source") or "")
        target_ref = str(mapping.get("target") or "")

        source_entity_name = source_ref.split(".", 1)[0].strip()
        target_entity_name = target_ref.split(".", 1)[0].strip()

        source_id = entity_lookup.get(
            f"SOURCE:{source_entity_name}".lower()
        ) or entity_lookup.get(source_entity_name.lower())

        target_id = entity_lookup.get(
            f"TARGET:{target_entity_name}".lower()
        ) or entity_lookup.get(target_entity_name.lower())

        if source_id and target_id:
            relationships.append(
                _make_relationship(
                    scan_id=scan_id,
                    from_asset_id=source_id,
                    to_asset_id=target_id,
                    relationship_type="MAPS_TO",
                    confidence=float(
                        mapping.get("confidence")
                        if mapping.get("confidence") is not None
                        else 0.5
                    ),
                    verified=str(
                        mapping.get("status", "")
                    ).upper() in {
                        "ACCEPTED",
                        "VALIDATED",
                        "READY",
                    },
                    source="KMITORA_MAPPING",
                    evidence=[
                        {
                            "type": "MAPPING",
                            "migration_id": migration_id,
                            "source": source_ref,
                            "target": target_ref,
                        }
                    ],
                    attributes={
                        "status": mapping.get("status"),
                        "decision": mapping.get("decision"),
                        "reason": mapping.get("reason"),
                        "business_rules": mapping.get(
                            "business_rules",
                            [],
                        ),
                    },
                )
            )

    # Remove duplicates while preserving latest normalized object.
    unique_assets = {
        item["asset_id"]: item
        for item in assets
    }

    unique_relationships = {
        item["relationship_id"]: item
        for item in relationships
    }

    assets = list(unique_assets.values())
    relationships = list(unique_relationships.values())

    degree: dict[str, int] = defaultdict(int)

    for relation in relationships:
        degree[relation["from_asset_id"]] += 1
        degree[relation["to_asset_id"]] += 1

    # Relationship-based criticality.
    for asset in assets:
        graph_degree = degree.get(asset["asset_id"], 0)

        if asset["asset_type"] == "SYSTEM":
            asset["criticality"] = "HIGH"
        elif graph_degree >= 8:
            asset["criticality"] = "CRITICAL"
        elif graph_degree >= 4:
            asset["criticality"] = "HIGH"
        elif graph_degree >= 2:
            asset["criticality"] = "MEDIUM"
        else:
            asset["criticality"] = asset.get(
                "criticality",
                "LOW",
            )

        asset["attributes"]["graph_degree"] = graph_degree

    blind_spots: list[dict[str, Any]] = []

    # Unverified relationships.
    for relation in relationships:
        if not relation["verified"]:
            blind_spots.append(
                {
                    "blind_spot_id": stable_id(
                        "BLIND",
                        scan_id,
                        relation["relationship_id"],
                    ),
                    "category": "UNVERIFIED_RELATIONSHIP",
                    "severity": "MEDIUM",
                    "asset_id": relation["from_asset_id"],
                    "message": (
                        "Relationship exists but is not yet "
                        "deterministically verified."
                    ),
                    "recommendation": (
                        "Validate relationship against source "
                        "metadata, code, runtime trace or SME evidence."
                    ),
                    "evidence": relation.get("evidence", []),
                }
            )

    # Data entities without discovered fields.
    children_by_parent: dict[str, int] = defaultdict(int)

    for relation in relationships:
        if relation["relationship_type"] == "HAS_FIELD":
            children_by_parent[relation["from_asset_id"]] += 1

    for asset in assets:
        if (
            asset["asset_type"] == "DATA_ENTITY"
            and children_by_parent.get(asset["asset_id"], 0) == 0
        ):
            blind_spots.append(
                {
                    "blind_spot_id": stable_id(
                        "BLIND",
                        scan_id,
                        asset["asset_id"],
                        "NO_FIELDS",
                    ),
                    "category": "INCOMPLETE_METADATA",
                    "severity": "HIGH",
                    "asset_id": asset["asset_id"],
                    "message": (
                        f"No field/column metadata was discovered for "
                        f"{asset['name']}."
                    ),
                    "recommendation": (
                        "Run deeper metadata discovery before "
                        "migration design or impact analysis."
                    ),
                    "evidence": asset.get("evidence", []),
                }
            )

    risks: list[dict[str, Any]] = []

    for asset in assets:
        if asset["criticality"] in {"CRITICAL", "HIGH"}:
            risk_score = (
                90.0
                if asset["criticality"] == "CRITICAL"
                else 70.0
            )

            risks.append(
                {
                    "risk_id": stable_id(
                        "RISK",
                        scan_id,
                        asset["asset_id"],
                    ),
                    "category": "CHANGE_BLAST_RADIUS",
                    "severity": (
                        "CRITICAL"
                        if asset["criticality"] == "CRITICAL"
                        else "HIGH"
                    ),
                    "asset_id": asset["asset_id"],
                    "score": risk_score,
                    "message": (
                        f"{asset['name']} has elevated dependency "
                        f"criticality."
                    ),
                    "recommendation": (
                        "Require impact analysis and simulation before "
                        "state-changing migration or modernization."
                    ),
                    "evidence": asset.get("evidence", []),
                }
            )

    verified_asset_count = sum(
        1 for item in assets if item["verified"]
    )

    verified_relationship_count = sum(
        1 for item in relationships if item["verified"]
    )

    asset_coverage = (
        verified_asset_count / len(assets)
        if assets
        else 0.0
    )

    relationship_coverage = (
        verified_relationship_count / len(relationships)
        if relationships
        else 0.0
    )

    rule_coverage = 1.0 if business_rules else 0.0

    evidence_coverage = (
        sum(1 for item in assets if item.get("evidence"))
        / len(assets)
        if assets
        else 0.0
    )

    blind_spot_penalty = min(
        len(blind_spots) / max(len(assets), 1),
        1.0,
    )

    understanding_score = round(
        100
        * max(
            0.0,
            (
                asset_coverage * 0.35
                + relationship_coverage * 0.30
                + rule_coverage * 0.15
                + evidence_coverage * 0.20
                - blind_spot_penalty * 0.15
            ),
        ),
        2,
    )

    summary = {
        "product": PRODUCT,
        "component": COMPONENT,
        "version": VERSION,
        "scan_id": scan_id,
        "migration_id": migration_id,
        "status": "COMPLETED",
        "mode": "READ_ONLY_ENTERPRISE_XRAY",
        "read_only": True,
        "source_write_executed": False,
        "target_write_executed": False,
        "production_action_executed": False,
        "asset_count": len(assets),
        "relationship_count": len(relationships),
        "business_rule_count": len(business_rules),
        "verified_asset_count": verified_asset_count,
        "verified_relationship_count": verified_relationship_count,
        "blind_spot_count": len(blind_spots),
        "risk_count": len(risks),
        "critical_asset_count": sum(
            1
            for item in assets
            if item["criticality"] == "CRITICAL"
        ),
        "high_criticality_asset_count": sum(
            1
            for item in assets
            if item["criticality"] == "HIGH"
        ),
        "enterprise_understanding_score": understanding_score,
        "coverage": {
            "asset": round(asset_coverage * 100, 2),
            "relationship": round(
                relationship_coverage * 100,
                2,
            ),
            "business_rule": round(rule_coverage * 100, 2),
            "evidence": round(evidence_coverage * 100, 2),
        },
        "created_at": created_at,
        "completed_at": utc_now(),
    }

    graph = {
        "scan_id": scan_id,
        "nodes": assets,
        "edges": relationships,
        "summary": summary,
    }

    fingerprint = hashlib.sha256(
        _json(
            {
                "assets": [
                    {
                        "id": item["asset_id"],
                        "type": item["asset_type"],
                        "name": item["name"],
                    }
                    for item in assets
                ],
                "relationships": [
                    {
                        "from": item["from_asset_id"],
                        "to": item["to_asset_id"],
                        "type": item["relationship_type"],
                    }
                    for item in relationships
                ],
            }
        ).encode("utf-8")
    ).hexdigest()

    snapshot_id = stable_id(
        "SNAP",
        scan_id,
        fingerprint,
    )

    with _LOCK:
        with _connect() as db:
            db.execute(
                """
                INSERT OR REPLACE INTO xray_scans (
                    scan_id,
                    migration_id,
                    created_at,
                    completed_at,
                    status,
                    mode,
                    source_type,
                    target_type,
                    asset_count,
                    relationship_count,
                    business_rule_count,
                    blind_spot_count,
                    risk_count,
                    understanding_score,
                    payload_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    scan_id,
                    migration_id,
                    created_at,
                    summary["completed_at"],
                    "COMPLETED",
                    "READ_ONLY_ENTERPRISE_XRAY",
                    source_type,
                    target_type,
                    len(assets),
                    len(relationships),
                    len(business_rules),
                    len(blind_spots),
                    len(risks),
                    understanding_score,
                    _json(summary),
                ),
            )

            db.execute(
                "DELETE FROM xray_assets WHERE scan_id = ?",
                (scan_id,),
            )
            db.execute(
                "DELETE FROM xray_relationships WHERE scan_id = ?",
                (scan_id,),
            )
            db.execute(
                "DELETE FROM xray_blind_spots WHERE scan_id = ?",
                (scan_id,),
            )
            db.execute(
                "DELETE FROM xray_risks WHERE scan_id = ?",
                (scan_id,),
            )

            for asset in assets:
                _insert_asset(db, asset)

            for relationship in relationships:
                _insert_relationship(db, relationship)

            for item in blind_spots:
                db.execute(
                    """
                    INSERT OR REPLACE INTO xray_blind_spots (
                        scan_id,
                        blind_spot_id,
                        category,
                        severity,
                        asset_id,
                        message,
                        recommendation,
                        evidence_json,
                        created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        scan_id,
                        item["blind_spot_id"],
                        item["category"],
                        item["severity"],
                        item.get("asset_id"),
                        item["message"],
                        item["recommendation"],
                        _json(item.get("evidence", [])),
                        utc_now(),
                    ),
                )

            for item in risks:
                db.execute(
                    """
                    INSERT OR REPLACE INTO xray_risks (
                        scan_id,
                        risk_id,
                        category,
                        severity,
                        asset_id,
                        score,
                        message,
                        recommendation,
                        evidence_json,
                        created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        scan_id,
                        item["risk_id"],
                        item["category"],
                        item["severity"],
                        item.get("asset_id"),
                        item["score"],
                        item["message"],
                        item["recommendation"],
                        _json(item.get("evidence", [])),
                        utc_now(),
                    ),
                )

            db.execute(
                """
                INSERT OR REPLACE INTO xray_snapshots (
                    snapshot_id,
                    scan_id,
                    created_at,
                    fingerprint,
                    summary_json,
                    graph_json
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    snapshot_id,
                    scan_id,
                    utc_now(),
                    fingerprint,
                    _json(summary),
                    _json(graph),
                ),
            )

    return {
        **summary,
        "snapshot_id": snapshot_id,
        "fingerprint": fingerprint,
    }


def get_status() -> dict[str, Any]:
    initialize()

    with _connect() as db:
        scan_id = _latest_scan_id(db)

    return {
        "product": PRODUCT,
        "component": COMPONENT,
        "version": VERSION,
        "status": "READY",
        "read_only": READ_ONLY,
        "production_write": PRODUCTION_WRITE,
        "database": str(DB_PATH),
        "latest_scan_id": scan_id,
        "source_write_executed": False,
        "target_write_executed": False,
        "production_action_executed": False,
    }


def get_summary(scan_id: str | None = None) -> dict[str, Any]:
    initialize()

    with _connect() as db:
        selected = scan_id or _latest_scan_id(db)

        if not selected:
            return {
                "status": "NO_XRAY_SCAN",
                "read_only": True,
                "production_action_executed": False,
            }

        row = db.execute(
            """
            SELECT *
            FROM xray_scans
            WHERE scan_id = ?
            """,
            (selected,),
        ).fetchone()

        if not row:
            return {
                "status": "NOT_FOUND",
                "scan_id": selected,
                "read_only": True,
                "production_action_executed": False,
            }

        return _from_json(
            row["payload_json"],
            dict(row),
        )


def get_assets(
    scan_id: str | None = None,
    asset_type: str | None = None,
) -> list[dict[str, Any]]:
    initialize()

    with _connect() as db:
        selected = scan_id or _latest_scan_id(db)

        if not selected:
            return []

        if asset_type:
            rows = db.execute(
                """
                SELECT *
                FROM xray_assets
                WHERE scan_id = ?
                  AND asset_type = ?
                ORDER BY criticality, asset_type, name
                """,
                (selected, asset_type),
            ).fetchall()
        else:
            rows = db.execute(
                """
                SELECT *
                FROM xray_assets
                WHERE scan_id = ?
                ORDER BY asset_type, name
                """,
                (selected,),
            ).fetchall()

    return _rows_to_assets(rows)


def get_relationships(
    scan_id: str | None = None,
) -> list[dict[str, Any]]:
    initialize()

    with _connect() as db:
        selected = scan_id or _latest_scan_id(db)

        if not selected:
            return []

        rows = db.execute(
            """
            SELECT *
            FROM xray_relationships
            WHERE scan_id = ?
            ORDER BY relationship_type, relationship_id
            """,
            (selected,),
        ).fetchall()

    return _rows_to_relationships(rows)


def get_graph(scan_id: str | None = None) -> dict[str, Any]:
    summary = get_summary(scan_id)

    selected = summary.get("scan_id")

    if not selected:
        return {
            "status": summary.get("status", "NO_XRAY_SCAN"),
            "nodes": [],
            "edges": [],
            "summary": summary,
        }

    return {
        "status": "READY",
        "scan_id": selected,
        "nodes": get_assets(selected),
        "edges": get_relationships(selected),
        "summary": summary,
        "read_only": True,
        "production_action_executed": False,
    }


def get_blind_spots(
    scan_id: str | None = None,
) -> list[dict[str, Any]]:
    initialize()

    with _connect() as db:
        selected = scan_id or _latest_scan_id(db)

        if not selected:
            return []

        rows = db.execute(
            """
            SELECT *
            FROM xray_blind_spots
            WHERE scan_id = ?
            ORDER BY
                CASE severity
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'HIGH' THEN 2
                    WHEN 'MEDIUM' THEN 3
                    ELSE 4
                END,
                category
            """,
            (selected,),
        ).fetchall()

    output = []

    for row in rows:
        item = dict(row)
        item["evidence"] = _from_json(
            item.pop("evidence_json", "[]"),
            [],
        )
        output.append(item)

    return output


def get_risks(
    scan_id: str | None = None,
) -> list[dict[str, Any]]:
    initialize()

    with _connect() as db:
        selected = scan_id or _latest_scan_id(db)

        if not selected:
            return []

        rows = db.execute(
            """
            SELECT *
            FROM xray_risks
            WHERE scan_id = ?
            ORDER BY score DESC
            """,
            (selected,),
        ).fetchall()

    output = []

    for row in rows:
        item = dict(row)
        item["evidence"] = _from_json(
            item.pop("evidence_json", "[]"),
            [],
        )
        output.append(item)

    return output


def get_critical_assets(
    scan_id: str | None = None,
) -> list[dict[str, Any]]:
    assets = get_assets(scan_id)

    priority = {
        "CRITICAL": 0,
        "HIGH": 1,
        "MEDIUM": 2,
        "LOW": 3,
        "UNKNOWN": 4,
    }

    filtered = [
        item
        for item in assets
        if item.get("criticality") in {"CRITICAL", "HIGH"}
    ]

    return sorted(
        filtered,
        key=lambda item: (
            priority.get(item.get("criticality"), 9),
            -int(
                item.get("attributes", {}).get(
                    "graph_degree",
                    0,
                )
            ),
            item.get("name", ""),
        ),
    )


def calculate_impact(
    asset_id: str,
    scan_id: str | None = None,
    max_depth: int = 6,
) -> dict[str, Any]:
    if not asset_id:
        raise ValueError("asset_id is required.")

    graph = get_graph(scan_id)

    selected = graph.get("scan_id")

    if not selected:
        return {
            "status": "NO_XRAY_SCAN",
            "asset_id": asset_id,
            "impacted_assets": [],
            "read_only": True,
            "production_action_executed": False,
        }

    assets = {
        item["asset_id"]: item
        for item in graph["nodes"]
    }

    if asset_id not in assets:
        raise ValueError(
            f"Enterprise X-Ray asset not found: {asset_id}"
        )

    adjacency: dict[str, list[tuple[str, dict[str, Any]]]] = (
        defaultdict(list)
    )

    for relation in graph["edges"]:
        adjacency[relation["from_asset_id"]].append(
            (relation["to_asset_id"], relation)
        )

        if relation["relationship_type"] in {
            "HAS_FIELD",
            "CONTAINS",
        }:
            adjacency[relation["to_asset_id"]].append(
                (relation["from_asset_id"], relation)
            )

    visited = {asset_id}
    queue: deque[tuple[str, int]] = deque(
        [(asset_id, 0)]
    )

    impacted: list[dict[str, Any]] = []

    while queue:
        current, depth = queue.popleft()

        if depth >= max_depth:
            continue

        for next_id, relation in adjacency.get(current, []):
            if next_id in visited:
                continue

            visited.add(next_id)

            asset = assets.get(next_id)

            if not asset:
                continue

            impacted.append(
                {
                    "depth": depth + 1,
                    "asset": asset,
                    "via_relationship": {
                        "relationship_id": relation[
                            "relationship_id"
                        ],
                        "relationship_type": relation[
                            "relationship_type"
                        ],
                        "confidence": relation["confidence"],
                        "verified": relation["verified"],
                    },
                }
            )

            queue.append((next_id, depth + 1))

    critical = [
        item
        for item in impacted
        if item["asset"].get("criticality")
        in {"CRITICAL", "HIGH"}
    ]

    business_rules = [
        item
        for item in impacted
        if item["asset"].get("asset_type")
        == "BUSINESS_RULE"
    ]

    risk = "LOW"

    if any(
        item["asset"].get("criticality") == "CRITICAL"
        for item in impacted
    ):
        risk = "CRITICAL"
    elif critical:
        risk = "HIGH"
    elif len(impacted) >= 10:
        risk = "MEDIUM"

    return {
        "product": PRODUCT,
        "component": "WHAT_BREAKS_IF",
        "status": "ANALYZED",
        "scan_id": selected,
        "source_asset": assets[asset_id],
        "max_depth": max_depth,
        "direct_impact_count": sum(
            1
            for item in impacted
            if item["depth"] == 1
        ),
        "downstream_impact_count": len(impacted),
        "critical_impact_count": len(critical),
        "business_rule_impact_count": len(business_rules),
        "risk": risk,
        "impacted_assets": impacted,
        "read_only": True,
        "source_write_executed": False,
        "target_write_executed": False,
        "production_action_executed": False,
    }


initialize()
