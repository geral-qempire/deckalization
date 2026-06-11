"""Graph routing and verifier unit tests (no LLM)."""

from agents.graph import route_after_lookup, route_after_router, route_after_verifier
from agents.nodes.verifier import _deterministic_issues
from agents.schemas import RuleCitation, RulingResponse, VerifierVerdict
from agents.state import RefereeState, initial_state


def test_route_out_of_scope() -> None:
    state: RefereeState = initial_state("best deck ever")
    state["route"] = "out_of_scope"
    assert route_after_router(state) == "out_of_scope"


def test_route_disambiguate_stops_before_retrieval() -> None:
    state: RefereeState = initial_state("which one?")
    state["route"] = "disambiguate"
    assert route_after_lookup(state) == "formatter"


def test_verifier_catches_fake_rule_citation() -> None:
    state: RefereeState = initial_state("test")
    state["retrieved_rules"] = [{"ruleNumber": "702.2", "text": "deathtouch", "score": 0.9}]
    state["draft_ruling"] = RulingResponse(
        ruling="Yes.",
        rule_citations=[
            RuleCitation(rule_number="999.999", excerpt="fake", relevance=""),
        ],
    )
    issues = _deterministic_issues(state)
    assert any("999.999" in i for i in issues)


def test_verifier_loop_when_ungrounded() -> None:
    state: RefereeState = initial_state("test")
    state["loop_count"] = 0
    state["verdict"] = VerifierVerdict(verdict="ungrounded", issues=["missing context"])
    assert route_after_verifier(state) == "rules_retrieval"

    state["loop_count"] = 2
    assert route_after_verifier(state) == "formatter"


def test_verifier_accepts_grounded() -> None:
    state: RefereeState = initial_state("test")
    state["verdict"] = VerifierVerdict(verdict="grounded")
    assert route_after_verifier(state) == "formatter"
