"""Run the Phase 4 multi-agent referee graph.

Examples:
    uv run python -m agents.run_referee --question "Does deathtouch work with trample?"
    uv run python -m agents.run_referee --fixture evals/fixtures/sample_questions.jsonl
    uv run python -m agents.run_referee --question "..." --compare  # also run RAG baseline
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from agents.baseline.rag import build_rag_graph
from agents.graph import build_referee_graph
from agents.schemas import RulingResponse
from agents.state import initial_state
from agents.tracing import export_langsmith_env, referee_run_config, run_config


def _print_ruling(label: str, question: str, ruling: RulingResponse | None) -> None:
    print(f"\n{'=' * 72}")
    print(f"[{label}] {question}")
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


def _load_fixture(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            rows.append(json.loads(line))
    return rows


def run_referee(question: str, *, question_id: str | None = None) -> RulingResponse | None:
    app = build_referee_graph()
    result = app.invoke(
        initial_state(question),
        config=referee_run_config(question=question, question_id=question_id),
    )
    return result.get("final_response")


def run_rag_baseline(question: str, *, question_id: str | None = None) -> RulingResponse | None:
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
        config=run_config(baseline="rag", question=question, question_id=question_id),
    )
    return result.get("ruling")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run the Phase 4 referee graph.")
    parser.add_argument("--question", help="Single rules question.")
    parser.add_argument("--fixture", type=Path, help="JSONL fixture file.")
    parser.add_argument(
        "--compare",
        action="store_true",
        help="Also run the Phase 3 RAG baseline for side-by-side comparison.",
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

    for item in items:
        q = item["question"]
        qid = item.get("id")
        try:
            ruling = run_referee(q, question_id=qid)
            _print_ruling("referee", q, ruling)
            if args.compare:
                baseline = run_rag_baseline(q, question_id=qid)
                _print_ruling("baseline:rag", q, baseline)
        except Exception as exc:
            print(f"\n[referee] ERROR on {qid or q!r}: {exc}", file=sys.stderr)

    from agents.config import get_settings

    s = get_settings()
    if s.langsmith_api_key:
        print(f"\n[langsmith] traces sent to project '{s.langsmith_project}'.")
        print("  Filter tags: pipeline:referee | baseline:rag | phase:4")


if __name__ == "__main__":
    main()
