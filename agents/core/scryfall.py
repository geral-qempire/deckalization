"""Scryfall live API — the resolver's final fuzzy fallback.

Used only when local resolution fails or is low-confidence (e.g. a card newer
than the last bulk refresh). On a hit we map the Scryfall object into our card
schema so the caller can cache it into the mirror ("no row, no ruling").
"""

from __future__ import annotations

import time
from typing import Any

import httpx

from agents.core.normalize import normalize_name

_NAMED = "https://api.scryfall.com/cards/named"
_HEADERS = {"User-Agent": "deckalization/0.1 (MTG rules referee)", "Accept": "application/json"}


def _first_str(*vals: Any) -> str | None:
    for val in vals:
        if isinstance(val, str) and val:
            return val
    return None


def map_scryfall_card(raw: dict[str, Any], rulings: list[dict[str, Any]]) -> dict[str, Any]:
    """Map a raw Scryfall card object into our Convex `cards` schema shape."""
    faces = raw.get("card_faces") or []
    oracle_text = _first_str(
        raw.get("oracle_text"),
        "\n//\n".join(f.get("oracle_text", "") for f in faces if f.get("oracle_text")),
    )
    type_line = _first_str(
        raw.get("type_line"),
        " // ".join(f.get("type_line", "") for f in faces if f.get("type_line")),
    )
    mana_cost = _first_str(
        raw.get("mana_cost"),
        " // ".join(f.get("mana_cost", "") for f in faces if f.get("mana_cost")),
    )
    colors = raw.get("colors")
    if not isinstance(colors, list):
        colors = sorted({c for f in faces for c in (f.get("colors") or [])})

    def face_stat(key: str) -> str | None:
        return _first_str(
            raw.get(key),
            " // ".join(f.get(key, "") for f in faces if f.get(key)),
        )

    card = {
        "oracleId": raw["oracle_id"],
        "name": raw.get("name", ""),
        "normalizedName": normalize_name(raw.get("name", "")),
        "oracleText": oracle_text or "",
        "typeLine": type_line or "",
        "manaCost": mana_cost,
        "power": face_stat("power"),
        "toughness": face_stat("toughness"),
        "loyalty": face_stat("loyalty"),
        "defense": face_stat("defense"),
        "colors": colors,
        "keywords": raw.get("keywords") or [],
        "legalities": raw.get("legalities") or {},
        "rulings": rulings,
        "layout": raw.get("layout"),
        "setType": raw.get("set_type"),
        "scryfallId": raw.get("id"),
        "updatedAt": int(time.time() * 1000),
    }
    # Convex v.optional() rejects explicit nulls — omit absent fields instead.
    return {k: v for k, v in card.items() if v is not None}


def _fetch_rulings(client: httpx.Client, rulings_uri: str | None) -> list[dict[str, Any]]:
    if not rulings_uri:
        return []
    try:
        resp = client.get(rulings_uri)
        resp.raise_for_status()
        data = resp.json().get("data", [])
        return [
            {
                "source": r.get("source", ""),
                "published_at": r.get("published_at", ""),
                "comment": r.get("comment", ""),
            }
            for r in data
        ]
    except httpx.HTTPError:
        return []


def fuzzy_named(name: str) -> dict[str, Any] | None:
    """Look up a card by fuzzy name on Scryfall. Returns a mapped card or None."""
    with httpx.Client(headers=_HEADERS, timeout=15.0, follow_redirects=True) as client:
        resp = client.get(_NAMED, params={"fuzzy": name})
        if resp.status_code != 200:
            return None
        raw = resp.json()
        if raw.get("object") != "card" or "oracle_id" not in raw:
            return None
        # Be polite to Scryfall's rate limit before the rulings call.
        time.sleep(0.1)
        rulings = _fetch_rulings(client, raw.get("rulings_uri"))
        return map_scryfall_card(raw, rulings)
