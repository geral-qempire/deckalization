"""Embed text via OpenRouter (OpenAI-compatible Embeddings API).

Same model + dimensions used at ingest time and query time (Phase 2), pinned in
agents/core/config.py and matching the Convex vector index. `check_embedding_ctx_length`
is disabled so raw strings (not tiktoken token arrays) are sent — required for
the OpenRouter endpoint.
"""

from __future__ import annotations

from functools import lru_cache

from langchain_openai import OpenAIEmbeddings
from pydantic import SecretStr

from agents.core.config import get_settings


@lru_cache
def get_embeddings() -> OpenAIEmbeddings:
    settings = get_settings()
    return OpenAIEmbeddings(
        model=settings.embeddings.model,
        dimensions=settings.embeddings.dimensions,
        api_key=SecretStr(settings.openrouter_api_key),
        base_url=settings.openrouter_base_url,
        check_embedding_ctx_length=False,
        chunk_size=settings.embeddings.batch_size,
    )


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts, returning one vector per input."""
    return get_embeddings().embed_documents(texts)


def embed_query(text: str) -> list[float]:
    """Embed a single query string (used by rules retrieval in Phase 2)."""
    return get_embeddings().embed_query(text)
