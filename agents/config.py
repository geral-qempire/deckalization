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


class EmbeddingConfig(BaseSettings):
    """Embedding model for the Comprehensive Rules vectors.

    Version-pinned: the SAME model + dimensions must be used at index time
    (ingest) and query time (retrieval), and must match the Convex vector
    index `dimensions`. Computed in Python via OpenRouter for a single,
    consistent code path. Card rulings are NOT embedded.
    """

    # OpenRouter embedding model id.
    model: str = "openai/text-embedding-3-large"
    # Output dimensionality — must equal `ruleChunks.by_embedding` index dims.
    dimensions: int = 3072
    # Batch size for embedding requests during ingest.
    batch_size: int = 96


class IngestConfig(BaseSettings):
    """Comprehensive Rules ingestion settings."""

    # Optional explicit URL to the CR .txt. If empty, the downloader discovers
    # the latest link from the official rules page.
    cr_txt_url: str = Field(default="", alias="CR_TXT_URL")
    # Official rules landing page used to auto-discover the .txt download link.
    cr_rules_page: str = "https://magic.wizards.com/en/rules"
    # How many rule chunks to upsert into Convex per mutation call. Kept small
    # because each chunk carries a 3072-float embedding (large JSON payload).
    upsert_batch_size: int = 50


class Settings(BaseSettings):
    """Top-level application settings, loaded from environment / ``.env``."""

    # Single local env file: `.env.local` (Convex CLI-managed + your secrets).
    model_config = SettingsConfigDict(
        env_file=".env.local",
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
    langsmith_project: str = Field(default="deckalization-dev", alias="LANGSMITH_PROJECT")
    langsmith_tracing: bool = Field(default=True, alias="LANGSMITH_TRACING")
    langsmith_endpoint: str = Field(
        default="https://api.smith.langchain.com", alias="LANGSMITH_ENDPOINT"
    )

    # ---- Convex ----
    convex_url: str = Field(default="", alias="CONVEX_URL")
    convex_deploy_key: str = Field(default="", alias="CONVEX_DEPLOY_KEY")

    # ---- Nested config ----
    models: ModelConfig = Field(default_factory=ModelConfig)
    thresholds: Thresholds = Field(default_factory=Thresholds)
    embeddings: EmbeddingConfig = Field(default_factory=EmbeddingConfig)
    ingest: IngestConfig = Field(default_factory=IngestConfig)


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (loaded once per process)."""
    return Settings()
