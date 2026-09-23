from __future__ import annotations

import csv
import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
SCENARIO_ROOT = REPO_ROOT / "TEST_DATA" / "UNIVERSAL_DEV_E2E"
SOURCE_BASE = "http://127.0.0.1:8081"
TARGET_BASE = "http://127.0.0.1:8082"

CUSTOMER_STATUS_ALIASES = {
    "ACTIVE": "ACTIVE",
    "ENABLED": "ACTIVE",
    "INACTIVE": "INACTIVE",
    "DISABLED": "INACTIVE",
}
ORDER_STATUS_ALIASES = {
    "NEW": "NEW",
    "OPEN": "NEW",
    "PAID": "PAID",
    "COMPLETE": "PAID",
    "COMPLETED": "PAID",
    "SHIPPED": "SHIPPED",
    "SENT": "SHIPPED",
    "CANCELLED": "CANCELLED",
    "CANCELED": "CANCELLED",
    "VOID": "CANCELLED",
}
DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y")


@dataclass(frozen=True)
class RepairEvidence:
    entity: str
    key: str
    field: str
    before: Any
    after: Any
    rule: str


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_http(method: str, url: str, payload: Any | None = None, timeout: int = 15) -> Any:
    body = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} for {url}: {raw}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not reach {url}: {exc.reason}") from exc


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def _load_expected(path: Path) -> list[dict[str, str]]:
    return json.loads(path.read_text(encoding="utf-8"))


def _clean(value: Any) -> str:
    return str(value if value is not None else "").strip()


def _upper(value: Any) -> str:
    return _clean(value).upper()


def _lower(value: Any) -> str:
    return _clean(value).lower()


def _money(value: Any) -> str:
    raw = _clean(value).replace(",", "").replace("$", "").replace("₹", "")
    try:
        amount = Decimal(raw).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except InvalidOperation as exc:
        raise ValueError(f"Invalid monetary value: {value!r}") from exc
    return f"{amount:.2f}"


def _positive_int(value: Any) -> str:
    raw = _clean(value)
    try:
        parsed = int(raw)
    except ValueError as exc:
        raise ValueError(f"Invalid integer value: {value!r}") from exc
    if parsed <= 0:
        raise ValueError(f"Quantity must be positive: {value!r}")
    return str(parsed)


def _date(value: Any) -> str:
    raw = _clean(value)
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    raise ValueError(f"Unsupported date format: {value!r}")


def _repair(evidence: list[RepairEvidence], entity: str, key: str, field: str, before: Any, after: Any, rule: str) -> Any:
    if str(before) != str(after):
        evidence.append(RepairEvidence(entity, key, field, before, after, rule))
    return after


def heal_dataset(source: dict[str, list[dict[str, Any]]]) -> tuple[dict[str, list[dict[str, str]]], list[dict[str, Any]]]:
    """Deterministically repair only rules that are unambiguous in the test contract."""
    evidence: list[RepairEvidence] = []

    customers_by_id: dict[str, dict[str, str]] = {}
    for row in source.get("customers", []):
        cid = _upper(row.get("customer_id"))
        if not cid:
            raise ValueError("Customer row has no customer_id")
        first = _clean(row.get("first_name"))
        last = _clean(row.get("last_name"))
        email_before = row.get("email")
        email = _lower(email_before)
        if not email:
            if not first or not last:
                raise ValueError(f"Cannot derive email for {cid}; name is incomplete")
            email = f"{first.lower()}.{last.lower()}@example.test"
        status_raw = _upper(row.get("status"))
        if status_raw not in CUSTOMER_STATUS_ALIASES:
            raise ValueError(f"Ambiguous customer status for {cid}: {status_raw}")
        status = CUSTOMER_STATUS_ALIASES[status_raw]
        region = _upper(row.get("region"))
        healed = {
            "customer_id": _repair(evidence, "customers", cid, "customer_id", row.get("customer_id"), cid, "TRIM_UPPER_IDENTIFIER"),
            "first_name": first,
            "last_name": last,
            "email": _repair(evidence, "customers", cid, "email", email_before, email, "LOWERCASE_OR_DERIVE_EMAIL"),
            "status": _repair(evidence, "customers", cid, "status", row.get("status"), status, "CUSTOMER_STATUS_ALIAS"),
            "region": _repair(evidence, "customers", cid, "region", row.get("region"), region, "TRIM_UPPER_REGION"),
        }
        existing = customers_by_id.get(cid)
        if existing is not None:
            if existing != healed:
                raise ValueError(f"Conflicting duplicate customer {cid}")
            evidence.append(RepairEvidence("customers", cid, "record", "duplicate", "deduplicated", "IDENTICAL_PRIMARY_KEY_DEDUP"))
            continue
        customers_by_id[cid] = healed

    items_by_id: dict[str, dict[str, str]] = {}
    for row in source.get("order_items", []):
        iid = _upper(row.get("item_id"))
        if not iid:
            raise ValueError("Order item row has no item_id")
        oid = _upper(row.get("order_id"))
        product = _upper(row.get("product_code"))
        qty = _positive_int(row.get("quantity"))
        price = _money(row.get("unit_price"))
        healed = {
            "item_id": _repair(evidence, "order_items", iid, "item_id", row.get("item_id"), iid, "TRIM_UPPER_IDENTIFIER"),
            "order_id": _repair(evidence, "order_items", iid, "order_id", row.get("order_id"), oid, "TRIM_UPPER_FOREIGN_KEY"),
            "product_code": _repair(evidence, "order_items", iid, "product_code", row.get("product_code"), product, "TRIM_UPPER_PRODUCT_CODE"),
            "quantity": qty,
            "unit_price": _repair(evidence, "order_items", iid, "unit_price", row.get("unit_price"), price, "NORMALIZE_MONEY"),
        }
        existing = items_by_id.get(iid)
        if existing is not None:
            if existing != healed:
                raise ValueError(f"Conflicting duplicate order item {iid}")
            evidence.append(RepairEvidence("order_items", iid, "record", "duplicate", "deduplicated", "IDENTICAL_PRIMARY_KEY_DEDUP"))
            continue
        items_by_id[iid] = healed

    item_totals: dict[str, Decimal] = {}
    for item in items_by_id.values():
        total = Decimal(item["quantity"]) * Decimal(item["unit_price"])
        item_totals[item["order_id"]] = item_totals.get(item["order_id"], Decimal("0")) + total

    orders_by_id: dict[str, dict[str, str]] = {}
    for row in source.get("orders", []):
        oid = _upper(row.get("order_id"))
        if not oid:
            raise ValueError("Order row has no order_id")
        cid = _upper(row.get("customer_id"))
        order_date = _date(row.get("order_date"))
        status_raw = _upper(row.get("status"))
        if status_raw not in ORDER_STATUS_ALIASES:
            raise ValueError(f"Ambiguous order status for {oid}: {status_raw}")
        status = ORDER_STATUS_ALIASES[status_raw]
        amount = _money(row.get("amount"))
        if Decimal(amount) < 0:
            if oid not in item_totals:
                raise ValueError(f"Negative amount for {oid} cannot be recovered without order items")
            amount = f"{item_totals[oid].quantize(Decimal('0.01')):.2f}"
            evidence.append(RepairEvidence("orders", oid, "amount", row.get("amount"), amount, "RECOVER_NEGATIVE_AMOUNT_FROM_ITEMS"))
        healed = {
            "order_id": _repair(evidence, "orders", oid, "order_id", row.get("order_id"), oid, "TRIM_UPPER_IDENTIFIER"),
            "customer_id": _repair(evidence, "orders", oid, "customer_id", row.get("customer_id"), cid, "TRIM_UPPER_FOREIGN_KEY"),
            "order_date": _repair(evidence, "orders", oid, "order_date", row.get("order_date"), order_date, "NORMALIZE_DATE_ISO8601"),
            "status": _repair(evidence, "orders", oid, "status", row.get("status"), status, "ORDER_STATUS_ALIAS"),
            "amount": _repair(evidence, "orders", oid, "amount", row.get("amount"), amount, "NORMALIZE_OR_RECOVER_AMOUNT"),
        }
        existing = orders_by_id.get(oid)
        if existing is not None:
            if existing != healed:
                raise ValueError(f"Conflicting duplicate order {oid}")
            evidence.append(RepairEvidence("orders", oid, "record", "duplicate", "deduplicated", "IDENTICAL_PRIMARY_KEY_DEDUP"))
            continue
        orders_by_id[oid] = healed

    customer_ids = set(customers_by_id)
    order_ids = set(orders_by_id)
    orphan_orders = sorted(o["order_id"] for o in orders_by_id.values() if o["customer_id"] not in customer_ids)
    orphan_items = sorted(i["item_id"] for i in items_by_id.values() if i["order_id"] not in order_ids)
    if orphan_orders or orphan_items:
        raise ValueError(f"Unresolved referential defects: orders={orphan_orders}, items={orphan_items}")

    healed = {
        "customers": sorted(customers_by_id.values(), key=lambda r: r["customer_id"]),
        "orders": sorted(orders_by_id.values(), key=lambda r: r["order_id"]),
        "order_items": sorted(items_by_id.values(), key=lambda r: r["item_id"]),
    }
    return healed, [e.__dict__ for e in evidence]


def _canonical(rows: list[dict[str, Any]], key: str) -> str:
    normalized = []
    for row in rows:
        normalized.append({k: _clean(v) for k, v in sorted(row.items())})
    normalized.sort(key=lambda row: row.get(key, ""))
    return json.dumps(normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _hash(rows: list[dict[str, Any]], key: str) -> str:
    return hashlib.sha256(_canonical(rows, key).encode("utf-8")).hexdigest()


def _assert_exact(actual: list[dict[str, Any]], expected: list[dict[str, Any]], key: str, entity: str) -> dict[str, Any]:
    actual_canonical = _canonical(actual, key)
    expected_canonical = _canonical(expected, key)
    if actual_canonical != expected_canonical:
        raise ValueError(f"{entity} exact reconciliation failed")
    return {
        "entity": entity,
        "primary_key": key,
        "expected_count": len(expected),
        "actual_count": len(actual),
        "expected_sha256": _hash(expected, key),
        "actual_sha256": _hash(actual, key),
        "matched": True,
    }


def list_scenarios() -> list[dict[str, Any]]:
    out = []
    if not SCENARIO_ROOT.exists():
        return out
    for scenario_file in sorted(SCENARIO_ROOT.glob("*/scenario.json")):
        data = json.loads(scenario_file.read_text(encoding="utf-8"))
        data["folder"] = scenario_file.parent.name
        out.append(data)
    return out


def _scenario(folder: str) -> tuple[dict[str, Any], Path]:
    base = (SCENARIO_ROOT / folder).resolve()
    if SCENARIO_ROOT.resolve() not in base.parents:
        raise ValueError("Invalid scenario folder")
    scenario_file = base / "scenario.json"
    if not scenario_file.exists():
        raise ValueError(f"Unknown DEV E2E scenario: {folder}")
    return json.loads(scenario_file.read_text(encoding="utf-8")), base


def run_dev_certification(payload: dict[str, Any]) -> dict[str, Any]:
    scenario_folder = str(payload.get("scenario") or "failure_storm").strip()
    scenario, base = _scenario(scenario_folder)
    trace_id = str(uuid.uuid4())
    started_at = utc_now()

    if str(scenario.get("environment")).upper() != "DEV":
        raise ValueError("DEV certification runner refuses non-DEV scenarios")
    if scenario.get("production_authorized") is not False or scenario.get("cutover_authorized") is not False:
        raise ValueError("Scenario violates production/cutover safety contract")

    source_health = _json_http("GET", f"{SOURCE_BASE}/health")
    target_health_before = _json_http("GET", f"{TARGET_BASE}/health")
    if int(source_health.get("production_writes", -1)) != 0:
        raise ValueError("Source API production-write safety check failed")
    if int(target_health_before.get("production_writes", -1)) != 0 or target_health_before.get("cutover") != "DISABLED":
        raise ValueError("Target API production/cutover safety check failed")

    source_path = base / "source"
    source_connection = _json_http("POST", f"{SOURCE_BASE}/v1/sources", {
        "name": f"KMITORA {scenario['id']} Source",
        "type": "file",
        "filePath": str(source_path),
    })
    source_id = source_connection["id"]
    objects = _json_http("GET", f"{SOURCE_BASE}/v1/sources/{urllib.parse.quote(source_id)}/objects")
    required_objects = {"customers.csv", "orders.csv", "order_items.csv"}
    discovered = {str(item.get("name")) for item in objects}
    missing = sorted(required_objects - discovered)
    if missing:
        raise ValueError(f"Source scenario missing required objects: {missing}")

    source_rows: dict[str, list[dict[str, Any]]] = {}
    for entity in ("customers", "orders", "order_items"):
        obj = f"{entity}.csv"
        preview = _json_http("GET", f"{SOURCE_BASE}/v1/sources/{urllib.parse.quote(source_id)}/preview?schema=files&object={urllib.parse.quote(obj)}&limit=500")
        source_rows[entity] = list(preview.get("rows") or [])

    healed, repairs = heal_dataset(source_rows)
    expected = {
        entity: _load_expected(base / "expected" / f"{entity}.json")
        for entity in ("customers", "orders", "order_items")
    }

    pre_load_reconciliation = [
        _assert_exact(healed["customers"], expected["customers"], "customer_id", "customers"),
        _assert_exact(healed["orders"], expected["orders"], "order_id", "orders"),
        _assert_exact(healed["order_items"], expected["order_items"], "item_id", "order_items"),
    ]

    targets = _json_http("GET", f"{TARGET_BASE}/v1/targets")
    dev_targets = [t for t in targets if str(t.get("status", "")).lower() == "connected" and str(t.get("environment", "")).upper() == "DEV" and str(t.get("type", "")).lower() == "postgresql"]
    if not dev_targets:
        _json_http("POST", f"{TARGET_BASE}/v1/targets/recover", {})
        targets = _json_http("GET", f"{TARGET_BASE}/v1/targets")
        dev_targets = [t for t in targets if str(t.get("status", "")).lower() == "connected" and str(t.get("environment", "")).upper() == "DEV" and str(t.get("type", "")).lower() == "postgresql"]
    if not dev_targets:
        raise ValueError("No recoverable connected DEV PostgreSQL target found. Create it once from KMITORA UI; Closure-20 will persist and restore it thereafter.")
    target = dev_targets[0]
    target_id = target["id"]

    replace_result = _json_http("POST", f"{TARGET_BASE}/v1/targets/{urllib.parse.quote(target_id)}/replace-load", {
        "schema": str(scenario.get("target_schema") or "public"),
        "tables": healed,
    }, timeout=30)
    if replace_result.get("ok") is not True or replace_result.get("mode") != "DEV_REPLACE_LOAD":
        raise ValueError("DEV replace-load did not return a successful governed result")

    target_rows: dict[str, list[dict[str, Any]]] = {}
    post_load_reconciliation = []
    keys = {"customers": "customer_id", "orders": "order_id", "order_items": "item_id"}
    schema = str(scenario.get("target_schema") or "public")
    for entity in ("customers", "orders", "order_items"):
        preview = _json_http("GET", f"{TARGET_BASE}/v1/targets/{urllib.parse.quote(target_id)}/preview?schema={urllib.parse.quote(schema)}&object={urllib.parse.quote(entity)}&limit=500")
        target_rows[entity] = list(preview.get("rows") or [])
        post_load_reconciliation.append(_assert_exact(target_rows[entity], expected[entity], keys[entity], entity))

    target_health_after = _json_http("GET", f"{TARGET_BASE}/health")
    if int(target_health_after.get("production_writes", -1)) != 0 or target_health_after.get("cutover") != "DISABLED":
        raise ValueError("Post-load production/cutover safety check failed")

    evidence = {
        "kind": "KMITORA_UNIVERSAL_DEV_E2E_CERTIFICATION",
        "version": "1.0",
        "trace_id": trace_id,
        "scenario": scenario,
        "status": "PASS",
        "started_at": started_at,
        "completed_at": utc_now(),
        "source": {
            "id": source_id,
            "path": str(source_path),
            "row_counts": {k: len(v) for k, v in source_rows.items()},
        },
        "self_healing": {
            "repair_count": len(repairs),
            "repairs": repairs,
            "ambiguous_repairs_performed": False,
        },
        "pre_load_reconciliation": pre_load_reconciliation,
        "target": {
            "id": target_id,
            "environment": target.get("environment"),
            "database": target.get("database"),
            "replace_load": replace_result,
        },
        "post_load_reconciliation": post_load_reconciliation,
        "safety": {
            "source_production_writes": source_health.get("production_writes"),
            "target_production_writes_before": target_health_before.get("production_writes"),
            "target_production_writes_after": target_health_after.get("production_writes"),
            "cutover_before": target_health_before.get("cutover"),
            "cutover_after": target_health_after.get("cutover"),
            "production_authorized": False,
            "cutover_authorized": False,
        },
    }

    evidence_dir = REPO_ROOT / "backend" / "main_api" / "runtime_evidence" / "dev_e2e"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    evidence_path = evidence_dir / f"{scenario['id']}_{trace_id}.json"
    evidence_path.write_text(json.dumps(evidence, indent=2, ensure_ascii=False, default=str) + "\n", encoding="utf-8")
    evidence["evidence_path"] = str(evidence_path)
    return evidence
