"""Two-stage adjudication: reason in prose (frontier model) → format to schema (cheap).

Forcing a frontier model to emit a rigid JSON schema in one shot measurably degrades
multi-step reasoning. So we split the work: the expensive model reasons freely in prose,
then a cheap model extracts the ``RulingResponse`` structure from that prose. Same
reasoning budget, no structured-output penalty.

The same prose→format machinery powers the verifier *patch* step (minimal revision of an
existing draft) so the two paths stay consistent.
"""

from __future__ import annotations

import re
from typing import cast

from langchain_core.messages import HumanMessage, SystemMessage

from agents.core.llm import get_chat_model
from agents.core.schemas import RulingResponse
from agents.referee.nodes.prompts import FORMAT_SYSTEM, PATCH_SYSTEM, REASON_SYSTEM


def _evidence_block(
    *, question: str, format_line: str, cards_ctx: str, unresolved_block: str, rules_ctx: str
) -> str:
    return f"""Question:
{question}
{format_line}

--- Resolved cards (with official rulings) ---
{cards_ctx}

--- Unresolved / skipped ---
{unresolved_block}

--- Retrieved Comprehensive Rules ---
{rules_ctx}
"""


# Audit/meta talk that some models leak into a *patched* ruling. Since the patch prose
# is preserved verbatim as the final answer, a leading meta sentence would otherwise be
# graded by the correctness/faithfulness judges. Strip such leading sentences defensively.
_META_LEAD = re.compile(
    r"^\s*(?:the\s+)?(?:auditor|verifier|reviewer|audit)\b"
    r"|^\s*(?:my|the)\s+(?:core|original|previous|initial)\s+"
    r"(?:conclusion|answer|ruling|analysis)\b"
    r"|^\s*(?:the\s+)?flagged\s+issues?\b"
    r"|^\s*(?:i|we)\s+(?:need to|should|will|'ll)\s+"
    r"(?:revis|fix|correct|swap|update|adjust|tighten)",
    re.IGNORECASE,
)


def _strip_meta_lead(prose: str) -> str:
    """Drop leading paragraphs that address the audit instead of the player."""
    blocks = prose.split("\n\n")
    while blocks and _META_LEAD.search(blocks[0].strip()):
        blocks.pop(0)
    cleaned = "\n\n".join(blocks).strip()
    # Never return empty — fall back to the original prose if every block looked meta.
    return cleaned or prose.strip()


def _prose_to_ruling(prose: str, *, question: str) -> RulingResponse:
    fmt_llm = get_chat_model("lookup").with_structured_output(RulingResponse)
    user = f"""Question: {question}

Referee's analysis:
{prose}

Extract the structured ruling from this analysis.
"""
    ruling = cast(
        RulingResponse,
        fmt_llm.invoke([SystemMessage(content=FORMAT_SYSTEM), HumanMessage(content=user)]),
    )
    # Preserve the frontier model's FULL reasoning as the answer. Stage 2 only structures
    # the citations/confidence — it must never compress or rewrite the explanation, which
    # is what the correctness judge actually grades.
    cleaned = prose.strip()
    if cleaned:
        ruling.ruling = cleaned
    return ruling


def _content_str(message: object) -> str:
    content = getattr(message, "content", message)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [
            p.get("text", "") if isinstance(p, dict) else str(p) for p in content
        ]
        return "\n".join(parts)
    return str(content)


def reason_then_format(
    *,
    question: str,
    format_line: str,
    cards_ctx: str,
    unresolved_block: str,
    rules_ctx: str,
) -> RulingResponse:
    """Stage 1 prose reasoning (frontier) → stage 2 schema extraction (cheap)."""
    reason_llm = get_chat_model("adjudication")
    evidence = _evidence_block(
        question=question,
        format_line=format_line,
        cards_ctx=cards_ctx,
        unresolved_block=unresolved_block,
        rules_ctx=rules_ctx,
    )
    prose = _content_str(
        reason_llm.invoke(
            [SystemMessage(content=REASON_SYSTEM), HumanMessage(content=evidence)]
        )
    )
    return _prose_to_ruling(prose, question=question)


def patch_then_format(
    *,
    question: str,
    draft: RulingResponse,
    issues: list[str],
    cards_ctx: str,
    rules_ctx: str,
) -> RulingResponse:
    """Minimally revise an existing draft to resolve flagged issues (prose → schema)."""
    reason_llm = get_chat_model("adjudication")
    issue_block = "\n".join(f"- {i}" for i in issues) or "- (none specified)"
    draft_cites = ", ".join(c.rule_number for c in draft.rule_citations) or "(none)"
    user = f"""Question:
{question}

--- Your draft ruling ---
{draft.ruling}
(cited rules: {draft_cites})

--- Issues flagged by the auditor ---
{issue_block}

--- Resolved cards (with official rulings) ---
{cards_ctx}

--- Retrieved Comprehensive Rules ---
{rules_ctx}

Revise minimally to resolve the issues.
"""
    prose = _content_str(
        reason_llm.invoke(
            [SystemMessage(content=PATCH_SYSTEM), HumanMessage(content=user)]
        )
    )
    return _prose_to_ruling(_strip_meta_lead(prose), question=question)
