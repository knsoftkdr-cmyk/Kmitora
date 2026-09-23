from __future__ import annotations
import hashlib
import re
from difflib import SequenceMatcher
from typing import Iterable, Optional, Tuple

STOP = {"the","a","an","and","or","for","to","of","with","in","on","by","engine","service","capability"}


def normalize(text: str) -> str:
    tokens = re.findall(r"[a-z0-9]+", (text or "").lower())
    tokens = [t for t in tokens if t not in STOP]
    return " ".join(sorted(set(tokens)))


def fingerprint(*parts: str) -> str:
    norm = "|".join(normalize(p) for p in parts if p)
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()


def similarity(a: str, b: str) -> float:
    na, nb = normalize(a), normalize(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    return SequenceMatcher(None, na, nb).ratio()


def equivalent(name: str, candidates: Iterable[Tuple[str, str]], threshold: float = 0.90) -> Optional[str]:
    best_id, best = None, 0.0
    for cid, cname in candidates:
        score = similarity(name, cname)
        if score > best:
            best_id, best = cid, score
    return best_id if best >= threshold else None
