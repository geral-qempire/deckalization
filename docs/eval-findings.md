# Architecture Evaluation Findings

> Reference notes from the Phase 5 eval work — captured for later use when building
> the project docs / website. All numbers are from the LangSmith experiments on the
> golden rules-QA dataset (`deckalization-rules-qa`).

## TL;DR

We compared four MTG-rules answering pipelines and discovered that a naïve
multi-agent "referee" graph **loses to a simple RAG baseline** on answer correctness,
until two specific fixes are applied. After those fixes, the improved referee
(`referee_v2`) **beats RAG decisively** on every metric.

Final benchmark (125 cases):

| metric | zero_shot | baseline_rag | **referee_v2 (final)** |
|---|---|---|---|
| **correctness** | 0.460 | 0.552 | **0.716** |
| citation_relevance | 0.360 | 0.213 | **0.433** |
| citation_validity | 0.979 | 1.000 | 0.997 |
| faithfulness | n/a | 1.000 | 1.000 |

`referee_v2` is the recommended production architecture.

---

## Update 2026-06-12 — eval-layer revamp + `bench40`

The eval layer was reworked for sharper, more diagnostic metrics, and a **fixed 40-case
subset (`bench40`)** was pinned for cheap, repeatable experiments. Results below supersede
the 125-case table above for ongoing comparison **but are not directly comparable to it**:
the judge model changed (gpt-4o-mini → **claude-sonnet-4.5**) and faithfulness is now a
claim-level judge rather than a citation-overlap check. Treat `bench40` as the new
baseline going forward.

### What changed in the metrics

| Old | New | Why |
|---|---|---|
| `citation_relevance` (golden rules in *citations*) | split into **`rule_recall`** (golden rules in *retrieved context*) + **`citation_recall`** (golden rules *cited in answer*) | Separates a *retrieval* failure from a *reasoning/citation* failure. |
| `faithfulness` (cited rules were in context) | **claim-level LLM judge**: every claim supported by retrieved evidence | RAGAS-style grounding; catches memory-based answers. |
| — | **`card_recall` / `card_precision`** (resolved vs golden cards) | Direct measure of resolver coverage. |
| judge = gpt-4o-mini | judge = **claude-sonnet-4.5** | A weak grader added more noise than the metric was worth. |

### Data fix discovered by the new faithfulness judge

On its very first case the claim-level faithfulness judge flagged that the card context
**never included power/toughness** — every combat-math answer had been running on model
memory. Root cause: the Scryfall importer dropped P/T. Fixed end-to-end (schema, importer,
live fallback, `format_cards_context`) and re-imported (~35k cards).

### `bench40` three-way results (Sonnet-4.5 adjudication + judge)

| metric | zero_shot | baseline_rag | **referee_v2** |
|---|---|---|---|
| **correctness** | 0.237 | 0.512 | **0.688** |
| **faithfulness** | n/a | 0.713 | **0.800** |
| **rule_recall** | n/a | 0.097 | **0.489** |
| **citation_recall** | 0.309 | 0.071 | **0.389** |
| citation_validity | 0.958 | 1.000 | 0.969 |
| card_recall | n/a | 0.963 | **0.975** |
| card_precision | n/a | 1.000 | 1.000 |
| latency p50 / p99 (s) | 13.9 / 25.4 | 14.2 / 22.8 | 34.9 / 134.4 |
| $/case | 0.013 | 0.018 | 0.051 |

Takeaways:

- **`referee_v2` wins every quality metric.** Correctness ~3× zero_shot and +0.18 over RAG.
- **`rule_recall` 0.489 vs RAG 0.097** is the standout: v2's query-decomposition +
  cross-reference expansion pulls the right CR rules 5× more often. RAG answers largely
  from model memory (its decent faithfulness with near-zero rule_recall confirms it).
- **`citation_recall` (0.389) lags `rule_recall` (0.489)**: v2 often retrieves the right
  rule but doesn't always cite it. Addressed with a citation prompt nudge (REASON/FORMAT
  prompts) — pending re-measurement.
- Cost/latency: v2 ≈ 3.5× cost and 2.5× median latency of the baselines, for +0.18
  correctness over RAG.

LangSmith experiments: `bench40-0shot-b5cddb68`, `bench40-rag-f0c18186`,
`bench40-referee_v2-7f82f9b3`.

### Adjudication-model sweep on `bench40` (v2 architecture)

Only the **adjudication (stage-1 reasoning)** model varies; verifier (sonnet-4.5),
router/lookup/format (gpt-4o-mini), and the LLM judge (sonnet-4.5) are held fixed. Cost
is full-pipeline $/case (includes the fixed verifier/format calls). Run sequentially so
latency is contention-free.

| model | correctness | faithfulness | rule_recall | citation_recall | cite_valid | card_recall | lat p50 / p99 (s) | $/case |
|---|---|---|---|---|---|---|---|---|
| **gpt-5.5** | **0.838** | **0.938** | 0.439 | 0.326 | 1.000 | 0.963 | 57.4 / 509 | 0.127 |
| **gpt-5-mini** | 0.700 | 0.825 | **0.484** | **0.361** | 0.994 | 0.963 | 58.0 / 264 | **0.030** |
| **sonnet-4.5** | 0.700 | 0.800 | 0.460 | 0.301 | 0.987 | 0.963 | **28.0** / 131 | 0.044 |
| **opus-4.8** | 0.600 | 0.838 | 0.454 | 0.359 | 0.991 | 0.963 | 31.4 / 156 | 0.086 |

Takeaways (consistent with the earlier sweep on the old architecture):

- **gpt-5.5 leads correctness (0.838) and faithfulness (0.938)** — but is the most
  expensive ($0.127/case, ~4× mini) and has a brutal tail latency (p99 **509 s**).
- **gpt-5-mini is the value champion**: ties sonnet on correctness (0.700), tops both
  retrieval metrics (rule_recall 0.484, citation_recall 0.361), and is the cheapest
  ($0.030/case). Best correctness-per-dollar by far.
- **sonnet-4.5**: same correctness as mini, **fastest median (28 s)**, mid cost.
- **opus-4.8 is the laggard on correctness (0.600)** again — more reasoning capacity does
  not help here and costs 2.8× mini. Drop it for adjudication. (Same pattern as the prior
  sweep — two independent runs agree.) See [Why opus-4.8 underperforms](#why-opus-48-underperforms-on-correctness) below.

Recommendation: **gpt-5-mini** as the default adjudication model (near-top quality, lowest
cost); **gpt-5.5** for a high-accuracy mode where the cost + tail latency are acceptable;
**retire opus-4.8** for adjudication.

LangSmith experiments: `bench40-referee_v2-sonnet45-f7577c33`,
`bench40-referee_v2-opus48-bbfbf87b`, `bench40-referee_v2-gpt5mini-b7ffdd42`,
`bench40-referee_v2-gpt55-2f47f027`.

### Why opus-4.8 underperforms on correctness

Opus ranking last on correctness (0.600 vs 0.700 for sonnet/mini, 0.838 for gpt-5.5) is
counter-intuitive for a frontier model. Trace-level analysis on the bench40 sweep shows this
is **not** a pipeline artifact — it is a pattern of **real reasoning errors on hard
interaction puzzles**, now confirmed across two independent sweeps.

#### What it is *not*

1. **Verifier meta-leak (fixed).** An earlier sweep found Anthropic models sometimes opened
   patched answers with audit talk ("the auditor flagged…"), which the judge scored 0. The
   PATCH prompt + `_strip_meta_lead` backstop fixed that. Current opus answers are clean,
   self-contained rulings.
2. **Extra verifier/patch cycles.** Patch and verify run counts are nearly identical across
   all four models (~16–18 patches, ~110 verifies per 40 cases). Opus is not being dragged
   through more revision loops than the others.
3. **Poor grounding.** Opus faithfulness (0.838) is **second-best** — it stays within the
   retrieved evidence. The failure mode is mis-deduction *from* good evidence, not
   hallucination.

#### What the failures look like

On the **13 cases where opus scored below at least one other model**, the judge comments
show clean, well-cited derivations that reach the **wrong conclusion** on multi-step
RulesGuru puzzles:

| case (abbrev.) | opus | others | failure mode |
|---|---|---|---|
| Wrenn emblem + Daze from graveyard | 0.0 | 1.0 | Mis-ordered alternative vs additional costs → answered "no" |
| Bramblewood Paragon + Thunder-Thrash Elder counters | 0.0 | 1.0 | Counter math: said 6 max, answer is 8 (missed Paragon +1/+1 on top of devour) |
| Forerunner of the Empire + Polyraptor loop | 0.0 | 1.0 | Iterative stack/trigger loop: said 16 tokens, answer is 11 |
| Thorn of Amethyst + Prismatic Ending cost | 0.0 | 1.0 | Cost optimization: said 3 mana (X=1), answer is 2 (X=0) |
| Living Death + Immortal Coil | 0.0 | 1.0 | State-based / replacement interaction |

These are adversarial interaction questions with deliberate traps — exactly the hard
subset that decides rankings on a 40-case average.

#### Answer length vs correctness (inverse correlation)

| model | avg `ruling` length (chars) | correctness |
|---|---|---|
| gpt-5.5 | **1,336** | **0.838** |
| sonnet-4.5 | 2,207 | 0.700 |
| gpt-5-mini | 2,597 | 0.700 |
| opus-4.8 | **2,891** | **0.600** |

Opus writes the **longest** answers and gets the **most** wrong; gpt-5.5 is the most
concise and most correct. At temperature 0, verbose step-by-step derivation on trap-heavy
questions appears to **lock in an early wrong framing** and then build a long, internally
consistent (but incorrect) chain. More tokens ≠ better on this task.

#### Magnitude and confidence

- 0.600 vs 0.700 is roughly **4 cases out of 40** — small-N noise matters.
- ~24 of 40 cases are "gimmes" every model aces; rankings are decided by ~13–16 hard cases.
- gpt-5.5 wins most of those tie-breakers; opus loses most of them.
- Two independent sweeps agree on the **ranking**; exact gaps (±~0.05) should be treated
  as noisy until confirmed on the full 125-case benchmark.

#### Implications

- **Do not assume "bigger model → better referee."** gpt-5.5 (newest frontier reasoner)
  wins here; opus-4.8's general capability does not translate to this narrow adversarial
  rules-QA task under the current v2 harness.
- **gpt-5-mini** offers the best correctness-per-dollar; **gpt-5.5** for max accuracy when
  cost/latency (especially p99 tail) are acceptable.
- **Opus is not recommended for adjudication** unless re-tested at scale (125-case head-to-
  head vs gpt-5.5 only) shows the gap was a bench40 sampling artifact.

#### Open follow-up

Run a focused **125-case gpt-5.5 vs opus-4.8** comparison on `referee_v2` to confirm the
correctness gap holds at scale before permanently retiring opus for this role.

### Caveat — the citation prompt nudge did not clearly help

Between the three-way run and this sweep, REASON/FORMAT prompts were nudged to cite every
relied-upon rule inline. Sonnet's `citation_recall` actually moved **down** (0.389 → 0.301)
while `rule_recall` also dipped (0.489 → 0.460) — within run-to-run noise, but no evident
gain. The retrieved-but-uncited gap persists and needs a different lever (or more samples
to separate signal from variance).

### CI thresholds calibrated

`agents/evals/thresholds.yaml` gates are now set from these numbers (gate sits a margin
below observed to absorb judge variance). The must-beat-RAG compare gate
(`faithfulness`, `rule_recall`, `citation_recall`) was also fixed in `run.py` to apply to
`referee_v2` (it previously only matched a target literally named `referee`).

---

## The pipelines compared

- **zero_shot** — single LLM call, no retrieval. Answers from model memory only.
- **baseline_rag** — linear pipeline: extract card names → resolve cards → semantic
  rules search → single grounded answer (one structured LLM call).
- **referee (v1)** — multi-agent LangGraph: router → card lookup → rules retrieval →
  adjudication → verifier loop (re-retrieve + re-draft from scratch on "ungrounded").
- **referee_no_verifier** — ablation of v1 with the verifier subsystem removed.
- **referee_v2** — improved multi-agent graph (see "The four changes" below).

Models (via OpenRouter, version-pinned in `agents/core/config.py`):
adjudication + verifier = `anthropic/claude-sonnet-4.5`; router + lookup + LLM judge =
`openai/gpt-4o-mini`.

## Metrics

- **correctness** — LLM judge vs. the golden reference answer (0 / 0.5 / 1). The
  headline metric.
- **citation_relevance** — did the golden "expected rules" show up in the citations.
- **citation_validity** — do cited CR numbers actually exist in the Convex CR mirror.
- **faithfulness** — were cited rules present in the retrieved context (RAG/referee only).

## Key finding #1 — the multi-agent graph started out *worse* than RAG

Smoke set (n=15) first flagged it; the 125-case benchmark confirmed it at scale.

Pre-fix benchmark correctness: zero_shot 0.460, **baseline_rag 0.552**, referee_v2 0.496.
Head-to-head (referee_v2 vs rag): **win 23 / tie 62 / lose 40**.

So more machinery (router, verifier loop, etc.) bought a large **citation_relevance**
gain (+0.24 over RAG) but a small **correctness** *loss*. Better evidence, slightly
worse answers.

## Key finding #2 — the verifier *re-draft* loop hurt correctness

Ablation on the smoke set: `referee` (full verifier loop) scored **0.433** correctness
vs **0.567** for `referee_no_verifier`. The v1 verifier, on an "ungrounded" verdict,
threw the draft away and **re-drafted from scratch** with a widened/noisier context —
which turned mostly-correct answers into worse ones. Cost was also ~4× latency
(~49 s/case vs ~12 s).

Fix: `referee_v2` **patches** the existing draft (minimal targeted edit to resolve the
flagged issues) instead of re-drafting.

## Key finding #3 — un-truncating card rulings was *not* the bottleneck

Hypothesis: v1 truncated official card rulings to "first 3, 120 chars each", cutting off
the exact text that answers many interaction questions (e.g. Valakut). We removed all
caps (include every ruling, full length).

Result: aggregate correctness moved **< 1 case** (RAG 0.548 → 0.552; v2 0.500 → 0.496).
Most cards simply have few rulings, so "all" ≈ "first 12" in aggregate. Still kept the
change (it's strictly more correct and helps specific cases), but it was not the lever.

## Key finding #4 (the breakthrough) — the two-stage format step was discarding the reasoning

`referee_v2` uses **two-stage adjudication**: stage 1 = frontier model reasons in free
prose; stage 2 = cheap model extracts the structured `RulingResponse`. The bug: stage 2
**compressed** the multi-paragraph reasoning into a one-line `ruling`, and the
correctness judge grades the `ruling` text. Many answers were correct but scored 0.5 for
"lacks explanation."

Fix (`agents/referee/adjudicate.py`): preserve stage-1 prose **verbatim** as the `ruling`; stage 2
only extracts citations / confidence / notes — it never rewrites the answer.

Impact (same 125 cases): correctness **0.496 → 0.716** (+0.22). This single change flipped
a ~0.05 deficit vs RAG into a **+0.16 lead**.

## The four changes in `referee_v2`

(`agents/referee/v2/graph.py`, kept separate from the untouched v1 `agents/referee/v1/graph.py`.)

1. **Generous card rulings** — include all official rulings, full length
   (`agents/core/context.py`). Shared, so RAG benefits too.
2. **Two-stage reason→format adjudication** — frontier model reasons in prose, cheap
   model structures it; **prose is preserved verbatim as the answer**
   (`agents/referee/adjudicate.py`, `agents/referee/nodes/adjudication_v2.py`). ← the decisive fix.
3. **Verifier patches instead of re-drafts** — minimal targeted edit on "ungrounded"
   (`agents/referee/nodes/patch.py`).
4. **Query decomposition + cross-reference expansion** — narrative question split into
   2–4 focused CR searches; "see rule NNN" references followed deterministically
   (`agents/referee/nodes/decompose.py`, `agents/referee/nodes/rules_retrieval_v2.py`).

## Remaining known issues (future work)

- **Genuine reasoning flips** still lose a handful of cases vs RAG (e.g. Shahrazad
  subgame, Nexus of Fate replacement, Master of Cruelties).
- **Disambiguation leak** — on at least one case (Aluren / Embrose) the card-lookup
  disambiguation stop fired and asked for clarification instead of answering the rules
  question. RAG has no such stop.
- **citation_recall lags rule_recall** — retrieved-but-uncited gap; prompt nudge did not
  clearly help (see caveat above).
- **Adjudication model choice** — bench40 sweep favors gpt-5-mini (value) / gpt-5.5
  (accuracy); opus underperformance documented above. Default still sonnet-4.5 in config
  until explicitly switched.
- **125-case confirmation** — bench40 gates calibrated; full benchmark run still pending
  with revamped metrics.

## Reproduction

```bash
# Pinned 40-case comparison (cheap, repeatable)
uv run python -m agents.evals.run --suite bench40 \
  --compare zero_shot baseline_rag referee_v2 --concurrency 3 --skip-thresholds

# Adjudication-model sweep on v2 (one model at a time)
uv run python -m agents.evals.run --suite bench40 --target referee_v2 \
  --adjudication-model openai/gpt-5-mini --model-label gpt5mini \
  --concurrency 3 --skip-thresholds

# Full benchmark comparison (125 cases)
uv run python -m agents.evals.run --suite benchmark \
  --compare zero_shot baseline_rag referee_v2 --concurrency 6 --skip-thresholds
```

Dataset: <https://smith.langchain.com/datasets/3f3d750d-2ddb-4ff6-b93e-8930e10b0da0>

LangSmith experiments referenced:

| run | experiment |
|---|---|
| zero_shot (benchmark) | `benchmark-0shot-dc217113` |
| baseline_rag (uncapped rulings) | `benchmark-rag-deff6da0` |
| referee_v2 (pre-fix, capped) | `benchmark-referee_v2-027d7e96` |
| referee_v2 (pre-fix, uncapped) | `benchmark-referee_v2-eedcb571` |
| **referee_v2 (final, prose fix)** | `benchmark-referee_v2-6e15c3bb` |

## Appendix — smoke results (n=15, directional only)

| metric | zero_shot | baseline_rag | referee (v1) | referee_no_verifier |
|---|---|---|---|---|
| correctness | 0.567 | 0.600 | 0.433 | 0.567 |
| citation_relevance | 0.280 | 0.133 | 0.369 | 0.133 |
| citation_validity | 0.967 | 1.000 | 1.000 | 1.000 |
| faithfulness | n/a | 1.000 | 1.000 | 1.000 |
