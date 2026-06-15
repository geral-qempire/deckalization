"""Resolver fixtures — typo / nickname / made-up / real / rules-concept.

These run against the live dev Convex deployment (and Scryfall for the fallback),
so they're skipped when CONVEX_URL / OPENROUTER_API_KEY aren't configured (e.g.
a bare CI checkout without secrets). Phase 6 wires the secrets for CI.
"""

from __future__ import annotations

import pytest
from agents.core.config import get_settings
from agents.core.normalize import normalize_name

_settings = get_settings()
pytestmark = pytest.mark.skipif(
    not _settings.convex_url or not _settings.openrouter_api_key,
    reason="needs CONVEX_URL + OPENROUTER_API_KEY (live data layer)",
)


def test_real_hit() -> None:
    from agents.core.resolver import resolve_card

    res = resolve_card("Lightning Bolt")
    assert res.status == "resolved"
    assert res.card is not None
    assert normalize_name(res.card["name"]) == "lightning bolt"
    # Must resolve to the real instant, not a token / art card.
    assert "Instant" in res.card["typeLine"]


def test_typo_resolves() -> None:
    from agents.core.resolver import resolve_card

    res = resolve_card("Lightnig Bolt")
    assert res.status == "resolved"
    assert res.card is not None
    assert normalize_name(res.card["name"]) == "lightning bolt"


def test_nickname_resolves() -> None:
    from agents.core.resolver import resolve_card

    res = resolve_card("Bob")
    assert res.status == "resolved"
    assert res.card is not None
    assert res.card["name"] == "Dark Confidant"


def test_made_up_abstains() -> None:
    from agents.core.resolver import resolve_card

    res = resolve_card("Qwertyuiop Notarealcard Xyzzy")
    assert res.status == "not_found"
    assert res.card is None


def test_rules_concept_routed() -> None:
    from agents.core.resolver import resolve_card

    res = resolve_card("Treasure token")
    assert res.status == "rules_concept"


def test_search_rules_relevance() -> None:
    from agents.core.tools.rules import search_rules

    hits = search_rules("combat damage assignment order between blockers", limit=8)
    assert hits
    # The combat-damage rules live in section 510.
    assert any(h["ruleNumber"].startswith("510") for h in hits)
