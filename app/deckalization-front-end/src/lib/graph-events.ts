// Normalized graph-event schema shared by the live stream (LangGraph Platform,
// proxied) and the pre-recorded replay player. Both paths emit this shape so a
// single renderer drives the demo. Field names mirror the Python RefereeState
// (agents/referee/state.py) and the node return shapes.

export type RefereeNodeId =
  | "router"
  | "card_lookup"
  | "decompose"
  | "rules_retrieval"
  | "adjudication"
  | "patch"
  | "verifier"
  | "out_of_scope"
  | "formatter"

export interface RuleCitation {
  rule_number: string
  excerpt: string
  relevance?: string
}

export interface CardCitation {
  name: string
  oracle_excerpt: string
  relevance?: string
}

export type Confidence = "high" | "medium" | "low"

export interface RulingResponse {
  ruling: string
  rule_citations: RuleCitation[]
  card_citations: CardCitation[]
  confidence: Confidence
  notes?: string | null
}

export interface RouterDecision {
  intent: "rules" | "out_of_scope" | "needs_format"
  game_format?: string | null
  reason?: string
}

export interface VerifierVerdict {
  verdict: "grounded" | "ungrounded"
  issues?: string[]
  retrieval_hints?: string[]
}

export interface CardData {
  name: string
  oracleText?: string
  typeLine?: string
  manaCost?: string | null
  power?: string | null
  toughness?: string | null
  rulings?: { comment?: string }[]
}

export interface ResolvedCardEntry {
  query: string
  method?: string
  confidence?: string
  card: CardData
}

export interface RuleHit {
  ruleNumber: string
  section?: string
  score?: number
  text: string
}

/** Partial RefereeState a node writes — only the fields the UI renders. */
export interface RefereeStateDelta {
  router_decision?: RouterDecision
  route?: string
  game_format?: string | null
  card_names?: string[]
  resolved_cards?: ResolvedCardEntry[]
  unresolved_notes?: string[]
  disambiguation?: { query: string; candidates: unknown[] }[]
  subqueries?: string[]
  retrieval_query?: string
  retrieved_rules?: RuleHit[]
  draft_ruling?: RulingResponse | null
  verdict?: VerifierVerdict | null
  loop_count?: number
  final_response?: RulingResponse | null
}

export type GraphEvent =
  | { type: "start"; question: string; mode: "live" | "replay" }
  | { type: "node"; node: RefereeNodeId; delta: RefereeStateDelta; index: number }
  | { type: "final"; response: RulingResponse | null }
  | { type: "error"; message: string }

/** A fully captured run — the on-disk format for pre-recorded showcase runs. */
export interface RecordedRun {
  slug: string
  question: string
  blurb: string
  events: GraphEvent[]
}
