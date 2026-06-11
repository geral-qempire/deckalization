"""Multi-agent referee graph — router, lookup, retrieval, adjudication, verifier loop."""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from agents.config import get_settings
from agents.nodes.adjudication import adjudication_node
from agents.nodes.card_lookup import card_lookup_node
from agents.nodes.formatter import formatter_node
from agents.nodes.out_of_scope import out_of_scope_node
from agents.nodes.router import router_node
from agents.nodes.rules_retrieval import rules_retrieval_node
from agents.nodes.verifier import verifier_node
from agents.state import RefereeState


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


def build_referee_graph():
    """Compile the Phase 4 multi-agent referee graph."""
    graph = StateGraph(RefereeState)

    graph.add_node("router", router_node)
    graph.add_node("card_lookup", card_lookup_node)
    graph.add_node("rules_retrieval", rules_retrieval_node)
    graph.add_node("adjudication", adjudication_node)
    graph.add_node("verifier", verifier_node)
    graph.add_node("out_of_scope", out_of_scope_node)
    graph.add_node("formatter", formatter_node)

    graph.add_edge(START, "router")
    graph.add_conditional_edges(
        "router",
        route_after_router,
        {
            "out_of_scope": "out_of_scope",
            "formatter": "formatter",
            "card_lookup": "card_lookup",
        },
    )
    graph.add_conditional_edges(
        "card_lookup",
        route_after_lookup,
        {"formatter": "formatter", "rules_retrieval": "rules_retrieval"},
    )
    graph.add_edge("rules_retrieval", "adjudication")
    graph.add_edge("adjudication", "verifier")
    graph.add_conditional_edges(
        "verifier",
        route_after_verifier,
        {"formatter": "formatter", "rules_retrieval": "rules_retrieval"},
    )
    graph.add_edge("out_of_scope", "formatter")
    graph.add_edge("formatter", END)

    return graph.compile()
