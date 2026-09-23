from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class OperationKind(str, Enum):
    SOURCE = "source"
    PROFILE = "profile"
    PROJECT = "project"
    FILTER = "filter"
    ROUTE = "route"
    JOIN = "join"
    LOOKUP = "lookup"
    AGGREGATE = "aggregate"
    SORT = "sort"
    UNION = "union"
    NORMALIZE = "normalize"
    PIVOT = "pivot"
    UNPIVOT = "unpivot"
    PARSE = "parse"
    BUILD = "build"
    EXPRESSION = "expression"
    VALIDATE = "validate"
    STANDARDIZE = "standardize"
    MATCH = "match"
    MERGE = "merge"
    SURVIVE = "survive"
    MASK = "mask"
    TOKENIZE = "tokenize"
    CLASSIFY = "classify"
    TEMPORAL = "temporal"
    SEQUENCE = "sequence"
    CDC = "cdc"
    WRITE = "write"
    UPSERT = "upsert"
    DELETE = "delete"
    TRANSACTION = "transaction"
    SQL = "sql"
    PROCEDURE = "procedure"
    API = "api"
    MESSAGE = "message"
    COMMAND = "command"
    DECISION = "decision"
    WAIT = "wait"
    EVENT = "event"
    NOTIFY = "notify"
    WORKFLOW = "workflow"
    RECONCILE = "reconcile"
    EVIDENCE = "evidence"
    GOVERN = "govern"
    SECURITY = "security"


@dataclass
class SemanticOperation:
    id: str
    kind: OperationKind
    name: str
    inputs: List[str] = field(default_factory=list)
    outputs: List[str] = field(default_factory=list)
    config: Dict[str, Any] = field(default_factory=dict)
    expression: Optional[str] = None
    business_rule: Optional[str] = None
    source_vendor: Optional[str] = None
    source_object_type: Optional[str] = None
    lineage: List[Tuple[str, str]] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)

    def canonical_payload(self) -> Dict[str, Any]:
        return {
            "kind": self.kind.value,
            "inputs": sorted(self.inputs),
            "outputs": sorted(self.outputs),
            "config": normalize(self.config),
            "expression": normalize_text(self.expression),
            "business_rule": normalize_text(self.business_rule),
            "lineage": sorted(self.lineage),
            "tags": sorted(set(self.tags)),
        }


@dataclass
class SemanticFlow:
    id: str
    name: str
    operations: Dict[str, SemanticOperation] = field(default_factory=dict)
    edges: List[Tuple[str, str]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_operation(self, operation: SemanticOperation) -> None:
        if operation.id in self.operations:
            raise ValueError(f"Duplicate operation id: {operation.id}")
        self.operations[operation.id] = operation

    def add_edge(self, upstream: str, downstream: str) -> None:
        edge = (upstream, downstream)
        if edge not in self.edges:
            self.edges.append(edge)


def normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return " ".join(value.strip().split()).lower()


def normalize(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: normalize(value[k]) for k in sorted(value)}
    if isinstance(value, list):
        return [normalize(v) for v in value]
    if isinstance(value, tuple):
        return tuple(normalize(v) for v in value)
    if isinstance(value, str):
        return " ".join(value.strip().split())
    return value

