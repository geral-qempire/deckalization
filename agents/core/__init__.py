"""Shared building blocks used across every agent architecture.

Config, LLM clients, schemas, tracing, prompts, card resolution, and the Convex
data-access tools live here. Architecture packages (baseline, referee) import
from `agents.core`; nothing in core imports from an architecture package.
"""
