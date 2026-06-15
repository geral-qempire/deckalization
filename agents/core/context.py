"""Format retrieved evidence and enforce citation grounding."""

from __future__ import annotations

from typing import Any

from agents.core.schemas import RulingResponse


def format_cards_context(cards: list[dict[str, Any]]) -> str:
    if not cards:
        return "(no cards resolved)"
    parts: list[str] = []
    for entry in cards:
        card = entry["card"]
        rulings = card.get("rulings") or []
        # Include ALL official rulings in full — they are written precisely to resolve
        # the interaction questions we're graded on. No count or length cap.
        ruling_lines = "".join(
            f"\n    • {(r.get('comment') or '').replace(chr(10), ' ')}" for r in rulings
        )
        pt = ""
        if card.get("power") is not None or card.get("toughness") is not None:
            pt = f" {card.get('power', '?')}/{card.get('toughness', '?')}"
        mana = f" {card['manaCost']}" if card.get("manaCost") else ""
        parts.append(
            f"- {card['name']}{mana} [{card.get('typeLine', '')}{pt}]\n"
            f"  Oracle: {(card.get('oracleText') or '').replace(chr(10), ' ')}\n"
            f"  Rulings ({len(rulings)}):{ruling_lines or ' (none)'}"
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
