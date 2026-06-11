"""Rules retrieval node — semantic search with verifier-driven retry."""

from __future__ import annotations

from typing import Any

from agents.config import get_settings
from agents.state import RefereeState
from agents.tools.rules import search_rules


def _merge_rules(
    existing: list[dict[str, Any]], new_hits: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    by_number = {h["ruleNumber"]: h for h in existing}
    for h in new_hits:
        by_number[h["ruleNumber"]] = h
    return sorted(by_number.values(), key=lambda x: x.get("score", 0), reverse=True)


def rules_retrieval_node(state: RefereeState) -> RefereeState:
    settings = get_settings()
    question = state["question"]
    verdict = state.get("verdict")
    hints = verdict.retrieval_hints if verdict and verdict.verdict == "ungrounded" else []

    # Widen top_k on retry; combine question + verifier hints for search.
    top_k = settings.thresholds.rules_top_k + state.get("loop_count", 0) * 4
    queries = [question, *hints]
    combined_query = " | ".join(q for q in queries if q)

    hits = search_rules(combined_query, limit=top_k)
    merged = _merge_rules(state.get("retrieved_rules") or [], hits)

    loop_count = state.get("loop_count", 0)
    if hints:
        loop_count += 1

    return {
        "retrieval_query": combined_query,
        "retrieved_rules": merged,
        "loop_count": loop_count,
    }
