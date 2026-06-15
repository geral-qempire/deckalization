"""Patch node (v2) — minimally revise the draft to fix verifier-flagged issues.

Replaces the v1 "throw the draft away and re-draft from scratch with widened context"
behavior, which could turn a mostly-correct answer into a worse one. Here the adjudicator
edits its own draft, fixing only what the auditor flagged.
"""

from __future__ import annotations

from agents.core.context import format_cards_context, format_rules_context, ground_citations
from agents.referee.adjudicate import patch_then_format
from agents.referee.state import RefereeState


def patch_node(state: RefereeState) -> RefereeState:
    draft = state.get("draft_ruling")
    verdict = state.get("verdict")
    if draft is None:
        return {}

    cards_ctx = format_cards_context(state.get("resolved_cards") or [])
    rules_ctx = format_rules_context(state.get("retrieved_rules") or [])
    issues = list(verdict.issues) if verdict else []

    revised = patch_then_format(
        question=state["question"],
        draft=draft,
        issues=issues,
        cards_ctx=cards_ctx,
        rules_ctx=rules_ctx,
    )

    allowed_rules = {h["ruleNumber"] for h in state.get("retrieved_rules") or []}
    allowed_cards = {
        entry["card"]["name"].lower() for entry in (state.get("resolved_cards") or [])
    }
    revised = ground_citations(
        revised, allowed_rules=allowed_rules, allowed_cards=allowed_cards
    )
    return {"draft_ruling": revised}
