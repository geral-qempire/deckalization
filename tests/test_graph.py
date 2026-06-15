"""Graph routing and verifier unit tests (no LLM)."""

from agents.core.context import ground_citations
from agents.core.schemas import RuleCitation, RulingResponse, VerifierVerdict
from agents.referee.routing import route_after_lookup, route_after_router, route_after_verifier
from agents.referee.state import RefereeState, initial_state


def test_route_out_of_scope() -> None:
    state: RefereeState = initial_state("best deck ever")
    state["route"] = "out_of_scope"
    assert route_after_router(state) == "out_of_scope"


def test_route_disambiguate_stops_before_retrieval() -> None:
    state: RefereeState = initial_state("which one?")
    state["route"] = "disambiguate"
    assert route_after_lookup(state) == "formatter"


def test_grounding_drops_fake_rule_citation() -> None:
    ruling = RulingResponse(
        ruling="Yes.",
        rule_citations=[
            RuleCitation(rule_number="702.2", excerpt="deathtouch", relevance=""),
            RuleCitation(rule_number="999.999", excerpt="fake", relevance=""),
        ],
    )
    grounded = ground_citations(
        ruling, allowed_rules={"702.2"}, allowed_cards=set()
    )
    cited = {c.rule_number for c in grounded.rule_citations}
    assert "702.2" in cited
    assert "999.999" not in cited


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
