"""Schema smoke tests (no LLM calls)."""

from agents.core.schemas import CardNameExtraction, RulingResponse


def test_ruling_response_defaults() -> None:
    r = RulingResponse(ruling="Yes.")
    assert r.confidence == "medium"
    assert r.rule_citations == []


def test_card_name_extraction_empty() -> None:
    e = CardNameExtraction()
    assert e.card_names == []
