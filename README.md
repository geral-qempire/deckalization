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
| Embeddings | OpenRouter `text-embedding-3-large` (3072-dim) |
| Tool interface | MCP — custom FastMCP server + official Convex MCP (dev) |
| Observability + Evals | LangSmith |
| CI/CD | GitHub Actions |

## Guardrails (non-negotiable)

- **No row, no ruling** — card lookups return real DB rows or `not_found`; never answer from model memory.
- **MCP stays off the production hot path** — graph nodes call the Convex tools directly.
- **Models are config-driven & version-pinned** in `agents/core/config.py` — never hardcode a model name in a node.
- **All card lookups hit the local mirror** — the live Scryfall API is a fallback only.

## Repo layout

See [AGENTS.md](AGENTS.md) for the canonical structure and the rules that keep it that way.

```
deckalization/
├── AGENTS.md          # canonical repo structure + conventions (read this first)
├── agents/            # all Python — reasoning, orchestration & evals
│   ├── core/          # shared across every architecture (config, llm, schemas,
│   │   │              #   tracing, prompts, resolver, scryfall, normalize, context, extract)
│   │   └── tools/     # Convex data-access layer
│   ├── baseline/      # architecture: zero-shot + single-chain RAG
│   ├── referee/       # architecture: multi-agent referee
│   │   ├── nodes/     # all referee nodes (shared + v1 + v2 variants)
│   │   ├── v1/        # v1 graph wiring
│   │   ├── v2/        # v2 graph wiring (production)
│   │   ├── routing.py # shared conditional-edge predicates
│   │   ├── state.py   # shared graph state
│   │   └── run.py     # referee CLI (defaults to v2)
│   ├── ingest/        # Comprehensive Rules download/parse/embed/seed
│   ├── evals/         # golden datasets, evaluators, runner, ingestion scripts
│   └── hello.py       # phase-0 smoke graph
├── convex/            # TypeScript — data layer (schema + functions + crons)
├── mcp_server/        # FastMCP server over the same tool layer (named to avoid the `mcp` pkg clash)
├── app/               # Streamlit chat UI (future)
├── docs/              # eval findings & design notes
├── tests/             # unit tests
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
cp .env.local.example .env.local
# Fill in OPENROUTER_API_KEY and LANGSMITH_API_KEY.
```
A single `.env.local` holds everything: your secrets plus the Convex-managed vars.

### 3. Convex (interactive login the first time)
```bash
npx convex dev
# Logs in via browser, creates the deployment, and writes the CONVEX_* vars to .env.local.
```

### 4. Smoke test (Phase 0 done-when)
```bash
uv run python -m agents.hello   # traced no-op graph + Convex ping
uv run pytest                   # unit smoke tests
npx @langchain/langgraph-cli dev  # or: langgraph dev — serves the graph locally
```

### 5. Phase 3 baselines (zero-shot vs RAG)
```bash
# Single question — both baselines, traced to LangSmith (deckalization-dev)
uv run python -m agents.baseline.run --baseline both \
  --question "Does deathtouch work with trample?"

# Starter fixture set (~10 questions)
uv run python -m agents.baseline.run --baseline both \
  --fixture agents/evals/fixtures/sample_questions.jsonl
```
Filter LangSmith traces by tags `baseline:zero_shot` or `baseline:rag`.

### 6. Phase 4 referee graph
```bash
# Defaults to the v2 graph (production architecture)
uv run python -m agents.referee.run --question "Does deathtouch work with trample?"

# Run the v1 graph instead (kept as a benchmark comparison)
uv run python -m agents.referee.run --graph v1 --question "..."

# Compare against Phase 3 RAG baseline on the same question
uv run python -m agents.referee.run --question "..." --compare

uv run python -m agents.referee.run --fixture agents/evals/fixtures/sample_questions.jsonl
```
Filter LangSmith traces by tag `pipeline:referee`.

### 7. Phase 5 eval harness
```bash
# One-time: ingest all RulesGuru → Convex, then build fixed benchmark manifest
uv run python -m agents.evals.scripts.ingest_rulesguru
uv run python -m agents.evals.scripts.build_benchmark_manifest

# Smoke (CI-sized, ~15 cases)
uv run python -m agents.evals.run --suite smoke --target referee

# Full benchmark (~125 fixed cases, ~€8–10 for 3-way compare)
uv run python -m agents.evals.run --suite benchmark --compare zero_shot baseline_rag referee
```

## Environments (dev / prod)

Same variable names everywhere; only values differ.

| Concern | dev | prod |
| --- | --- | --- |
| OpenRouter key | `deckalization-dev` key in `.env.local` | `deckalization-prod` key as LangGraph Platform secret |
| LangSmith project | `deckalization-dev` | `deckalization-prod` |
| Convex deployment | personal dev deployment (`npx convex dev`) | prod deployment (`npx convex deploy` + deploy key) |
| CI (PRs) | dev/CI OpenRouter key + Convex preview deploy | — |

Prod and CI secrets are wired in **Phase 6 (CI/CD)** and **Phase 7 (deploy)** — dev is all that's needed for Phases 0–5.

## Build plan

Built **one phase at a time**:

- **Phase 0** — Scaffolding & infra ✅
- **Phase 1** — Data layer: schema, ingestion & indexing ✅
- **Phase 2** — Data-access tools, card resolver & FastMCP server ✅
- **Phase 3** — Baseline zero-shot + single-chain RAG (traced in LangSmith)
- **Phase 4** — Multi-agent graph (router + verifier loop) ✅
- **Phase 5** — Eval harness (Convex goldens, benchmark suite, evaluators) ✅
- **Phase 6** — CI/CD quality gate
- **Phase 7** — Deploy + monitor

Tournament policy (MTR/IPG/JAR) and the player-friendly explanation formatter are
deferred to **v1.1** — the seams exist in the graph but are not implemented in v1.
