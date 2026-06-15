"""Referee node library — every node used by any referee graph version.

Shared nodes are used by both v1 and v2; version-suffixed variants
(`adjudication_v2`, `rules_retrieval_v2`) belong to the v2 graph only.

Import nodes from their submodules directly (e.g.
`from agents.referee.nodes.router import router_node`). This package
intentionally avoids eager re-exports so that modules like `adjudicate`,
which depend on `nodes.prompts`, don't trigger a circular import.
"""
