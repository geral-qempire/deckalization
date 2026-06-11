"""Card resolution ladder: turn a (possibly messy) card name into a real DB row.

Ladder (cheap → expensive, stop at first confident hit):
    exact (normalized) → alias → fuzzy/full-text → Scryfall fuzzy fallback → not_found

Guarantees the "no row, no ruling" rule: a resolved result always carries a real
card row (from the mirror, or cached from Scryfall). Returns candidates + a
confidence score so the graph can branch: use / disambiguate / abstain. Names
that are really rules concepts (e.g. "Treasure token") are flagged so the graph
routes them to rules retrieval instead of card lookup.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field
from rapidfuzz import fuzz

from agents.config import get_settings
from agents.normalize import normalize_name
from agents.scryfall import fuzzy_named
from agents.tools.cards import (
    get_alias,
    get_card_by_oracle_id,
    get_cards_by_normalized_name,
    is_playable,
    search_cards_by_name,
    upsert_card,
)

# Common rules concepts that look like card names but aren't cards.
RULES_CONCEPTS = frozenset(
    {
        "treasure",
        "treasure token",
        "food",
        "food token",
        "clue",
        "clue token",
        "blood",
        "blood token",
        "gold",
        "gold token",
        "saproling",
        "the monarch",
        "monarch",
        "the ring",
        "the initiative",
        "energy",
        "experience counter",
        "city s blessing",
        "the city s blessing",
        "day",
        "night",
        "poison",
        "poison counter",
    }
)

ResolutionStatus = Literal["resolved", "ambiguous", "not_found", "rules_concept"]


class CandidateCard(BaseModel):
    oracleId: str
    name: str
    typeLine: str = ""


class Resolution(BaseModel):
    """Structured resolver output the graph branches on."""

    query: str
    status: ResolutionStatus
    method: str = "none"
    confidence: float = 0.0
    card: dict[str, Any] | None = None
    candidates: list[CandidateCard] = Field(default_factory=list)
    reason: str = ""


def _to_candidate(row: dict[str, Any]) -> CandidateCard:
    return CandidateCard(
        oracleId=row.get("oracleId", ""),
        name=row.get("name", ""),
        typeLine=row.get("typeLine", ""),
    )


def _canonical_sort_key(card: dict[str, Any]) -> tuple[int, int, int]:
    """Higher is more canonical: prefer playable, then more rulings, longer text."""
    return (
        1 if is_playable(card) else 0,
        len(card.get("rulings") or []),
        len(card.get("oracleText") or ""),
    )


def _select_exact(name: str, rows: list[dict[str, Any]]) -> Resolution:
    ranked = sorted(rows, key=_canonical_sort_key, reverse=True)
    best = ranked[0]
    playable = [r for r in ranked if is_playable(r)]
    # Genuine ambiguity: 2+ distinct playable cards with different oracle text.
    if len({r.get("oracleText", "") for r in playable}) > 1:
        return Resolution(
            query=name,
            status="ambiguous",
            method="exact",
            confidence=0.7,
            candidates=[_to_candidate(r) for r in playable[:5]],
            reason="Multiple distinct cards share this exact name.",
        )
    return Resolution(
        query=name,
        status="resolved",
        method="exact",
        confidence=1.0 if len(rows) == 1 else 0.95,
        card=best,
        reason="Exact normalized-name match.",
    )


def resolve_card(name: str) -> Resolution:
    settings = get_settings()
    high = settings.thresholds.resolver_high_confidence
    low = settings.thresholds.resolver_min_confidence
    norm = normalize_name(name)

    if not norm:
        return Resolution(query=name, status="not_found", reason="Empty name.")

    if norm in RULES_CONCEPTS:
        return Resolution(
            query=name,
            status="rules_concept",
            method="concept",
            reason="Name is a rules concept, not a card — route to rules retrieval.",
        )

    # 1) Exact normalized-name match.
    rows = get_cards_by_normalized_name(norm)
    if rows:
        return _select_exact(name, rows)

    # 2) Community-nickname alias.
    alias = get_alias(norm)
    if alias:
        card = get_card_by_oracle_id(alias["oracleId"])
        if card:
            return Resolution(
                query=name,
                status="resolved",
                method="alias",
                confidence=0.97,
                card=card,
                reason=f"Nickname for {alias.get('canonicalName', card.get('name'))}.",
            )

    # 3) Fuzzy / full-text. Pull a deep candidate set: Convex full-text ranks by
    # BM25 relevance, which can push the true card (under a typo) past the top
    # few; rapidfuzz then re-ranks by edit distance to the full name.
    candidates = search_cards_by_name(name, limit=40)
    if candidates:
        scored = sorted(
            (
                (
                    fuzz.WRatio(norm, c.get("normalizedName", "")) / 100.0
                    - (0.0 if is_playable(c) else 0.08),
                    c,
                )
                for c in candidates
            ),
            key=lambda t: t[0],
            reverse=True,
        )
        best_score, best = scored[0]
        gap = best_score - (scored[1][0] if len(scored) > 1 else 0.0)
        if best_score >= high and (len(scored) == 1 or gap >= 0.05):
            card = get_card_by_oracle_id(best["oracleId"])
            if card:
                return Resolution(
                    query=name,
                    status="resolved",
                    method="fuzzy",
                    confidence=round(best_score, 3),
                    card=card,
                    reason="Confident fuzzy name match.",
                )
        if best_score >= low:
            return Resolution(
                query=name,
                status="ambiguous",
                method="fuzzy",
                confidence=round(best_score, 3),
                candidates=[_to_candidate(c) for _, c in scored[:5]],
                reason="Several plausible cards — ask to disambiguate.",
            )

    # 4) Scryfall fuzzy fallback (covers cards newer than the last bulk refresh).
    scry = fuzzy_named(name)
    if scry and scry.get("oracleId"):
        upsert_card(scry)  # self-heal the mirror
        card = get_card_by_oracle_id(scry["oracleId"]) or scry
        return Resolution(
            query=name,
            status="resolved",
            method="scryfall",
            confidence=0.9,
            card=card,
            reason="Resolved via Scryfall fuzzy API and cached locally.",
        )

    # 5) Abstain.
    return Resolution(
        query=name,
        status="not_found",
        confidence=0.0,
        reason="No real card matched — abstain or ask.",
    )
