import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  Gavel,
  ListTree,
  Loader2,
  Play,
  PlayCircle,
  Repeat,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from "lucide-react"
import type { RefereeNodeId } from "@/lib/graph-events"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { GraphCanvas } from "@/components/demo/graph-canvas"
import { NodeTimeline } from "@/components/demo/node-panel"
import { RulingCard } from "@/components/demo/ruling-card"
import { useRefereeRun } from "@/hooks/use-referee-run"
import { RECORDED_RUNS } from "@/lib/recorded-runs"
import { NODE_BY_ID } from "@/lib/graph-layout"

export const Route = createFileRoute("/demo")({ component: Demo })

function Demo() {
  const { state, runReplay, runLive, reset, stop } = useRefereeRun()
  const [question, setQuestion] = useState("")
  const [selected, setSelected] = useState<RefereeNodeId | null>(null)
  const [lastRun, setLastRun] = useState<
    | { kind: "live"; question: string }
    | { kind: "replay"; run: (typeof RECORDED_RUNS)[number] }
    | null
  >(null)
  const running = state.status === "running"

  const activeNode = (Object.keys(state.nodeStates) as Array<
    keyof typeof state.nodeStates
  >).find((k) => state.nodeStates[k] === "active")

  const startLive = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setSelected(null)
    setLastRun({ kind: "live", question: trimmed })
    runLive(trimmed)
  }
  const startReplay = (r: (typeof RECORDED_RUNS)[number]) => {
    setSelected(null)
    setQuestion(r.question)
    setLastRun({ kind: "replay", run: r })
    runReplay(r)
  }
  const replayLast = () => {
    if (!lastRun) return
    setSelected(null)
    if (lastRun.kind === "replay") runReplay(lastRun.run)
    else runLive(lastRun.question)
  }
  const resetRun = () => {
    setSelected(null)
    reset()
  }

  // Outputs shown in the Node outputs panel — all by default, or just the
  // clicked node. Keep the original timeline index so the "active" pulse still
  // tracks the genuinely-latest step.
  const visibleOutputs = state.timeline
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !selected || entry.node === selected)
  const selectedLabel = selected ? NODE_BY_ID[selected].label : null
  const timelineEntries = visibleOutputs.map(({ entry, index }) => ({
    id: `${entry.node}-${index}`,
    node: entry.node,
    delta: entry.delta,
    active: index === state.timeline.length - 1 && running,
  }))

  return (
    <main className="pb-24">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_50%_-10%,color-mix(in_oklab,var(--color-primary)_12%,transparent),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <PlayCircle className="size-3.5" />
            Live demo
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Inside the referee
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            Ask a Magic: The Gathering rules question and watch it flow through the
            multi-agent graph: routing, card resolution, query decomposition, rules
            retrieval, adjudication and the verifier loop, with every node's output
            revealed as it happens.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-8">
        {/* Composer */}
        <section>
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm transition-all focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a rules question… e.g. If a creature with deathtouch and trample is blocked by a 5/5, how much tramples over?"
              rows={3}
              disabled={running}
              className="min-h-[92px] resize-none border-0 bg-transparent px-4 py-4 text-base shadow-none focus-visible:border-0 focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !running) {
                  startLive(question)
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-2.5">
              {running ? (
                <Button onClick={stop} variant="outline" size="sm">
                  <Square className="size-4" /> Stop
                </Button>
              ) : (
                <Button
                  onClick={() => startLive(question)}
                  disabled={!question.trim()}
                  size="sm"
                >
                  <Play className="size-4" /> Run live
                </Button>
              )}
              {!running && lastRun && (
                <Button onClick={replayLast} variant="outline" size="sm">
                  <Repeat className="size-4" /> Replay
                </Button>
              )}
              {state.status !== "idle" && !running && (
                <Button onClick={resetRun} variant="ghost" size="sm">
                  <RotateCcw className="size-4" /> Reset
                </Button>
              )}
              <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd>
                to run
              </span>

              {/* Status */}
              <div className="ml-auto flex min-h-8 items-center gap-2">
                {running && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    {activeNode
                      ? `Running ${NODE_BY_ID[activeNode].label}…`
                      : "Starting…"}
                  </span>
                )}
                {state.status === "done" && (
                  <span className="text-sm font-medium text-emerald-500">Done</span>
                )}
                {state.status === "error" && (
                  <span className="text-sm text-destructive">{state.error}</span>
                )}
              </div>
            </div>
          </div>

          {/* Showcase chips */}
          {RECORDED_RUNS.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Instant showcase runs (pre-recorded, no waiting)
              </span>
              <div className="flex flex-wrap gap-2">
                {RECORDED_RUNS.map((r) => (
                  <button
                    key={r.slug}
                    disabled={running}
                    onClick={() => startReplay(r)}
                    className={cn(
                      "rounded-full border border-border/60 bg-card px-3 py-1.5 text-left text-xs font-medium transition-colors",
                      "hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50",
                    )}
                  >
                    {r.blurb}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground">
                Live runs hit the deployed graph and can take 30s+.
              </span>
            </div>
          )}
        </section>

        {/* Graph */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Graph</CardTitle>
            <CardDescription>
              The referee_v2 multi-agent pipeline. Click a completed node to inspect
              its output.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <GraphCanvas
              states={state.nodeStates}
              className="mx-auto w-full min-w-[720px]"
              selected={selected}
              onSelect={(id) => setSelected((prev) => (prev === id ? null : id))}
            />
          </CardContent>
        </Card>

        {/* Node outputs + Final response */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-start">
          {/* Node outputs */}
          <Card className="border-border/60 lg:col-span-3">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListTree className="size-4 text-primary" />
                  Node outputs
                </CardTitle>
                {selectedLabel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setSelected(null)}
                  >
                    <X className="size-3.5" /> Show all
                  </Button>
                )}
              </div>
              <CardDescription>
                {selectedLabel
                  ? `Showing the “${selectedLabel}” node.`
                  : "Each node's output, in order. Click a graph node to focus one."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {state.timeline.length === 0 ? (
                <EmptyState>
                  Run a question or pick a showcase to trace each node's output here.
                </EmptyState>
              ) : timelineEntries.length === 0 ? (
                <EmptyState>This node didn't produce output in this run.</EmptyState>
              ) : (
                <div className="max-h-[680px] overflow-y-auto pr-1">
                  <NodeTimeline entries={timelineEntries} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Final response */}
          <Card className="gap-0 overflow-hidden border-border/60 pt-0 lg:col-span-2 lg:sticky lg:top-20">
            <div className="border-b border-border/60 bg-gradient-to-br from-primary/[0.07] to-transparent px-(--card-spacing) py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gavel className="size-4 text-primary" />
                Final ruling
              </CardTitle>
              <CardDescription className="mt-1 line-clamp-2">
                {state.question || "The grounded ruling appears here."}
              </CardDescription>
            </div>
            <CardContent className="pt-5">
              {state.final ? (
                <RulingCard ruling={state.final} />
              ) : running ? (
                <EmptyState>
                  <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
                  Reasoning through the graph…
                </EmptyState>
              ) : (
                <EmptyState>
                  The grounded ruling, with citations to the Comprehensive Rules and card
                  text, appears here once the graph finishes.
                </EmptyState>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/70 bg-muted px-1 font-sans text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  )
}
