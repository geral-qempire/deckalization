"""Shared structured output schemas for ruling responses."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class RuleCitation(BaseModel):
    rule_number: str = Field(description="Comprehensive Rules citation, e.g. '702.2' or '510.1c'.")
    excerpt: str = Field(description="Short quoted or paraphrased excerpt supporting the ruling.")
    relevance: str = Field(default="", description="Why this rule applies to the question.")


class CardCitation(BaseModel):
    name: str
    oracle_excerpt: str = Field(description="Relevant oracle text snippet from the card.")
    relevance: str = Field(default="", description="Why this card text matters.")


class RulingResponse(BaseModel):
    """Structured referee answer — shared by zero-shot and RAG baselines."""

    ruling: str = Field(description="Plain-language answer to the rules question.")
    rule_citations: list[RuleCitation] = Field(default_factory=list)
    card_citations: list[CardCitation] = Field(default_factory=list)
    confidence: Literal["high", "medium", "low"] = "medium"
    notes: str | None = Field(
        default=None,
        description="Caveats, ambiguity, or unresolved cards (RAG baseline).",
    )


class SubqueryDecomposition(BaseModel):
    """Targeted CR search queries decomposed from a narrative question (v2 retrieval)."""

    queries: list[str] = Field(
        default_factory=list,
        description="2-4 focused rules-search queries covering the question's sub-issues.",
    )


class CardNameExtraction(BaseModel):
    """Card names mentioned in a rules question (lookup-model output)."""

    card_names: list[str] = Field(
        default_factory=list,
        description="Distinct card names explicitly referenced; empty if none.",
    )


class RouterDecision(BaseModel):
    """Router/triage output — drives conditional graph edges."""

    intent: Literal["rules", "out_of_scope", "needs_format"]
    game_format: str | None = Field(
        default=None,
        description="Inferred format (Standard, Commander, …) if mentioned or obvious.",
    )
    reason: str = ""


class VerifierVerdict(BaseModel):
    """Verifier/critic output — grounded-ness check on draft_ruling."""

    verdict: Literal["grounded", "ungrounded"]
    issues: list[str] = Field(default_factory=list)
    retrieval_hints: list[str] = Field(
        default_factory=list,
        description="Suggested follow-up search queries when ungrounded.",
    )
