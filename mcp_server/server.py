"""Referee MCP server (FastMCP).

Exposes the curated, read-only domain tools over the SAME Python data-access
layer the graph uses — so Cursor, Claude Desktop, or any MCP host can drive the
referee's tools. Narrow + read-only by design: every tool returns a real DB row
(or an explicit not_found), enforcing "no row, no ruling" at the protocol edge.

NOTE: MCP stays OFF the production hot path. Runtime graph nodes call the Python
functions directly; this server is an additional interface for external clients.

The package is named `mcp_server` (not `mcp`) to avoid shadowing the `mcp` PyPI
package that FastMCP imports internally.

Run (stdio):  uv run python -m mcp_server.server
"""

from __future__ import annotations

from typing import Any

from agents.core.normalize import normalize_name
from agents.core.resolver import resolve_card
from agents.core.tools.cards import get_card_exact
from agents.core.tools.rules import get_rule_by_number, search_rules
from fastmcp import FastMCP

mcp: FastMCP = FastMCP("deckalization-referee")


@mcp.tool
def resolveCard(name: str) -> dict[str, Any]:
    """Resolve a possibly-misspelled or nicknamed card name to a real card.

    Returns status (resolved/ambiguous/not_found/rules_concept), the resolved
    card, candidate cards, and a confidence score.
    """
    return resolve_card(name).model_dump()


@mcp.tool
def getCard(name: str) -> dict[str, Any] | None:
    """Look up a card by exact name. Returns the card row, or null if not found."""
    return get_card_exact(normalize_name(name))


@mcp.tool
def searchRules(query: str, limit: int = 8) -> list[dict[str, Any]]:
    """Semantically search the Comprehensive Rules. Returns matching rule chunks."""
    return search_rules(query, limit=limit)


@mcp.tool
def getRuleByNumber(ruleNumber: str) -> dict[str, Any] | None:
    """Fetch a specific Comprehensive Rule by number, e.g. '601.2a'."""
    return get_rule_by_number(ruleNumber)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
