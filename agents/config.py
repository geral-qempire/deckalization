"""Central, config-driven settings for the referee.

Guardrails enforced here:
- Models are **config-driven & version-pinned** — never hardcode a model name in a node.
- All secrets/URLs load from the environment (`.env` locally, real env in CI/prod).

The adjudication model runs on a frontier reasoning model; routing and lookup run
on a cheap model. Both are addressed through OpenRouter (OpenAI-compatible API), so
swapping providers is a config change, and evals can later drive downgrades.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ModelConfig(BaseSettings):
    """Per-role model IDs, version-pinned. Format: ``<provider>/<model>``.

    Pin exact versions (avoid floating ``:latest`` style tags) so eval results are
    reproducible and CI can gate on a known model.
    """

    # Frontier reasoning model — drafts and adjudicates rulings.
    adjudication: str = "anthropic/claude-sonnet-4.5"
    # Cheap model — triage/routing classification.
    router: str = "openai/gpt-4o-mini"
    # Cheap model — card-name span extraction and lookup helpers.
    lookup: str = "openai/gpt-4o-mini"
    # Verifier/critic — grounded-ness check (mid-tier reasoning).
    verifier: str = "anthropic/claude-sonnet-4.5"


class Thresholds(BaseSettings):
    """Retrieval and confidence thresholds the graph branches on."""

    # Card resolver: minimum score to accept a single confident match.
    resolver_high_confidence: float = 0.92
    # Card resolver: below this we abstain / ask instead of guessing.
    resolver_min_confidence: float = 0.60
    # Rules retrieval: number of rule chunks to pull per query.
    rules_top_k: int = 8
    # Verifier loop: max re-retrieve iterations before giving up.
    max_verifier_loops: int = 2


class Settings(BaseSettings):
    """Top-level application settings, loaded from environment / ``.env``."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ---- LLM gateway (OpenRouter) ----
    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    openrouter_base_url: str = Field(
        default="https://openrouter.ai/api/v1", alias="OPENROUTER_BASE_URL"
    )

    # ---- LangSmith ----
    langsmith_api_key: str = Field(default="", alias="LANGSMITH_API_KEY")
    langsmith_project: str = Field(default="deckalization", alias="LANGSMITH_PROJECT")
    langsmith_tracing: bool = Field(default=True, alias="LANGSMITH_TRACING")
    langsmith_endpoint: str = Field(
        default="https://api.smith.langchain.com", alias="LANGSMITH_ENDPOINT"
    )

    # ---- Convex ----
    convex_url: str = Field(default="", alias="CONVEX_URL")
    convex_deploy_key: str = Field(default="", alias="CONVEX_DEPLOY_KEY")

    # ---- Embeddings (local, CPU, 384-dim) ----
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dimensions: int = 384

    # ---- Nested config ----
    models: ModelConfig = Field(default_factory=ModelConfig)
    thresholds: Thresholds = Field(default_factory=Thresholds)


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (loaded once per process)."""
    return Settings()
