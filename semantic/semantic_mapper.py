from __future__ import annotations
import re
from difflib import SequenceMatcher
from typing import Iterable, List, Tuple
from .contracts import MappingCandidate
from .confidence_policy import decision_for


ALIASES = {
    "cust": "customer",
    "custid": "customerid",
    "custno": "customernumber",
    "client": "customer",
    "fname": "firstname",
    "lname": "lastname",
    "dob": "dateofbirth",
    "addr": "address",
    "addr1": "addressline1",
    "addr2": "addressline2",
    "postcode": "postalcode",
    "zipcode": "postalcode",
    "zip": "postalcode",
    "mobile": "phonenumber",
    "phone": "phonenumber",
    "emailid": "email",
}


def normalize_name(name: str) -> str:
    value = re.sub(r"[^a-z0-9]", "", name.lower())
    return ALIASES.get(value, value)


def similarity(source: str, target: str) -> Tuple[float, List[str]]:
    s = normalize_name(source)
    t = normalize_name(target)

    if s == t:
        return 0.99, ["normalized semantic names match"]

    seq = SequenceMatcher(None, s, t).ratio()
    base = 0.91 if s and t and (s in t or t in s) else (0.45 + 0.45 * seq)
    return min(max(base, 0.0), 0.97), [f"name similarity {seq:.2f}"]


class SemanticMapper:
    def generate(self, source_fields: Iterable[str], target_fields: Iterable[str]) -> List[MappingCandidate]:
        sources = list(dict.fromkeys(str(v) for v in source_fields))
        targets = list(dict.fromkeys(str(v) for v in target_fields))
        output: List[MappingCandidate] = []

        for source in sources:
            ranked = []
            for target in targets:
                score, reasons = similarity(source, target)
                ranked.append((score, target, reasons))

            ranked.sort(key=lambda x: (-x[0], x[1]))
            if not ranked:
                continue

            score, target, reasons = ranked[0]
            second = ranked[1][0] if len(ranked) > 1 else 0.0
            margin = score - second
            confidence = score if margin >= 0.08 else max(0.0, score - 0.12)

            output.append(MappingCandidate(
                source=source,
                target=target,
                confidence=round(confidence, 4),
                reasons=reasons,
                decision=decision_for(confidence),
            ))

        return output

