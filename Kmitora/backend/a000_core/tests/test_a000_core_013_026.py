from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path: sys.path.insert(0, str(ROOT))

from a000_core.runtime import A000CoreRuntime
from a000_core.models import Capability
from a000_core.registry import UniversalRegistry
from a000_core.db_ir import DatabaseIR, TableIR, ColumnIR
from a000_core.db_translate import translate
from a000_core.learning import promotion_gate


def test_dedup():
    r = UniversalRegistry()
    a = Capability("KCPX0001","Schema Drift Detection","DATA","Detect schema changes")
    b = Capability("KCPX0002","Schema Drift Detection","DATA","Detect schema changes")
    assert r.register(a)["status"] == "REGISTERED"
    assert r.register(b)["status"] == "IGNORED_DUPLICATE"


def test_plan_is_read_only():
    rt = A000CoreRuntime()
    out = rt.plan({"objective":"migrate customer data and reconcile","technology":"PostgreSQL","environment":"DEV"})
    assert out["mode"] == "PLAN_ONLY"
    assert out["target_write_executed"] is False
    assert out["production_action_executed"] is False
    assert out["steps"]


def test_translation_is_plan_only():
    ir = DatabaseIR("oracle", [TableIR("customer", [ColumnIR("id","INTEGER"), ColumnIR("payload","JSON")], primary_key=["id"])])
    out = translate(ir, "postgresql")
    assert out["status"] == "PLAN_ONLY"
    assert out["tables"][0]["columns"][1]["target_type"] == "jsonb"


def test_learning_requires_regression():
    candidate = {"evidence_id":"EVD-1","validation_status":"PASS","production_action_executed":False,"cutover_executed":False}
    assert promotion_gate(candidate, [{"passed":True}])["promotion_gate"] == "PASS"
    assert promotion_gate(candidate, [{"passed":False}])["promotion_gate"] == "BLOCK"

if __name__ == "__main__":
    test_dedup(); test_plan_is_read_only(); test_translation_is_plan_only(); test_learning_requires_regression(); print("PASS A000 core 013-026")
