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

// Color of the value rendered inside the bar. The yellow (primary) fill keeps a
// dark label in both themes; the others go white in dark mode.
const DARK_ON_FILL = "text-background/90"
const WHITE_IN_DARK = "text-background dark:text-foreground"
const PIPELINE_INSIDE_LABEL: Record<PipelineKey, string> = {
  zero_shot: WHITE_IN_DARK,
  baseline_rag: WHITE_IN_DARK,
  referee_v2: DARK_ON_FILL,
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

/**
 * One horizontal bar row: a left-hand label and the bar track with the numeric
 * value rendered inside the fill (right-aligned). When the fill is too short to
 * hold the text it spills just past the fill edge instead, so the number is
 * always readable in both themes.
 */
export function MetricBar({
  label,
  fillPct,
  value,
  barClassName,
  insideLabelClassName = WHITE_IN_DARK,
  forceLabelOutside = false,
}: {
  label: string
  /** Bar width as a percentage (0-100), or null when there is no data. */
  fillPct: number | null
  /** Formatted value text, or null to show "n/a". */
  value: string | null
  barClassName?: string
  /** Color of the value when it sits inside the fill. */
  insideLabelClassName?: string
  /** Always render the value past the fill edge, never inside it. */
  forceLabelOutside?: boolean
}) {
  // Below this fill width the value won't fit inside the bar, so render it just
  // past the fill edge in the foreground color instead.
  const labelFitsInside = !forceLabelOutside && fillPct !== null && fillPct >= 24

  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="relative h-5 flex-1 rounded-md bg-muted/50">
        {fillPct === null ? (
          <span className="absolute inset-y-0 left-2 flex items-center text-xs text-muted-foreground">
            n/a
          </span>
        ) : (
          <>
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-md transition-[width] duration-700",
                barClassName,
              )}
              style={{ width: `${Math.max(fillPct, 1)}%` }}
            />
            <span
              className={cn(
                "absolute inset-y-0 flex items-center text-xs font-semibold tabular-nums",
                labelFitsInside ? insideLabelClassName : "text-foreground",
              )}
              style={
                labelFitsInside
                  ? { right: `calc(${100 - fillPct}% + 0.5rem)` }
                  : { left: `calc(${fillPct}% + 0.375rem)` }
              }
            >
              {value}
            </span>
          </>
        )}
      </div>
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
                <MetricBar
                  key={p.key}
                  label={p.label}
                  fillPct={v !== null ? Math.max(v * 100, 6) : null}
                  value={v !== null ? v.toFixed(3) : null}
                  barClassName={PIPELINE_BAR[p.key]}
                  insideLabelClassName={PIPELINE_INSIDE_LABEL[p.key]}
                />
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
                <MetricBar
                  key={key}
                  label={labelFor(key)}
                  fillPct={v !== null ? Math.max(v * 100, 6) : null}
                  value={v !== null ? v.toFixed(2) : null}
                  barClassName={PIPELINE_BAR[key]}
                  insideLabelClassName={PIPELINE_INSIDE_LABEL[key]}
                />
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
          <text x={pad.left - 8} y={py(t) + 4} textAnchor="end" className="fill-foreground/80 text-xs font-medium tabular-nums">
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={`x${t}`} x={px(t)} y={h - pad.bottom + 18} textAnchor="middle" className="fill-foreground/80 text-xs font-medium tabular-nums">
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
            className="fill-foreground text-[11px] font-semibold"
            stroke="var(--background)"
            strokeWidth={3}
            strokeLinejoin="round"
            style={{ paintOrder: "stroke" }}
          >
            {p.label}
          </text>
        </g>
      ))}

      <text x={(w + pad.left) / 2} y={h - 6} textAnchor="middle" className="fill-foreground/70 text-xs font-medium">
        {xLabel}
      </text>
      <text x={-(h - pad.bottom) / 2} y={14} textAnchor="middle" transform="rotate(-90)" className="fill-foreground/70 text-xs font-medium">
        {yLabel}
      </text>
    </svg>
  )
}
