// Architecture descriptions, snapshotted from docs/eval-findings.md
// ("The pipelines compared" and "The four changes in referee_v2").

export interface Architecture {
  key: string
  name: string
  tagline: string
  steps: string[]
  description: string
  status: "baseline" | "production" | "ablation"
}

export const ARCHITECTURES: Architecture[] = [
  {
    key: "zero_shot",
    name: "Zero-shot",
    tagline: "A single LLM call, no retrieval",
    steps: ["question", "LLM", "answer"],
    description:
      "One model call answering purely from memory — no card data, no rules text. The floor: it shows how far raw model knowledge gets you on adversarial rules questions.",
    status: "baseline",
  },
  {
    key: "baseline_rag",
    name: "RAG baseline",
    tagline: "A linear retrieval chain",
    steps: ["extract cards", "resolve cards", "search rules", "answer"],
    description:
      "Extract card names, resolve them to Oracle text, run one semantic search over the Comprehensive Rules, then produce a single grounded, structured answer. Strong and cheap — the bar the agent has to beat.",
    status: "baseline",
  },
  {
    key: "referee_v1",
    name: "Referee v1",
    tagline: "First multi-agent graph",
    steps: ["router", "card lookup", "rules retrieval", "adjudication", "verifier loop"],
    description:
      "A multi-agent LangGraph: route → look up cards → retrieve rules → adjudicate → verify. On an 'ungrounded' verdict the verifier re-retrieved and re-drafted from scratch. It improved citations but actually lost correctness to plain RAG — the machinery hurt the answers.",
    status: "ablation",
  },
  {
    key: "referee_v2",
    name: "Referee v2",
    tagline: "The production architecture",
    steps: [
      "router",
      "card lookup",
      "decompose",
      "rules retrieval",
      "adjudication",
      "verifier (loop → patch)",
      "formatter",
    ],
    description:
      "The fixed multi-agent graph. Four targeted changes turned a deficit-vs-RAG into a decisive lead on every quality metric. This is what the live demo runs.",
    status: "production",
  },
]

export interface ChangeNote {
  title: string
  body: string
  decisive?: boolean
}

export const REFEREE_V2_CHANGES: ChangeNote[] = [
  {
    title: "Generous card rulings",
    body: "Include every official card ruling at full length in context (no 'first 3, 120 chars' truncation). Shared with RAG, so both benefit.",
  },
  {
    title: "Two-stage reason → format adjudication",
    body: "A frontier model reasons in free prose; a cheap model only extracts citations and confidence. The prose is preserved verbatim as the answer instead of being compressed to one line.",
    decisive: true,
  },
  {
    title: "Verifier patches instead of re-drafts",
    body: "On an 'ungrounded' verdict the verifier makes a minimal, targeted edit to the existing draft rather than throwing it away and rewriting from scratch with noisier context.",
  },
  {
    title: "Query decomposition + cross-reference expansion",
    body: "A narrative question is split into 2–4 focused CR searches, and 'see rule NNN' references are followed deterministically — pulling the right rules ~5× more often than RAG.",
  },
]

export interface Finding {
  title: string
  body: string
}

export const KEY_FINDINGS: Finding[] = [
  {
    title: "The multi-agent graph started out worse than RAG",
    body: "Before the fixes, referee correctness was 0.496 vs RAG's 0.552. More machinery (router, verifier loop) bought a big citation gain but a small correctness loss: better evidence, slightly worse answers.",
  },
  {
    title: "The verifier re-draft loop hurt correctness",
    body: "An ablation scored the full verifier loop at 0.433 correctness vs 0.567 with the verifier removed. Re-drafting from scratch on 'ungrounded' turned mostly-correct answers into worse ones (and cost ~4× the latency). v2 patches instead.",
  },
  {
    title: "Un-truncating card rulings was not the bottleneck",
    body: "Removing all ruling caps moved aggregate correctness by less than one case — most cards simply have few rulings. Kept the change (strictly more correct), but it was not the lever.",
  },
  {
    title: "The breakthrough: the format step was discarding the reasoning",
    body: "Two-stage adjudication was compressing multi-paragraph reasoning into a one-line ruling — and the judge grades that text. Preserving the stage-1 prose verbatim lifted correctness 0.496 → 0.716 (+0.22), flipping a deficit into a +0.16 lead over RAG.",
  },
  {
    title: "Bigger model ≠ better referee",
    body: "On the adjudication sweep, opus-4.8 ranked last on correctness (0.600) while the newer, more concise gpt-5.5 led (0.838). Opus writes the longest answers and gets the most wrong: at temperature 0, verbose step-by-step derivation on trap questions locks in an early wrong framing. gpt-5-mini ties sonnet on correctness at the lowest cost.",
  },
]

export const MODELS_NOTE =
  "Models are version-pinned via OpenRouter. Default: adjudication = gpt-5-mini (bench40 sweep winner on correctness-per-dollar); verifier = claude-sonnet-4.5; router + lookup + format = gpt-4o-mini; LLM judge = claude-sonnet-4.5."
