import { cn } from "@/lib/utils"

export interface DiagramNode {
  id: string
  label: string
  blurb: string
  x: number
  y: number
}

export interface DiagramEdge {
  from: string
  to: string
  kind: "main" | "branch" | "loop"
}

export interface ArchitectureDiagram {
  viewBox: { w: number; h: number }
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

const NODE_W = 128
const NODE_H = 50
const HW = NODE_W / 2
const HH = NODE_H / 2

function edgePath(byId: Record<string, DiagramNode>, e: DiagramEdge): string {
  const a = byId[e.from]
  const b = byId[e.to]

  if (e.kind === "loop") {
    const x1 = a.x
    const y1 = a.y + HH
    const x2 = b.x
    const y2 = b.y + HH
    const dip = Math.max(y1, y2) + 56
    return `M ${x1} ${y1} C ${x1} ${dip}, ${x2} ${dip}, ${x2} ${y2}`
  }

  if (a.y === b.y) {
    const x1 = a.x + HW
    const x2 = b.x - HW
    return `M ${x1} ${a.y} L ${x2} ${b.y}`
  }

  const goingDown = b.y > a.y
  const x1 = a.x
  const y1 = a.y + (goingDown ? HH : -HH)
  const x2 = b.x
  const y2 = b.y + (goingDown ? -HH : HH)
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

/**
 * Static flow diagram for an architecture, styled like the live-demo graph.
 * `accent` paints the production graph in the brand gold; others stay neutral.
 */
export function ArchitectureGraph({
  diagram,
  accent = false,
  className,
}: {
  diagram: ArchitectureDiagram
  accent?: boolean
  className?: string
}) {
  const byId = Object.fromEntries(
    diagram.nodes.map((n) => [n.id, n]),
  ) as Record<string, DiagramNode>
  const arrowId = accent ? "arch-arrow-accent" : "arch-arrow"

  return (
    <svg
      viewBox={`0 0 ${diagram.viewBox.w} ${diagram.viewBox.h}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label="Architecture diagram"
    >
      <defs>
        <marker
          id="arch-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-border" />
        </marker>
        <marker
          id="arch-arrow-accent"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary/70" />
        </marker>
      </defs>

      {diagram.edges.map((e) => (
        <path
          key={`${e.from}-${e.to}-${e.kind}`}
          d={edgePath(byId, e)}
          fill="none"
          strokeWidth={1.5}
          strokeDasharray={e.kind === "main" ? undefined : "4 4"}
          markerEnd={`url(#${arrowId})`}
          className={cn(
            accent
              ? e.kind === "main"
                ? "stroke-primary/60"
                : "stroke-primary/30"
              : e.kind === "main"
                ? "stroke-border"
                : "stroke-border/50",
          )}
        />
      ))}

      {diagram.nodes.map((n) => (
        <g key={n.id}>
          <rect
            x={n.x - HW}
            y={n.y - HH}
            width={NODE_W}
            height={NODE_H}
            rx={10}
            strokeWidth={1.5}
            className={cn(
              accent
                ? "fill-primary/15 stroke-primary"
                : "fill-muted/40 stroke-border",
            )}
          />
          <text
            x={n.x}
            y={n.y - 3}
            textAnchor="middle"
            className="fill-foreground text-[13px] font-medium"
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
      ))}
    </svg>
  )
}
