import { BookOpen, Layers, ShieldCheck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Markdown } from "@/components/demo/markdown"
import { CardPreview } from "@/components/demo/card-art"
import type { Confidence, RulingResponse } from "@/lib/graph-events"

const CONFIDENCE: Record<Confidence, { dot: string; pill: string }> = {
  high: {
    dot: "bg-emerald-500",
    pill: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  medium: {
    dot: "bg-amber-500",
    pill: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  low: {
    dot: "bg-destructive",
    pill: "border-destructive/30 bg-destructive/10 text-destructive",
  },
}

export function RulingCard({
  ruling,
  compact = false,
}: {
  ruling: RulingResponse
  compact?: boolean
}) {
  const conf = CONFIDENCE[ruling.confidence]
  const citationCount = ruling.rule_citations.length + ruling.card_citations.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
            conf.pill,
          )}
        >
          <span className={cn("size-1.5 rounded-full", conf.dot)} />
          {ruling.confidence} confidence
        </span>
        {!compact && citationCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {ruling.rule_citations.length} rule · {ruling.card_citations.length} card{" "}
            {ruling.card_citations.length === 1 ? "citation" : "citations"}
          </span>
        )}
      </div>

      {compact ? (
        <div className="relative max-h-52 overflow-hidden">
          <Markdown>{ruling.ruling}</Markdown>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
        </div>
      ) : (
        <Markdown>{ruling.ruling}</Markdown>
      )}

      {!compact && ruling.rule_citations.length > 0 && (
        <CitationSection icon={BookOpen} title="Rule citations" count={ruling.rule_citations.length}>
          {ruling.rule_citations.map((c, i) => (
            <li
              key={`${c.rule_number}-${i}`}
              className="flex gap-2.5 rounded-lg border border-border/50 bg-muted/30 p-2.5"
            >
              <span className="h-fit shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                {c.rule_number}
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground">{c.excerpt}</p>
            </li>
          ))}
        </CitationSection>
      )}

      {!compact && ruling.card_citations.length > 0 && (
        <CitationSection icon={Layers} title="Card citations" count={ruling.card_citations.length}>
          {ruling.card_citations.map((c, i) => (
            <CardPreview key={`${c.name}-${i}`} name={c.name}>
              <li className="cursor-zoom-in rounded-lg border border-border/50 bg-muted/30 p-2.5 transition-colors hover:border-primary/40 hover:bg-muted/50">
                <p className="text-xs font-semibold">{c.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {c.oracle_excerpt}
                </p>
              </li>
            </CardPreview>
          ))}
        </CitationSection>
      )}

      {!compact && ruling.notes && (
        <div className="flex gap-2 rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span>
            <span className="font-medium text-foreground">Notes. </span>
            {ruling.notes}
          </span>
        </div>
      )}
    </div>
  )
}

function CitationSection({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: LucideIcon
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
        <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{count}</span>
      </span>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  )
}
