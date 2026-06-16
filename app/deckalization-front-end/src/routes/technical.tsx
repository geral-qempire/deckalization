import { createFileRoute } from "@tanstack/react-router"
import { Sparkles } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import {
  ComparisonBars,
  CostCorrectnessScatter,
  MetricBars,
  PipelineLegend
  
} from "@/components/charts"
import type {ScatterPoint} from "@/components/charts";
import { ScoreTable } from "@/components/score-table"
import { ModelSweepTable } from "@/components/model-sweep-table"
import {
  ARCHITECTURES,
  KEY_FINDINGS,
  MODELS_NOTE,
  REFEREE_V2_CHANGES
  
} from "@/data/architectures"
import type {Architecture} from "@/data/architectures";
import { METRICS } from "@/data/metrics"
import {
  BENCH40_EFFICIENCY,
  BENCH40_QUALITY,
  CATEGORY_BREAKDOWN,
  COMPLEXITY_BREAKDOWN,
  EXPERIMENT_META,
  HEADLINE_STATS,
  MODEL_SWEEP,
} from "@/data/scores"

export const Route = createFileRoute("/technical")({ component: Technical })

function Technical() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Technical results
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Four architectures for answering Magic: The Gathering rules questions, the
          metrics built to grade them, and the scores each earned on{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            {EXPERIMENT_META.suite}
          </code>{" "}
          — {EXPERIMENT_META.suiteDescription} Judge:{" "}
          <span className="font-medium text-foreground">{EXPERIMENT_META.judge}</span>.
        </p>
      </header>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {HEADLINE_STATS.map((s) => (
          <Card key={s.label} className="border-border/60 bg-primary/[0.03]">
            <CardContent className="flex flex-col gap-1 p-5">
              <span className="text-3xl font-semibold tracking-tight text-primary">
                {s.value}
              </span>
              <span className="text-sm font-medium">{s.label}</span>
              <span className="text-xs text-muted-foreground">{s.detail}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Section title="The architectures compared" id="architectures">
        <div className="grid gap-4 md:grid-cols-2">
          {ARCHITECTURES.map((a) => (
            <ArchitectureCard key={a.key} a={a} />
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{MODELS_NOTE}</p>
      </Section>

      <Section
        title="What made referee_v2 win"
        subtitle="Four targeted changes turned a deficit vs. RAG into a decisive lead."
        id="changes"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {REFEREE_V2_CHANGES.map((c, i) => (
            <Card
              key={c.title}
              className={cn("border-border/60", c.decisive && "border-primary/50")}
            >
              <CardContent className="flex flex-col gap-2 p-5">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className="font-medium">{c.title}</span>
                  {c.decisive && (
                    <Badge className="ml-auto gap-1 bg-primary/15 text-primary">
                      <Sparkles className="size-3" />
                      decisive
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{c.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="The metrics"
        subtitle="What each metric means and how it is measured."
        id="metrics"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {METRICS.map((m) => (
            <Card key={m.key} className="border-border/60">
              <CardContent className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{m.name}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[10px]",
                      m.kind === "LLM judge"
                        ? "border-primary/40 text-primary"
                        : "border-chart-2/40 text-muted-foreground",
                    )}
                  >
                    {m.kind}
                  </Badge>
                </div>
                <p className="text-sm">{m.summary}</p>
                <p className="text-xs text-muted-foreground">{m.howMeasured}</p>
                <span className="text-[10px] text-muted-foreground">
                  Range: {m.range}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Scores — zero-shot vs RAG vs referee_v2"
        subtitle="The 40-case benchmark, gpt-5-mini adjudication. Higher is better for quality metrics; best in each row is highlighted. zero-shot is the documented floor."
        id="scores"
      >
        <div className="grid gap-8 lg:grid-cols-2">
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
          <div className="flex flex-col gap-4">
            <ScoreTable rows={BENCH40_QUALITY} />
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                Efficiency (lower is better)
              </h3>
              <ScoreTable rows={BENCH40_EFFICIENCY} />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Where the graph helps — and where it doesn't"
        subtitle="Correctness by interaction category, RAG vs referee_v2 (sliced from LangSmith example metadata). Buckets are small — read them as directional."
        id="by-category"
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Correctness by category</CardTitle>
              <CardDescription>
                <PipelineLegend />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComparisonBars buckets={CATEGORY_BREAKDOWN} />
            </CardContent>
          </Card>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground lg:pt-4">
            <p>
              The gains concentrate where retrieval is the bottleneck:{" "}
              <span className="font-medium text-foreground">costs &amp; casting</span>{" "}
              (0.38 → 0.75) and{" "}
              <span className="font-medium text-foreground">
                replacement &amp; prevention
              </span>{" "}
              (0.50 → 0.75) — exactly the questions where pulling the precise
              Comprehensive Rule decides the answer.
            </p>
            <p>
              On{" "}
              <span className="font-medium text-foreground">
                layers &amp; continuous effects
              </span>{" "}
              the two tie (0.73): both already retrieve enough, and the remaining
              misses are genuine multi-step reasoning flips that more retrieval
              doesn&apos;t fix.
            </p>
            <p>
              <span className="font-medium text-foreground">Combat, zones &amp; state</span>{" "}
              is a shared weak spot (0.25 for both, n=4) — a small, adversarial
              bucket worth a closer look at scale.
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="…and by question complexity"
        subtitle="RulesGuru's own difficulty label. The graph's lift is largest on Simple questions; the hardest cases remain hard."
        id="by-complexity"
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Correctness by complexity</CardTitle>
              <CardDescription>
                <PipelineLegend />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComparisonBars buckets={COMPLEXITY_BREAKDOWN} />
            </CardContent>
          </Card>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground lg:pt-4">
            <p>
              referee_v2 lifts{" "}
              <span className="font-medium text-foreground">Simple</span> questions
              from 0.57 → 0.75 — the bulk of the benchmark (n=28) and the bulk of the
              overall win.
            </p>
            <p>
              On{" "}
              <span className="font-medium text-foreground">Intermediate</span> and{" "}
              <span className="font-medium text-foreground">Complicated</span> cases
              it matches RAG rather than beating it: these are the genuine
              reasoning puzzles where the bottleneck is deduction, not evidence.
              With n=9 and n=3 these are directional only.
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="Adjudication model sweep"
        subtitle="Only the stage-1 reasoning model varies on referee_v2; verifier, format and judge are held fixed."
        id="model-sweep"
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <ModelSweepTable />
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Cost vs. correctness</CardTitle>
              <CardDescription>
                Bubble = adjudication model. Up and to the left is better.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CostCorrectnessScatter
                points={MODEL_SWEEP.map<ScatterPoint>((r) => ({
                  label: r.label,
                  x: r.cost,
                  y: r.correctness,
                  tone: r.tagTone,
                }))}
                xLabel="Cost ($/case)"
                yLabel="Correctness"
              />
            </CardContent>
          </Card>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Counter-intuitively, the longest answers score worst: opus-4.8 averages 2,891
          characters at 0.600 correctness, while the concise gpt-5.5 (1,336 chars) leads
          at 0.838. More tokens lock in an early wrong framing on trap questions.
        </p>
      </Section>

      <Section
        title="Key findings"
        subtitle="The story behind the numbers."
        id="findings"
      >
        <Accordion type="single" collapsible className="rounded-xl border border-border/60 px-4">
          {KEY_FINDINGS.map((f, i) => (
            <AccordionItem key={f.title} value={`f${i}`} className="last:border-b-0">
              <AccordionTrigger className="text-left text-sm font-medium">
                {f.title}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {f.body}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Section>
    </main>
  )
}

function ArchitectureCard({ a }: { a: Architecture }) {
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
        a.status === "production" && "border-primary/50 bg-primary/[0.03]",
      )}
    >
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">{a.name}</h3>
            <p className="text-xs text-muted-foreground">{a.tagline}</p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-[10px]",
              a.status === "production"
                ? "border-primary/40 text-primary"
                : "text-muted-foreground",
            )}
          >
            {statusLabel}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {a.steps.map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {s}
              </span>
              {i < a.steps.length - 1 && (
                <span className="text-muted-foreground/50">→</span>
              )}
            </span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{a.description}</p>
      </CardContent>
    </Card>
  )
}

function Section(props: {
  title: string
  subtitle?: string
  id?: string
  children: React.ReactNode
}) {
  return (
    <section id={props.id} className="mt-14 scroll-mt-20">
      <h2 className="text-xl font-semibold tracking-tight">{props.title}</h2>
      {props.subtitle && (
        <p className="mt-1 text-sm text-muted-foreground">{props.subtitle}</p>
      )}
      <div className="mt-5">{props.children}</div>
    </section>
  )
}
