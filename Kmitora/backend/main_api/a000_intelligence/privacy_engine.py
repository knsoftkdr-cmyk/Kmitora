from __future__ import annotations
import hashlib
import re
from typing import Any

class PrivacyEngine:
    EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

    def classify_field(self, name: str, sample_values: list[Any] | None = None) -> dict[str, Any]:
        n = name.casefold()
        classification = "GENERAL"
        if any(token in n for token in ("email", "phone", "mobile", "address", "passport", "ssn", "aadhaar", "pan", "dob", "birth")):
            classification = "PII"
        if any(token in n for token in ("card", "cvv", "account_number", "iban")):
            classification = "FINANCIAL_SENSITIVE"
        return {"field": name, "classification": classification, "masking_recommended": classification != "GENERAL"}

    def deterministic_token(self, value: Any, salt: str = "KMITORA-DEV") -> str:
        return hashlib.sha256(f"{salt}:{value}".encode()).hexdigest()[:24]
