# Eval fixtures & golden datasets

## Suites (stored in Convex `evalCases`)

| Suite | Size | Purpose |
|---|---|---|
| **full** | ~1,487 | Entire RulesGuru corpus in Convex (storage; expensive to eval) |
| **benchmark** | 125 fixed | Stratified sample (~€8–10 for 3-pipeline compare) |
| **smoke** | 15 fixed | CI / quick dev (subset of benchmark) |
| **card_resolution** | 9 hand-curated | Resolver ladder only |

The **benchmark** and **smoke** IDs are pinned in `benchmark_manifest.json` (committed).
Re-run `build_benchmark_manifest.py` only when intentionally rebasing the sample (bump `version`).

## Setup (once)

```bash
# 1) Ingest all RulesGuru questions → Convex (~30–40 min, rate-limited)
uv run python -m agents.evals.scripts.ingest_rulesguru

# 2) Build fixed benchmark + smoke tags in Convex
uv run python -m agents.evals.scripts.build_benchmark_manifest

# 3) Card resolution golden set
uv run python -m agents.evals.scripts.ingest_card_resolution
```

## Run evals

```bash
uv run python -m agents.evals.run --suite smoke --target referee
uv run python -m agents.evals.run --suite benchmark --compare zero_shot baseline_rag referee
uv run python -m agents.evals.run --suite card_resolution --target resolver
```

Attribution: RulesGuru questions ([rulesguru.org](https://rulesguru.org/)) — non-commercial evaluation only, not model training.
