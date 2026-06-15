"""Typed data-access functions over the Comprehensive Rules in Convex."""

from __future__ import annotations

from typing import Any

from agents.core.config import get_settings
from agents.core.tools.convex_client import get_convex_client
from agents.ingest.embedder import embed_query


def get_rule_by_number(rule_number: str) -> dict[str, Any] | None:
    """Exact rule lookup, e.g. "601.2a"."""
    client = get_convex_client()
    return client.query("queries:getRuleByNumber", {"ruleNumber": rule_number})


def search_rules(query: str, limit: int | None = None) -> list[dict[str, Any]]:
    """Semantic search over the rules.

    Embeds the query in Python with the same pinned model used at ingest, then
    calls the Convex vector-search action.
    """
    settings = get_settings()
    top_k = limit or settings.thresholds.rules_top_k
    embedding = embed_query(query)
    client = get_convex_client()
    return client.action(
        "queries:searchRules", {"embedding": embedding, "limit": top_k}
    )
