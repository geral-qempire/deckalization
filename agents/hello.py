"""Phase 0 smoke test: a traced no-op LangGraph run + a trivial Convex call.

Run with:

    uv run python -m agents.hello

Done-when checks this exercises:
- a no-op LangGraph graph executes locally,
- the run shows up as a trace in LangSmith (if LANGSMITH_API_KEY is set),
- Python successfully calls a Convex function (if CONVEX_URL is set).
"""

from __future__ import annotations

from typing import TypedDict

from agents.config import get_settings
from agents.tracing import export_langsmith_env


class HelloState(TypedDict):
    """Minimal graph state for the smoke test."""

    question: str
    answer: str


def _greet(state: HelloState) -> HelloState:
    """No-op node: echoes a friendly, deterministic answer."""
    return {
        "question": state["question"],
        "answer": f"deckalization is alive. You said: {state['question']!r}",
    }


def build_hello_graph():
    """Build and compile a trivial single-node LangGraph."""
    from langgraph.graph import END, START, StateGraph

    graph = StateGraph(HelloState)
    graph.add_node("greet", _greet)
    graph.add_edge(START, "greet")
    graph.add_edge("greet", END)
    return graph.compile()


def check_convex() -> str:
    """Call the trivial Convex `hello:ping` query; return its result or a skip note."""
    s = get_settings()
    if not s.convex_url:
        return "CONVEX_URL not set — skipping Convex check."
    from convex import ConvexClient

    client = ConvexClient(s.convex_url)
    result = client.query("hello:ping", {"name": "deckalization"})
    return f"Convex says: {result}"


def main() -> None:
    export_langsmith_env()

    app = build_hello_graph()
    result = app.invoke({"question": "Does the stack work?", "answer": ""})
    print("[graph]", result["answer"])

    print("[convex]", check_convex())

    s = get_settings()
    if s.langsmith_api_key:
        print(f"[langsmith] traced run sent to project '{s.langsmith_project}'.")
    else:
        print("[langsmith] LANGSMITH_API_KEY not set — run not traced.")


if __name__ == "__main__":
    main()
