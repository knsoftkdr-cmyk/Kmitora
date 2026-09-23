from __future__ import annotations
import csv, json, re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Set

TEXT_EXTS = {".json", ".csv", ".yaml", ".yml", ".md", ".txt", ".py"}
IGNORE_PARTS = {".git", ".venv", "venv", "node_modules", "dist", "build", "__pycache__"}
ID_PATTERNS = {
    "family": re.compile(r"\bKFM\d{4}\b", re.I),
    "agent": re.compile(r"\bKAG\d{5}\b", re.I),
    "capability": re.compile(r"\b(?:KCP|KDBC)[-]?\d{4,5}\b", re.I),
    "skill": re.compile(r"\bKSK[-]?\d{4,5}\b", re.I),
    "tool": re.compile(r"\bKTL[-]?\d{4,5}\b", re.I),
}

def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()

class ExistingRegistryIndex:
    def __init__(self, root: Path) -> None:
        self.root=root
        self.ids: Dict[str, Set[str]] = {k:set() for k in ID_PATTERNS}
        self.text_signatures: Set[str] = set()
        self.scanned_files=0

    def scan(self, max_bytes: int = 2_000_000) -> Dict[str, Any]:
        for p in self.root.rglob("*"):
            if not p.is_file() or p.suffix.lower() not in TEXT_EXTS: continue
            if any(part in IGNORE_PARTS for part in p.parts): continue
            try:
                if p.stat().st_size > max_bytes: continue
                text=p.read_text(encoding="utf-8",errors="ignore")
            except Exception:
                continue
            self.scanned_files += 1
            for kind,rx in ID_PATTERNS.items():
                self.ids[kind].update(x.upper().replace("-","") for x in rx.findall(text))
            for line in text.splitlines():
                n=_norm(line)
                if 12 <= len(n) <= 220:
                    self.text_signatures.add(n)
        return self.summary()

    def has_id(self, kind: str, value: str) -> bool:
        return value.upper().replace("-","") in self.ids.get(kind,set())

    def equivalent_text_exists(self, *phrases: str) -> bool:
        for phrase in phrases:
            n=_norm(phrase)
            if not n: continue
            if n in self.text_signatures: return True
            toks=set(n.split())
            if len(toks) < 3: continue
            for sig in self.text_signatures:
                s=set(sig.split())
                if len(toks & s) / max(1,len(toks)) >= 0.90:
                    return True
        return False

    def summary(self) -> Dict[str, Any]:
        return {"scanned_files":self.scanned_files,"ids":{k:len(v) for k,v in self.ids.items()}}
