"""LangGraph state for the multi-agent referee (Phase 4)."""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from agents.schemas import RouterDecision, RulingResponse, VerifierVerdict

RouteKind = Literal[
    "pending",
    "rules",
    "out_of_scope",
    "needs_format",
    "disambiguate",
]


class RefereeState(TypedDict, total=False):
    """Graph state — field names mirror the build plan (`format` → `game_format` in Python)."""

    question: str
    game_format: str | None  # plan field: format
    rel: str | None  # v1.1 REL/tournament policy — reserved, always None in v1
    route: RouteKind
    card_names: list[str]
    resolved_cards: list[dict[str, Any]]
    unresolved_notes: list[str]
    disambiguation: list[dict[str, Any]]  # {query, candidates[]}
    retrieval_query: str
    retrieved_rules: list[dict[str, Any]]
    draft_ruling: RulingResponse | None
    verdict: VerifierVerdict | None
    loop_count: int
    final_response: RulingResponse | None
    router_decision: RouterDecision | None


def initial_state(question: str) -> RefereeState:
    """Default state for a new question."""
    return RefereeState(
        question=question,
        game_format=None,
        rel=None,
        route="pending",
        card_names=[],
        resolved_cards=[],
        unresolved_notes=[],
        disambiguation=[],
        retrieval_query=question,
        retrieved_rules=[],
        draft_ruling=None,
        verdict=None,
        loop_count=0,
        final_response=None,
        router_decision=None,
    )
