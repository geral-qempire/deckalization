import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Loader2, Play, RotateCcw, Sparkles, Square, X } from "lucide-react"
import type { RefereeNodeId } from "@/lib/graph-events"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { GraphCanvas } from "@/components/demo/graph-canvas"
import { NodePanel } from "@/components/demo/node-panel"
import { RulingCard } from "@/components/demo/ruling-card"
import { useRefereeRun } from "@/hooks/use-referee-run"
import { RECORDED_RUNS } from "@/lib/recorded-runs"
import { NODE_BY_ID } from "@/lib/graph-layout"

export const Route = createFileRoute("/demo")({ component: Demo })

function Demo() {
  const { state, runReplay, runLive, reset, cancel } = useRefereeRun()
  const [question, setQuestion] = useState("")
  const [selected, setSelected] = useState<RefereeNodeId | null>(null)
  const running = state.status === "running"

  const activeNode = (Object.keys(state.nodeStates) as Array<
    keyof typeof state.nodeStates
  >).find((k) => state.nodeStates[k] === "active")

  const startLive = (q: string) => {
    setSelected(null)
    runLive(q)
  }
  const startReplay = (r: (typeof RECORDED_RUNS)[number]) => {
    setSelected(null)
    setQuestion(r.question)
    runReplay(r)
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Inside the referee
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Ask a Magic: The Gathering rules question and watch it flow through the
          multi-agent graph: routing, card resolution, query decomposition, rules
          retrieval, adjudication and the verifier loop, with every node's output
          revealed as it happens.
        </p>
      </header>

      {/* Chat */}
      <Card className="mt-6 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Chat</CardTitle>
          <CardDescription>
            Ask a question, or pick an instant showcase run.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. If a creature with deathtouch and trample is blocked by a 5/5, how much tramples over?"
            rows={2}
            className="resize-none"
            disabled={running}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !running) {
                runLive(question)
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {running ? (
              <Button onClick={cancel} variant="outline">
                <Square className="size-4" /> Stop
              </Button>
            ) : (
              <Button onClick={() => startLive(question)} disabled={!question.trim()}>
                <Play className="size-4" /> Run live
              </Button>
            )}
            {state.status !== "idle" && !running && (
              <Button onClick={resetRun} variant="ghost">
                <RotateCcw className="size-4" /> Reset
              </Button>
            )}

            {/* Status */}
            <div className="ml-auto flex min-h-8 items-center gap-2">
              {state.mode && (
                <Badge variant="outline" className="capitalize">
                  {state.mode === "replay" ? "replay" : "live"}
                </Badge>
              )}
              {running && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {activeNode
                    ? `Running ${NODE_BY_ID[activeNode].label}…`
                    : "Starting…"}
                </span>
              )}
              {state.status === "done" && (
                <span className="text-sm text-muted-foreground">Done.</span>
              )}
              {state.status === "error" && (
                <span className="text-sm text-destructive">{state.error}</span>
              )}
            </div>
          </div>

          {/* Showcase chips */}
          {RECORDED_RUNS.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
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
                      "rounded-full border border-border/60 bg-card px-3 py-1.5 text-left text-xs transition-colors hover:border-primary/50 disabled:opacity-50",
                    )}
                  >
                    <span className="font-medium">{r.blurb}</span>
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground">
                Live runs hit the deployed graph and can take 30s+. ⌘/Ctrl+Enter to
                run.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Graph */}
      <Card className="mt-4 border-border/60">
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

      {/* Node outputs + Final response — grow with the page, no inner scroll */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        {/* Node outputs */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Node outputs</CardTitle>
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
              <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                Run a question or pick a showcase to see each node's output here.
              </div>
            ) : visibleOutputs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                This node didn't produce output in this run.
              </div>
            ) : (
              <div className="flex max-h-[640px] flex-col gap-3 overflow-y-auto pr-1">
                {visibleOutputs.map(({ entry, index }) => (
                  <NodePanel
                    key={`${entry.node}-${index}`}
                    node={entry.node}
                    delta={entry.delta}
                    active={index === state.timeline.length - 1 && running}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Final response */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Final response</CardTitle>
            <CardDescription className="line-clamp-1">
              {state.question || "The grounded ruling appears here."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.final ? (
              <RulingCard ruling={state.final} />
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                The grounded ruling, with citations to the Comprehensive Rules and card
                text, appears here once the graph finishes.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
