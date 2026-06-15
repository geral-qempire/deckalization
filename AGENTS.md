# AGENTS.md

Guidance for AI coding agents (and humans) working in this repo. Read this before
adding files or moving things around. The goal is to keep the structure below
**canonical** — when in doubt, put code where this document says it goes.

## What this project is

`deckalization` is a Magic: The Gathering rules referee: a multi-agent LangGraph
assistant (Python) that answers rules questions with citations to the Comprehensive
Rules and Oracle card text, backed by a Convex data layer and evaluated with LangSmith.

## Canonical structure

```
deckalization/
├── AGENTS.md              # this file
├── README.md              # product overview + getting started
├── agents/                # ALL Python: reasoning, orchestration, and evals
│   ├── core/              # shared building blocks used by every architecture
│   │   ├── config.py      # pydantic settings: models, thresholds, embeddings
│   │   ├── llm.py         # get_chat_model(role) via OpenRouter
│   │   ├── schemas.py     # pydantic response/decision schemas
│   │   ├── tracing.py     # LangSmith env + run configs
│   │   ├── context.py     # format evidence + citation grounding
│   │   ├── extract.py     # LLM card-name extraction
│   │   ├── prompts.py     # cross-architecture prompts (grounded adjudication)
│   │   ├── normalize.py   # card-name normalization
│   │   ├── resolver.py    # card resolution ladder (exact→alias→fuzzy→Scryfall)
│   │   ├── scryfall.py    # Scryfall fuzzy fallback
│   │   └── tools/         # Convex data-access layer (convex_client, cards, rules)
│   ├── baseline/          # ARCHITECTURE: zero-shot + single-chain RAG
│   ├── referee/           # ARCHITECTURE: the multi-agent referee
│   │   ├── state.py       # RefereeState — shared by all referee versions
│   │   ├── routing.py     # conditional-edge predicates shared by all versions
│   │   ├── adjudicate.py  # two-stage reason/format/patch helper (v2 nodes)
│   │   ├── nodes/         # ONE library of every referee node (see naming below)
│   │   ├── v1/graph.py    # v1 graph wiring only
│   │   ├── v2/graph.py    # v2 graph wiring only (production)
│   │   └── run.py         # referee CLI (defaults to v2)
│   ├── ingest/            # Comprehensive Rules download/parse/embed/seed
│   ├── evals/             # eval harness for the agents (see below)
│   │   ├── run.py         # main CLI harness (local + LangSmith)
│   │   ├── pipelines.py   # maps a target name → a runnable pipeline
│   │   ├── evaluators.py  # scorers (deterministic + LLM judge)
│   │   ├── langsmith_eval.py
│   │   ├── thresholds.yaml
│   │   ├── datasets/      # pinned benchmark manifest + curated sets
│   │   ├── fixtures/      # sample questions for manual runs
│   │   └── scripts/       # dataset ingestion + offline analysis scripts
│   └── hello.py           # phase-0 smoke graph
├── convex/                # TypeScript data layer (schema, queries, mutations, crons)
├── mcp_server/            # FastMCP server over the core tool layer
├── app/                   # Streamlit chat UI (future; placeholder for now)
├── docs/                  # design notes & eval findings
├── tests/                 # unit tests
├── langgraph.json         # graph registry for LangGraph CLI / Studio
└── pyproject.toml         # deps, ruff, mypy, pytest config
```

## Rules of the road

### 1. Shared code lives in `agents/core/`
Anything used by more than one architecture (baseline, referee) goes in `agents/core/`.
`core/` must **not** import from an architecture package — the dependency arrow only
points `architecture → core` (and `architecture → core.tools`, `architecture → ingest`).

### 2. Each architecture gets its own folder
A distinct pipeline design is a folder under `agents/` (today: `baseline/`, `referee/`).
Architectures do not import from each other. Add a new architecture as a sibling folder,
not by bolting onto an existing one.

### 3. Inside `referee/`: nodes are a library, graphs are thin wiring
- `referee/nodes/` holds **every** node for **every** version. Node modules contain the
  logic.
- `referee/v1/graph.py` and `referee/v2/graph.py` contain only graph construction
  (`StateGraph`, nodes, edges) — no business logic.
- Predicates used to choose edges go in `referee/routing.py` if shared, or stay local to
  a `graph.py` if used by only one version (e.g. v2's `route_after_retrieval`).
- Shared graph state is `referee/state.py`.

### 4. Versioning convention: folders for graphs, suffixes for divergent nodes
- A new graph version is a new folder (`v3/graph.py`), not a `_v3` filename.
- When a node genuinely differs between versions, the variant keeps a version suffix
  (`adjudication.py` vs `adjudication_v2.py`) so it's obvious in the nodes library which
  graph uses it. Nodes shared across versions have no suffix.
- If a future version introduces many new variants, consider promoting version-specific
  nodes into the version folder — but keep shared nodes in `referee/nodes/`.

### 5. Prompt placement: prompts live next to their owner
- Cross-architecture prompts → `agents/core/prompts.py`.
- All referee node prompts → `agents/referee/nodes/prompts.py`.
- Architecture-specific prompts → that architecture's `prompts.py` (e.g.
  `agents/baseline/prompts.py`).

### 6. Evals live with the agents
The eval harness, datasets, fixtures, and ingestion scripts are under `agents/evals/`.
Eval pipelines may import from any architecture and from `core`.

### 7. MCP is off the production hot path
`mcp_server/` wraps the same `agents/core/tools` functions for external MCP clients.
Graph nodes call the Python tool functions directly — never route the hot path through MCP.

### 8. Package `__init__.py` files stay import-light
Avoid eager re-exports of submodules in `__init__.py` (especially in `referee/nodes/`):
they can cause circular imports because some node modules import shared helpers that in
turn import from the package. Import nodes from their submodule path directly.

### 9. Prune dead code
If something is not used and has no planned use, delete it rather than leaving it to rot.
Keep intentional placeholders (e.g. `app/`, `.github/workflows/`) only when they mark a
known upcoming phase.

## Commands

```bash
uv sync                                             # install deps
uv run pytest                                       # run unit tests
uv run ruff check agents mcp_server tests           # lint
uv run mypy agents mcp_server                        # type-check

uv run python -m agents.hello                        # phase-0 smoke graph
uv run python -m agents.referee.run --question "..." # referee (v2 by default)
uv run python -m agents.referee.run --graph v1 --question "..."
uv run python -m agents.baseline.run --baseline both --question "..."
uv run python -m agents.evals.run --suite smoke --target referee
```

Graphs are registered for the LangGraph CLI/Studio in `langgraph.json`; keep that file in
sync when you add, rename, or move a graph entrypoint.

## When you add code, ask:

- Is it shared by >1 architecture? → `agents/core/` (or `core/tools/` for data access).
- Is it a referee node? → `agents/referee/nodes/` (suffix only if it's a version variant).
- Is it a new graph version? → `agents/referee/vN/graph.py` + register in `langgraph.json`.
- Is it an eval, dataset, or eval script? → `agents/evals/`.
- Is it a whole new pipeline design? → a new architecture folder under `agents/`.
