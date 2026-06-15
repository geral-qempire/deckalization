"""Adjudication node — draft a grounded ruling from retrieved evidence."""

from __future__ import annotations

from typing import cast

from langchain_core.messages import HumanMessage, SystemMessage

from agents.core.context import format_cards_context, format_rules_context, ground_citations
from agents.core.llm import get_chat_model
from agents.core.prompts import GROUNDED_ADJUDICATION_SYSTEM
from agents.core.schemas import RulingResponse
from agents.referee.state import RefereeState


def adjudication_node(state: RefereeState) -> RefereeState:
    cards_ctx = format_cards_context(state.get("resolved_cards") or [])
    rules_ctx = format_rules_context(state.get("retrieved_rules") or [])
    unresolved = state.get("unresolved_notes") or []
    unresolved_block = "\n".join(f"- {n}" for n in unresolved) if unresolved else "(none)"
    fmt = state.get("game_format")
    format_line = f"Format context: {fmt}" if fmt else "Format context: (not specified)"

    user_content = f"""Question:
{state["question"]}
{format_line}

--- Resolved cards ---
{cards_ctx}

--- Unresolved / skipped ---
{unresolved_block}

--- Retrieved Comprehensive Rules ---
{rules_ctx}
"""

    llm = get_chat_model("adjudication").with_structured_output(RulingResponse)
    ruling = cast(
        RulingResponse,
        llm.invoke(
            [
                SystemMessage(content=GROUNDED_ADJUDICATION_SYSTEM),
                HumanMessage(content=user_content),
            ]
        ),
    )

    allowed_rules = {h["ruleNumber"] for h in state.get("retrieved_rules") or []}
    allowed_cards = {
        entry["card"]["name"].lower() for entry in (state.get("resolved_cards") or [])
    }
    ruling = ground_citations(ruling, allowed_rules=allowed_rules, allowed_cards=allowed_cards)

    return {"draft_ruling": ruling}
