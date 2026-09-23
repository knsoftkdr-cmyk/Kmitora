from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[4]
for p in (ROOT/"backend", ROOT):
    if str(p) not in sys.path: sys.path.insert(0,str(p))
from a000_training.database_universe import universe
from a000_training.database_router import route

def test_catalog_counts():
    assert len(universe.databases) == 224
    assert len(universe.capabilities) >= 70

def test_postgres_route_is_safe():
    r=route({"database":"PostgreSQL","objective":"migrate customer data","business_rules":["preserve referential integrity"],"environment":"DEV"})
    assert r["status"] == "ROUTED"
    assert r["execution_authority"] == "NONE"
    assert r["production_action_executed"] is False
    assert any(x["id"] == "KDBC-0076" for x in r["matched_capabilities"])

def test_unknown_database_does_not_invent_execution():
    r=route({"database":"UnknownDB","objective":"analyze only"})
    assert r["database"] is None
    assert r["source_write_executed"] is False
