"""Query-decomposition node (v2) — narrative question → focused CR search queries."""

from __future__ import annotations

from typing import cast

from langchain_core.messages import HumanMessage, SystemMessage

from agents.core.llm import get_chat_model
from agents.core.schemas import SubqueryDecomposition
from agents.referee.nodes.prompts import DECOMPOSE_SYSTEM
from agents.referee.state import RefereeState


def query_decompose_node(state: RefereeState) -> RefereeState:
    llm = get_chat_model("lookup").with_structured_output(SubqueryDecomposition)
    out = cast(
        SubqueryDecomposition,
        llm.invoke(
            [
                SystemMessage(content=DECOMPOSE_SYSTEM),
                HumanMessage(content=state["question"]),
            ]
        ),
    )
    subs = [q.strip() for q in out.queries if q and q.strip()][:4]
    return {"subqueries": subs}
