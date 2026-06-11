"""Triage/router node — classify intent and infer format."""

from __future__ import annotations

from typing import cast

from langchain_core.messages import HumanMessage, SystemMessage

from agents.llm import get_chat_model
from agents.nodes.prompts import ROUTER_SYSTEM
from agents.schemas import RouterDecision
from agents.state import RefereeState, RouteKind


def router_node(state: RefereeState) -> RefereeState:
    llm = get_chat_model("router").with_structured_output(RouterDecision)
    decision = cast(
        RouterDecision,
        llm.invoke(
            [
                SystemMessage(content=ROUTER_SYSTEM),
                HumanMessage(content=state["question"]),
            ]
        ),
    )

    route_map: dict[str, RouteKind] = {
        "rules": "rules",
        "out_of_scope": "out_of_scope",
        "needs_format": "needs_format",
    }
    return {
        "router_decision": decision,
        "route": route_map[decision.intent],
        "game_format": decision.game_format,
    }
