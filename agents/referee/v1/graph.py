"""Multi-agent referee graph — router, lookup, retrieval, adjudication, verifier loop."""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from agents.referee.nodes.adjudication import adjudication_node
from agents.referee.nodes.card_lookup import card_lookup_node
from agents.referee.nodes.formatter import formatter_node
from agents.referee.nodes.out_of_scope import out_of_scope_node
from agents.referee.nodes.router import router_node
from agents.referee.nodes.rules_retrieval import rules_retrieval_node
from agents.referee.nodes.verifier import verifier_node
from agents.referee.routing import (
    route_after_lookup,
    route_after_router,
    route_after_verifier,
)
from agents.referee.state import RefereeState


def build_referee_graph(*, with_verifier: bool = True):
    """Compile the multi-agent referee graph.

    Args:
        with_verifier: when True (default) the full Phase 4 graph runs the verifier
            and its re-retrieval loop. When False the verifier subsystem is skipped
            (adjudication → formatter) — the ablation that isolates exactly what the
            verifier loop contributes vs. grounded RAG + router.
    """
    graph = StateGraph(RefereeState)

    graph.add_node("router", router_node)
    graph.add_node("card_lookup", card_lookup_node)
    graph.add_node("rules_retrieval", rules_retrieval_node)
    graph.add_node("adjudication", adjudication_node)
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

    if with_verifier:
        graph.add_node("verifier", verifier_node)
        graph.add_edge("adjudication", "verifier")
        graph.add_conditional_edges(
            "verifier",
            route_after_verifier,
            {"formatter": "formatter", "rules_retrieval": "rules_retrieval"},
        )
    else:
        graph.add_edge("adjudication", "formatter")

    graph.add_edge("out_of_scope", "formatter")
    graph.add_edge("formatter", END)

    return graph.compile()


def build_referee_no_verifier_graph():
    """Ablation entrypoint (for langgraph.json / Studio): referee without the verifier."""
    return build_referee_graph(with_verifier=False)
