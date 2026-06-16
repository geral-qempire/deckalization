import { BookOpen, Layers } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Confidence, RulingResponse } from "@/lib/graph-events"

const CONFIDENCE_CLASS: Record<Confidence, string> = {
  high: "border-primary/40 bg-primary/10 text-primary",
  medium: "border-chart-2/40 bg-chart-2/10 text-foreground",
  low: "border-destructive/40 bg-destructive/10 text-destructive",
}

export function RulingCard({
  ruling,
  compact = false,
}: {
  ruling: RulingResponse
  compact?: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={cn("capitalize", CONFIDENCE_CLASS[ruling.confidence])}>
          {ruling.confidence} confidence
        </Badge>
      </div>

      <p
        className={cn(
          "whitespace-pre-wrap text-sm leading-relaxed",
          compact && "line-clamp-[12]",
        )}
      >
        {ruling.ruling}
      </p>

      {ruling.rule_citations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <BookOpen className="size-3.5" /> Rule citations
          </span>
          <ul className="flex flex-col gap-1.5">
            {ruling.rule_citations.map((c, i) => (
              <li key={`${c.rule_number}-${i}`} className="rounded-md border border-border/50 bg-muted/30 p-2 text-xs">
                <span className="font-semibold text-primary">CR {c.rule_number}</span>
                <span className="text-muted-foreground"> — {c.excerpt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ruling.card_citations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Layers className="size-3.5" /> Card citations
          </span>
          <ul className="flex flex-col gap-1.5">
            {ruling.card_citations.map((c, i) => (
              <li key={`${c.name}-${i}`} className="rounded-md border border-border/50 bg-muted/30 p-2 text-xs">
                <span className="font-semibold">{c.name}</span>
                <span className="text-muted-foreground"> — {c.oracle_excerpt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ruling.notes && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Notes: </span>
          {ruling.notes}
        </p>
      )}
    </div>
  )
}
