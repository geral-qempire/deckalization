"""Referee v2 — improved architecture.

Changes vs. the v1 referee (`agents/referee/v1/graph.py`, kept intact for comparison):
  #1 generous card rulings in context (see agents/core/context.py)
  #2 two-stage reason→format adjudication (agents/referee/nodes/adjudication_v2.py)
  #3 verifier loop *patches* the draft instead of re-drafting from scratch (patch node)
  #4 query decomposition + cross-reference expansion in retrieval (v2 retrieval node)

Flow:
    router → card_lookup → decompose → rules_retrieval_v2 → adjudication_v2 → verifier
    verifier --ungrounded--> rules_retrieval_v2 → (draft exists) patch → verifier
    verifier --grounded/exhausted--> formatter
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from agents.referee.nodes.adjudication_v2 import adjudication_v2_node
from agents.referee.nodes.card_lookup import card_lookup_node
from agents.referee.nodes.decompose import query_decompose_node
from agents.referee.nodes.formatter import formatter_node
from agents.referee.nodes.out_of_scope import out_of_scope_node
from agents.referee.nodes.patch import patch_node
from agents.referee.nodes.router import router_node
from agents.referee.nodes.rules_retrieval_v2 import rules_retrieval_v2_node
from agents.referee.nodes.verifier import verifier_node
from agents.referee.routing import (
    route_after_lookup,
    route_after_router,
    route_after_verifier,
)
from agents.referee.state import RefereeState


def route_after_retrieval(state: RefereeState) -> str:
    """First pass (no draft yet) adjudicates; retries patch the existing draft."""
    return "patch" if state.get("draft_ruling") is not None else "adjudication"


def build_referee_v2_graph():
    graph = StateGraph(RefereeState)

    graph.add_node("router", router_node)
    graph.add_node("card_lookup", card_lookup_node)
    graph.add_node("decompose", query_decompose_node)
    graph.add_node("rules_retrieval", rules_retrieval_v2_node)
    graph.add_node("adjudication", adjudication_v2_node)
    graph.add_node("patch", patch_node)
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
        {"formatter": "formatter", "rules_retrieval": "decompose"},
    )
    graph.add_edge("decompose", "rules_retrieval")
    graph.add_conditional_edges(
        "rules_retrieval",
        route_after_retrieval,
        {"adjudication": "adjudication", "patch": "patch"},
    )
    graph.add_edge("adjudication", "verifier")
    graph.add_edge("patch", "verifier")
    graph.add_conditional_edges(
        "verifier",
        route_after_verifier,
        {"formatter": "formatter", "rules_retrieval": "rules_retrieval"},
    )
    graph.add_edge("out_of_scope", "formatter")
    graph.add_edge("formatter", END)

    return graph.compile()
