// Static snapshot of the Phase 5 eval results.
// Source of truth: docs/eval-findings.md (bench40 — the pinned 40-case subset,
// judged by claude-sonnet-4.5). Update both together if numbers change.

export type PipelineKey = "zero_shot" | "baseline_rag" | "referee_v2"

export interface Pipeline {
  key: PipelineKey
  label: string
  blurb: string
}

export const PIPELINES: Pipeline[] = [
  { key: "zero_shot", label: "Zero-shot", blurb: "No retrieval" },
  { key: "baseline_rag", label: "RAG baseline", blurb: "Single-chain retrieval" },
  { key: "referee_v2", label: "Referee v2", blurb: "Multi-agent (production)" },
]

export interface ScoreRow {
  key: string
  label: string
  zero_shot: number | null
  baseline_rag: number | null
  referee_v2: number | null
  /** Headline metric — emphasised in the UI. */
  headline?: boolean
  /** Lower is better (latency, cost). Default false = higher is better. */
  lowerBetter?: boolean
  /** "ratio" renders 0-1 values as-is; "raw" leaves numbers untouched. */
  format?: "ratio" | "raw"
}

// 0-1 quality metrics (higher is better). RAG + referee_v2 are the latest
// coherent run (gpt-5-mini adjudication, experiments bench40-rag-fec40ed9 /
// bench40-referee_v2-798f6c55). zero_shot is the documented floor (prior run).
export const BENCH40_QUALITY: ScoreRow[] = [
  { key: "correctness", label: "Correctness", zero_shot: 0.237, baseline_rag: 0.575, referee_v2: 0.7, headline: true, format: "ratio" },
  { key: "faithfulness", label: "Faithfulness", zero_shot: null, baseline_rag: 0.825, referee_v2: 0.85, format: "ratio" },
  { key: "rule_recall", label: "Rule recall", zero_shot: null, baseline_rag: 0.097, referee_v2: 0.34, format: "ratio" },
  { key: "citation_recall", label: "Citation recall", zero_shot: 0.309, baseline_rag: 0.097, referee_v2: 0.287, format: "ratio" },
  { key: "citation_validity", label: "Citation validity", zero_shot: 0.958, baseline_rag: 1.0, referee_v2: 1.0, format: "ratio" },
  { key: "card_recall", label: "Card recall", zero_shot: null, baseline_rag: 0.963, referee_v2: 0.963, format: "ratio" },
  { key: "card_precision", label: "Card precision", zero_shot: null, baseline_rag: 1.0, referee_v2: 1.0, format: "ratio" },
]

// Efficiency metrics (lower is better). Contention-free figures from the
// adjudication sweep; referee_v2 reflects the gpt-5-mini default.
export const BENCH40_EFFICIENCY: ScoreRow[] = [
  { key: "latency_p50", label: "Latency p50 (s)", zero_shot: 13.9, baseline_rag: 14.2, referee_v2: 58.0, lowerBetter: true, format: "raw" },
  { key: "latency_p99", label: "Latency p99 (s)", zero_shot: 25.4, baseline_rag: 22.8, referee_v2: 264.0, lowerBetter: true, format: "raw" },
  { key: "cost", label: "Cost ($/case)", zero_shot: 0.013, baseline_rag: 0.018, referee_v2: 0.03, lowerBetter: true, format: "raw" },
]

export interface ModelSweepRow {
  model: string
  label: string
  tag: string
  tagTone: "good" | "neutral" | "warn"
  correctness: number
  faithfulness: number
  rule_recall: number
  citation_recall: number
  citation_validity: number
  card_recall: number
  latency_p50: number
  latency_p99: number
  cost: number
  answer_chars: number
}

// Adjudication-model sweep on the referee_v2 architecture (bench40). Only the
// stage-1 reasoning model varies; verifier/format/judge are held fixed.
export const MODEL_SWEEP: ModelSweepRow[] = [
  { model: "openai/gpt-5.5", label: "gpt-5.5", tag: "Max accuracy", tagTone: "good", correctness: 0.838, faithfulness: 0.938, rule_recall: 0.439, citation_recall: 0.326, citation_validity: 1.0, card_recall: 0.963, latency_p50: 57.4, latency_p99: 509, cost: 0.127, answer_chars: 1336 },
  { model: "openai/gpt-5-mini", label: "gpt-5-mini", tag: "Production default", tagTone: "good", correctness: 0.7, faithfulness: 0.825, rule_recall: 0.484, citation_recall: 0.361, citation_validity: 0.994, card_recall: 0.963, latency_p50: 58.0, latency_p99: 264, cost: 0.03, answer_chars: 2597 },
  { model: "anthropic/claude-sonnet-4.5", label: "sonnet-4.5", tag: "Strong alternative", tagTone: "neutral", correctness: 0.7, faithfulness: 0.8, rule_recall: 0.46, citation_recall: 0.301, citation_validity: 0.987, card_recall: 0.963, latency_p50: 28.0, latency_p99: 131, cost: 0.044, answer_chars: 2207 },
  { model: "anthropic/claude-opus-4.8", label: "opus-4.8", tag: "Not recommended", tagTone: "warn", correctness: 0.6, faithfulness: 0.838, rule_recall: 0.454, citation_recall: 0.359, citation_validity: 0.991, card_recall: 0.963, latency_p50: 31.4, latency_p99: 156, cost: 0.086, answer_chars: 2891 },
]

export interface HeadlineStat {
  value: string
  label: string
  detail: string
}

export const HEADLINE_STATS: HeadlineStat[] = [
  {
    value: "0.70",
    label: "Correctness",
    detail: "referee_v2 on the 40-case benchmark: +0.13 over RAG, ~3× zero-shot",
  },
  {
    value: "3.5×",
    label: "Rule retrieval vs RAG",
    detail: "rule_recall 0.34 vs 0.10 via query decomposition + cross-reference expansion",
  },
  {
    value: "0.85",
    label: "Faithfulness",
    detail: "claims grounded in retrieved evidence (claim-level RAGAS-style judge)",
  },
]

export const EXPERIMENT_META = {
  suite: "bench40",
  suiteDescription: "A pinned 40-case subset of the golden rules-QA benchmark, for cheap, repeatable comparisons.",
  judge: "claude-sonnet-4.5",
  adjudicationDefault: "gpt-5-mini",
  cheapModel: "gpt-4o-mini (router · lookup · format)",
  gateway: "OpenRouter",
  // Latest coherent RAG-vs-v2 run (LangSmith experiments), gpt-5-mini adjudication.
  ragExperiment: "bench40-rag-fec40ed9",
  refereeExperiment: "bench40-referee_v2-798f6c55",
}

// Per-interaction-category correctness, sliced from LangSmith example metadata
// (metadata.category). Ordered by referee_v2's win margin over RAG — where the
// graph helps most first. Small buckets (low n) are directional only.
export interface BreakdownBucket {
  label: string
  n: number
  values: Partial<Record<PipelineKey, number | null>>
}

export const CATEGORY_BREAKDOWN: BreakdownBucket[] = [
  { label: "Costs, casting & mana", n: 8, values: { baseline_rag: 0.375, referee_v2: 0.75 } },
  { label: "Replacement & prevention", n: 6, values: { baseline_rag: 0.5, referee_v2: 0.75 } },
  { label: "Triggers, abilities & the stack", n: 11, values: { baseline_rag: 0.727, referee_v2: 0.773 } },
  { label: "Layers & continuous effects", n: 11, values: { baseline_rag: 0.727, referee_v2: 0.727 } },
  { label: "Combat, zones & state", n: 4, values: { baseline_rag: 0.25, referee_v2: 0.25 } },
]

export const COMPLEXITY_BREAKDOWN: BreakdownBucket[] = [
  { label: "Simple", n: 28, values: { baseline_rag: 0.571, referee_v2: 0.75 } },
  { label: "Intermediate", n: 9, values: { baseline_rag: 0.667, referee_v2: 0.667 } },
  { label: "Complicated", n: 3, values: { baseline_rag: 0.333, referee_v2: 0.333 } },
]
