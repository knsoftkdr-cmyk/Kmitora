"""CLI for the integrated KMITORA A000 one-million capability universe."""

from __future__ import annotations

import argparse
import csv
import json
from dataclasses import asdict
from pathlib import Path

from .catalog import (
    TOTAL_SCENARIOS,
    catalog_summary,
    iter_scenarios,
    validate_catalog,
)
from .engine import run_batch


def validate_command(_: argparse.Namespace) -> int:
    validate_catalog()
    print(json.dumps(catalog_summary(), indent=2))
    return 0


def export_command(args: argparse.Namespace) -> int:
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    with output.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(
            stream,
            fieldnames=list(asdict(next(iter_scenarios(1, 1))).keys()),
        )
        writer.writeheader()
        for scenario in iter_scenarios(args.start, args.end):
            writer.writerow(asdict(scenario))

    print(f"Exported {args.end - args.start + 1:,} scenarios to {output}")
    return 0


def run_command(args: argparse.Namespace) -> int:
    summary = run_batch(
        start=args.start,
        end=args.end,
        output_path=Path(args.output),
        stop_on_failure=not args.continue_on_failure,
    )
    print(json.dumps(summary, indent=2))
    return 0 if summary["failed"] == 0 else 2


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description="KMITORA A000 integrated one-million scenario engine"
    )
    sub = result.add_subparsers(dest="command", required=True)

    validate = sub.add_parser("validate")
    validate.set_defaults(func=validate_command)

    export = sub.add_parser("export")
    export.add_argument("--start", type=int, default=1)
    export.add_argument("--end", type=int, default=TOTAL_SCENARIOS)
    export.add_argument(
        "--output",
        default="runtime_evidence/a000_1m_catalog.csv",
    )
    export.set_defaults(func=export_command)

    run = sub.add_parser("run")
    run.add_argument("--start", type=int, default=1)
    run.add_argument("--end", type=int, default=TOTAL_SCENARIOS)
    run.add_argument(
        "--output",
        default="runtime_evidence/a000_1m_evidence.jsonl",
    )
    run.add_argument("--continue-on-failure", action="store_true")
    run.set_defaults(func=run_command)

    return result


def main() -> None:
    args = parser().parse_args()
    raise SystemExit(args.func(args))


if __name__ == "__main__":
    main()
