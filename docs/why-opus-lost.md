# Why Opus Lost the Adjudication Sweep

> A focused post-mortem on why `anthropic/claude-opus-4.8` finished **last on
> correctness** in the `referee_v2` adjudication-model sweep — despite being the
> most capable general model in the field. All numbers are pulled from the
> LangSmith experiments on the pinned 40-case benchmark (`bench40`); experiment
> IDs are listed at the bottom so every figure is reproducible.

## TL;DR

- On `bench40` (40 pinned rules questions, judged by `claude-sonnet-4.5`), the
  **only** thing varied was the **adjudication (stage-1 reasoning) model**.
  Everything else — verifier, router, lookup, formatter, retrieval, and the LLM
  judge — was held fixed.
- **Opus came last on correctness: `0.600`**, behind `gpt-5-mini` and
  `sonnet-4.5` (both `0.700`) and well behind `gpt-5.5` (`0.838`).
- It is **not** a pipeline bug and **not** hallucination. Opus's grounding
  (faithfulness `0.838`) is the **second best** in the field. It stays inside the
  retrieved evidence and then **mis-deduces from it** on hard, multi-step
  interaction puzzles.
- Opus also writes the **longest** answers and gets the **most** wrong — a clean
  inverse correlation between verbosity and correctness on this task.
- **Verdict: not recommended for adjudication.** `gpt-5-mini` is the
  correctness-per-dollar default; `gpt-5.5` is the high-accuracy option.

## The sweep, precisely

The sweep isolates one variable. For every model below, the graph is identical
`referee_v2`; only the **stage-1 adjudication** model changes:

| Held fixed | Model |
|---|---|
| Router / card lookup / formatter | `openai/gpt-4o-mini` |
| Verifier (grounding critic) | `anthropic/claude-sonnet-4.5` |
| LLM judge (grades correctness/faithfulness) | `anthropic/claude-sonnet-4.5` |
| Dataset | `bench40` — 40 pinned cases, stratified by category/complexity |

`$/case` is **full-pipeline** cost (it includes the fixed verifier/format calls,
not just the adjudication call). Runs were executed sequentially so latency is
contention-free.

## Results (live from LangSmith, n = 40)

| model | correctness | faithfulness | rule_recall | citation_recall | cite_valid | card_recall | $/case |
|---|---|---|---|---|---|---|---|
| **gpt-5.5** | **0.838** | **0.938** | 0.439 | 0.326 | 1.000 | 0.963 | 0.127 |
| **gpt-5-mini** | 0.700 | 0.825 | **0.484** | **0.361** | 0.994 | 0.963 | **0.030** |
| **sonnet-4.5** | 0.700 | 0.800 | 0.460 | 0.301 | 0.987 | 0.963 | 0.044 |
| **opus-4.8** | **0.600** | 0.838 | 0.454 | 0.359 | 0.991 | 0.963 | 0.086 |

Two things jump out:

1. **Opus is last on the headline metric (correctness) by a clear margin** —
   `0.600` vs `0.700`/`0.838` — while costing **~2.8× more than `gpt-5-mini`**.
2. **Every *non*-correctness metric is essentially tied.** Opus's retrieval
   (`rule_recall` 0.454, `citation_recall` 0.359), citation validity (0.991),
   and card recall (0.963) are all in line with the pack. The retrieval layer
   handed every model the same evidence. **The gap is purely in what Opus *did*
   with that evidence.**

## Why this is surprising — and what it is *not*

Opus is the strongest general-purpose model in the field, so finishing last is
counter-intuitive. Trace-level analysis rules out the usual suspects:

1. **Not a pipeline/formatting artifact.** An earlier sweep caught Anthropic
   models occasionally leaking verifier "audit" talk into the patched answer
   (e.g. *"the auditor flagged…"*), which the judge scored `0`. That was fixed
   (PATCH prompt + a `_strip_meta_lead` backstop). Current Opus answers are
   clean, self-contained rulings.
2. **Not extra revision loops.** Patch/verify counts are nearly identical across
   all four models (~16–18 patches, ~110 verifies per 40 cases). Opus is not
   being dragged through more retries than its peers.
3. **Not hallucination / poor grounding.** Opus faithfulness is **0.838 — second
   best in the field**, above both `gpt-5-mini` and `sonnet-4.5`. It cites real
   rules and stays inside the retrieved context. The failure mode is
   **mis-deduction from correct evidence**, not making things up.

So the loss is real reasoning error on the hard subset, confirmed across two
independent sweeps that agree on the ranking.

## What the failures actually look like

Opus scored `0.0` on **15 of 40** cases. Pulled straight from the judge feedback
on experiment `bench40-referee_v2-opus48-bbfbf87b`, the failures cluster into a
few recognizable modes — almost all are clean, well-cited derivations that reach
the **wrong final answer** on adversarial, multi-step puzzles.

### Mode 1 — Counting / iterative-stack math

| case (abbrev.) | Opus said | correct | error |
|---|---|---|---|
| Bramblewood Paragon ×2 + Thunder-Thrash Elder | 6 counters | **8** | missed the Paragons' +1/+1 *on top of* devour |
| Forerunner of the Empire + Polyraptor loop | 16 tokens | **11** | resolved Enrage triggers in a batch instead of one-at-a-time on the stack → exponential instead of linear |
| Slimefoot + Deafening Clarion (lifelink timing) | gains 1 life | **2** | claimed damage is dealt "before lifelink is granted" |

> *Judge, Forerunner/Polyraptor:* "concludes with 16 Polyraptors, while the
> reference answer states 11 … treats each 'activation' as if all Enrage triggers
> resolve simultaneously before the next Forerunner trigger, leading to
> exponential [growth]."

### Mode 2 — Yes/No interaction flips

| case (abbrev.) | Opus said | correct | error |
|---|---|---|---|
| Wrenn & Six emblem + Daze from graveyard | "No" | **Yes** | mis-ordered alternative vs additional costs |
| Volrath's Shapeshifter + Yixlid Jailer (flying?) | "No" | **Yes** | Yixlid removes *abilities*, not *text* — Shapeshifter still copies type line |
| Living Death + Immortal Coil + Voidslime | opposite verdict | — | missed that Immortal Coil is a **once**-only state trigger |
| Life and Limb + Blood Moon (is Stomping Ground a creature?) | opposite verdict | — | applied **timestamp** order; **dependency** rules override it |
| Bludgeon Brawl + Darksteel Garrison subtypes | unattaches | — | missed that Bludgeon Brawl **overwrites** subtypes wholesale |

### Mode 3 — Replacement-effect misreads

- **Alhammarret's Archive / Alms Collector**: Opus concluded **0 cards** drawn;
  the reference is **29**. Judge: *"core error is in the interpretation of Alms
  Collector's interaction with replacement effects … incorrectly claims Alms
  Collector 'intercepts every multi-draw instruction'."*

### Mode 4 — Refusing to answer (disambiguation leak)

On two modal/double-faced-card questions, Opus **asked for clarification instead
of ruling**, even though the question gave the full card name:

- *Aluren + Embrose, Dean of Shadow* — "requests clarification" on an MDFC that
  was already fully specified.
- *Walk-In Closet // Forgotten Cellar + Zoetic Cavern* — "incorrectly claims …
  ambiguous when the question explicitly provides the full double-faced card
  name."

This is the same disambiguation-stop behavior noted as a known issue; Opus trips
it more readily than the other models. (RAG/zero-shot have no such stop.)

## The verbosity signal: longer answers, more errors

Average `ruling` length vs correctness across the sweep traces:

| model | avg ruling length (chars) | correctness |
|---|---|---|
| gpt-5.5 | **1,336** | **0.838** |
| sonnet-4.5 | 2,207 | 0.700 |
| gpt-5-mini | 2,597 | 0.700 |
| opus-4.8 | **2,891** | **0.600** |

Opus writes the **longest** answers and is the **least** correct; `gpt-5.5` is
the most concise and most correct. At temperature 0, long step-by-step
derivation on trap-heavy questions appears to **lock in an early wrong framing**
and then build a long, internally consistent — but incorrect — chain on top of
it. **More tokens ≠ better** on this narrow adversarial task.

## How big is the gap, really?

Be honest about small-N:

- `0.600` vs `0.700` is roughly **4 cases out of 40**.
- ~24 of 40 cases are "gimmes" every model aces; the ranking is decided by the
  ~13–16 genuinely hard interaction puzzles. `gpt-5.5` wins most of those
  tie-breakers; Opus loses most of them.
- **Two independent sweeps agree on the ranking.** Exact gaps (±~0.05) should be
  treated as noisy until confirmed on the full 125-case benchmark.

## Recommendation

- **Do not use Opus for adjudication** in `referee_v2` as it stands. Its general
  capability does not translate to this narrow, adversarial rules-QA task, and it
  costs ~2.8× the value pick for *worse* correctness.
- **Default: `gpt-5-mini`** — ties on correctness, tops both retrieval metrics,
  cheapest in the field (best correctness-per-dollar). This is the pinned default
  in `agents/core/config.py`.
- **High-accuracy mode: `gpt-5.5`** — best correctness and faithfulness, when its
  cost (`$0.127/case`) and tail latency (p99 ~509 s) are acceptable.

## Open follow-up

Before permanently retiring Opus for this role, run a focused **125-case
`gpt-5.5` vs `opus-4.8`** head-to-head on `referee_v2` to confirm the correctness
gap holds at scale (and isn't a `bench40` sampling artifact).

## Reproduction

```bash
# Re-run the Opus arm of the sweep (one model at a time)
uv run python -m agents.evals.run --suite bench40 --target referee_v2 \
  --adjudication-model anthropic/claude-opus-4.8 --model-label opus48 \
  --concurrency 3 --skip-thresholds
```

LangSmith experiments behind every number on this page:

| model | experiment |
|---|---|
| gpt-5.5 | `bench40-referee_v2-gpt55-2f47f027` |
| gpt-5-mini | `bench40-referee_v2-gpt5mini-b7ffdd42` |
| sonnet-4.5 | `bench40-referee_v2-sonnet45-f7577c33` |
| **opus-4.8** | `bench40-referee_v2-opus48-bbfbf87b` |

Dataset: <https://smith.langchain.com/datasets/3f3d750d-2ddb-4ff6-b93e-8930e10b0da0>

See also: [`docs/eval-findings.md`](./eval-findings.md) → *"Adjudication-model
sweep"* for the full four-pipeline context.
