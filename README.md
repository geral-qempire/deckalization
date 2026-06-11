# deckalization

A **Magic: The Gathering rules referee** — a multi-agent assistant that answers rules
questions and adjudicates card interactions **with citations to the official
Comprehensive Rules and current Oracle card text**, wrapped in a full
CI/CD + evaluation + observability pipeline on the **LangChain / LangGraph / LangSmith** stack.

> A "judge in a box": ask *"I control X, my opponent does Y — what happens?"* and the
> system fetches exact card text, retrieves the relevant rules, reasons through the
> interaction (stack, layers, state-based actions, replacement effects), and returns a
> ruling that cites both card text and rule numbers — with a verifier loop that rejects
> ungrounded rulings.

## Stack

| Layer | Choice |
| --- | --- |
| Orchestration | LangChain + LangGraph (Python) |
| Data layer | Convex (TypeScript) — card mirror + rules vectors |
| LLM gateway | OpenRouter (OpenAI-compatible), config-driven & version-pinned per node |
| Embeddings | Local `bge-small` (384-dim, CPU) |
| Tool interface | MCP — custom FastMCP server + official Convex MCP (dev) |
| Observability + Evals | LangSmith |
| CI/CD | GitHub Actions |

## Guardrails (non-negotiable)

- **No row, no ruling** — card lookups return real DB rows or `not_found`; never answer from model memory.
- **MCP stays off the production hot path** — graph nodes call the Convex tools directly.
- **Models are config-driven & version-pinned** in `agents/config.py` — never hardcode a model name in a node.
- **All card lookups hit the local mirror** — the live Scryfall API is a fallback only.

## Repo layout

```
deckalization/
├── agents/      # Python — reasoning & orchestration (config, state, graph, nodes, tools, ingest)
├── convex/      # TypeScript — data layer (schema + functions + crons)
├── mcp/         # FastMCP server over the same tool layer
├── evals/       # golden datasets, evaluators, runner
├── app/         # Streamlit chat UI
├── tests/       # unit tests
├── langgraph.json
└── pyproject.toml
```

## Getting started

### Prerequisites
- [uv](https://docs.astral.sh/uv/) (Python toolchain) — pins Python 3.12
- Node.js 18+ (for the Convex CLI)

### 1. Python environment
```bash
uv sync
```

### 2. Environment variables
```bash
cp .env.example .env
# Fill in OPENROUTER_API_KEY, LANGSMITH_API_KEY, and CONVEX_URL.
```

### 3. Convex (interactive login the first time)
```bash
npx convex dev
# Logs in via browser, creates the deployment, and writes CONVEX_URL to .env.local.
```

### 4. Smoke test (Phase 0 done-when)
```bash
uv run python -m agents.hello   # traced no-op graph + Convex ping
uv run pytest                   # unit smoke tests
npx @langchain/langgraph-cli dev  # or: langgraph dev — serves the graph locally
```

## Build plan

Built **one phase at a time**:

- **Phase 0** — Scaffolding & infra ✅ (this commit)
- **Phase 1** — Data layer: schema, ingestion & indexing
- **Phase 2** — Data-access tools & card resolver
- **Phase 3** — Baseline single-chain RAG
- **Phase 4** — Multi-agent graph (router + verifier loop)
- **Phase 5** — Eval harness
- **Phase 6** — CI/CD quality gate
- **Phase 7** — Deploy + monitor

Tournament policy (MTR/IPG/JAR) and the player-friendly explanation formatter are
deferred to **v1.1** — the seams exist in the graph but are not implemented in v1.
