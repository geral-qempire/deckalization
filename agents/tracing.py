"""LangSmith tracing helpers."""

from __future__ import annotations

import os
from typing import Any

from agents.config import get_settings


def export_langsmith_env() -> None:
    """Push LangSmith settings into the environment so tracers pick them up."""
    s = get_settings()
    if s.langsmith_api_key:
        os.environ["LANGSMITH_API_KEY"] = s.langsmith_api_key
        os.environ["LANGSMITH_TRACING"] = "true" if s.langsmith_tracing else "false"
        os.environ["LANGSMITH_PROJECT"] = s.langsmith_project
        os.environ["LANGSMITH_ENDPOINT"] = s.langsmith_endpoint


def run_config(
    *,
    baseline: str,
    question: str,
    question_id: str | None = None,
    extra_tags: list[str] | None = None,
) -> dict[str, Any]:
    """LangGraph/LangChain invoke config with consistent baseline tags."""
    tags = ["phase:3", f"baseline:{baseline}", *(extra_tags or [])]
    if question_id:
        tags.append(f"fixture:{question_id}")
    short_q = question[:60] + ("…" if len(question) > 60 else "")
    return {
        "tags": tags,
        "run_name": f"{baseline}: {short_q}",
        "metadata": {
            "baseline": baseline,
            "question_id": question_id or "",
        },
    }
