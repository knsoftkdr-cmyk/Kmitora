from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List

@dataclass
class ColumnIR:
    name: str
    logical_type: str
    nullable: bool = True
    default: Any = None

@dataclass
class TableIR:
    name: str
    columns: List[ColumnIR] = field(default_factory=list)
    primary_key: List[str] = field(default_factory=list)
    foreign_keys: List[Dict[str, Any]] = field(default_factory=list)
    indexes: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class DatabaseIR:
    source_engine: str
    tables: List[TableIR] = field(default_factory=list)
    procedures: List[Dict[str, Any]] = field(default_factory=list)
    sequences: List[Dict[str, Any]] = field(default_factory=list)
    features: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
