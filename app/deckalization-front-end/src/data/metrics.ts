// Metric definitions, snapshotted from docs/eval-findings.md
// ("What changed in the metrics" + "Metrics").

export interface MetricDef {
  key: string
  name: string
  kind: "LLM judge" | "Deterministic"
  range: string
  summary: string
  howMeasured: string
}

export const METRICS: MetricDef[] = [
  {
    key: "correctness",
    name: "Correctness",
    kind: "LLM judge",
    range: "0 / 0.5 / 1",
    summary: "Does the answer match the golden reference answer? The headline metric.",
    howMeasured:
      "claude-sonnet-4.5 grades the produced ruling against the expert reference answer on a 0 / 0.5 / 1 scale (wrong / partially right / right).",
  },
  {
    key: "faithfulness",
    name: "Faithfulness",
    kind: "LLM judge",
    range: "0 – 1",
    summary: "Is every claim in the answer actually supported by the retrieved evidence?",
    howMeasured:
      "A claim-level (RAGAS-style) judge decomposes the answer into individual claims and checks each against the retrieved card text and rules. Catches answers that are right 'from memory' but ungrounded.",
  },
  {
    key: "rule_recall",
    name: "Rule recall",
    kind: "Deterministic",
    range: "0 – 1",
    summary: "Did the right Comprehensive Rules end up in the retrieved context?",
    howMeasured:
      "Fraction of the case's golden 'expected rules' that appear in the retrieved context. Isolates retrieval quality from reasoning.",
  },
  {
    key: "citation_recall",
    name: "Citation recall",
    kind: "Deterministic",
    range: "0 – 1",
    summary: "Did the answer actually cite the right rules?",
    howMeasured:
      "Fraction of the golden 'expected rules' that are cited in the final answer. Paired with rule recall, it exposes the retrieved-but-uncited gap (a reasoning/citation failure, not a retrieval one).",
  },
  {
    key: "citation_validity",
    name: "Citation validity",
    kind: "Deterministic",
    range: "0 – 1",
    summary: "Do the cited rule numbers actually exist?",
    howMeasured:
      "Every cited CR number is looked up in the Convex Comprehensive-Rules mirror; the score is the fraction that resolve to a real rule. Guards against invented citations.",
  },
  {
    key: "card_recall",
    name: "Card recall",
    kind: "Deterministic",
    range: "0 – 1",
    summary: "Were the cards the question is about correctly resolved?",
    howMeasured:
      "Fraction of the case's golden cards that the resolver found. A direct measure of resolver coverage.",
  },
  {
    key: "card_precision",
    name: "Card precision",
    kind: "Deterministic",
    range: "0 – 1",
    summary: "Were only the relevant cards resolved (no spurious extras)?",
    howMeasured: "Fraction of resolved cards that are in the case's golden set.",
  },
]
