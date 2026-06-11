"""Verifier/critic node — check draft ruling against evidence."""

from __future__ import annotations

from typing import cast

from langchain_core.messages import HumanMessage, SystemMessage

from agents.context import format_cards_context, format_rules_context
from agents.llm import get_chat_model
from agents.nodes.prompts import VERIFIER_SYSTEM
from agents.schemas import VerifierVerdict
from agents.state import RefereeState


def _deterministic_issues(state: RefereeState) -> list[str]:
    """Fast checks before/alongside the LLM verifier."""
    issues: list[str] = []
    draft = state.get("draft_ruling")
    if draft is None:
        return ["No draft ruling to verify."]

    allowed_rules = {h["ruleNumber"] for h in state.get("retrieved_rules") or []}
    allowed_cards = {
        entry["card"]["name"].lower() for entry in (state.get("resolved_cards") or [])
    }

    for cite in draft.rule_citations:
        rn = cite.rule_number.strip()
        if not any(rn == r or rn.startswith(r) or r.startswith(rn) for r in allowed_rules):
            issues.append(f"Cited CR {rn} not in retrieved rules context.")

    for card_cite in draft.card_citations:
        if card_cite.name.lower() not in allowed_cards:
            issues.append(f"Cited card {card_cite.name!r} not among resolved cards.")

    return issues


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
    llm_verdict = cast(
        VerifierVerdict,
        llm.invoke(
            [SystemMessage(content=VERIFIER_SYSTEM), HumanMessage(content=user_content)]
        ),
    )

    det_issues = _deterministic_issues(state)
    if det_issues:
        merged_issues = list(dict.fromkeys([*det_issues, *llm_verdict.issues]))
        hints = llm_verdict.retrieval_hints or [state["question"]]
        return {
            "verdict": VerifierVerdict(
                verdict="ungrounded",
                issues=merged_issues,
                retrieval_hints=hints,
            )
        }

    return {"verdict": llm_verdict}
