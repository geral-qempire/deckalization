"""Phase 0 smoke tests — no network required.

These validate that the scaffold imports cleanly and the trivial graph runs.
"""

from __future__ import annotations

from agents.config import get_settings
from agents.hello import build_hello_graph


def test_settings_load_with_defaults() -> None:
    s = get_settings()
    # Models are config-driven & version-pinned (no hardcoding in nodes).
    assert s.models.adjudication
    assert s.models.router
    # Embedding dims must stay in sync with the Convex vector index.
    assert s.embeddings.dimensions == 3072


def test_hello_graph_runs() -> None:
    app = build_hello_graph()
    result = app.invoke({"question": "ping", "answer": ""})
    assert "ping" in result["answer"]
