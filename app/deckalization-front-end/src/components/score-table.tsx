import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { PIPELINES   } from "@/data/scores"
import type {PipelineKey, ScoreRow} from "@/data/scores";

function fmt(v: number | null, format: ScoreRow["format"]) {
  if (v === null) return "n/a"
  return format === "raw" ? String(v) : v.toFixed(3)
}

function bestKey(row: ScoreRow): PipelineKey | null {
  const entries = PIPELINES.map((p) => [p.key, row[p.key]] as const).filter(
    (e): e is [PipelineKey, number] => e[1] !== null,
  )
  if (entries.length < 2) return null
  const pick = row.lowerBetter
    ? entries.reduce((a, b) => (b[1] < a[1] ? b : a))
    : entries.reduce((a, b) => (b[1] > a[1] ? b : a))
  return pick[0]
}

/** True when `key`'s value ties or beats every other pipeline in the row. */
function isBestOrTied(row: ScoreRow, key: PipelineKey): boolean {
  const v = row[key]
  if (v === null) return false
  const others = PIPELINES.filter((p) => p.key !== key)
    .map((p) => row[p.key])
    .filter((x): x is number => x !== null)
  return row.lowerBetter
    ? others.every((o) => v <= o)
    : others.every((o) => v >= o)
}

export function ScoreTable({
  rows,
  emphasizeKey,
}: {
  rows: ScoreRow[]
  /** When set, gold-highlight every cell that ties or beats the rest of its row
   * (so the production pipeline AND any model that out-scores it both stand out).
   * Without it, only the single per-row best is highlighted. */
  emphasizeKey?: PipelineKey
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-40">Metric</TableHead>
            {PIPELINES.map((p) => (
              <TableHead key={p.key} className="text-right">
                {p.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const best = emphasizeKey ? null : bestKey(row)
            return (
              <TableRow key={row.key}>
                <TableCell className="font-medium">
                  {row.label}
                  {row.headline && (
                    <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      headline
                    </span>
                  )}
                </TableCell>
                {PIPELINES.map((p) => (
                  <TableCell
                    key={p.key}
                    className={cn(
                      "text-right tabular-nums",
                      (emphasizeKey
                        ? isBestOrTied(row, p.key)
                        : best === p.key) && "font-semibold text-primary",
                    )}
                  >
                    {fmt(row[p.key], row.format)}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
