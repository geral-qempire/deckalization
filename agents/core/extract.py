"""Card-name extraction — shared infra used by both the RAG baseline and the referee.

Lives at the top level (not under ``baseline/``) so the multi-agent graph does not
depend on the baseline package.
"""

from __future__ import annotations

from typing import cast

from langchain_core.messages import HumanMessage, SystemMessage

from agents.core.llm import get_chat_model
from agents.core.schemas import CardNameExtraction

EXTRACT_SYSTEM = """\
Extract Magic: The Gathering card names explicitly mentioned in the user's rules question.

Include only real card names (not rules concepts like "Treasure token" unless a card \
is literally named that). Return an empty list if no specific cards are named.
"""


def extract_card_names(question: str) -> list[str]:
    """Use the cheap lookup model to pull card names from the question."""
    llm = get_chat_model("lookup").with_structured_output(CardNameExtraction)
    result = cast(
        CardNameExtraction,
        llm.invoke(
            [SystemMessage(content=EXTRACT_SYSTEM), HumanMessage(content=question)]
        ),
    )
    seen: set[str] = set()
    names: list[str] = []
    for name in result.card_names:
        key = name.strip().lower()
        if key and key not in seen:
            seen.add(key)
            names.append(name.strip())
    return names
