"""Adjudication v2 — two-stage reason→format draft, then deterministic grounding."""

from __future__ import annotations

from agents.core.context import format_cards_context, format_rules_context, ground_citations
from agents.referee.adjudicate import reason_then_format
from agents.referee.state import RefereeState


def adjudication_v2_node(state: RefereeState) -> RefereeState:
    cards_ctx = format_cards_context(state.get("resolved_cards") or [])
    rules_ctx = format_rules_context(state.get("retrieved_rules") or [])
    unresolved = state.get("unresolved_notes") or []
    unresolved_block = "\n".join(f"- {n}" for n in unresolved) if unresolved else "(none)"
    fmt = state.get("game_format")
    format_line = f"Format context: {fmt}" if fmt else "Format context: (not specified)"

    ruling = reason_then_format(
        question=state["question"],
        format_line=format_line,
        cards_ctx=cards_ctx,
        unresolved_block=unresolved_block,
        rules_ctx=rules_ctx,
    )

    allowed_rules = {h["ruleNumber"] for h in state.get("retrieved_rules") or []}
    allowed_cards = {
        entry["card"]["name"].lower() for entry in (state.get("resolved_cards") or [])
    }
    ruling = ground_citations(ruling, allowed_rules=allowed_rules, allowed_cards=allowed_cards)
    return {"draft_ruling": ruling}
