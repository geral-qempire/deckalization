"""Run Phase 3 baselines from the CLI.

Examples:
    uv run python -m agents.baseline.run --baseline zero_shot \\
        --question "Does deathtouch work with trample?"

    uv run python -m agents.baseline.run --baseline rag \\
        --question "Does deathtouch work with trample?"

    uv run python -m agents.baseline.run --baseline both \\
        --fixture agents/evals/fixtures/sample_questions.jsonl
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Literal

from agents.baseline.rag import build_rag_graph
from agents.baseline.zero_shot import build_zero_shot_graph
from agents.core.schemas import RulingResponse
from agents.core.tracing import export_langsmith_env, run_config

BaselineName = Literal["zero_shot", "rag", "both"]


def _print_ruling(baseline: str, question: str, ruling: RulingResponse | None) -> None:
    print(f"\n{'=' * 72}")
    print(f"[{baseline}] {question}")
    print("=" * 72)
    if ruling is None:
        print("(no ruling produced)")
        return
    print(f"\nRULING ({ruling.confidence} confidence):\n{ruling.ruling}")
    if ruling.rule_citations:
        print("\nRule citations:")
        for rc in ruling.rule_citations:
            print(f"  • CR {rc.rule_number}: {rc.excerpt[:120]}")
    if ruling.card_citations:
        print("\nCard citations:")
        for cc in ruling.card_citations:
            print(f"  • {cc.name}: {cc.oracle_excerpt[:120]}")
    if ruling.notes:
        print(f"\nNotes: {ruling.notes}")


def _run_one(
    baseline: Literal["zero_shot", "rag"],
    question: str,
    *,
    question_id: str | None = None,
) -> RulingResponse | None:
    config = run_config(baseline=baseline, question=question, question_id=question_id)
    if baseline == "zero_shot":
        app = build_zero_shot_graph()
        result = app.invoke({"question": question, "ruling": None}, config=config)
    else:
        app = build_rag_graph()
        result = app.invoke(
            {
                "question": question,
                "card_names": [],
                "resolved_cards": [],
                "unresolved_notes": [],
                "rule_hits": [],
                "ruling": None,
            },
            config=config,
        )
    ruling = result.get("ruling")
    _print_ruling(baseline, question, ruling)
    return ruling


def _load_fixture(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            rows.append(json.loads(line))
    return rows


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run Phase 3 baseline referee pipelines.")
    parser.add_argument(
        "--baseline",
        choices=["zero_shot", "rag", "both"],
        default="both",
        help="Which baseline to run (default: both).",
    )
    parser.add_argument("--question", help="Single rules question to answer.")
    parser.add_argument(
        "--fixture",
        type=Path,
        help="JSONL file of questions ({id, question, ...}).",
    )
    args = parser.parse_args(argv)

    export_langsmith_env()

    if not args.question and not args.fixture:
        parser.error("Provide --question or --fixture.")

    items: list[dict[str, Any]]
    if args.fixture:
        items = _load_fixture(args.fixture)
    else:
        items = [{"id": "cli", "question": args.question}]

    baselines: list[Literal["zero_shot", "rag"]]
    if args.baseline == "both":
        baselines = ["zero_shot", "rag"]
    else:
        baselines = [args.baseline]

    for item in items:
        q = item["question"]
        qid = item.get("id")
        for b in baselines:
            try:
                _run_one(b, q, question_id=qid)
            except Exception as exc:
                print(f"\n[{b}] ERROR on {qid or q!r}: {exc}", file=sys.stderr)

    from agents.core.config import get_settings

    s = get_settings()
    if s.langsmith_api_key:
        print(f"\n[langsmith] traces sent to project '{s.langsmith_project}'.")
        print("  Filter tags: baseline:zero_shot | baseline:rag | phase:3")


if __name__ == "__main__":
    main()
