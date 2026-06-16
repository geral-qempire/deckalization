"""Snapshot LangSmith experiment scores into JSON for the website's static data.

Read-only: this does NOT run an eval. It reads experiments that the Eval gate
Action already uploaded to LangSmith, joins each run to its dataset example's
metadata (category / complexity), and aggregates:

  * overall metrics per experiment, and
  * per-category and per-complexity correctness (and other metrics).

Usage (experiment names are printed by the Eval gate Action log):

    uv run python -m agents.evals.scripts.export_results \
        --experiment baseline_rag=bench40-rag-1234abcd \
        --experiment referee_v2=bench40-referee_v2-5678ef01

Output: agents/evals/datasets/experiment_snapshot.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import mean
from typing import Any

from langsmith import Client

from agents.core.tracing import export_langsmith_env

_OUT = Path(__file__).resolve().parents[1] / "datasets" / "experiment_snapshot.json"

_METRICS = [
    "correctness",
    "faithfulness",
    "rule_recall",
    "citation_recall",
    "citation_validity",
    "card_recall",
    "card_precision",
]


def _avg(values: list[float]) -> float | None:
    return round(mean(values), 4) if values else None


def _example_meta(client: Client, dataset_name: str) -> dict[str, dict[str, Any]]:
    """example_id → {category, complexity, level}."""
    out: dict[str, dict[str, Any]] = {}
    for ex in client.list_examples(dataset_name=dataset_name):
        md = ex.metadata or {}
        out[str(ex.id)] = {
            "category": md.get("category") or "Unknown",
            "complexity": md.get("complexity") or "Unknown",
            "level": md.get("level") or "Unknown",
        }
    return out


def _collect_rows(
    client: Client, experiment: str, meta: dict[str, dict[str, Any]]
) -> list[dict[str, Any]]:
    """One row per example: its category/complexity + each metric's score."""
    rows: list[dict[str, Any]] = []
    for run in client.list_runs(project_name=experiment, is_root=True):
        ex_id = str(run.reference_example_id) if run.reference_example_id else None
        info = meta.get(ex_id or "", {"category": "Unknown", "complexity": "Unknown"})
        stats = run.feedback_stats or {}
        row: dict[str, Any] = {
            "category": info["category"],
            "complexity": info["complexity"],
        }
        for m in _METRICS:
            s = stats.get(m)
            row[m] = s.get("avg") if isinstance(s, dict) else None
        rows.append(row)
    return rows


def _bucket(rows: list[dict[str, Any]], key: str | None, value: str | None) -> dict[str, Any]:
    sel = rows if key is None else [r for r in rows if r[key] == value]
    entry: dict[str, Any] = {"n": len(sel)}
    for m in _METRICS:
        entry[m] = _avg([r[m] for r in sel if r.get(m) is not None])
    return entry


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--experiment",
        action="append",
        required=True,
        metavar="target=experiment_name",
        help="Repeatable. e.g. --experiment referee_v2=bench40-referee_v2-abcd1234",
    )
    parser.add_argument("--dataset", default="deckalization-rules-qa")
    parser.add_argument("--out", default=str(_OUT))
    args = parser.parse_args(argv)

    export_langsmith_env()
    client = Client()

    pairs = [e.split("=", 1) for e in args.experiment]
    meta = _example_meta(client, args.dataset)
    categories = sorted({m["category"] for m in meta.values()})
    complexities = ["Simple", "Intermediate", "Complicated"]

    payload: dict[str, Any] = {"dataset": args.dataset, "experiments": {}}
    for target, experiment in pairs:
        rows = _collect_rows(client, experiment, meta)
        payload["experiments"][target] = {
            "experiment_name": experiment,
            "n": len(rows),
            "overall": _bucket(rows, None, None),
            "by_category": {c: _bucket(rows, "category", c) for c in categories},
            "by_complexity": {c: _bucket(rows, "complexity", c) for c in complexities},
        }

    out_path = Path(args.out)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    # Console summary.
    for target, info in payload["experiments"].items():
        o = info["overall"]
        print(
            f"\n{target} ({info['experiment_name']}, n={info['n']}): "
            f"corr={o['correctness']} faith={o['faithfulness']} "
            f"rule_recall={o['rule_recall']} cite_recall={o['citation_recall']}"
        )
        print("  by category:")
        for c, b in info["by_category"].items():
            print(f"    {c:<32} n={b['n']:>2}  corr={b['correctness']}")
        print("  by complexity:")
        for c, b in info["by_complexity"].items():
            print(f"    {c:<14} n={b['n']:>2}  corr={b['correctness']}")

    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
