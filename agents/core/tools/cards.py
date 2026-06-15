"""Typed data-access functions over the Convex card mirror.

Plain Python functions (called directly by graph nodes and the resolver, off the
MCP hot path).
"""

from __future__ import annotations

from typing import Any

from agents.core.tools.convex_client import get_convex_client

# Scryfall layouts that are NOT real, castable/playable cards. Used to prefer a
# real card over a same-named token / art card / emblem during resolution.
NON_PLAYABLE_LAYOUTS = frozenset(
    {
        "token",
        "double_faced_token",
        "emblem",
        "art_series",
        "reversible_card",
        "vanguard",
        "scheme",
        "planar",
        "augment",
        "host",
    }
)


def is_playable(card: dict[str, Any]) -> bool:
    """True if the card row is a real, playable card (not a token/art/emblem)."""
    layout = (card.get("layout") or "").lower()
    if layout in NON_PLAYABLE_LAYOUTS:
        return False
    type_line = (card.get("typeLine") or "").lower()
    if "token" in type_line:
        return False
    # Art-series rows carry the bare type line "Card" (possibly doubled).
    if type_line.replace("//", "").strip() == "card":
        return False
    return True


def get_cards_by_normalized_name(normalized_name: str) -> list[dict[str, Any]]:
    """All card rows sharing an exact normalized name (resolver ranks them)."""
    client = get_convex_client()
    return client.query(
        "queries:getCardsByNormalizedName", {"normalizedName": normalized_name}
    )


def get_card_by_oracle_id(oracle_id: str) -> dict[str, Any] | None:
    client = get_convex_client()
    return client.query("queries:getCardByOracleId", {"oracleId": oracle_id})


def _canonical_key(card: dict[str, Any]) -> tuple[int, int, int]:
    return (
        1 if is_playable(card) else 0,
        len(card.get("rulings") or []),
        len(card.get("oracleText") or ""),
    )


def get_card_exact(normalized_name: str) -> dict[str, Any] | None:
    """Exact lookup returning the single most-canonical card for a name."""
    rows = get_cards_by_normalized_name(normalized_name)
    if not rows:
        return None
    return max(rows, key=_canonical_key)


def search_cards_by_name(query: str, limit: int = 15) -> list[dict[str, Any]]:
    """Full-text fuzzy name candidates (lightweight fields)."""
    client = get_convex_client()
    return client.query("queries:searchCardsByName", {"query": query, "limit": limit})


def upsert_card(card: dict[str, Any]) -> bool:
    """Cache a single card row (used by the Scryfall fuzzy fallback)."""
    client = get_convex_client()
    return client.mutation("cards:upsertOne", {"card": card})


def get_alias(normalized_alias: str) -> dict[str, Any] | None:
    """Community-nickname lookup (e.g. "bob" -> Dark Confidant)."""
    client = get_convex_client()
    return client.query(
        "aliases:getByNormalizedAlias", {"normalizedAlias": normalized_alias}
    )
