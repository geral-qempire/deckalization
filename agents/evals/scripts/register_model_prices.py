"""Register OpenRouter model prices in the LangSmith workspace price map.

LangSmith computes native run cost by matching the run's model name (`ls_model_name`)
against a workspace price map. Our models come through OpenRouter with slugs like
`anthropic/claude-sonnet-4.5`, which aren't in LangSmith's default table — so cost shows
as $0. This script registers the slugs so cost populates for NEW runs (existing runs are
not recomputed retroactively).

Prices are OpenRouter list prices, USD per 1M tokens, converted to per-token for the API.

Idempotent: skips slugs already present (matched by name).

    uv run python -m agents.evals.scripts.register_model_prices
"""

from __future__ import annotations

import os
import re
from typing import Any

import requests

from agents.core.tracing import export_langsmith_env

# slug -> (input $/Mtok, output $/Mtok)
PRICES: dict[str, tuple[float, float]] = {
    "anthropic/claude-sonnet-4.5": (3.0, 15.0),
    "anthropic/claude-opus-4.8": (5.0, 25.0),
    "anthropic/claude-haiku-4.5": (1.0, 5.0),
    "openai/gpt-5.5": (5.0, 30.0),
    "openai/gpt-5-mini": (0.25, 2.0),
    "openai/gpt-4o-mini": (0.15, 0.60),
}

MATCH_PATH = ["model", "model_name", "model_id", "model_path", "endpoint_name"]
# Everything routes through ChatOpenAI (OpenRouter, OpenAI-compatible API), so LangSmith
# tags every run with ls_provider="openai" regardless of the underlying model vendor.
# The price-map entry's provider must match that, or cost won't compute.
PROVIDER = "openai"


def main() -> None:
    export_langsmith_env()
    host = os.environ.get("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")
    key = os.environ["LANGSMITH_API_KEY"]
    headers = {"x-api-key": key, "Content-Type": "application/json"}
    url = f"{host}/api/v1/model-price-map"

    # Delete any prior deckalization entries so re-runs apply corrected fields.
    for e in requests.get(url, headers=headers, params={"limit": 500}).json():
        if e["name"].startswith("deckalization:"):
            d = requests.delete(f"{url}/{e['id']}", headers=headers)
            print(f"  delete {e['name']} -> {'ok' if d.ok else d.status_code}")

    for slug, (pin, pout) in PRICES.items():
        name = f"deckalization:{slug}"
        payload: dict[str, Any] = {
            "name": name,
            "match_path": MATCH_PATH,
            # Anchor an exact match on the OpenRouter slug.
            "match_pattern": f"^{re.escape(slug)}$",
            "prompt_cost": pin / 1_000_000,
            "completion_cost": pout / 1_000_000,
            "provider": PROVIDER,
        }
        r = requests.post(url, headers=headers, json=payload)
        status = "ok" if r.ok else f"FAILED {r.status_code}: {r.text[:200]}"
        print(f"  create {name}  (${pin}/${pout} per Mtok) -> {status}")


if __name__ == "__main__":
    main()
