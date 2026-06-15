"""Adjudication-model sweep for referee_v2 — correctness + latency + cost + tokens.

Runs the referee_v2 pipeline over a slice of the benchmark for each candidate
adjudication model, metering per-case wall latency and token usage (via the
usage-metadata callback, keyed by model so cost is exact across every sub-model),
and scoring correctness with the same LLM judge used in the main harness.

Only the adjudication (Stage-1 reasoning) model varies. The Stage-2 formatter, the
router/lookup, the verifier, and the correctness judge are held fixed so the comparison
is clean. The judge runs OUTSIDE the usage meter, so reported tokens/cost reflect the
production pipeline only — not eval overhead.

Usage:
    uv run python -m agents.evals.scripts.model_sweep --suite benchmark --limit 40
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import UTC, datetime
from pathlib import Path
from statistics import mean, median
from typing import Any

from langchain_core.callbacks import get_usage_metadata_callback

from agents.core.config import get_settings
from agents.core.tracing import export_langsmith_env
from agents.evals.evaluators import evaluate_rules_case
from agents.evals.pipelines import run_target
from agents.evals.run import _load_cases

# (label, OpenRouter slug) — sonnet-4.5 is the current production baseline.
MODELS: list[tuple[str, str]] = [
    ("sonnet-4.5", "anthropic/claude-sonnet-4.5"),
    ("gpt-5-mini", "openai/gpt-5-mini"),
    ("haiku-4.5", "anthropic/claude-haiku-4.5"),
    ("opus-4.8", "anthropic/claude-opus-4.8"),
    ("gpt-5.5", "openai/gpt-5.5"),
]

# OpenRouter list prices, USD per 1M tokens (input, output), keyed by model *family*.
# The usage callback reports resolved names (e.g. "anthropic/claude-4.5-sonnet-20250929"),
# so we match by family. Fixed sub-models included so total cost is accurate
# (router/lookup/formatter = gpt-4o-mini; verifier = sonnet-4.5).
PRICE_BY_FAMILY: dict[str, tuple[float, float]] = {
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-5-mini": (0.25, 2.0),
    "gpt-5.5": (5.0, 30.0),
    "opus-4.8": (5.0, 25.0),
    "haiku-4.5": (1.0, 5.0),
    "sonnet-4.5": (3.0, 15.0),
}

FULL_BENCHMARK = 125  # for projecting full-run cost


def _family(model_name: str) -> str:
    """Map a resolved OpenRouter model name to a price family (order-sensitive)."""
    n = model_name.lower()
    if "gpt-4o-mini" in n:
        return "gpt-4o-mini"
    if "gpt-5-mini" in n:
        return "gpt-5-mini"
    if "gpt-5.5" in n:
        return "gpt-5.5"
    if "opus" in n:
        return "opus-4.8"
    if "haiku" in n:
        return "haiku-4.5"
    if "sonnet" in n:
        return "sonnet-4.5"
    return model_name


def _cost(usage: dict[str, dict[str, Any]]) -> tuple[float, list[str]]:
    total = 0.0
    unpriced: list[str] = []
    for model, u in usage.items():
        price = PRICE_BY_FAMILY.get(_family(model))
        if price is None:
            unpriced.append(model)
            continue
        pin, pout = price
        total += u.get("input_tokens", 0) / 1e6 * pin
        total += u.get("output_tokens", 0) / 1e6 * pout
    return total, unpriced


def _case_id(case: dict[str, Any]) -> str:
    return f"{case['source']}:{case['externalId']}"


def run_sweep(suite: str, limit: int, out_path: Path) -> list[dict[str, Any]]:
    export_langsmith_env()
    settings = get_settings()
    cases = _load_cases(suite)
    if limit:
        cases = cases[:limit]
    n = len(cases)
    print(f"Model sweep: {n} cases × {len(MODELS)} models (suite={suite!r})")

    results: list[dict[str, Any]] = []
    for label, slug in MODELS:
        settings.models.adjudication = slug
        print(f"\n=== {label}  ({slug}) ===")
        corr: list[float] = []
        rel: list[float] = []
        lat: list[float] = []
        agg: dict[str, dict[str, int]] = {}
        adj_in = adj_out = 0
        errors = 0
        unpriced_seen: set[str] = set()

        for i, case in enumerate(cases, 1):
            with get_usage_metadata_callback() as cb:
                t0 = time.perf_counter()
                run = run_target(
                    "referee_v2", case_id=_case_id(case), question=case["question"]
                )
                dt = time.perf_counter() - t0
            lat.append(dt)
            if run.error:
                errors += 1
            adj_family = _family(slug)
            case_adj_in = case_adj_out = 0
            for m, u in cb.usage_metadata.items():
                d = agg.setdefault(m, {"input_tokens": 0, "output_tokens": 0})
                d["input_tokens"] += u.get("input_tokens", 0)
                d["output_tokens"] += u.get("output_tokens", 0)
                # Attribute the swapped adjudication model's tokens by family. NOTE: when
                # the adjudication model IS sonnet-4.5, this also includes the (sonnet)
                # verifier calls, since they share a family.
                if _family(m) == adj_family:
                    case_adj_in += u.get("input_tokens", 0)
                    case_adj_out += u.get("output_tokens", 0)
            adj_in += case_adj_in
            adj_out += case_adj_out

            # Correctness OUTSIDE the usage meter (judge cost must not count).
            sc = evaluate_rules_case(case, run, use_llm_judge=True)
            corr.append(sc.get("correctness", 0.0))
            rel.append(sc.get("citation_recall", 0.0))
            print(
                f"  [{i}/{n}] {dt:5.1f}s  corr={sc.get('correctness')}  "
                f"adj_tok={case_adj_in}+{case_adj_out}"
            )

        cost_total, unpriced = _cost(agg)
        unpriced_seen.update(unpriced)
        tok_in = sum(u["input_tokens"] for u in agg.values())
        tok_out = sum(u["output_tokens"] for u in agg.values())
        row = {
            "label": label,
            "slug": slug,
            "n": n,
            "errors": errors,
            "correctness": round(mean(corr), 4) if corr else 0.0,
            "citation_recall": round(mean(rel), 4) if rel else 0.0,
            "latency_mean_s": round(mean(lat), 2) if lat else 0.0,
            "latency_median_s": round(median(lat), 2) if lat else 0.0,
            "tokens_in": tok_in,
            "tokens_out": tok_out,
            "adj_tokens_in": adj_in,
            "adj_tokens_out": adj_out,
            "cost_total_usd": round(cost_total, 4),
            "cost_per_case_usd": round(cost_total / n, 5) if n else 0.0,
            "cost_full125_usd": round(cost_total / n * FULL_BENCHMARK, 2) if n else 0.0,
            "unpriced_models": sorted(unpriced_seen),
        }
        results.append(row)
        print(
            f"  → correctness={row['correctness']} latency~{row['latency_median_s']}s "
            f"cost=${row['cost_total_usd']} (${row['cost_per_case_usd']}/case)"
        )
        _write_report(results, out_path, suite=suite, limit=n)

    return results


def _write_report(results: list[dict[str, Any]], out_path: Path, *, suite: str, limit: int) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    json_path = out_path.with_suffix(".json")
    json_path.write_text(json.dumps(results, indent=2), encoding="utf-8")

    ts = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# referee_v2 — adjudication model sweep",
        "",
        f"_Generated {ts} · suite=`{suite}` · {limit} cases · pipeline=`referee_v2`._",
        "",
        "Only the **adjudication (Stage-1 reasoning)** model varies. Stage-2 formatter, "
        "router/lookup, verifier, and the correctness judge are fixed (`gpt-4o-mini` "
        "for judge/formatter, `claude-sonnet-4.5` for verifier). Cost spans all sub-models; "
        "judge cost is excluded. Tokens/cost are pipeline totals across the run.",
        "",
        "| model | correctness | cite_rel | latency med (s) | latency mean (s) "
        "| tokens in | tokens out | cost (run) | cost/case | proj. full-125 |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in sorted(results, key=lambda x: x["correctness"], reverse=True):
        lines.append(
            f"| `{r['label']}` | {r['correctness']:.3f} | {r['citation_recall']:.3f} "
            f"| {r['latency_median_s']:.1f} | {r['latency_mean_s']:.1f} "
            f"| {r['tokens_in']:,} | {r['tokens_out']:,} "
            f"| ${r['cost_total_usd']:.2f} | ${r['cost_per_case_usd']:.4f} "
            f"| ${r['cost_full125_usd']:.2f} |"
        )
    lines += [
        "",
        "### Adjudication-model token share (the swapped model only)",
        "",
        "| model | adj tokens in | adj tokens out | errors |",
        "|---|---|---|---|",
    ]
    for r in sorted(results, key=lambda x: x["correctness"], reverse=True):
        lines.append(
            f"| `{r['label']}` | {r['adj_tokens_in']:,} | {r['adj_tokens_out']:,} | {r['errors']} |"
        )
    lines.append("")
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"  [report] {out_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description="referee_v2 adjudication-model sweep")
    ap.add_argument("--suite", default="benchmark")
    ap.add_argument("--limit", type=int, default=40)
    ap.add_argument("--out", default="docs/model-sweep-report.md")
    args = ap.parse_args()
    run_sweep(args.suite, args.limit, Path(args.out))


if __name__ == "__main__":
    main()
