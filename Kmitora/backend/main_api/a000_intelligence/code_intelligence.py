from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Any


class CodeIntelligenceEngine:
    SUPPORTED = {
        ".py", ".sql", ".ps1", ".ts", ".tsx", ".js",
        ".java", ".cs", ".c", ".cpp", ".cbl", ".cob",
        ".jcl", ".abap",
    }

    WRITE_METHODS = {
        "write", "write_text", "write_bytes",
        "unlink", "rename", "replace", "mkdir",
        "rmdir", "remove",
    }

    READ_METHODS = {
        "read", "read_text", "read_bytes",
        "open",
    }

    def _name(self, node: ast.AST) -> str:
        if isinstance(node, ast.Name):
            return node.id

        if isinstance(node, ast.Attribute):
            left = self._name(node.value)
            return (
                f"{left}.{node.attr}"
                if left
                else node.attr
            )

        if isinstance(node, ast.Call):
            return self._name(node.func)

        return ""

    def _constant_string(
        self,
        node: ast.AST,
    ) -> str | None:
        if (
            isinstance(node, ast.Constant)
            and isinstance(node.value, str)
        ):
            return node.value

        return None

    def _containing_callable(
        self,
        tree: ast.AST,
        target: ast.AST,
    ) -> str | None:
        for node in ast.walk(tree):
            if isinstance(
                node,
                (
                    ast.FunctionDef,
                    ast.AsyncFunctionDef,
                ),
            ):
                if target in ast.walk(node):
                    return node.name

        return None

    def _extract_routes(
        self,
        tree: ast.AST,
    ) -> list[dict[str, Any]]:
        routes: list[dict[str, Any]] = []

        for node in ast.walk(tree):
            if not isinstance(node, ast.If):
                continue

            test = node.test

            if not (
                isinstance(test, ast.Compare)
                and isinstance(test.left, ast.Name)
                and test.left.id == "path"
                and len(test.ops) == 1
                and isinstance(test.ops[0], ast.Eq)
                and len(test.comparators) == 1
            ):
                continue

            route = self._constant_string(
                test.comparators[0]
            )

            if not route:
                continue

            handler = self._containing_callable(
                tree,
                node,
            )

            method = "UNKNOWN"

            if handler == "do_GET":
                method = "GET"
            elif handler == "do_POST":
                method = "POST"
            elif handler == "do_PATCH":
                method = "PATCH"

            calls = sorted(
                {
                    self._name(call.func)
                    for call in ast.walk(node)
                    if isinstance(call, ast.Call)
                    and self._name(call.func)
                }
            )

            routes.append(
                {
                    "method": method,
                    "route": route,
                    "handler": handler,
                    "calls": calls,
                }
            )

        return routes

    def _extract_call_graph(
        self,
        tree: ast.AST,
    ) -> list[dict[str, Any]]:
        graph: list[dict[str, Any]] = []

        for node in ast.walk(tree):
            if not isinstance(
                node,
                (
                    ast.FunctionDef,
                    ast.AsyncFunctionDef,
                ),
            ):
                continue

            calls = sorted(
                {
                    self._name(call.func)
                    for call in ast.walk(node)
                    if isinstance(call, ast.Call)
                    and self._name(call.func)
                }
            )

            graph.append(
                {
                    "caller": node.name,
                    "calls": calls,
                }
            )

        return graph

    def _extract_environment_variables(
        self,
        tree: ast.AST,
    ) -> list[str]:
        variables: set[str] = set()

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue

            name = self._name(node.func)

            if name not in {
                "os.environ.get",
                "os.getenv",
            }:
                continue

            if not node.args:
                continue

            value = self._constant_string(
                node.args[0]
            )

            if value:
                variables.add(value)

        return sorted(variables)

    def _extract_io(
        self,
        tree: ast.AST,
    ) -> dict[str, Any]:
        reads: list[dict[str, Any]] = []
        writes: list[dict[str, Any]] = []

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue

            call_name = self._name(node.func)

            short_name = call_name.rsplit(
                ".",
                1,
            )[-1]

            entry = {
                "operation": call_name,
                "line": getattr(
                    node,
                    "lineno",
                    None,
                ),
            }

            if short_name in self.WRITE_METHODS:
                writes.append(entry)

            elif short_name in self.READ_METHODS:
                reads.append(entry)

        return {
            "read_operations": reads,
            "write_operations": writes,
            "potential_write_operation_count": len(
                writes
            ),
        }

    def _extract_rule_candidates(
        self,
        tree: ast.AST,
        text: str,
    ) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []

        for node in ast.walk(tree):
            if not isinstance(
                node,
                (
                    ast.If,
                    ast.Assert,
                ),
            ):
                continue

            try:
                expression = ast.unparse(
                    node.test
                    if isinstance(node, ast.If)
                    else node.test
                )
            except Exception:
                continue

            candidates.append(
                {
                    "line": getattr(
                        node,
                        "lineno",
                        None,
                    ),
                    "expression": expression,
                    "status": "CANDIDATE",
                    "authoritative": False,
                    "requires_review": True,
                }
            )

        for number, line in enumerate(
            text.splitlines(),
            start=1,
        ):
            lower = line.lower()

            if any(
                token in lower
                for token in (
                    "approval_required",
                    "production_action_executed",
                    "target_write",
                    "source_write",
                    "guarded",
                    "reject",
                    "quarantine",
                    "validate",
                )
            ):
                candidates.append(
                    {
                        "line": number,
                        "expression": line.strip(),
                        "status": "CANDIDATE",
                        "authoritative": False,
                        "requires_review": True,
                    }
                )

        return candidates[:500]

    def _extract_architecture(
        self,
        imports: list[str],
        routes: list[dict[str, Any]],
    ) -> dict[str, Any]:
        components: set[str] = set()

        if routes:
            components.add(
                "HTTP_API_RUNTIME"
            )

        if any(
            item.startswith("a000_intelligence")
            for item in imports
        ):
            components.add(
                "A000_INTELLIGENCE_ENGINE"
            )

        if "openpyxl" in imports:
            components.add(
                "EXCEL_CONNECTOR"
            )

        if "csv" in imports:
            components.add(
                "CSV_CONNECTOR"
            )

        if "http.server" in imports:
            components.add(
                "PYTHON_HTTP_SERVER"
            )

        if "threading" in imports:
            components.add(
                "IN_PROCESS_CONCURRENCY"
            )

        return {
            "components": sorted(
                components
            ),
            "route_count": len(routes),
        }

    def analyze_file(
        self,
        path: str,
    ) -> dict[str, Any]:
        file_path = Path(path)

        if file_path.suffix.lower() not in self.SUPPORTED:
            return {
                "status": "UNSUPPORTED",
                "path": str(file_path),
                "production_action_executed": False,
            }

        text = file_path.read_text(
            encoding="utf-8-sig",
            errors="replace",
        )

        result: dict[str, Any] = {
            "status": "ANALYZED",
            "path": str(file_path),
            "language_hint": file_path.suffix.lower(),
            "line_count": len(text.splitlines()),
            "analysis_mode": "READ_ONLY_STATIC_ANALYSIS",
            "authoritative": False,
            "source_write_executed": False,
            "target_write_executed": False,
            "production_action_executed": False,
        }

        if file_path.suffix.lower() != ".py":
            result["business_rule_candidates"] = [
                line.strip()
                for line in text.splitlines()
                if any(
                    token in line.lower()
                    for token in (
                        " if ",
                        " where ",
                        " case ",
                        " when ",
                        "validate",
                        "reject",
                        "transform",
                    )
                )
            ][:200]

            return result

        tree = ast.parse(
            text,
            filename=str(file_path),
        )

        functions = [
            node.name
            for node in ast.walk(tree)
            if isinstance(
                node,
                (
                    ast.FunctionDef,
                    ast.AsyncFunctionDef,
                ),
            )
        ]

        classes = [
            node.name
            for node in ast.walk(tree)
            if isinstance(
                node,
                ast.ClassDef,
            )
        ]

        imports = sorted(
            {
                getattr(node, "module", None)
                or getattr(
                    node,
                    "names",
                    [None],
                )[0].name
                for node in ast.walk(tree)
                if isinstance(
                    node,
                    (
                        ast.Import,
                        ast.ImportFrom,
                    ),
                )
                and (
                    getattr(
                        node,
                        "module",
                        None,
                    )
                    or getattr(
                        node,
                        "names",
                        None,
                    )
                )
            }
        )

        routes = self._extract_routes(
            tree
        )

        result.update(
            {
                "functions": functions,
                "classes": classes,
                "imports": imports,
                "routes": routes,
                "call_graph": self._extract_call_graph(
                    tree
                ),
                "environment_variables":
                    self._extract_environment_variables(
                        tree
                    ),
                "io_analysis":
                    self._extract_io(
                        tree
                    ),
                "business_rule_candidates":
                    self._extract_rule_candidates(
                        tree,
                        text,
                    ),
                "architecture":
                    self._extract_architecture(
                        imports,
                        routes,
                    ),
            }
        )

        return result
