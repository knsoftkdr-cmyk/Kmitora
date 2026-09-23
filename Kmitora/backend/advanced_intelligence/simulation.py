from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


StepStatus = Literal[
    "PENDING",
    "SIMULATED_PASS",
    "SIMULATED_FAIL",
    "BLOCKED",
]


@dataclass
class CutoverStep:
    step_id: str
    name: str
    duration_minutes: int
    dependencies: list[str] = field(
        default_factory=list
    )
    rollback_step: str | None = None
    critical: bool = False


@dataclass(frozen=True)
class FailureInjection:
    step_id: str
    failure_type: str
    probability: float = 1.0


class CutoverSimulator:

    def __init__(
        self,
        steps: list[CutoverStep],
    ) -> None:

        self.steps = {
            step.step_id: step
            for step in steps
        }

        self._validate_dependencies()

    def _validate_dependencies(
        self,
    ) -> None:

        for step in self.steps.values():

            for dependency in step.dependencies:

                if dependency not in self.steps:
                    raise ValueError(
                        (
                            f"{step.step_id} depends on "
                            f"unknown step {dependency}"
                        )
                    )

        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(
            step_id: str,
        ) -> None:

            if step_id in visiting:
                raise ValueError(
                    "CUTOVER_DEPENDENCY_CYCLE"
                )

            if step_id in visited:
                return

            visiting.add(
                step_id
            )

            for dependency in self.steps[
                step_id
            ].dependencies:
                visit(
                    dependency
                )

            visiting.remove(
                step_id
            )

            visited.add(
                step_id
            )

        for step_id in self.steps:
            visit(
                step_id
            )

    def execution_order(
        self,
    ) -> list[str]:

        pending = set(
            self.steps
        )

        completed: set[str] = set()
        order: list[str] = []

        while pending:

            ready = sorted([
                step_id
                for step_id in pending
                if set(
                    self.steps[
                        step_id
                    ].dependencies
                ).issubset(
                    completed
                )
            ])

            if not ready:
                raise RuntimeError(
                    "UNRESOLVABLE_CUTOVER_GRAPH"
                )

            for step_id in ready:

                order.append(
                    step_id
                )

                completed.add(
                    step_id
                )

                pending.remove(
                    step_id
                )

        return order

    def simulate(
        self,
        *,
        failures: list[FailureInjection] | None = None,
    ) -> dict[str, object]:

        failures = failures or []

        failure_by_step = {
            failure.step_id: failure
            for failure in failures
        }

        statuses: dict[str, StepStatus] = {}
        timeline: list[dict[str, object]] = []

        elapsed = 0
        rollback_required: list[str] = []

        for step_id in self.execution_order():

            step = self.steps[
                step_id
            ]

            dependency_failed = any(
                statuses.get(
                    dependency
                ) != "SIMULATED_PASS"
                for dependency in step.dependencies
            )

            if dependency_failed:

                statuses[
                    step_id
                ] = "BLOCKED"

                timeline.append({
                    "step_id": step_id,
                    "name": step.name,
                    "status": "BLOCKED",
                    "start_minute": elapsed,
                    "end_minute": elapsed,
                })

                continue

            start = elapsed

            elapsed += max(
                0,
                step.duration_minutes,
            )

            failure = failure_by_step.get(
                step_id
            )

            if failure is not None:

                status: StepStatus = (
                    "SIMULATED_FAIL"
                )

                if step.rollback_step:
                    rollback_required.append(
                        step.rollback_step
                    )

            else:

                status = (
                    "SIMULATED_PASS"
                )

            statuses[
                step_id
            ] = status

            timeline.append({
                "step_id": step_id,
                "name": step.name,
                "status": status,
                "start_minute": start,
                "end_minute": elapsed,
                "critical": step.critical,
            })

        failed = [
            step_id
            for step_id, status
            in statuses.items()
            if status == "SIMULATED_FAIL"
        ]

        blocked = [
            step_id
            for step_id, status
            in statuses.items()
            if status == "BLOCKED"
        ]

        critical_failure = any(
            self.steps[
                step_id
            ].critical
            for step_id in failed
        )

        decision = "GO"

        if failed or blocked:
            decision = "CONDITIONAL_GO"

        if critical_failure:
            decision = "NO_GO"

        return {
            "mode": "SIMULATION_ONLY",
            "timeline": timeline,
            "total_minutes": elapsed,
            "failed_steps": failed,
            "blocked_steps": blocked,
            "rollback_required": rollback_required,
            "decision": decision,
            "production_authorized": False,
            "cutover_authorized": False,
            "target_write_executed": False,
            "production_action_executed": False,
            "cutover_executed": False,
        }