"""Verifier/critic node — semantic grounding check on the draft ruling.

Citation *existence* in the retrieved context is already guaranteed deterministically
by ``ground_citations`` in the adjudication node, so the verifier's job is the part
that determinism can't do: catch unsupported claims, misquotes, and fabricated
reasoning, and propose retrieval hints to fill gaps.
"""

from __future__ import annotations

from typing import cast

from langchain_core.messages import HumanMessage, SystemMessage

from agents.core.context import format_cards_context, format_rules_context
from agents.core.llm import get_chat_model
from agents.core.schemas import VerifierVerdict
from agents.referee.nodes.prompts import VERIFIER_SYSTEM
from agents.referee.state import RefereeState


def verifier_node(state: RefereeState) -> RefereeState:
    draft = state.get("draft_ruling")
    if draft is None:
        return {
            "verdict": VerifierVerdict(
                verdict="ungrounded",
                issues=["No draft ruling produced."],
                retrieval_hints=[state["question"]],
            )
        }

    cards_ctx = format_cards_context(state.get("resolved_cards") or [])
    rules_ctx = format_rules_context(state.get("retrieved_rules") or [])

    user_content = f"""Question: {state["question"]}

--- Draft ruling ---
{draft.ruling}

Rule citations: {[c.rule_number for c in draft.rule_citations]}
Card citations: {[c.name for c in draft.card_citations]}

--- Evidence: resolved cards ---
{cards_ctx}

--- Evidence: retrieved rules ---
{rules_ctx}
"""

    llm = get_chat_model("verifier").with_structured_output(VerifierVerdict)
    verdict = cast(
        VerifierVerdict,
        llm.invoke(
            [SystemMessage(content=VERIFIER_SYSTEM), HumanMessage(content=user_content)]
        ),
    )
    return {"verdict": verdict}
