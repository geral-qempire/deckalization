"""Evaluators for Phase 5 — deterministic scorers + LLM judges.

Metric keys (shown in LangSmith experiments and local CLI):

  Answer quality (LLM judge, ``judge`` model role):
    correctness        — answer vs golden answer (1.0 / 0.5 / 0.0)
    faithfulness       — every claim in the answer is supported by the evidence
                         the system actually retrieved (retrieval targets only)

  Retrieval stage (deterministic, vs golden labels):
    card_recall        — golden cards that were resolved / golden cards
    card_precision     — resolved cards that are golden / resolved cards
    rule_recall        — golden expected rules present in retrieved context

  Answer citations (deterministic):
    citation_recall    — golden expected rules cited in the final answer
    citation_validity  — cited rule numbers exist in the Convex CR

  Card-resolution suite:
    card_resolution    — resolver ladder outcome
    abstention         — resolver abstains when it should

rule_recall vs citation_recall is the diagnostic split: a rule_recall miss is a
*retrieval* failure (the adjudicator never saw the rule); a citation_recall miss
with rule_recall hit is a *reasoning/citation* failure.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, cast

from langchain_core.messages import HumanMessage, SystemMessage
from langsmith.schemas import Example, Run
from pydantic import BaseModel, Field

from agents.core.llm import get_chat_model
from agents.core.schemas import RulingResponse
from agents.core.tools.convex_client import get_convex_client
from agents.evals.pipelines import RETRIEVAL_TARGETS, EvalRunResult, TargetName

# ---------------------------------------------------------------------------
# LLM judges
# ---------------------------------------------------------------------------

CORRECTNESS_SYSTEM = """\
You grade MTG rules answers for an offline evaluation harness (not model training).
Compare the actual answer to the expected reference answer for the same question.
Return score 1.0 if semantically equivalent and correct, 0.5 if partially correct,
0.0 if wrong or unrelated. Be strict on numeric outcomes and yes/no questions.
Grade only the final conclusion and its key reasoning — ignore differences in
style, length, or ordering.
"""

FAITHFULNESS_SYSTEM = """\
You audit MTG rules answers for grounding, for an offline evaluation harness.
You are given the EVIDENCE that was retrieved (card oracle text, official rulings,
and Comprehensive Rules excerpts) and the ANSWER produced from it.

Score how well the answer's factual claims are supported by the evidence:
  1.0 — every rules claim, card behavior, and citation is supported by the evidence
  0.5 — conclusion is supported but some supporting claims go beyond the evidence
  0.0 — key claims contradict the evidence or rely on facts not present in it

You are NOT grading whether the answer is correct — only whether it is grounded
in the provided evidence. General game knowledge (turn structure, basic terms) does
not need explicit support; specific rule contents, card texts, and interaction
outcomes do. List unsupported claims in the reason.
"""


class JudgeScore(BaseModel):
    # No ge/le constraints: Anthropic's structured-output API rejects JSON-schema
    # minimum/maximum on numbers. Clamped after parsing instead.
    score: float = Field(description="0.0, 0.5, or 1.0")
    reason: str = ""

    def clamped(self) -> JudgeScore:
        self.score = min(1.0, max(0.0, self.score))
        return self


def _judge_llm():
    return get_chat_model("judge").with_structured_output(JudgeScore)


def _ruling_text(ruling: RulingResponse) -> str:
    text = ruling.ruling
    if ruling.notes:
        text = f"{text}\n\nNotes: {ruling.notes}"
    return text


def judge_correctness(
    question: str, expected_answer: str, ruling: RulingResponse | None
) -> JudgeScore:
    if not ruling:
        return JudgeScore(score=0.0, reason="No ruling produced.")
    prompt = f"""Question: {question}

Expected reference answer: {expected_answer}

Actual answer: {_ruling_text(ruling)}
"""
    return cast(
        JudgeScore,
        _judge_llm().invoke(
            [SystemMessage(content=CORRECTNESS_SYSTEM), HumanMessage(content=prompt)]
        ),
    ).clamped()


def judge_faithfulness(
    question: str, ruling: RulingResponse | None, evidence: str
) -> JudgeScore:
    if not ruling:
        return JudgeScore(score=0.0, reason="No ruling produced.")
    if not evidence.strip():
        return JudgeScore(score=0.0, reason="No retrieved evidence captured.")
    prompt = f"""Question: {question}

=== EVIDENCE (retrieved context) ===
{evidence}

=== ANSWER ===
{_ruling_text(ruling)}
"""
    return cast(
        JudgeScore,
        _judge_llm().invoke(
            [SystemMessage(content=FAITHFULNESS_SYSTEM), HumanMessage(content=prompt)]
        ),
    ).clamped()


def score_correctness(
    question: str, expected_answer: str, ruling: RulingResponse | None
) -> float:
    return judge_correctness(question, expected_answer, ruling).score


# ---------------------------------------------------------------------------
# Deterministic retrieval metrics
# ---------------------------------------------------------------------------


def _rule_ok(cite: str, allowed: set[str]) -> bool:
    cite = cite.strip()
    if cite in allowed:
        return True
    return any(cite.startswith(r) or r.startswith(cite) for r in allowed)


def _norm_card(name: str) -> str:
    return name.strip().casefold()


def score_card_recall(expected_cards: list[str], resolved: list[str]) -> float | None:
    """Golden cards that the pipeline resolved. None when the case has no golden cards."""
    if not expected_cards:
        return None
    got = {_norm_card(n) for n in resolved}
    hits = sum(1 for c in expected_cards if _norm_card(c) in got)
    return hits / len(expected_cards)


def score_card_precision(expected_cards: list[str], resolved: list[str]) -> float | None:
    """Resolved cards that are golden — extra resolutions signal hallucinated lookups."""
    if not expected_cards or not resolved:
        return None
    want = {_norm_card(c) for c in expected_cards}
    hits = sum(1 for n in resolved if _norm_card(n) in want)
    return hits / len(resolved)


def score_rule_recall(expected_rules: list[str], retrieved: list[str]) -> float | None:
    """Golden rules present in the retrieved context (retrieval-stage recall)."""
    if not expected_rules:
        return None
    allowed = set(retrieved)
    hits = sum(1 for r in expected_rules if _rule_ok(r, allowed))
    return hits / len(expected_rules)


def score_citation_recall(
    ruling: RulingResponse | None, expected_rules: list[str]
) -> float | None:
    """Golden rules actually cited in the final answer (answer-stage recall)."""
    if not expected_rules:
        return None
    if not ruling or not ruling.rule_citations:
        return 0.0
    cited = {c.rule_number for c in ruling.rule_citations}
    hits = 0
    for exp in expected_rules:
        if any(_rule_ok(exp, {c}) or _rule_ok(c, {exp}) for c in cited):
            hits += 1
    return hits / len(expected_rules)


def score_citation_validity(ruling: RulingResponse | None) -> float:
    if not ruling or not ruling.rule_citations:
        return 1.0 if ruling else 0.0
    client = get_convex_client()
    ok = 0
    for c in ruling.rule_citations:
        row = client.query("queries:getRuleByNumber", {"ruleNumber": c.rule_number})
        if row:
            ok += 1
    return ok / len(ruling.rule_citations)


# ---------------------------------------------------------------------------
# Card-resolution suite
# ---------------------------------------------------------------------------


def score_card_resolution(case: dict[str, Any], run: EvalRunResult) -> float:
    exp_status = case.get("expectedStatus")
    if not exp_status or run.resolver_status is None:
        return 0.0
    if run.resolver_status != exp_status:
        return 0.0
    exp_name = case.get("expectedCardName")
    if exp_name and run.resolver_card_name:
        return 1.0 if run.resolver_card_name == exp_name else 0.5
    return 1.0


def score_abstention(case: dict[str, Any], run: EvalRunResult) -> float:
    exp = case.get("expectedStatus")
    if exp not in ("not_found", "rules_concept"):
        return 1.0
    return 1.0 if run.resolver_status == exp else 0.0


# ---------------------------------------------------------------------------
# Suite-level scoring (local CLI path)
# ---------------------------------------------------------------------------


def evaluate_rules_case(
    case: dict[str, Any],
    run: EvalRunResult,
    *,
    use_llm_judge: bool = True,
) -> dict[str, float]:
    ruling = run.ruling
    if run.error:
        return {"error": 0.0}

    expected_rules = case.get("expectedRules") or []
    expected_cards = case.get("cards") or []

    scores: dict[str, float] = {"citation_validity": score_citation_validity(ruling)}

    def put(key: str, val: float | None) -> None:
        if val is not None:
            scores[key] = val

    put("citation_recall", score_citation_recall(ruling, expected_rules))
    if run.target in RETRIEVAL_TARGETS:
        put("rule_recall", score_rule_recall(expected_rules, run.retrieved_rules))
        put("card_recall", score_card_recall(expected_cards, run.resolved_card_names))
        put(
            "card_precision",
            score_card_precision(expected_cards, run.resolved_card_names),
        )
        if use_llm_judge:
            scores["faithfulness"] = judge_faithfulness(
                case["question"], ruling, run.evidence
            ).score
    if use_llm_judge:
        scores["correctness"] = score_correctness(
            case["question"], case.get("expectedAnswer") or "", ruling
        )
    return scores


def evaluate_card_case(case: dict[str, Any], run: EvalRunResult) -> dict[str, float]:
    if run.error:
        return {"error": 0.0}
    return {
        "card_resolution": score_card_resolution(case, run),
        "abstention": score_abstention(case, run),
    }


def aggregate_scores(all_scores: list[dict[str, float]]) -> dict[str, float]:
    buckets: dict[str, list[float]] = {}
    for row in all_scores:
        for k, v in row.items():
            buckets.setdefault(k, []).append(v)
    return {k: sum(v) / len(v) for k, v in buckets.items() if k != "error"}


# ---------------------------------------------------------------------------
# LangSmith row evaluators
# ---------------------------------------------------------------------------


def _run_from_outputs(outputs: dict[str, Any], target: TargetName) -> EvalRunResult:
    ruling = None
    raw = outputs.get("ruling")
    if raw:
        ruling = RulingResponse.model_validate(raw)
    return EvalRunResult(
        target=target,
        case_id=outputs.get("case_id") or "",
        ruling=ruling,
        retrieved_rules=list(outputs.get("retrieved_rules") or []),
        resolved_card_names=list(outputs.get("resolved_card_names") or []),
        evidence=outputs.get("evidence") or "",
        resolver_status=outputs.get("resolver_status"),
        resolver_card_name=outputs.get("resolver_card_name"),
        error=outputs.get("error"),
    )


def _feedback(key: str, score: float | None, *, comment: str = "") -> dict[str, Any]:
    row: dict[str, Any] = {"key": key, "score": score}
    if comment:
        row["comment"] = comment
    return row


def langsmith_rules_evaluators(
    target: TargetName, *, use_llm_judge: bool = True
) -> list[Callable[..., dict[str, Any]]]:
    """Row evaluators for LangSmith client.evaluate() — rules Q&A suites.

    Evaluators may return score=None (e.g. no golden labels for the case);
    LangSmith skips None scores in aggregates.
    """

    def _expected_rules(example: Example) -> list[str]:
        return (example.outputs or {}).get("expected_rules") or []

    def _expected_cards(example: Example) -> list[str]:
        return (example.outputs or {}).get("cards") or []

    def correctness(run: Run, example: Example) -> dict[str, Any]:
        ref = example.outputs or {}
        inputs = example.inputs or {}
        res = _run_from_outputs(run.outputs or {}, target)
        js = judge_correctness(
            inputs.get("question") or "",
            ref.get("expected_answer") or "",
            res.ruling,
        )
        return _feedback("correctness", js.score, comment=js.reason)

    def faithfulness(run: Run, example: Example) -> dict[str, Any]:
        inputs = example.inputs or {}
        res = _run_from_outputs(run.outputs or {}, target)
        js = judge_faithfulness(inputs.get("question") or "", res.ruling, res.evidence)
        return _feedback("faithfulness", js.score, comment=js.reason)

    def card_recall(run: Run, example: Example) -> dict[str, Any]:
        expected = _expected_cards(example)
        res = _run_from_outputs(run.outputs or {}, target)
        return _feedback(
            "card_recall",
            score_card_recall(expected, res.resolved_card_names),
            comment=(
                f"expected: {', '.join(expected) or 'none'} | "
                f"resolved: {', '.join(res.resolved_card_names) or 'none'}"
            ),
        )

    def card_precision(run: Run, example: Example) -> dict[str, Any]:
        expected = _expected_cards(example)
        res = _run_from_outputs(run.outputs or {}, target)
        return _feedback(
            "card_precision",
            score_card_precision(expected, res.resolved_card_names),
            comment=f"resolved: {', '.join(res.resolved_card_names) or 'none'}",
        )

    def rule_recall(run: Run, example: Example) -> dict[str, Any]:
        expected = _expected_rules(example)
        res = _run_from_outputs(run.outputs or {}, target)
        return _feedback(
            "rule_recall",
            score_rule_recall(expected, res.retrieved_rules),
            comment=(
                f"expected: {', '.join(expected) or 'none'} | "
                f"{len(res.retrieved_rules)} rule(s) retrieved"
            ),
        )

    def citation_recall(run: Run, example: Example) -> dict[str, Any]:
        expected = _expected_rules(example)
        res = _run_from_outputs(run.outputs or {}, target)
        cited = [c.rule_number for c in res.ruling.rule_citations] if res.ruling else []
        return _feedback(
            "citation_recall",
            score_citation_recall(res.ruling, expected),
            comment=(
                f"expected: {', '.join(expected) or 'none'} | "
                f"cited: {', '.join(cited) or 'none'}"
            ),
        )

    def citation_validity(run: Run, example: Example) -> dict[str, Any]:
        res = _run_from_outputs(run.outputs or {}, target)
        n = len(res.ruling.rule_citations) if res.ruling else 0
        return _feedback(
            "citation_validity",
            score_citation_validity(res.ruling),
            comment=f"{n} rule citation(s) checked against the CR.",
        )

    evaluators: list[Callable[..., dict[str, Any]]] = [
        citation_validity,
        citation_recall,
    ]
    if target in RETRIEVAL_TARGETS:
        evaluators += [rule_recall, card_recall, card_precision]
        if use_llm_judge:
            evaluators.append(faithfulness)
    if use_llm_judge:
        evaluators.append(correctness)
    return evaluators


def langsmith_resolver_evaluators() -> list[Callable[..., dict[str, Any]]]:
    def card_resolution(run: Run, example: Example) -> dict[str, Any]:
        ref = example.outputs or {}
        case = {
            "expectedStatus": ref.get("expected_status"),
            "expectedCardName": ref.get("expected_card_name"),
        }
        res = _run_from_outputs(run.outputs or {}, "resolver")
        return _feedback(
            "card_resolution",
            score_card_resolution(case, res),
            comment=(
                f"expected={ref.get('expected_status')}/{ref.get('expected_card_name')} "
                f"got={res.resolver_status}/{res.resolver_card_name}"
            ),
        )

    def abstention(run: Run, example: Example) -> dict[str, Any]:
        ref = example.outputs or {}
        case = {"expectedStatus": ref.get("expected_status")}
        res = _run_from_outputs(run.outputs or {}, "resolver")
        return _feedback(
            "abstention",
            score_abstention(case, res),
            comment=f"expected_status={ref.get('expected_status')} got={res.resolver_status}",
        )

    return [card_resolution, abstention]
