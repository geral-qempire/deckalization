import { createFileRoute } from "@tanstack/react-router"
import {
  Download,
  FileJson,
  FlaskConical,
  Gauge,
  Layers,
  Scale,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  ComparisonBars,
  CostCorrectnessScatter,
  MetricBars,
  PipelineLegend,
} from "@/components/charts"
import type { ScatterPoint } from "@/components/charts"
import { ScoreTable } from "@/components/score-table"
import { ModelSweepTable } from "@/components/model-sweep-table"
import { ArchitectureGraph } from "@/components/architecture-graph"
import type { ArchitectureDiagram } from "@/components/architecture-graph"
import { ARCHITECTURES, MODELS_NOTE } from "@/data/architectures"
import type { Architecture } from "@/data/architectures"
import { METRICS } from "@/data/metrics"
import {
  BENCH40_EFFICIENCY,
  BENCH40_QUALITY,
  CATEGORY_BREAKDOWN,
  COMPLEXITY_BREAKDOWN,
  EXPERIMENT_META,
  MODEL_SWEEP,
  PIPELINES,
} from "@/data/scores"
import {
  EDGE_LAYOUT,
  NODE_LAYOUT,
  VIEWBOX,
} from "@/lib/graph-layout"

export const Route = createFileRoute("/technical")({ component: Technical })

// ---- Per-architecture flow diagrams (live-demo styling) -------------------

const ROW = 64

const ZERO_SHOT_DIAGRAM: ArchitectureDiagram = {
  viewBox: { w: 568, h: 128 },
  nodes: [
    { id: "q", label: "Question", blurb: "Rules question", x: 94, y: ROW },
    { id: "llm", label: "LLM", blurb: "Answer from memory", x: 284, y: ROW },
    { id: "a", label: "Answer", blurb: "Ungrounded ruling", x: 474, y: ROW },
  ],
  edges: [
    { from: "q", to: "llm", kind: "main" },
    { from: "llm", to: "a", kind: "main" },
  ],
}

const RAG_DIAGRAM: ArchitectureDiagram = {
  viewBox: { w: 728, h: 128 },
  nodes: [
    { id: "extract", label: "Extract", blurb: "Find card names", x: 94, y: ROW },
    { id: "resolve", label: "Resolve", blurb: "→ Oracle text", x: 274, y: ROW },
    { id: "search", label: "Search rules", blurb: "One CR query", x: 454, y: ROW },
    { id: "answer", label: "Answer", blurb: "Grounded ruling", x: 634, y: ROW },
  ],
  edges: [
    { from: "extract", to: "resolve", kind: "main" },
    { from: "resolve", to: "search", kind: "main" },
    { from: "search", to: "answer", kind: "main" },
  ],
}

const V1_DIAGRAM: ArchitectureDiagram = {
  viewBox: { w: 968, h: 220 },
  nodes: [
    { id: "router", label: "Router", blurb: "Classify intent", x: 74, y: ROW },
    { id: "card_lookup", label: "Card lookup", blurb: "Resolve cards", x: 234, y: ROW },
    { id: "rules", label: "Rules retrieval", blurb: "Search rules", x: 394, y: ROW },
    { id: "adjudication", label: "Adjudication", blurb: "Draft & format", x: 554, y: ROW },
    { id: "verifier", label: "Verifier", blurb: "Grounded? re-draft", x: 714, y: ROW },
    { id: "formatter", label: "Formatter", blurb: "Final ruling", x: 874, y: ROW },
    { id: "out_of_scope", label: "Out of scope", blurb: "Not a rules Q", x: 234, y: 162 },
  ],
  edges: [
    { from: "router", to: "card_lookup", kind: "main" },
    { from: "card_lookup", to: "rules", kind: "main" },
    { from: "rules", to: "adjudication", kind: "main" },
    { from: "adjudication", to: "verifier", kind: "main" },
    { from: "verifier", to: "formatter", kind: "main" },
    { from: "verifier", to: "rules", kind: "loop" },
    { from: "router", to: "out_of_scope", kind: "branch" },
    { from: "out_of_scope", to: "formatter", kind: "branch" },
  ],
}

const V2_DIAGRAM: ArchitectureDiagram = {
  viewBox: VIEWBOX,
  nodes: NODE_LAYOUT.map((n) => ({
    id: n.id,
    label: n.label,
    blurb: n.blurb,
    x: n.x,
    y: n.y,
  })),
  edges: EDGE_LAYOUT.map((e) => ({ from: e.from, to: e.to, kind: e.kind })),
}

const DIAGRAMS: Record<string, ArchitectureDiagram> = {
  zero_shot: ZERO_SHOT_DIAGRAM,
  baseline_rag: RAG_DIAGRAM,
  referee_v1: V1_DIAGRAM,
  referee_v2: V2_DIAGRAM,
}

// ---------------------------------------------------------------------------

function Technical() {
  const correctness = BENCH40_QUALITY.find((r) => r.key === "correctness")!

  return (
    <main className="pb-24">
      {/* Hero + headline scoreboard */}
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_50%_-10%,color-mix(in_oklab,var(--color-primary)_14%,transparent),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-14">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <FlaskConical className="size-3.5" />
            Evaluation
          </span>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Does a multi-agent referee actually beat plain RAG?
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Four architectures, a purpose-built metric suite, and the scores each earned on
            a 40-case golden benchmark. Here&apos;s how they stack up, and the surprises
            along the way.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {[
              `suite · ${EXPERIMENT_META.suite} (40 cases)`,
              `judge · ${EXPERIMENT_META.judge}`,
              `adjudication · ${EXPERIMENT_META.adjudicationDefault}`,
              `gateway · ${EXPERIMENT_META.gateway}`,
            ].map((chip) => (
              <span
                key={chip}
                className="rounded-md border border-border/60 bg-card/60 px-2.5 py-1 text-muted-foreground"
              >
                {chip}
              </span>
            ))}
          </div>

          {/* Headline scoreboard */}
          <div className="mt-10">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Headline result</span>
              <span className="h-px flex-1 bg-border/60" />
              <span className="normal-case tracking-normal">correctness · bench40</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {PIPELINES.map((p) => {
                const v = correctness[p.key]
                const isWinner = p.key === "referee_v2"
                const ragVal = correctness.baseline_rag
                const delta =
                  isWinner && v !== null && ragVal !== null ? v - ragVal : null
                return (
                  <div
                    key={p.key}
                    className={cn(
                      "rounded-2xl border p-5 backdrop-blur-sm",
                      isWinner
                        ? "border-primary/50 bg-primary/[0.07]"
                        : "border-border/60 bg-card/60",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{p.label}</span>
                      {isWinner && (
                        <Badge className="gap-1 bg-primary/15 text-primary">
                          <Sparkles className="size-3" />
                          winner
                        </Badge>
                      )}
                    </div>
                    <div
                      className={cn(
                        "mt-3 text-4xl font-semibold tabular-nums",
                        isWinner ? "text-primary" : "text-foreground",
                      )}
                    >
                      {v !== null ? v.toFixed(3) : "—"}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {delta !== null
                        ? `+${delta.toFixed(3)} vs RAG · ${p.blurb}`
                        : p.blurb}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4">
        {/* Architectures */}
        <Section
          n="01"
          title="The architectures compared"
          subtitle="From a single model call to a five-stage multi-agent graph. referee_v2 (highlighted in gold) is what ships."
          id="architectures"
        >
          <Tabs defaultValue="referee_v2">
            <TabsList className="flex-wrap">
              {ARCHITECTURES.map((a) => (
                <TabsTrigger key={a.key} value={a.key} className="gap-1.5">
                  {a.status === "production" && (
                    <span className="size-1.5 rounded-full bg-primary" />
                  )}
                  {a.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {ARCHITECTURES.map((a) => (
              <TabsContent key={a.key} value={a.key} className="pt-4">
                <ArchTab a={a} />
              </TabsContent>
            ))}
          </Tabs>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{MODELS_NOTE}</p>
        </Section>

        {/* Results */}
        <Section
          n="02"
          title="The results"
          subtitle="bench40, gpt-5-mini adjudication. zero-shot is the documented floor; RAG and referee_v2 are one coherent run."
          id="results"
        >
          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Quality metrics</CardTitle>
                <CardDescription>
                  <PipelineLegend />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MetricBars rows={BENCH40_QUALITY.slice(0, 4)} />
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Full scorecard</CardTitle>
                <CardDescription>
                  Best in each row highlighted. Efficiency is contention-free.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="quality">
                  <TabsList>
                    <TabsTrigger value="quality">Quality</TabsTrigger>
                    <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
                  </TabsList>
                  <TabsContent value="quality" className="pt-3">
                    <ScoreTable rows={BENCH40_QUALITY} emphasizeKey="referee_v2" />
                  </TabsContent>
                  <TabsContent value="efficiency" className="pt-3">
                    <ScoreTable rows={BENCH40_EFFICIENCY} />
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      referee_v2 costs ~1.7× RAG and is ~4× slower at the median: the
                      price of decomposition, retrieval and a verifier loop.
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Where it helps */}
          <Card className="mt-6 border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Where the graph helps, and where it doesn&apos;t</CardTitle>
              <CardDescription>
                Correctness sliced from LangSmith example metadata. Buckets are small (n
                shown), so read them as directional.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="category">
                <TabsList>
                  <TabsTrigger value="category">By interaction type</TabsTrigger>
                  <TabsTrigger value="complexity">By complexity</TabsTrigger>
                </TabsList>
                <TabsContent value="category" className="grid gap-6 pt-4 lg:grid-cols-2">
                  <ComparisonBars buckets={CATEGORY_BREAKDOWN} />
                  <div className="flex flex-col justify-center gap-3 text-sm leading-relaxed text-muted-foreground">
                    <p>
                      Gains concentrate where retrieval is the bottleneck:{" "}
                      <Em>costs &amp; casting</Em> (0.38 → 0.75) and{" "}
                      <Em>replacement &amp; prevention</Em> (0.50 → 0.75): questions where
                      pulling the precise rule decides the answer.
                    </p>
                    <p>
                      On <Em>layers &amp; continuous effects</Em> the two tie (0.73): both
                      retrieve enough, and the misses left are genuine multi-step reasoning
                      flips that more retrieval won&apos;t fix.
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="complexity" className="grid gap-6 pt-4 lg:grid-cols-2">
                  <ComparisonBars buckets={COMPLEXITY_BREAKDOWN} />
                  <div className="flex flex-col justify-center gap-3 text-sm leading-relaxed text-muted-foreground">
                    <p>
                      referee_v2 lifts <Em>Simple</Em> questions 0.57 → 0.75: the bulk of
                      the benchmark (n=28) and the bulk of the overall win.
                    </p>
                    <p>
                      On <Em>Intermediate</Em> and <Em>Complicated</Em> cases it matches RAG
                      rather than beating it: these are reasoning puzzles where the
                      bottleneck is deduction, not evidence.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </Section>

        {/* Metrics (condensed) */}
        <Section
          n="03"
          title="What the metrics mean"
          subtitle="Two LLM judges for quality, deterministic checks for retrieval and citations. Glance the one-liners; expand any row for how it's computed."
          id="metrics"
        >
          <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-primary" />
              LLM judge
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-chart-2" />
              Deterministic
            </span>
          </div>
          <Accordion
            type="single"
            collapsible
            className="rounded-xl border border-border/60 px-4"
          >
            {METRICS.map((m) => (
              <AccordionItem key={m.key} value={m.key} className="last:border-b-0">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex flex-1 items-center gap-3 pr-3 text-left">
                    <span
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        m.kind === "LLM judge" ? "bg-primary" : "bg-chart-2",
                      )}
                    />
                    <span className="w-32 shrink-0 font-medium">{m.name}</span>
                    <span className="hidden text-sm text-muted-foreground sm:block">
                      {m.summary}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  <p className="sm:hidden mb-2 text-foreground">{m.summary}</p>
                  {m.howMeasured}
                  <span className="mt-2 block text-xs">Range: {m.range}</span>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Section>

        {/* Model sweep */}
        <Section
          n="04"
          title="Choosing the adjudication model"
          subtitle="Only the stage-1 reasoning model varies on referee_v2; verifier, format and judge are held fixed."
          id="models"
        >
          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gauge className="size-4 text-primary" />
                  Cost vs. correctness
                </CardTitle>
                <CardDescription>
                  Each point is an adjudication model. Up and to the left is better.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CostCorrectnessScatter
                  points={MODEL_SWEEP.map<ScatterPoint>((r) => ({
                    label: r.label,
                    x: r.cost,
                    y: r.correctness,
                    tone: r.tagTone,
                    // gpt-5-mini and sonnet-4.5 share y=0.70 and sit close on x —
                    // push their labels apart so they don't overlap.
                    ...(r.label === "gpt-5-mini"
                      ? { labelDx: -10, labelAnchor: "end" as const }
                      : {}),
                    ...(r.label === "sonnet-4.5"
                      ? { labelDx: 10, labelAnchor: "start" as const }
                      : {}),
                  }))}
                  xLabel="Cost ($/case)"
                  yLabel="Correctness"
                />
              </CardContent>
            </Card>
            <div className="flex flex-col gap-4">
              <ModelSweepTable />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Counter-intuitively, the longest answers score worst: opus-4.8 averages
                2,891 characters at 0.600 correctness, while the concise gpt-5.5 (1,336
                chars) leads at 0.838. At temperature 0, verbose derivation on trap
                questions locks in an early wrong framing. <Em>gpt-5-mini</Em> ties
                sonnet-4.5 on correctness at the lowest cost, the production pick.
              </p>
            </div>
          </div>
        </Section>

        {/* Opus aside */}
        <section className="scroll-mt-28 pt-12" id="opus">
          <Card className="overflow-hidden border-amber-500/30 bg-amber-500/[0.04]">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                  <Sparkles className="size-5" />
                </span>
                <h3 className="text-lg font-semibold tracking-tight">
                  Wait, Opus did <span className="text-amber-500">badly?</span>
                </h3>
              </div>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Yes. The most expensive frontier model finished{" "}
                <Em>last on correctness (0.600)</Em> while the concise{" "}
                <Em>gpt-5.5 led at 0.838</Em>. The pattern is consistent: longer answers
                score worse. At temperature 0, opus-4.8 writes the most verbose
                derivations (~2,900 chars/answer) and on trap questions it commits to an
                early wrong framing, then reasons confidently toward the wrong verdict:
                miscounting, flipping yes/no, or misreading replacement effects. It's not
                a pipeline bug (every model ran the same graph) and not hallucination
                (faithfulness stayed high). It's just a worse fit for terse, high-stakes
                adjudication.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href="/data/bench40-adjudication-sweep.csv" download>
                    <Download /> Full results (CSV)
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href="/data/bench40-adjudication-sweep.json" download>
                    <FileJson /> Full results (JSON)
                  </a>
                </Button>
                <span className="text-xs text-muted-foreground">
                  Per-case scores, questions, and every model's answer across all 40 cases
                  × 4 models. Check it yourself.
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Conclusions */}
        <Section
          n="05"
          title="Conclusions"
          subtitle="What the benchmark actually shows."
          id="conclusions"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <VerdictCard
              icon={TrendingUp}
              kicker="Finding 1"
              title="The graph wins, at a price"
              body="referee_v2 leads correctness (0.70 vs RAG's 0.575) and triples rule retrieval, while tying on card resolution and citation validity. But it costs ~1.7× and runs ~4× slower: a premium you pay when answer quality matters more than latency."
            />
            <VerdictCard
              icon={Layers}
              kicker="Finding 2"
              title="It helps evidence, not deduction"
              body="The gains concentrate where retrieval is the bottleneck: costs & casting, replacement & prevention, and simple questions. On layers, continuous effects and harder reasoning puzzles it only ties RAG: more machinery finds better rules, it doesn't reason better."
            />
            <VerdictCard
              icon={Scale}
              kicker="Finding 3"
              title="Bigger model ≠ better referee"
              body="On the adjudication sweep the frontier opus model ranked last; the concise gpt-5.5 led, and gpt-5-mini tied sonnet-4.5 on correctness at the lowest cost in the field, so gpt-5-mini is the production default."
            />
          </div>
        </Section>
      </div>
    </main>
  )
}

function Em({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>
}

function ArchTab({ a }: { a: Architecture }) {
  const isProd = a.status === "production"
  const statusLabel =
    a.status === "production"
      ? "production"
      : a.status === "ablation"
        ? "superseded"
        : "baseline"
  return (
    <Card
      className={cn(
        "border-border/60",
        isProd && "border-primary/50 bg-primary/[0.03]",
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{a.name}</CardTitle>
            <CardDescription>{a.tagline}</CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-[10px]",
              isProd ? "border-primary/40 text-primary" : "text-muted-foreground",
            )}
          >
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-border/50 bg-muted/15 p-4">
          <div className="mx-auto" style={{ maxWidth: DIAGRAMS[a.key].viewBox.w }}>
            <ArchitectureGraph diagram={DIAGRAMS[a.key]} accent={isProd} />
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {a.description}
        </p>
      </CardContent>
    </Card>
  )
}

function VerdictCard({
  icon: Icon,
  kicker,
  title,
  body,
}: {
  icon: LucideIcon
  kicker: string
  title: string
  body: string
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-col gap-2 p-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {kicker}
          </span>
        </div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  )
}

function Section(props: {
  n: string
  title: string
  subtitle?: string
  id?: string
  children: React.ReactNode
}) {
  return (
    <section id={props.id} className="scroll-mt-28 pt-16">
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-semibold tabular-nums text-primary/70">{props.n}</span>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{props.title}</h2>
          {props.subtitle && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{props.subtitle}</p>
          )}
        </div>
      </div>
      <div className="mt-6">{props.children}</div>
    </section>
  )
}
