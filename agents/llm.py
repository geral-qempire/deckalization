"""OpenRouter-backed chat models (config-driven, version-pinned)."""

from __future__ import annotations

from typing import Literal

from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from agents.config import get_settings

ModelRole = Literal["adjudication", "router", "lookup", "verifier"]


def get_chat_model(role: ModelRole = "adjudication", *, temperature: float = 0.0) -> ChatOpenAI:
    """Return a ChatOpenAI client routed through OpenRouter for the given role."""
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY not set.")

    model_id = getattr(settings.models, role)
    return ChatOpenAI(
        model=model_id,
        api_key=SecretStr(settings.openrouter_api_key),
        base_url=settings.openrouter_base_url,
        temperature=temperature,
    )
