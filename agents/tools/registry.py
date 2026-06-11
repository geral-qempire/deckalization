"""LangChain tool wrappers over the data-access layer.

The graph nodes (Phase 4) bind these tools; the FastMCP server (mcp/server.py)
re-exposes the same underlying functions. All are read-only and return real DB
rows or an explicit not_found — never model-memory answers.
"""

from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from agents.normalize import normalize_name
from agents.resolver import resolve_card
from agents.tools.cards import get_card_exact
from agents.tools.rules import get_rule_by_number, search_rules


@tool
def resolve_card_tool(name: str) -> dict[str, Any]:
    """Resolve a (possibly misspelled or nicknamed) card name to a real card.

    Returns a structured result with status (resolved/ambiguous/not_found/
    rules_concept), the resolved card, candidates, and a confidence score.
    """
    return resolve_card(name).model_dump()


@tool
def get_card_tool(name: str) -> dict[str, Any] | None:
    """Look up a card by its exact name. Returns the card row or null."""
    return get_card_exact(normalize_name(name))


@tool
def search_rules_tool(query: str, limit: int = 8) -> list[dict[str, Any]]:
    """Semantically search the Comprehensive Rules. Returns matching rule chunks."""
    return search_rules(query, limit=limit)


@tool
def get_rule_by_number_tool(rule_number: str) -> dict[str, Any] | None:
    """Fetch a specific Comprehensive Rule by number, e.g. '601.2a'."""
    return get_rule_by_number(rule_number)


LANGCHAIN_TOOLS = [
    resolve_card_tool,
    get_card_tool,
    search_rules_tool,
    get_rule_by_number_tool,
]
