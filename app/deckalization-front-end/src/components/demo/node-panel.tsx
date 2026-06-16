import {
  CheckCircle2,
  Compass,
  FileText,
  GitBranch,
  Layers,
  ListTree,
  PenLine,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { RulingCard } from "@/components/demo/ruling-card"
import type { RefereeNodeId, RefereeStateDelta } from "@/lib/graph-events"
import { NODE_BY_ID } from "@/lib/graph-layout"

const NODE_ICON: Record<RefereeNodeId, React.ComponentType<{ className?: string }>> = {
  router: Compass,
  card_lookup: Layers,
  decompose: ListTree,
  rules_retrieval: Search,
  adjudication: Scale,
  patch: PenLine,
  verifier: ShieldCheck,
  out_of_scope: ShieldAlert,
  formatter: FileText,
}

export function NodePanel({
  node,
  delta,
  active,
}: {
  node: RefereeNodeId
  delta: RefereeStateDelta
  active?: boolean
}) {
  const meta = NODE_BY_ID[node]
  const Icon = NODE_ICON[node]
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card p-4 transition-colors",
        active && "border-primary/50 ring-1 ring-primary/20",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <span className="font-medium">{meta.label}</span>
        <span className="text-xs text-muted-foreground">{meta.blurb}</span>
      </div>
      <NodeBody node={node} delta={delta} />
    </div>
  )
}

function NodeBody({ node, delta }: { node: RefereeNodeId; delta: RefereeStateDelta }) {
  switch (node) {
    case "router":
      return <RouterBody delta={delta} />
    case "card_lookup":
      return <CardLookupBody delta={delta} />
    case "decompose":
      return <DecomposeBody delta={delta} />
    case "rules_retrieval":
      return <RulesBody delta={delta} />
    case "adjudication":
    case "patch":
      return delta.draft_ruling ? (
        <RulingCard ruling={delta.draft_ruling} compact />
      ) : (
        <Empty>No draft produced.</Empty>
      )
    case "verifier":
      return <VerifierBody delta={delta} />
    case "formatter":
      return delta.final_response ? (
        <RulingCard ruling={delta.final_response} />
      ) : (
        <Empty>No final response.</Empty>
      )
    case "out_of_scope":
      return <Empty>Classified as outside the rules-referee scope.</Empty>
    default:
      return null
  }
}

function RouterBody({ delta }: { delta: RefereeStateDelta }) {
  const d = delta.router_decision
  if (!d) return <Empty>No decision.</Empty>
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-primary/40 text-primary">
          intent: {d.intent}
        </Badge>
        {d.game_format && (
          <Badge variant="outline" className="text-muted-foreground">
            format: {d.game_format}
          </Badge>
        )}
      </div>
      {d.reason && <p className="text-xs text-muted-foreground">{d.reason}</p>}
    </div>
  )
}

function CardLookupBody({ delta }: { delta: RefereeStateDelta }) {
  const cards = delta.resolved_cards ?? []
  const notes = delta.unresolved_notes ?? []
  if (cards.length === 0 && notes.length === 0)
    return <Empty>No cards referenced.</Empty>
  return (
    <div className="flex flex-col gap-2">
      {cards.map((entry, i) => {
        const c = entry.card
        const pt =
          c.power != null || c.toughness != null
            ? ` ${c.power ?? "?"}/${c.toughness ?? "?"}`
            : ""
        return (
          <div key={`${c.name}-${i}`} className="rounded-md border border-border/50 bg-muted/30 p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{c.name}</span>
              {c.manaCost && (
                <span className="text-xs text-muted-foreground">{c.manaCost}</span>
              )}
              {entry.method && (
                <Badge variant="outline" className="ml-auto text-[10px] text-muted-foreground">
                  {entry.method}
                </Badge>
              )}
            </div>
            {(c.typeLine || pt) && (
              <p className="text-xs text-muted-foreground">
                {c.typeLine}
                {pt}
              </p>
            )}
            {c.oracleText && (
              <p className="mt-1 line-clamp-3 text-xs">{c.oracleText}</p>
            )}
          </div>
        )
      })}
      {notes.map((n, i) => (
        <p key={i} className="text-xs text-muted-foreground">
          {n}
        </p>
      ))}
    </div>
  )
}

function DecomposeBody({ delta }: { delta: RefereeStateDelta }) {
  const subs = delta.subqueries ?? []
  if (subs.length === 0) return <Empty>No sub-queries.</Empty>
  return (
    <ul className="flex flex-col gap-1.5">
      {subs.map((s, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <GitBranch className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>{s}</span>
        </li>
      ))}
    </ul>
  )
}

function RulesBody({ delta }: { delta: RefereeStateDelta }) {
  const rules = delta.retrieved_rules ?? []
  if (rules.length === 0) return <Empty>No rules retrieved.</Empty>
  const top = rules.slice(0, 6)
  return (
    <div className="flex flex-col gap-1.5">
      {top.map((r, i) => (
        <div key={`${r.ruleNumber}-${i}`} className="rounded-md border border-border/50 bg-muted/30 p-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary">CR {r.ruleNumber}</span>
            {r.section && <span className="text-muted-foreground">{r.section}</span>}
            {typeof r.score === "number" && r.score > 0 && (
              <span className="ml-auto tabular-nums text-muted-foreground">
                {r.score.toFixed(3)}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-muted-foreground">{r.text}</p>
        </div>
      ))}
      {rules.length > top.length && (
        <span className="text-xs text-muted-foreground">
          +{rules.length - top.length} more rules retrieved
        </span>
      )}
    </div>
  )
}

function VerifierBody({ delta }: { delta: RefereeStateDelta }) {
  const v = delta.verdict
  if (!v) return <Empty>No verdict.</Empty>
  const grounded = v.verdict === "grounded"
  return (
    <div className="flex flex-col gap-2 text-sm">
      <Badge
        variant="outline"
        className={cn(
          "w-fit gap-1",
          grounded
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-destructive/40 bg-destructive/10 text-destructive",
        )}
      >
        {grounded ? <CheckCircle2 className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
        {v.verdict}
      </Badge>
      {v.issues && v.issues.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {v.issues.map((iss, i) => (
            <li key={i}>• {iss}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}
