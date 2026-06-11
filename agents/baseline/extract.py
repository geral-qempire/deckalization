"""Extract card name spans from a free-text rules question."""

from __future__ import annotations

from typing import cast

from langchain_core.messages import HumanMessage, SystemMessage

from agents.baseline.prompts import EXTRACT_SYSTEM
from agents.llm import get_chat_model
from agents.schemas import CardNameExtraction


def extract_card_names(question: str) -> list[str]:
    """Use the cheap lookup model to pull card names from the question."""
    llm = get_chat_model("lookup").with_structured_output(CardNameExtraction)
    result = cast(
        CardNameExtraction,
        llm.invoke(
            [SystemMessage(content=EXTRACT_SYSTEM), HumanMessage(content=question)]
        ),
    )
    # Dedupe while preserving order.
    seen: set[str] = set()
    names: list[str] = []
    for name in result.card_names:
        key = name.strip().lower()
        if key and key not in seen:
            seen.add(key)
            names.append(name.strip())
    return names
