from __future__ import annotations
from collections import Counter, defaultdict
from typing import Any

class ProcessMiningEngine:
    def discover(self, events: list[dict[str, Any]]) -> dict[str, Any]:
        by_case: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for event in events:
            by_case[str(event.get("case_id", "UNKNOWN"))].append(event)
        transitions: Counter[tuple[str, str]] = Counter()
        variants: Counter[tuple[str, ...]] = Counter()
        for case_events in by_case.values():
            ordered = sorted(case_events, key=lambda e: str(e.get("timestamp", "")))
            activities = tuple(str(e.get("activity", "UNKNOWN")) for e in ordered)
            variants[activities] += 1
            transitions.update(zip(activities, activities[1:]))
        return {
            "case_count": len(by_case),
            "event_count": len(events),
            "variants": [{"path": list(path), "count": count} for path, count in variants.most_common(20)],
            "transitions": [{"from": a, "to": b, "count": count} for (a, b), count in transitions.most_common(100)],
            "production_action_executed": False,
        }
