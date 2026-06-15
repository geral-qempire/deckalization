"""Run eval targets and capture outputs + metadata for scorers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from agents.baseline.rag import build_rag_graph
from agents.baseline.zero_shot import build_zero_shot_graph
from agents.core.context import format_cards_context, format_rules_context
from agents.core.resolver import resolve_card
from agents.core.schemas import RulingResponse
from agents.core.tracing import referee_run_config, run_config
from agents.referee.state import initial_state
from agents.referee.v1.graph import build_referee_graph
from agents.referee.v2.graph import build_referee_v2_graph

TargetName = Literal[
    "zero_shot",
    "baseline_rag",
    "referee",
    "referee_no_verifier",
    "referee_v2",
    "resolver",
]

# Targets that retrieve rules context (so faithfulness applies).
RETRIEVAL_TARGETS = ("baseline_rag", "referee", "referee_no_verifier", "referee_v2")

# Short tags for LangSmith filters (target:0shot, target:rag, target:referee).
TARGET_TRACE_TAG: dict[TargetName, str] = {
    "zero_shot": "0shot",
    "baseline_rag": "rag",
    "referee": "referee",
    "referee_no_verifier": "referee_nv",
    "referee_v2": "referee_v2",
    "resolver": "resolver",
}


def target_trace_tag(target: TargetName) -> str:
    return TARGET_TRACE_TAG[target]


@dataclass
class EvalRunResult:
    target: TargetName
    case_id: str
    ruling: RulingResponse | None = None
    retrieved_rules: list[str] = field(default_factory=list)
    resolved_card_names: list[str] = field(default_factory=list)
    # Exact formatted context the adjudicator saw (cards + rules) — the evidence
    # the faithfulness judge grades against.
    evidence: str = ""
    resolver_status: str | None = None
    resolver_card_name: str | None = None
    error: str | None = None


def _evidence_text(cards: list[dict], hits: list[dict]) -> str:
    return (
        f"--- Resolved cards (oracle text + official rulings) ---\n"
        f"{format_cards_context(cards)}\n\n"
        f"--- Retrieved Comprehensive Rules ---\n"
        f"{format_rules_context(hits)}"
    )


def run_target(
    target: TargetName,
    *,
    case_id: str,
    question: str,
    trace: bool = False,
) -> EvalRunResult:
    try:
        if target == "resolver":
            res = resolve_card(question)
            return EvalRunResult(
                target=target,
                case_id=case_id,
                resolver_status=res.status,
                resolver_card_name=res.card["name"] if res.card else None,
            )

        config = None
        if trace:
            if target in ("referee", "referee_no_verifier", "referee_v2"):
                config = referee_run_config(
                    question=question,
                    question_id=case_id,
                    extra_tags=[f"variant:{target_trace_tag(target)}"],
                )
            else:
                config = run_config(
                    baseline=target_trace_tag(target),
                    question=question,
                    question_id=case_id,
                    phase="5",
                )

        if target == "zero_shot":
            app = build_zero_shot_graph()
            out = app.invoke({"question": question, "ruling": None}, config=config or {})
            ruling = out.get("ruling")
            return EvalRunResult(target=target, case_id=case_id, ruling=ruling)

        if target == "baseline_rag":
            app = build_rag_graph()
            out = app.invoke(
                {
                    "question": question,
                    "card_names": [],
                    "resolved_cards": [],
                    "unresolved_notes": [],
                    "rule_hits": [],
                    "ruling": None,
                },
                config=config or {},
            )
            hits = out.get("rule_hits") or []
            cards = out.get("resolved_cards") or []
            return EvalRunResult(
                target=target,
                case_id=case_id,
                ruling=out.get("ruling"),
                retrieved_rules=[h["ruleNumber"] for h in hits],
                resolved_card_names=[c["card"]["name"] for c in cards],
                evidence=_evidence_text(cards, hits),
            )

        if target in ("referee", "referee_no_verifier", "referee_v2"):
            if target == "referee_v2":
                app = build_referee_v2_graph()
            else:
                app = build_referee_graph(with_verifier=(target == "referee"))
            out = app.invoke(initial_state(question), config=config or {})
            hits = out.get("retrieved_rules") or []
            cards = out.get("resolved_cards") or []
            return EvalRunResult(
                target=target,
                case_id=case_id,
                ruling=out.get("final_response"),
                retrieved_rules=[h["ruleNumber"] for h in hits],
                resolved_card_names=[c["card"]["name"] for c in cards],
                evidence=_evidence_text(cards, hits),
            )

        raise ValueError(f"Unknown target: {target}")
    except Exception as exc:
        return EvalRunResult(target=target, case_id=case_id, error=str(exc))
