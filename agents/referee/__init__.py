"""The multi-agent referee architecture.

`nodes/` is a single library of every referee node (shared, v1, and v2). Each
version package (`v1/`, `v2/`) contains only its `graph.py`, which wires those
nodes into a graph. Shared routing predicates live in `routing.py`; shared
state lives in `state.py`.
"""
