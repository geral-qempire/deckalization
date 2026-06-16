import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { MODEL_SWEEP  } from "@/data/scores"
import type {ModelSweepRow} from "@/data/scores";

const TAG_CLASS: Record<ModelSweepRow["tagTone"], string> = {
  good: "border-primary/40 bg-primary/10 text-primary",
  neutral: "border-chart-2/40 bg-chart-2/10 text-foreground",
  warn: "border-destructive/40 bg-destructive/10 text-destructive",
}

const cols = [
  { key: "correctness", label: "Correct.", best: "max" },
  { key: "faithfulness", label: "Faithful.", best: "max" },
  { key: "rule_recall", label: "Rule rec.", best: "max" },
  { key: "citation_recall", label: "Cite rec.", best: "max" },
  { key: "cost", label: "$/case", best: "min" },
  { key: "latency_p50", label: "Lat p50", best: "min" },
] as const

export function ModelSweepTable() {
  const best: Record<string, number> = {}
  for (const c of cols) {
    const vals = MODEL_SWEEP.map((r) => r[c.key])
    best[c.key] = c.best === "max" ? Math.max(...vals) : Math.min(...vals)
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-28">Adjudication model</TableHead>
            {cols.map((c) => (
              <TableHead key={c.key} className="text-right">
                {c.label}
              </TableHead>
            ))}
            <TableHead className="text-right">Verdict</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {MODEL_SWEEP.map((r) => (
            <TableRow key={r.model}>
              <TableCell className="font-medium">{r.label}</TableCell>
              {cols.map((c) => (
                <TableCell
                  key={c.key}
                  className={cn(
                    "text-right tabular-nums",
                    r[c.key] === best[c.key] && "font-semibold text-primary",
                  )}
                >
                  {c.key === "cost"
                    ? `$${r[c.key].toFixed(3)}`
                    : c.key === "latency_p50"
                      ? `${r[c.key].toFixed(0)}s`
                      : r[c.key].toFixed(3)}
                </TableCell>
              ))}
              <TableCell className="text-right">
                <Badge variant="outline" className={cn("font-medium", TAG_CLASS[r.tagTone])}>
                  {r.tag}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
