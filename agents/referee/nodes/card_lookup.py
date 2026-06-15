"""Card lookup node — extract names and run the resolver ladder."""

from __future__ import annotations

from typing import Any

from agents.core.extract import extract_card_names
from agents.core.resolver import resolve_card
from agents.referee.state import RefereeState


def card_lookup_node(state: RefereeState) -> RefereeState:
    question = state["question"]
    card_names = extract_card_names(question)

    resolved_cards: list[dict[str, Any]] = []
    unresolved_notes: list[str] = []
    disambiguation: list[dict[str, Any]] = []

    for name in card_names:
        res = resolve_card(name)
        if res.status == "resolved" and res.card:
            resolved_cards.append(
                {
                    "query": name,
                    "method": res.method,
                    "confidence": res.confidence,
                    "card": res.card,
                }
            )
        elif res.status == "ambiguous":
            disambiguation.append(
                {
                    "query": name,
                    "candidates": [c.model_dump() for c in res.candidates],
                }
            )
        elif res.status == "rules_concept":
            unresolved_notes.append(
                f"{name!r} is a rules concept, not a card — skipped card lookup."
            )
        elif res.status == "not_found":
            unresolved_notes.append(f"Could not resolve card {name!r} — not found in mirror.")
        else:
            unresolved_notes.append(f"Could not resolve {name!r} ({res.status}).")

    update: RefereeState = {
        "card_names": card_names,
        "resolved_cards": resolved_cards,
        "unresolved_notes": unresolved_notes,
        "disambiguation": disambiguation,
    }
    if disambiguation:
        update["route"] = "disambiguate"
    return update
