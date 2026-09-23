from universal_transformation_engine import (
    CAPABILITY_REGISTRY,
    compile_business_logic,
    execute_business_logic,
    engine_status,
)


def _entities():
    return [
        {
            "entity": "customers.csv",
            "fields": ["customer_id", "scenario_id", "name", "email", "status", "balance"],
            "_rows": [
                {"customer_id": "C1", "scenario_id": "SCN-MIG-006", "name": " Alice ", "email": "ALICE@EXAMPLE.COM", "status": "ACTIVE", "balance": "10"},
                {"customer_id": "C2", "scenario_id": "OTHER", "name": " Bob ", "email": "BOB@EXAMPLE.COM", "status": "INACTIVE", "balance": "2"},
            ],
        },
        {
            "entity": "orders.csv",
            "fields": ["order_id", "scenario_id", "customer_id", "amount", "status"],
            "_rows": [
                {"order_id": "O1", "scenario_id": "SCN-MIG-006", "customer_id": "C1", "amount": "12", "status": "OPEN"},
            ],
        },
    ]


def _target():
    return {
        "entities": [
            {"name": "target_customers", "columns": [{"name": x} for x in ["customer_id", "scenario_id", "name", "email", "status", "balance"]]},
            {"name": "target_orders", "columns": [{"name": x} for x in ["order_id", "scenario_id", "customer_id", "amount", "status"]]},
        ]
    }


def test_capability_catalog_covers_attached_transformation_families():
    names = {x["name"] for x in CAPABILITY_REGISTRY}
    required = {
        "Expression", "Aggregator", "Filter", "Router", "Joiner", "Sorter", "Lookup",
        "Update Strategy", "Sequence Generator", "Union", "Rank", "Normalizer",
        "Transaction Control", "SQL Transformation", "XML Parser", "Data Masking",
        "Hierarchy Parser", "Hierarchy Builder", "Standardizer", "Address Validation",
        "Match", "Exception", "Decision", "Key Generator", "Landing", "Stage / Cleanse",
        "Tokenization", "Merge", "Survivorship", "Golden Record", "Cross-reference/XREF",
        "Trust", "Validation",
    }
    assert required.issubset(names)
    assert len(CAPABILITY_REGISTRY) >= 50
    assert engine_status()["production_write"] is False


def test_compile_and_execute_business_rules_deterministically():
    rules = [
        {"id": "BR-001", "rule": "Process only records where scenario_id equals SCN-MIG-006."},
        {"id": "BR-002", "rule": "Trim name."},
        {"id": "BR-003", "rule": "Convert email to lowercase."},
        {"id": "BR-004", "rule": "ACTIVE status becomes A."},
        {"id": "BR-005", "rule": "INACTIVE status becomes I."},
        {"id": "BR-006", "rule": "balance cannot be negative."},
        {"id": "BR-007", "rule": "Every orders must reference an existing customers."},
        {"id": "BR-008", "rule": "customers.csv maps to target_customers."},
        {"id": "BR-009", "rule": "orders.csv maps to target_orders."},
    ]
    plan = compile_business_logic(rules, _entities(), _target(), llm_generate=None)
    assert plan["status"] == "COMPILED"
    assert plan["capability_coverage"]["catalog_size"] >= 50
    assert any(n["op"] == "FILTER" for n in plan["nodes"])
    assert any(n["op"] == "TRIM" for n in plan["nodes"])
    assert any(n["op"] == "LOWERCASE" for n in plan["nodes"])
    result = execute_business_logic(_entities(), plan)
    assert result["counts"]["customers"] == 1
    customer = result["datasets"]["customers"][0]
    assert customer["name"] == "Alice"
    assert customer["email"] == "alice@example.com"
    assert customer["status"] == "A"
    assert result["safety"]["target_write"] is False


def test_update_strategy_and_schema_mutation_are_planned_not_hidden_writes():
    rules = [
        {"id": "BR-001", "rule": "Delete records when status == 'CANCELLED'."},
        {"id": "BR-002", "rule": "Add target column risk_code to target_orders as TEXT."},
    ]
    plan = compile_business_logic(rules, _entities(), _target(), llm_generate=None)
    assert any(n["op"] == "UPDATE_STRATEGY" for n in plan["nodes"])
    assert plan["target_mutations"][0]["op"] == "ADD_COLUMN"
    result = execute_business_logic(_entities(), plan)
    assert result["safety"]["target_write"] is False
    assert result["target_schema_mutations"][0]["requires_approval"] is True
