"""Phase 5 eval harness — one command runs a suite and prints scores.

Results land in LangSmith → Datasets & Experiments → <dataset> → Experiments
(the Compare view with evaluator score columns). Use --local for an offline run.

Examples:
    # Smoke baseline-vs-graph comparison (LangSmith experiments)
    uv run python -m agents.evals.run --suite smoke --compare zero_shot baseline_rag referee

    # Single target, skip CI gate while tuning
    uv run python -m agents.evals.run --suite smoke --target referee --skip-thresholds

    # Card-resolution golden set
    uv run python -m agents.evals.run --suite card_resolution --target resolver

    # Offline (no LangSmith upload)
    uv run python -m agents.evals.run --suite smoke --target referee --local
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import yaml

from agents.core.tools.convex_client import get_convex_client
from agents.core.tracing import export_langsmith_env
from agents.evals.evaluators import aggregate_scores, evaluate_card_case, evaluate_rules_case
from agents.evals.langsmith_eval import run_experiments
from agents.evals.pipelines import TargetName, run_target

_THRESHOLDS = Path(__file__).resolve().parent / "thresholds.yaml"


def _load_cases(suite: str) -> list[dict[str, Any]]:
    client = get_convex_client()
    if suite == "full":
        return client.query(
            "evalCases:listAllEvalCases", {"source": "rulesguru", "kind": "rules_qa"}
        )
    if suite == "card_resolution":
        return client.query(
            "evalCases:listEvalCasesBySuite",
            {"suite": "card_resolution", "kind": "card_resolution"},
        )
    return client.query(
        "evalCases:listEvalCasesBySuite",
        {"suite": suite, "kind": "rules_qa"},
    )


def _case_id(case: dict[str, Any]) -> str:
    return f"{case['source']}:{case['externalId']}"


def _check_thresholds(
    suite: str,
    target: str,
    scores: dict[str, float],
    thresholds: dict[str, Any],
) -> list[str]:
    failures: list[str] = []
    gate = thresholds.get(suite, {}).get(target, {})
    for metric, minimum in gate.items():
        val = scores.get(metric)
        if val is None:
            continue
        if val < float(minimum):
            failures.append(f"{target}.{metric}: {val:.3f} < {minimum}")
    return failures


def _run_suite_local(
    cases: list[dict[str, Any]],
    targets: list[TargetName],
    *,
    limit: int,
    use_llm_judge: bool,
) -> dict[str, dict[str, float]]:
    if limit:
        cases = cases[:limit]
    results: dict[str, list[dict[str, float]]] = {t: [] for t in targets}

    for i, case in enumerate(cases, 1):
        cid = _case_id(case)
        print(f"  [{i}/{len(cases)}] {cid}", flush=True)
        for target in targets:
            if case.get("kind") == "card_resolution":
                if target != "resolver":
                    continue
                run = run_target("resolver", case_id=cid, question=case["question"], trace=False)
                results[target].append(evaluate_card_case(case, run))
            else:
                if target == "resolver":
                    continue
                run = run_target(target, case_id=cid, question=case["question"], trace=False)
                results[target].append(
                    evaluate_rules_case(case, run, use_llm_judge=use_llm_judge)
                )

    return {t: aggregate_scores(results[t]) for t in targets}


def _print_scores(scores_by_target: dict[str, dict[str, float]], targets: Sequence[str]) -> None:
    print("\n=== Scores ===")
    metrics = sorted({m for s in scores_by_target.values() for m in s})
    if not metrics:
        print("  (no scores)")
        return
    header = f"{'metric':<20}" + "".join(f"{t:>14}" for t in targets)
    print(header)
    print("-" * len(header))
    for m in metrics:
        row = f"{m:<20}"
        for t in targets:
            val = scores_by_target[t].get(m)
            row += f"{val:>14.3f}" if val is not None else f"{'n/a':>14}"
        print(row)


def _print_delta(
    scores_by_target: dict[str, dict[str, float]],
    left: str,
    right: str,
    metrics: list[str],
    title: str,
) -> None:
    if left not in scores_by_target or right not in scores_by_target:
        return
    rows = [m for m in metrics if m in scores_by_target[left] or m in scores_by_target[right]]
    if not rows:
        return
    print(f"\n=== {title} ({left} vs {right}) ===")
    for m in rows:
        a = scores_by_target[left].get(m)
        b = scores_by_target[right].get(m)
        if a is None or b is None:
            continue
        delta = a - b
        winner = left if delta >= 0 else right
        print(f"  {m:<20} {left}={a:.3f}  {right}={b:.3f}  Δ={delta:+.3f}  → {winner}")


def _print_compare_report(
    scores_by_target: dict[str, dict[str, float]],
    targets: Sequence[str],
    thresholds: dict[str, Any],
) -> None:
    metrics = thresholds.get("compare_referee_beats_rag", []) or [
        "correctness",
        "faithfulness",
        "rule_recall",
        "citation_recall",
    ]
    # Baseline-vs-graph: does the multi-agent referee beat single-chain RAG?
    _print_delta(scores_by_target, "referee", "baseline_rag", metrics, "Baseline-vs-graph")
    # New architecture vs the RAG baseline and vs the original referee.
    _print_delta(scores_by_target, "referee_v2", "baseline_rag", metrics, "v2-vs-RAG")
    _print_delta(scores_by_target, "referee_v2", "referee", metrics, "v2-vs-v1")
    # Ablation: what does the verifier loop actually add?
    _print_delta(
        scores_by_target, "referee", "referee_no_verifier", metrics, "Verifier-loop ablation"
    )


def _model_slug(model_id: str) -> str:
    """Short, filename-safe tag from a model id (e.g. anthropic/claude-opus-4.8 → opus48)."""
    base = model_id.split("/")[-1]
    base = base.replace("claude-", "").replace("gpt-", "gpt").replace("-fast", "")
    return base.replace(".", "").replace("-", "")[:14]


def _apply_model_overrides(args: argparse.Namespace) -> str | None:
    """Mutate the cached settings so all nodes pick up the overridden model ids.

    Returns a short label for the adjudication model (for experiment naming), or None.
    """
    from agents.core.config import get_settings

    settings = get_settings()
    overrides = {
        "adjudication": args.adjudication_model,
        "verifier": args.verifier_model,
        "lookup": args.lookup_model,
        "router": args.router_model,
    }
    applied = {role: val for role, val in overrides.items() if val}
    for role, val in applied.items():
        setattr(settings.models, role, val)
    if applied:
        print("Model overrides:")
        for role, val in applied.items():
            print(f"  {role}: {val}")
    if args.model_label:
        return args.model_label
    if args.adjudication_model:
        return _model_slug(args.adjudication_model)
    return None


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run Phase 5 eval suites.")
    parser.add_argument(
        "--suite",
        choices=["smoke", "bench40", "benchmark", "full", "card_resolution"],
        default="smoke",
    )
    parser.add_argument(
        "--target",
        choices=[
            "zero_shot",
            "baseline_rag",
            "referee",
            "referee_no_verifier",
            "referee_v2",
            "resolver",
        ],
    )
    parser.add_argument(
        "--compare",
        nargs="+",
        choices=["zero_shot", "baseline_rag", "referee", "referee_no_verifier", "referee_v2"],
        help="Run multiple pipeline targets and print a comparison table.",
    )
    parser.add_argument("--limit", type=int, default=0, help="Cap cases (dev/debug).")
    parser.add_argument(
        "--concurrency",
        type=int,
        default=1,
        help="Parallel cases per experiment (LangSmith runs).",
    )
    parser.add_argument("--no-llm-judge", action="store_true", help="Skip LLM correctness judge.")
    parser.add_argument(
        "--local",
        action="store_true",
        help="Offline run — no LangSmith experiment upload.",
    )
    parser.add_argument(
        "--reset-dataset",
        action="store_true",
        help="Delete + recreate the LangSmith dataset before running.",
    )
    parser.add_argument(
        "--skip-thresholds",
        action="store_true",
        help="Print scores but do not exit 1 on threshold failures.",
    )
    # Per-role model overrides (OpenRouter slugs). Config-driven — no node changes.
    # NOTE: --lookup-model also changes the Stage-2 formatter. The LLM judge is its own
    # role (settings.models.judge); for a clean adjudication comparison override only
    # --adjudication-model.
    parser.add_argument("--adjudication-model", default=None)
    parser.add_argument("--verifier-model", default=None)
    parser.add_argument("--lookup-model", default=None)
    parser.add_argument("--router-model", default=None)
    parser.add_argument(
        "--model-label",
        default=None,
        help="Short label appended to the experiment name (defaults to the adjudication slug).",
    )
    args = parser.parse_args(argv)

    if args.suite == "full" and not args.limit:
        print(
            "WARNING: --suite full runs the entire RulesGuru corpus. "
            "Prefer --suite benchmark or pass --limit.",
            file=sys.stderr,
        )

    export_langsmith_env()
    thresholds = yaml.safe_load(_THRESHOLDS.read_text(encoding="utf-8"))

    model_label = _apply_model_overrides(args)

    if args.compare:
        targets: list[TargetName] = list(args.compare)
    elif args.target:
        targets = [args.target]
    elif args.suite == "card_resolution":
        targets = ["resolver"]
    else:
        targets = ["referee"]

    cases = _load_cases(args.suite)
    if not cases:
        raise SystemExit(
            f"No cases for suite={args.suite!r}. Run ingest_rulesguru + build_benchmark_manifest."
        )

    print(f"Suite {args.suite!r}: {len(cases)} cases → targets {targets}")

    experiments: list[dict[str, Any]] = []
    if args.local:
        scores_by_target = _run_suite_local(
            cases, targets, limit=args.limit, use_llm_judge=not args.no_llm_judge
        )
    else:
        experiments = run_experiments(
            suite=args.suite,
            cases=cases,
            targets=targets,
            limit=args.limit,
            use_llm_judge=not args.no_llm_judge,
            max_concurrency=args.concurrency,
            experiment_suffix=f"-{model_label}" if model_label else "",
            reset=args.reset_dataset,
        )
        scores_by_target = {e["target"]: e["scores"] for e in experiments}

    _print_scores(scores_by_target, targets)
    _print_compare_report(scores_by_target, targets, thresholds)

    if experiments:
        print("\n=== LangSmith experiments ===")
        for e in experiments:
            print(f"  {e['target']}: {e['experiment_name']}")
            if e.get("url"):
                print(f"    compare: {e['url']}")
        if experiments[0].get("dataset_url"):
            print(f"  dataset: {experiments[0]['dataset_url']}")

    all_failures: list[str] = []
    if not args.skip_thresholds:
        for t in targets:
            all_failures.extend(
                _check_thresholds(args.suite, t, scores_by_target[t], thresholds)
            )
        if "baseline_rag" in scores_by_target:
            # Gate every referee variant in the run against the RAG baseline.
            referee_targets = [
                t for t in scores_by_target if t.startswith("referee")
            ]
            for ref in referee_targets:
                for metric in thresholds.get("compare_referee_beats_rag", []):
                    r = scores_by_target[ref].get(metric)
                    b = scores_by_target["baseline_rag"].get(metric)
                    if r is not None and b is not None and r < b:
                        all_failures.append(
                            f"compare: {ref} {metric} {r:.3f} < baseline_rag {b:.3f}"
                        )

    if all_failures:
        print("\nFAILED thresholds:")
        for f in all_failures:
            print(f"  • {f}")
        raise SystemExit(1)

    if not args.skip_thresholds:
        print("\nPASSED all thresholds.")


if __name__ == "__main__":
    main()
