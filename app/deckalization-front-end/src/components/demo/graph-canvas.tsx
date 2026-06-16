import { cn } from "@/lib/utils"
import type { RefereeNodeId } from "@/lib/graph-events"
import {
  EDGE_LAYOUT,
  NODE_BY_ID,
  NODE_H,
  NODE_LAYOUT,
  NODE_W,
  VIEWBOX
  
} from "@/lib/graph-layout"
import type {EdgeLayout} from "@/lib/graph-layout";

export type NodeState = "idle" | "pending" | "active" | "done"

const HW = NODE_W / 2
const HH = NODE_H / 2

function edgePath(e: EdgeLayout): string {
  const a = NODE_BY_ID[e.from]
  const b = NODE_BY_ID[e.to]

  if (e.kind === "loop") {
    // verifier -> rules_retrieval: arc that dips below the main row.
    const x1 = a.x
    const y1 = a.y + HH
    const x2 = b.x
    const y2 = b.y + HH
    const dip = Math.max(y1, y2) + 56
    return `M ${x1} ${y1} C ${x1} ${dip}, ${x2} ${dip}, ${x2} ${y2}`
  }

  if (a.y === b.y) {
    // straight horizontal main edge
    const x1 = a.x + HW
    const x2 = b.x - HW
    return `M ${x1} ${a.y} L ${x2} ${b.y}`
  }

  // diagonal branch edge — exit/enter via top/bottom centers with a smooth curve
  const goingDown = b.y > a.y
  const x1 = a.x
  const y1 = a.y + (goingDown ? HH : -HH)
  const x2 = b.x
  const y2 = b.y + (goingDown ? -HH : HH)
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

const EDGE_CLASS: Record<EdgeLayout["kind"], string> = {
  main: "stroke-border",
  branch: "stroke-border/50",
  loop: "stroke-border/50",
}

export function GraphCanvas({
  states,
  className,
  selected,
  onSelect,
}: {
  states: Partial<Record<RefereeNodeId, NodeState>>
  className?: string
  selected?: RefereeNodeId | null
  onSelect?: (id: RefereeNodeId) => void
}) {
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label="Referee graph"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-border" />
        </marker>
        <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary" />
        </marker>
      </defs>

      {EDGE_LAYOUT.map((e) => {
        const active =
          states[e.from] === "done" &&
          (states[e.to] === "active" || states[e.to] === "done")
        return (
          <path
            key={`${e.from}-${e.to}-${e.kind}`}
            d={edgePath(e)}
            fill="none"
            strokeWidth={active ? 2 : 1.25}
            strokeDasharray={e.kind === "main" ? undefined : "4 4"}
            markerEnd={active ? "url(#arrow-active)" : "url(#arrow)"}
            className={cn(
              "transition-colors duration-300",
              active ? "stroke-primary" : EDGE_CLASS[e.kind],
            )}
          />
        )
      })}

      {NODE_LAYOUT.map((n) => {
        const state = states[n.id] ?? "idle"
        const isSelected = selected === n.id
        const clickable =
          !!onSelect && (state === "active" || state === "done")
        return (
          <g
            key={n.id}
            className={cn(
              "transition-opacity duration-300 focus:outline-none",
              clickable && "cursor-pointer",
            )}
            opacity={state === "idle" ? 0.45 : 1}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-pressed={clickable ? isSelected : undefined}
            aria-label={clickable ? `Show ${n.label} output` : undefined}
            onClick={clickable ? () => onSelect(n.id) : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSelect(n.id)
                    }
                  }
                : undefined
            }
          >
            {isSelected && (
              <rect
                x={n.x - HW - 5}
                y={n.y - HH - 5}
                width={NODE_W + 10}
                height={NODE_H + 10}
                rx={13}
                className="fill-primary/10 stroke-primary"
                strokeWidth={2}
              />
            )}
            {state === "active" && (
              <rect
                x={n.x - HW - 3}
                y={n.y - HH - 3}
                width={NODE_W + 6}
                height={NODE_H + 6}
                rx={12}
                className="animate-pulse fill-none stroke-primary"
                strokeWidth={2}
              />
            )}
            <rect
              x={n.x - HW}
              y={n.y - HH}
              width={NODE_W}
              height={NODE_H}
              rx={10}
              className={cn(
                "transition-colors duration-300",
                state === "active"
                  ? "fill-primary/15 stroke-primary"
                  : state === "done"
                    ? "fill-card stroke-primary/40"
                    : "fill-muted/40 stroke-border",
              )}
              strokeWidth={1.25}
            />
            <text
              x={n.x}
              y={n.y - 3}
              textAnchor="middle"
              className={cn(
                "text-[13px] font-medium",
                state === "active" ? "fill-primary" : "fill-foreground",
              )}
            >
              {n.label}
            </text>
            <text
              x={n.x}
              y={n.y + 13}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {n.blurb}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
