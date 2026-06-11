"""Out-of-scope node — polite refusal."""

from __future__ import annotations

from agents.schemas import RulingResponse
from agents.state import RefereeState


def out_of_scope_node(state: RefereeState) -> RefereeState:
    rd = state.get("router_decision")
    reason = rd.reason if rd else ""
    ruling = RulingResponse(
        ruling=(
            "I can only answer Magic: The Gathering **rules** questions "
            "(interactions, timing, keywords, etc.). "
            "Your question appears to be outside that scope."
        ),
        confidence="low",
        notes=reason or None,
    )
    return {"final_response": ruling, "draft_ruling": ruling}
