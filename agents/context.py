"""Format retrieved evidence and enforce citation grounding."""

from __future__ import annotations

from typing import Any

from agents.schemas import RulingResponse


def format_cards_context(cards: list[dict[str, Any]]) -> str:
    if not cards:
        return "(no cards resolved)"
    parts: list[str] = []
    for entry in cards:
        card = entry["card"]
        parts.append(
            f"- {card['name']} [{card.get('typeLine', '')}]\n"
            f"  Oracle: {(card.get('oracleText') or '').replace(chr(10), ' ')[:800]}\n"
            f"  Rulings ({len(card.get('rulings') or [])}): "
            + "; ".join(
                (r.get("comment") or "")[:120]
                for r in (card.get("rulings") or [])[:3]
            )
        )
    return "\n".join(parts)


def format_rules_context(hits: list[dict[str, Any]]) -> str:
    if not hits:
        return "(no rules retrieved)"
    parts: list[str] = []
    for h in hits:
        parts.append(
            f"- CR {h['ruleNumber']} ({h.get('section', '')}, score={h.get('score', 0):.3f})\n"
            f"  {h['text'].replace(chr(10), ' ')[:500]}"
        )
    return "\n".join(parts)


def ground_citations(
    ruling: RulingResponse,
    *,
    allowed_rules: set[str],
    allowed_cards: set[str],
) -> RulingResponse:
    """Drop citations not backed by retrieved context."""

    def rule_ok(cite: str) -> bool:
        cite = cite.strip()
        if cite in allowed_rules:
            return True
        return any(cite.startswith(r) or r.startswith(cite) for r in allowed_rules)

    ruling.rule_citations = [c for c in ruling.rule_citations if rule_ok(c.rule_number)]
    ruling.card_citations = [
        c for c in ruling.card_citations if c.name.lower() in allowed_cards
    ]
    return ruling
