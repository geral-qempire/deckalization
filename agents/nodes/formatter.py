"""Formatter node — v1 pass-through; v1.1 adds player-friendly + REL policy tone."""

from __future__ import annotations

from agents.schemas import RulingResponse
from agents.state import RefereeState


def formatter_node(state: RefereeState) -> RefereeState:
    if state.get("final_response"):
        return {}

    # Disambiguation stop — return candidates, no ruling.
    if state.get("route") == "disambiguate" and state.get("disambiguation"):
        lines = ["I need you to clarify which card you mean:"]
        for item in state["disambiguation"]:
            cands = ", ".join(c["name"] for c in item.get("candidates", [])[:5])
            lines.append(f"  • {item['query']!r} → {cands or '(no candidates)'}")
        ruling = RulingResponse(
            ruling="\n".join(lines),
            confidence="low",
            notes="Ambiguous card name(s) — please specify the exact card.",
        )
        return {"final_response": ruling}

    # Format unknown — rare; note assumption and continue (v1 infers when possible).
    if state.get("route") == "needs_format":
        ruling = RulingResponse(
            ruling=(
                "Please specify the format (Standard, Commander, Modern, etc.) "
                "so I can answer accurately."
            ),
            confidence="low",
        )
        return {"final_response": ruling}

    draft = state.get("draft_ruling")
    if draft is None:
        ruling = RulingResponse(
            ruling="Unable to produce a ruling.",
            confidence="low",
        )
        return {"final_response": ruling}

    notes_parts: list[str] = []
    if draft.notes:
        notes_parts.append(draft.notes)
    if state.get("game_format"):
        notes_parts.append(f"Format context: {state['game_format']}.")
    unresolved = state.get("unresolved_notes") or []
    if unresolved:
        notes_parts.append("Unresolved: " + "; ".join(unresolved))

    verdict = state.get("verdict")
    if verdict and verdict.verdict == "ungrounded":
        from agents.config import get_settings

        max_loops = get_settings().thresholds.max_verifier_loops
        if state.get("loop_count", 0) >= max_loops:
            notes_parts.append(
                "Verifier could not fully ground this ruling after "
                f"{max_loops} re-retrieval attempt(s): "
                + "; ".join(verdict.issues[:3])
            )
            draft = draft.model_copy(update={"confidence": "low"})

    if notes_parts:
        draft = draft.model_copy(update={"notes": "\n\n".join(notes_parts)})

    return {"final_response": draft}
