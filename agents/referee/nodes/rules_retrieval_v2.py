"""Rules retrieval v2 — multi-query search + deterministic cross-reference expansion.

Improvements over the v1 node:
- Searches each decomposed sub-query (plus the raw question and any verifier hints)
  instead of embedding one long narrative string.
- Follows "see rule NNN.N" cross-references found in retrieved text and pulls those
  exact rules in deterministically (the CR is densely cross-linked).
- Still widens on verifier-driven retries.
"""

from __future__ import annotations

import re
from typing import Any

from agents.core.config import get_settings
from agents.core.tools.rules import get_rule_by_number, search_rules
from agents.referee.state import RefereeState

# Matches CR cross-references like "rule 603.4", "see rule 702.19c", "rules 601.2a".
_CROSSREF = re.compile(r"rules?\s+(\d{3}(?:\.\d+[a-z]?)?)", re.IGNORECASE)
_MAX_CROSSREFS = 6


def _merge(into: dict[str, dict[str, Any]], hits: list[dict[str, Any]]) -> None:
    for h in hits:
        num = h.get("ruleNumber")
        if not num:
            continue
        prev = into.get(num)
        # Keep the higher-scoring copy when the same rule arrives from multiple queries.
        if prev is None or h.get("score", 0) >= prev.get("score", 0):
            into[num] = h


def rules_retrieval_v2_node(state: RefereeState) -> RefereeState:
    settings = get_settings()
    question = state["question"]
    verdict = state.get("verdict")
    hints = verdict.retrieval_hints if verdict and verdict.verdict == "ungrounded" else []
    subqueries = state.get("subqueries") or []
    loop_count = state.get("loop_count", 0)

    queries = [question, *subqueries, *hints]
    queries = [q for q in queries if q and q.strip()]

    top_k = settings.thresholds.rules_top_k + loop_count * 4
    per_query = max(3, top_k // max(1, len(queries)))

    merged: dict[str, dict[str, Any]] = {
        h["ruleNumber"]: h for h in (state.get("retrieved_rules") or [])
    }
    for q in queries:
        _merge(merged, search_rules(q, limit=per_query))

    # Deterministic cross-reference expansion.
    referenced: set[str] = set()
    for h in list(merged.values()):
        for num in _CROSSREF.findall(h.get("text", "") or ""):
            if num not in merged:
                referenced.add(num)
    for num in list(referenced)[:_MAX_CROSSREFS]:
        row = get_rule_by_number(num)
        if row and row.get("ruleNumber"):
            merged[row["ruleNumber"]] = {"score": 0.0, **row}

    result = sorted(merged.values(), key=lambda x: x.get("score", 0), reverse=True)

    if hints:
        loop_count += 1

    return {
        "retrieval_query": " | ".join(queries),
        "retrieved_rules": result,
        "loop_count": loop_count,
    }
