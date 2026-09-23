from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Optional, Set

from .model import OperationKind


@dataclass(frozen=True)
class OperationSpec:
    kind: OperationKind
    aliases: Set[str]
    category: str
    stateful: bool = False
    mutating: bool = False


class OperationRegistry:
    def __init__(self) -> None:
        self._specs: Dict[OperationKind, OperationSpec] = {}
        self._aliases: Dict[str, OperationKind] = {}

    def register(self, spec: OperationSpec) -> None:
        if spec.kind in self._specs:
            raise ValueError(f"Operation already registered: {spec.kind}")
        self._specs[spec.kind] = spec
        for alias in {spec.kind.value, *spec.aliases}:
            key = alias.strip().lower()
            current = self._aliases.get(key)
            if current and current != spec.kind:
                raise ValueError(f"Alias collision: {alias}")
            self._aliases[key] = spec.kind

    def resolve(self, name: str) -> Optional[OperationKind]:
        return self._aliases.get(name.strip().lower())


def build_default_registry() -> OperationRegistry:
    r = OperationRegistry()

    def add(kind, aliases=(), category="data", stateful=False, mutating=False):
        r.register(OperationSpec(kind, set(aliases), category, stateful, mutating))

    add(OperationKind.SOURCE, {"source analyzer","source definition","source qualifier"}, "source")
    add(OperationKind.PROFILE, {"column profile","pattern profile","data profiling"}, "discovery")
    add(OperationKind.EXPRESSION, {"expression","derived column","formula","calculation"}, "transform")
    add(OperationKind.FILTER, {"filter","where","row filter"}, "transform")
    add(OperationKind.ROUTE, {"router","conditional split","switch"}, "transform")
    add(OperationKind.JOIN, {"joiner","merge join","join"}, "transform", True)
    add(OperationKind.LOOKUP, {"lookup","reference lookup","dimension lookup"}, "transform", True)
    add(OperationKind.AGGREGATE, {"aggregator","group by","aggregate"}, "transform", True)
    add(OperationKind.SORT, {"sorter","sort","order by"}, "transform", True)
    add(OperationKind.UNION, {"union","union all","merge streams"}, "transform")
    add(OperationKind.NORMALIZE, {"normalizer","flatten","explode"}, "structure")
    add(OperationKind.PIVOT, {"pivot"}, "structure")
    add(OperationKind.UNPIVOT, {"unpivot"}, "structure")
    add(OperationKind.PARSE, {"xml parser","json parser","hierarchy parser","parser"}, "structure")
    add(OperationKind.BUILD, {"xml generator","json generator","hierarchy builder"}, "structure")
    add(OperationKind.VALIDATE, {"validation","address validator","rule specification"}, "quality")
    add(OperationKind.STANDARDIZE, {"standardizer","cleanse"}, "quality")
    add(OperationKind.MATCH, {"match","deduplicate","entity resolution"}, "mdm", True)
    add(OperationKind.MERGE, {"merge","golden record"}, "mdm", True)
    add(OperationKind.SURVIVE, {"survivorship","trust"}, "mdm", True)
    add(OperationKind.MASK, {"data masking","mask"}, "security")
    add(OperationKind.TOKENIZE, {"tokenization","key generator"}, "quality")
    add(OperationKind.CLASSIFY, {"labeler","classification","data domain"}, "governance")
    add(OperationKind.TEMPORAL, {"effective dating","scd2","temporal lookup","temporal join"}, "transform", True)
    add(OperationKind.SEQUENCE, {"sequence generator","sequence"}, "transform", True)
    add(OperationKind.CDC, {"cdc","change data capture","incremental capture"}, "change", True)
    add(OperationKind.WRITE, {"target","insert","append","load"}, "target", False, True)
    add(OperationKind.UPSERT, {"update strategy","upsert","merge write"}, "target", False, True)
    add(OperationKind.DELETE, {"delete","soft delete","hard delete"}, "target", False, True)
    add(OperationKind.TRANSACTION, {"transaction control","commit","rollback"}, "target", True, True)
    add(OperationKind.SQL, {"sql transformation","sql override","pre-sql","post-sql"}, "integration")
    add(OperationKind.PROCEDURE, {"stored procedure","external procedure"}, "integration")
    add(OperationKind.API, {"http transformation","web service consumer","rest","soap"}, "integration")
    add(OperationKind.MESSAGE, {"mq","kafka","message queue"}, "integration")
    add(OperationKind.COMMAND, {"command task","shell","script"}, "orchestration")
    add(OperationKind.DECISION, {"decision task","if","branch"}, "orchestration")
    add(OperationKind.WAIT, {"timer task","event wait"}, "orchestration", True)
    add(OperationKind.EVENT, {"event raise","event trigger"}, "orchestration")
    add(OperationKind.NOTIFY, {"email task","notification"}, "orchestration")
    add(OperationKind.WORKFLOW, {"workflow","taskflow","worklet","dag"}, "orchestration", True)
    add(OperationKind.RECONCILE, {"reconciliation","checksum","count validation"}, "assurance", True)
    add(OperationKind.EVIDENCE, {"evidence","audit"}, "assurance")
    add(OperationKind.GOVERN, {"governance","policy"}, "governance")
    add(OperationKind.SECURITY, {"security","rbac","permission"}, "security")
    return r

