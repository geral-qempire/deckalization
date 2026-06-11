# Eval fixtures

## Phase 3 — `sample_questions.jsonl`

Hand-curated starter set (~10 questions) for manual baseline comparison. Run:

```bash
uv run python -m agents.baseline.run --baseline both --fixture evals/fixtures/sample_questions.jsonl
```

Compare traces in LangSmith (`deckalization-dev`), filter tags `baseline:zero_shot` / `baseline:rag`.

## Phase 5 — planned golden datasets

| Dataset | Size | Availability | Notes |
|---|---|---|---|
| **RulesGuru** | ~1,487 Q&A | [Public API](https://rulesguru.org/api/documentation/) | **ML use requires explicit permission** from Isaac King (see [About](https://rulesguru.org/about/)). Rate limit: 1 req / 2 sec. |
| **Cranial Insertion** | ~800+ articles | No bulk download | Weekly rules column since 2005; would need custom scrape + parse (Phase 5 task). |
| **Card resolution** | TBD | Hand-curated | Typos, nicknames, ambiguous names — extend resolver fixtures. |
| **Citation validity** | TBD | Derived | Assert cited CR numbers exist in our mirror and match retrieved chunks. |

Phase 5 will add LangSmith datasets + automated evaluators. Do **not** bulk-download RulesGuru for ML eval without permission.
