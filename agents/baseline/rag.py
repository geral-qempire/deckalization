"""Phase 3 baseline B — single-chain RAG (resolve cards → retrieve rules → answer)."""

from __future__ import annotations

from typing import Any, TypedDict, cast

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from agents.baseline.extract import extract_card_names
from agents.baseline.prompts import RAG_SYSTEM
from agents.llm import get_chat_model
from agents.resolver import resolve_card
from agents.schemas import RulingResponse
from agents.tools.rules import search_rules


class RagState(TypedDict):
    question: str
    card_names: list[str]
    resolved_cards: list[dict[str, Any]]
    unresolved_notes: list[str]
    rule_hits: list[dict[str, Any]]
    ruling: RulingResponse | None


def _format_cards_context(cards: list[dict[str, Any]]) -> str:
    if not cards:
        return "(no cards resolved)"
    parts: list[str] = []
    for entry in cards:
        card = entry["card"]
        parts.append(
            f"- {card['name']} [{card.get('typeLine', '')}]\n"
            f"  Oracle: {(card.get('oracleText') or '').replace(chr(10), ' ')[:800]}\n"
            f"  Rulings ({len(card.get('rulings') or [])}): "
            + "; ".join(
                (r.get("comment") or "")[:120]
                for r in (card.get("rulings") or [])[:3]
            )
        )
    return "\n".join(parts)


def _format_rules_context(hits: list[dict[str, Any]]) -> str:
    if not hits:
        return "(no rules retrieved)"
    parts: list[str] = []
    for h in hits:
        parts.append(
            f"- CR {h['ruleNumber']} ({h.get('section', '')}, score={h.get('score', 0):.3f})\n"
            f"  {h['text'].replace(chr(10), ' ')[:500]}"
        )
    return "\n".join(parts)


def _ground_citations(
    ruling: RulingResponse,
    *,
    allowed_rules: set[str],
    allowed_cards: set[str],
) -> RulingResponse:
    """Drop citations not backed by retrieved context (RAG grounding guard)."""

    def rule_ok(cite: str) -> bool:
        cite = cite.strip()
        if cite in allowed_rules:
            return True
        return any(cite.startswith(r) or r.startswith(cite) for r in allowed_rules)

    ruling.rule_citations = [c for c in ruling.rule_citations if rule_ok(c.rule_number)]
    ruling.card_citations = [
        c for c in ruling.card_citations if c.name.lower() in allowed_cards
    ]
    return ruling


def _prepare(state: RagState) -> RagState:
    question = state["question"]
    card_names = extract_card_names(question)

    resolved_cards: list[dict[str, Any]] = []
    unresolved_notes: list[str] = []

    for name in card_names:
        res = resolve_card(name)
        if res.status == "resolved" and res.card:
            resolved_cards.append(
                {
                    "query": name,
                    "method": res.method,
                    "confidence": res.confidence,
                    "card": res.card,
                }
            )
        elif res.status == "ambiguous":
            cands = ", ".join(c.name for c in res.candidates[:5])
            unresolved_notes.append(f"Could not resolve {name!r} — ambiguous ({cands}).")
        elif res.status == "rules_concept":
            unresolved_notes.append(
                f"{name!r} is a rules concept, not a card — skipped card lookup."
            )
        elif res.status == "not_found":
            unresolved_notes.append(f"Could not resolve card {name!r} — not found in mirror.")
        else:
            unresolved_notes.append(f"Could not resolve {name!r} ({res.status}).")

    rule_hits = search_rules(question)

    return {
        "question": question,
        "card_names": card_names,
        "resolved_cards": resolved_cards,
        "unresolved_notes": unresolved_notes,
        "rule_hits": rule_hits,
        "ruling": None,
    }


def _answer(state: RagState) -> RagState:
    cards_ctx = _format_cards_context(state["resolved_cards"])
    rules_ctx = _format_rules_context(state["rule_hits"])
    unresolved = state["unresolved_notes"]
    unresolved_block = "\n".join(f"- {n}" for n in unresolved) if unresolved else "(none)"

    user_content = f"""Question:
{state["question"]}

--- Resolved cards ---
{cards_ctx}

--- Unresolved / skipped ---
{unresolved_block}

--- Retrieved Comprehensive Rules ---
{rules_ctx}
"""

    llm = get_chat_model("adjudication").with_structured_output(RulingResponse)
    ruling = cast(
        RulingResponse,
        llm.invoke(
            [SystemMessage(content=RAG_SYSTEM), HumanMessage(content=user_content)]
        ),
    )

    if unresolved and ruling.notes:
        ruling.notes = f"{ruling.notes}\n\nUnresolved: {'; '.join(unresolved)}"
    elif unresolved:
        ruling.notes = "Unresolved: " + "; ".join(unresolved)

    allowed_rules = {h["ruleNumber"] for h in state["rule_hits"]}
    allowed_cards = {
        entry["card"]["name"].lower() for entry in state["resolved_cards"]
    }
    ruling = _ground_citations(ruling, allowed_rules=allowed_rules, allowed_cards=allowed_cards)

    return {**state, "ruling": ruling}


def build_rag_graph():
    """Linear RAG graph: prepare (extract + resolve + retrieve) → answer."""
    graph = StateGraph(RagState)
    graph.add_node("prepare", _prepare)
    graph.add_node("answer", _answer)
    graph.add_edge(START, "prepare")
    graph.add_edge("prepare", "answer")
    graph.add_edge("answer", END)
    return graph.compile()
