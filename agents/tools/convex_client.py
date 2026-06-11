"""Shared Convex client (one per process)."""

from __future__ import annotations

from functools import lru_cache

from convex import ConvexClient

from agents.config import get_settings


@lru_cache
def get_convex_client() -> ConvexClient:
    settings = get_settings()
    if not settings.convex_url:
        raise RuntimeError("CONVEX_URL not set (run `npx convex dev`).")
    return ConvexClient(settings.convex_url)
