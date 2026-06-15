"""Conditional-edge predicates shared by every referee graph version.

These functions decide the next node from the current state. Both the v1 and v2
graphs wire them into their `add_conditional_edges` calls, so they live here
rather than inside a single version's `graph.py`.
"""

from __future__ import annotations

from agents.core.config import get_settings
from agents.referee.state import RefereeState


def route_after_router(state: RefereeState) -> str:
    route = state.get("route", "rules")
    if route == "out_of_scope":
        return "out_of_scope"
    if route == "needs_format":
        return "formatter"
    return "card_lookup"


def route_after_lookup(state: RefereeState) -> str:
    if state.get("route") == "disambiguate":
        return "formatter"
    return "rules_retrieval"


def route_after_verifier(state: RefereeState) -> str:
    verdict = state.get("verdict")
    if verdict and verdict.verdict == "grounded":
        return "formatter"
    max_loops = get_settings().thresholds.max_verifier_loops
    if state.get("loop_count", 0) < max_loops:
        return "rules_retrieval"
    return "formatter"
