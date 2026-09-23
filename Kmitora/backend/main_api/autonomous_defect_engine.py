from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

KNOWLEDGE_PACKS = {
    "GLOBAL_BUSINESS_DOMAINS": 140,
    "DIGITAL_TWINS": 51,
    "NEURAL_NETWORKS": 889,
    "QUANTUM_COMPUTING": 1009,
    "TRANSFORMATIONS": 704,
}

CORE_AGENTS = ["A000"] + [f"A{i}" for i in range(101, 118)]

@dataclass
class Defect:
    test_id: str
    title: str
    area: str
    classification: str
    severity: str
    probable_root_cause: str
    recommended_action: str
    assigned_agents: list[str]
    knowledge_packs: list[str]
    safe_auto_fix: bool
    production_change_required: bool


def area_for(test_id: str) -> str:
    number = int(test_id.split("-")[-1])
    if number <= 23:
        return "CONNECT"
    if number <= 39:
        return "DISCOVER"
    if number <= 56:
        return "MAPPING"
    if number <= 75:
        return "TRANSFORM"
    return "VALIDATE"


def classify(title: str, detail: str) -> tuple[str, str, str, bool]:
    text = f"{title} {detail}".lower()
    if "strict mode violation" in text:
        return ("TEST_SELECTOR_AMBIGUITY", "P2_MEDIUM", "Selector matches multiple legitimate UI elements.", True)
    if "element(s) not found" in text or "timeout" in text:
        if any(x in text for x in ("run impacted tests", "view evidence", "explain", "test sample", "rule editor", "ask kmitora", "credential", "username", "postgresql", "sql server", "rest api", "file / folder", "select source system")):
            return ("PRODUCT_FUNCTION_OR_ACCESSIBILITY_GAP", "P1_HIGH", "Required user-facing control/accessible contract is missing or no longer reachable.", True)
        return ("UI_CONTRACT_OR_DYNAMIC_DATA_DRIFT", "P2_MEDIUM", "Current UI/data model differs from the historical deterministic expectation.", False)
    if "received: disabled" in text:
        return ("GOVERNED_PRECONDITION", "P2_MEDIUM", "Control is correctly/possibly gated by missing safe preconditions and must not be force-enabled without evidence.", False)
    return ("UNCLASSIFIED", "P2_MEDIUM", "Additional evidence is required.", False)


def agents_for(area: str) -> list[str]:
    return {
        "CONNECT": ["A000", "A103", "A104", "A109", "A110", "A111", "A112"],
        "DISCOVER": ["A000", "A101", "A102", "A103", "A104", "A109", "A117"],
        "MAPPING": ["A000", "A102", "A104", "A105", "A107", "A117"],
        "TRANSFORM": ["A000", "A102", "A104", "A106", "A107", "A108", "A117"],
        "VALIDATE": ["A000", "A104", "A107", "A108", "A112", "A115", "A116"],
    }[area]


def packs_for(area: str) -> list[str]:
    if area in {"CONNECT", "DISCOVER"}:
        return ["GLOBAL_BUSINESS_DOMAINS", "DIGITAL_TWINS"]
    if area == "MAPPING":
        return ["GLOBAL_BUSINESS_DOMAINS", "NEURAL_NETWORKS", "TRANSFORMATIONS"]
    if area in {"TRANSFORM", "VALIDATE"}:
        return ["GLOBAL_BUSINESS_DOMAINS", "NEURAL_NETWORKS", "TRANSFORMATIONS"]
    return list(KNOWLEDGE_PACKS)


def parse_playwright_log(path: Path) -> list[Defect]:
    text = path.read_text(encoding="utf-8", errors="replace")
    blocks = re.split(r"(?m)^\s*\d+\) \[chromium-desktop\]", text)[1:]
    defects: list[Defect] = []
    for block in blocks:
        id_match = re.search(r"KUI-(\d+)\s+([^\r\n]+)", block)
        if not id_match:
            continue
        test_id = f"KUI-{id_match.group(1)}"
        title = id_match.group(2).strip()
        detail = "\n".join(block.splitlines()[:35])
        classification, severity, root, safe = classify(title, detail)
        area = area_for(test_id)
        action = {
            "PRODUCT_FUNCTION_OR_ACCESSIBILITY_GAP": "Restore the required DEV-safe user function with semantic accessibility, preserve business behavior, then rerun impacted tests.",
            "TEST_SELECTOR_AMBIGUITY": "Make the product evidence label uniquely addressable or narrow the test selector without weakening the safety assertion.",
            "GOVERNED_PRECONDITION": "Establish the required safe precondition/test data; do not bypass the guardrail merely to make the test pass.",
            "UI_CONTRACT_OR_DYNAMIC_DATA_DRIFT": "Compare current requirements and dynamic evidence with the historical test contract; preserve real behavior and update only obsolete deterministic assumptions.",
            "UNCLASSIFIED": "Collect trace, screenshot, console and state evidence before changing code.",
        }[classification]
        defects.append(Defect(
            test_id=test_id,
            title=title,
            area=area,
            classification=classification,
            severity=severity,
            probable_root_cause=root,
            recommended_action=action,
            assigned_agents=agents_for(area),
            knowledge_packs=packs_for(area),
            safe_auto_fix=safe,
            production_change_required=False,
        ))
    return defects


def build_report(log_path: Path) -> dict:
    defects = parse_playwright_log(log_path)
    return {
        "engine": "KMITORA Autonomous Defect Intelligence",
        "mode": "DEV_SAFE_AUTONOMOUS",
        "knowledge_packs": [{"id": k, "topics": v, "status": "ACTIVE"} for k, v in KNOWLEDGE_PACKS.items()],
        "total_topics": sum(KNOWLEDGE_PACKS.values()),
        "core_agents": CORE_AGENTS,
        "defect_count": len(defects),
        "defects": [asdict(d) for d in defects],
        "safety": {
            "source_writes": 0,
            "target_production_writes": 0,
            "production_actions": 0,
            "production_migration": "DISABLED",
            "cutover": "DISABLED",
        },
    }


def main(argv: Iterable[str] | None = None) -> int:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("log", type=Path)
    parser.add_argument("--out", type=Path, default=Path("KMITORA_AUTONOMOUS_DEFECT_REPORT.json"))
    args = parser.parse_args(list(argv) if argv is not None else None)
    report = build_report(args.log)
    args.out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"KMITORA autonomous defect report: {args.out}")
    print(f"Defects observed: {report['defect_count']}")
    print(f"Knowledge topics active: {report['total_topics']}")
    print("Production migration: DISABLED")
    print("Cutover: DISABLED")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
