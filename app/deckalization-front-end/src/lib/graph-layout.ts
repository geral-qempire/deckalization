import type { RefereeNodeId } from "@/lib/graph-events"

export interface NodeLayout {
  id: RefereeNodeId
  label: string
  blurb: string
  x: number
  y: number
}

export interface EdgeLayout {
  from: RefereeNodeId
  to: RefereeNodeId
  kind: "main" | "branch" | "loop"
}

export const VIEWBOX = { w: 1108, h: 230 }
export const NODE_W = 128
export const NODE_H = 50

const MAIN_Y = 64
const BRANCH_Y = 162

// Mirrors agents/referee/v2/graph.py.
export const NODE_LAYOUT: NodeLayout[] = [
  { id: "router", label: "Router", blurb: "Classify intent & format", x: 74, y: MAIN_Y },
  { id: "card_lookup", label: "Card lookup", blurb: "Resolve card names", x: 234, y: MAIN_Y },
  { id: "decompose", label: "Decompose", blurb: "Split into sub-queries", x: 394, y: MAIN_Y },
  { id: "rules_retrieval", label: "Rules retrieval", blurb: "Search + cross-refs", x: 554, y: MAIN_Y },
  { id: "adjudication", label: "Adjudication", blurb: "Reason in prose", x: 714, y: MAIN_Y },
  { id: "verifier", label: "Verifier", blurb: "Grounded? loop : pass", x: 874, y: MAIN_Y },
  { id: "formatter", label: "Formatter", blurb: "Final ruling", x: 1034, y: MAIN_Y },
  { id: "patch", label: "Patch", blurb: "Targeted fix on retry", x: 714, y: BRANCH_Y },
  { id: "out_of_scope", label: "Out of scope", blurb: "Not a rules question", x: 234, y: BRANCH_Y },
]

export const EDGE_LAYOUT: EdgeLayout[] = [
  { from: "router", to: "card_lookup", kind: "main" },
  { from: "card_lookup", to: "decompose", kind: "main" },
  { from: "decompose", to: "rules_retrieval", kind: "main" },
  { from: "rules_retrieval", to: "adjudication", kind: "main" },
  { from: "adjudication", to: "verifier", kind: "main" },
  { from: "verifier", to: "formatter", kind: "main" },
  { from: "rules_retrieval", to: "patch", kind: "branch" },
  { from: "patch", to: "verifier", kind: "branch" },
  { from: "verifier", to: "rules_retrieval", kind: "loop" },
  { from: "router", to: "out_of_scope", kind: "branch" },
  { from: "out_of_scope", to: "formatter", kind: "branch" },
]

export const NODE_BY_ID: Record<RefereeNodeId, NodeLayout> = Object.fromEntries(
  NODE_LAYOUT.map((n) => [n.id, n]),
) as Record<RefereeNodeId, NodeLayout>

/** Default order used by the timeline / step labels. */
export const NODE_ORDER: RefereeNodeId[] = [
  "router",
  "card_lookup",
  "decompose",
  "rules_retrieval",
  "adjudication",
  "patch",
  "verifier",
  "out_of_scope",
  "formatter",
]
