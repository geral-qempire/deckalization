"""Phase 3 baseline A — zero-shot (model memory only, no retrieval)."""

from __future__ import annotations

from typing import TypedDict, cast

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from agents.baseline.prompts import ZERO_SHOT_SYSTEM
from agents.llm import get_chat_model
from agents.schemas import RulingResponse


class ZeroShotState(TypedDict):
    question: str
    ruling: RulingResponse | None


def _answer(state: ZeroShotState) -> ZeroShotState:
    llm = get_chat_model("adjudication").with_structured_output(RulingResponse)
    ruling = cast(
        RulingResponse,
        llm.invoke(
            [
                SystemMessage(content=ZERO_SHOT_SYSTEM),
                HumanMessage(content=state["question"]),
            ]
        ),
    )
    return {"question": state["question"], "ruling": ruling}


def build_zero_shot_graph():
    """Single-node graph: question → structured ruling (no tools)."""
    graph = StateGraph(ZeroShotState)
    graph.add_node("answer", _answer)
    graph.add_edge(START, "answer")
    graph.add_edge("answer", END)
    return graph.compile()
