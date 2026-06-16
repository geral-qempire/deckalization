import { cn } from "@/lib/utils"
import { PIPELINES   } from "@/data/scores"
import type {BreakdownBucket, PipelineKey, ScoreRow} from "@/data/scores";

const PIPELINE_BAR: Record<PipelineKey, string> = {
  zero_shot: "bg-muted-foreground/40",
  baseline_rag: "bg-chart-2",
  referee_v2: "bg-primary",
}

const PIPELINE_DOT: Record<PipelineKey, string> = {
  zero_shot: "bg-muted-foreground/40",
  baseline_rag: "bg-chart-2",
  referee_v2: "bg-primary",
}

export function PipelineLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {PIPELINES.map((p) => (
        <span key={p.key} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-full", PIPELINE_DOT[p.key])} />
          {p.label}
        </span>
      ))}
    </div>
  )
}

/** Grouped horizontal bars: one labelled group per metric, three pipeline bars each. */
export function MetricBars({ rows }: { rows: ScoreRow[] }) {
  return (
    <div className="flex flex-col gap-5">
      {rows.map((row) => (
        <div key={row.key} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{row.label}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {PIPELINES.map((p) => {
              const v = row[p.key]
              return (
                <div key={p.key} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">
                    {p.label}
                  </span>
                  <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-muted/50">
                    {v !== null && (
                      <div
                        className={cn(
                          "flex h-full items-center justify-end rounded-md pr-1.5 transition-[width] duration-700",
                          PIPELINE_BAR[p.key],
                        )}
                        style={{ width: `${Math.max(v * 100, 6)}%` }}
                      >
                        <span className="text-[10px] font-semibold text-background/90 tabular-nums">
                          {v.toFixed(3)}
                        </span>
                      </div>
                    )}
                    {v === null && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        n/a
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * One labelled group per bucket (interaction category / complexity), with a bar
 * per pipeline. Used for the per-category and per-complexity correctness cuts.
 */
export function ComparisonBars({
  buckets,
  series = ["baseline_rag", "referee_v2"],
}: {
  buckets: BreakdownBucket[]
  series?: PipelineKey[]
}) {
  const labelFor = (k: PipelineKey) =>
    PIPELINES.find((p) => p.key === k)?.label ?? k
  return (
    <div className="flex flex-col gap-5">
      {buckets.map((bucket) => (
        <div key={bucket.label} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium">{bucket.label}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              n={bucket.n}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {series.map((key) => {
              const v = bucket.values[key] ?? null
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">
                    {labelFor(key)}
                  </span>
                  <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-muted/50">
                    {v !== null ? (
                      <div
                        className={cn(
                          "flex h-full items-center justify-end rounded-md pr-1.5 transition-[width] duration-700",
                          PIPELINE_BAR[key],
                        )}
                        style={{ width: `${Math.max(v * 100, 6)}%` }}
                      >
                        <span className="text-[10px] font-semibold text-background/90 tabular-nums">
                          {v.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        n/a
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export interface ScatterPoint {
  label: string
  x: number
  y: number
  tone: "good" | "neutral" | "warn"
  /** Manual label placement to avoid overlap. Defaults to centred, above the dot. */
  labelDx?: number
  labelDy?: number
  labelAnchor?: "start" | "middle" | "end"
}

const TONE_FILL: Record<ScatterPoint["tone"], string> = {
  good: "fill-primary",
  neutral: "fill-chart-2",
  warn: "fill-destructive",
}

/** Cost (x) vs correctness (y) scatter for the model sweep. */
export function CostCorrectnessScatter({
  points,
  xLabel,
  yLabel,
}: {
  points: ScatterPoint[]
  xLabel: string
  yLabel: string
}) {
  const w = 520
  const h = 320
  const pad = { top: 24, right: 24, bottom: 44, left: 48 }
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const xMax = Math.max(...xs) * 1.15
  const yMin = Math.min(...ys) - 0.08
  const yMax = Math.max(...ys) + 0.08
  const px = (x: number) =>
    pad.left + (x / xMax) * (w - pad.left - pad.right)
  const py = (y: number) =>
    h - pad.bottom - ((y - yMin) / (yMax - yMin)) * (h - pad.top - pad.bottom)

  const yTicks = [yMin, (yMin + yMax) / 2, yMax]
  const xTicks = [0, xMax / 2, xMax]

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-auto w-full max-w-xl text-muted-foreground"
      role="img"
      aria-label={`${yLabel} versus ${xLabel}`}
    >
      {/* axes */}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={h - pad.bottom} className="stroke-border" strokeWidth={1} />
      <line x1={pad.left} y1={h - pad.bottom} x2={w - pad.right} y2={h - pad.bottom} className="stroke-border" strokeWidth={1} />

      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={pad.left - 4} y1={py(t)} x2={w - pad.right} y2={py(t)} className="stroke-border/40" strokeWidth={1} strokeDasharray="3 3" />
          <text x={pad.left - 8} y={py(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={`x${t}`} x={px(t)} y={h - pad.bottom + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          ${t.toFixed(2)}
        </text>
      ))}

      {points.map((p) => (
        <g key={p.label}>
          <circle cx={px(p.x)} cy={py(p.y)} r={7} className={cn(TONE_FILL[p.tone], "opacity-80")} />
          <text
            x={px(p.x) + (p.labelDx ?? 0)}
            y={py(p.y) + (p.labelDy ?? -12)}
            textAnchor={p.labelAnchor ?? "middle"}
            className="fill-foreground text-[10px] font-medium"
          >
            {p.label}
          </text>
        </g>
      ))}

      <text x={(w + pad.left) / 2} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
        {xLabel}
      </text>
      <text x={-(h - pad.bottom) / 2} y={14} textAnchor="middle" transform="rotate(-90)" className="fill-muted-foreground text-[11px]">
        {yLabel}
      </text>
    </svg>
  )
}
