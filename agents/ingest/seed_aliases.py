"""Seed the `aliases` table from a curated nickname list.

Each nickname maps to a canonical card name; we resolve the card's oracleId via
the local mirror (so aliases always point at a real row) and skip any that don't
resolve. Run AFTER the card mirror is populated:

    uv run python -m agents.ingest.seed_aliases
"""

from __future__ import annotations

from agents.core.config import get_settings
from agents.core.normalize import normalize_name
from agents.core.tools.cards import get_card_exact
from agents.core.tools.convex_client import get_convex_client

# nickname -> canonical card name (unambiguous community nicknames only).
ALIASES: dict[str, str] = {
    "bob": "Dark Confidant",
    "goyf": "Tarmogoyf",
    "tarmo": "Tarmogoyf",
    "snappy": "Snapcaster Mage",
    "bolt": "Lightning Bolt",
    "jtms": "Jace, the Mind Sculptor",
    "sad robot": "Solemn Simulacrum",
    "wrath": "Wrath of God",
    "mom": "Mother of Runes",
    "swords": "Swords to Plowshares",
    "path": "Path to Exile",
    "fow": "Force of Will",
    "ragavan": "Ragavan, Nimble Pilferer",
    "uro": "Uro, Titan of Nature's Wrath",
    "oko": "Oko, Thief of Crowns",
    "murktide": "Murktide Regent",
    "drc": "Dragon's Rage Channeler",
    "bloodbraid": "Bloodbraid Elf",
    "bowmasters": "Orcish Bowmasters",
    "nadu": "Nadu, Winged Wisdom",
    "esper sentinel": "Esper Sentinel",
    "the one ring": "The One Ring",
}


def main() -> None:
    settings = get_settings()
    if not settings.convex_url:
        raise SystemExit("CONVEX_URL not set (run `npx convex dev` first).")

    client = get_convex_client()
    seeded = skipped = 0
    for nickname, canonical in ALIASES.items():
        card = get_card_exact(normalize_name(canonical))
        if not card:
            print(f"  skip (card not found): {nickname!r} -> {canonical!r}")
            skipped += 1
            continue
        client.mutation(
            "aliases:upsert",
            {
                "alias": nickname,
                "normalizedAlias": normalize_name(nickname),
                "oracleId": card["oracleId"],
                "canonicalName": card["name"],
            },
        )
        seeded += 1

    print(f"Seeded {seeded} aliases, skipped {skipped}.")


if __name__ == "__main__":
    main()
