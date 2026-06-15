"""Comprehensive Rules ingest: download -> parse -> embed -> upsert to Convex.

Usage:
    uv run python -m agents.ingest.run            # full ingest
    uv run python -m agents.ingest.run --limit 50 # cheap pipeline smoke test
"""

from __future__ import annotations

import argparse
from typing import Any

from convex import ConvexClient

from agents.core.config import get_settings
from agents.ingest.downloader import download_cr_text
from agents.ingest.embedder import embed_texts
from agents.ingest.parser import RuleChunk, parse_rules


def _embedding_input(chunk: RuleChunk) -> str:
    """Text sent to the embedder — rule number + section give retrieval context."""
    return f"{chunk.section} | {chunk.ruleNumber}: {chunk.text}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest the MTG Comprehensive Rules.")
    parser.add_argument(
        "--limit", type=int, default=0, help="Only ingest the first N chunks (testing)."
    )
    args = parser.parse_args()

    settings = get_settings()
    if not settings.convex_url:
        raise SystemExit("CONVEX_URL not set (run `npx convex dev` first).")
    if not settings.openrouter_api_key:
        raise SystemExit("OPENROUTER_API_KEY not set.")

    print("Downloading Comprehensive Rules...")
    raw, source_url = download_cr_text()
    print(f"  source: {source_url}  ({len(raw):,} chars)")

    chunks = parse_rules(raw)
    if args.limit:
        chunks = chunks[: args.limit]
    print(f"Parsed {len(chunks):,} rule chunks (version: {chunks[0].rulesVersion}).")

    print(f"Embedding via {settings.embeddings.model} ({settings.embeddings.dimensions}d)...")
    vectors = embed_texts([_embedding_input(c) for c in chunks])

    client = ConvexClient(settings.convex_url)
    batch_size = settings.ingest.upsert_batch_size
    inserted = updated = 0
    for i in range(0, len(chunks), batch_size):
        payload: list[dict[str, Any]] = [
            {
                "ruleNumber": c.ruleNumber,
                "section": c.section,
                "text": c.text,
                "embedding": vec,
                "rulesVersion": c.rulesVersion,
            }
            for c, vec in zip(
                chunks[i : i + batch_size], vectors[i : i + batch_size], strict=True
            )
        ]
        res = client.mutation("rules:upsertRuleChunks", {"chunks": payload})
        inserted += res["inserted"]
        updated += res["updated"]
        print(f"  upserted {min(i + batch_size, len(chunks)):,}/{len(chunks):,}")

    print(f"Done. inserted={inserted} updated={updated}")


if __name__ == "__main__":
    main()
