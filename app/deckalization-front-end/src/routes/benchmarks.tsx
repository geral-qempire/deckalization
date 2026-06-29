import { Link, createFileRoute } from "@tanstack/react-router"
import { FlaskConical, GitBranch, Scale, Shuffle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricBar } from "@/components/charts"

export const Route = createFileRoute("/benchmarks")({ component: BenchmarksPage })

interface Suite {
  name: string
  count: number
  blurb: string
  highlight?: boolean
}

const SUITES: Suite[] = [
  {
    name: "benchmark",
    count: 125,
    blurb: "The full stratified evaluation set, sampled across complexity and difficulty to mirror the corpus.",
  },
  {
    name: "bench40",
    count: 40,
    blurb: "A fixed 40-case subset of benchmark for cheap, repeatable comparisons. The headline numbers come from here.",
    highlight: true,
  },
  {
    name: "smoke",
    count: 15,
    blurb: "A tiny set for fast CI sanity checks: does the pipeline still run and score sanely?",
  },
  {
    name: "card_resolution",
    count: 9,
    blurb: "Resolver-only cases (raw name / nickname → the right card), independent of rules reasoning.",
  },
]

const STAT = [
  { value: "1,153", label: "RulesGuru questions", detail: "the full ingested rules-QA corpus" },
  { value: "9", label: "Hand-written cases", detail: "card-resolution edge cases" },
  { value: "40", label: "bench40 fixed sample", detail: "the headline comparison set" },
  { value: "6", label: "Metrics per run", detail: "correctness + 5 grounding/retrieval scores" },
]

const COMPLEXITY = [
  { label: "Simple", n: 28 },
  { label: "Intermediate", n: 9 },
  { label: "Complicated", n: 3 },
]
const BENCH40_TOTAL = 40

const CASE_FIELDS = [
  ["question", "The rules question posed to the agent."],
  ["expectedAnswer", "Expert reference answer the LLM judge grades against."],
  ["expectedRules", "Golden Comprehensive-Rule numbers (drives rule + citation recall)."],
  ["cards", "Cards the question is about (drives card recall / precision)."],
  ["tags", "RulesGuru topic tags, sliced into interaction categories."],
  ["complexity / level", "Stratification keys (Simple/Intermediate/Complicated × L0–L3)."],
]

function BenchmarksPage() {
  return (
    <main className="pb-24">
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_50%_-10%,color-mix(in_oklab,var(--color-primary)_12%,transparent),transparent)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <FlaskConical className="size-3.5" />
            Evaluation data
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Benchmarks</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Every architecture is scored against a golden set of expert-answered Magic
            rules questions, mostly from{" "}
            <a
              href="https://rulesguru.org"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              RulesGuru
            </a>
            . The cases live in Convex (<code className="font-mono text-foreground/80">evalCases</code>)
            and are sampled into fixed suites for reproducible runs.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STAT.map((s) => (
              <div key={s.label} className="rounded-2xl border border-border/60 bg-card/60 p-5">
                <div className="text-3xl font-semibold tracking-tight text-primary tabular-nums">
                  {s.value}
                </div>
                <div className="mt-1 text-sm font-medium">{s.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-16 px-4 pt-12">
        {/* Suites */}
        <Section
          icon={GitBranch}
          title="The suites"
          subtitle="Membership is tagged on each case (the suites array), so a run is just a suite name."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {SUITES.map((s) => (
              <div
                key={s.name}
                className={cn(
                  "rounded-2xl border p-5",
                  s.highlight ? "border-primary/50 bg-primary/[0.05]" : "border-border/60 bg-card/30",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-sm font-semibold text-foreground">{s.name}</code>
                  <span
                    className={cn(
                      "text-2xl font-semibold tabular-nums",
                      s.highlight ? "text-primary" : "text-foreground",
                    )}
                  >
                    {s.count}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.blurb}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Sampling */}
        <Section
          icon={Shuffle}
          title="How cases are sampled"
          subtitle="A pinned manifest (seed 42) keeps the suites identical across runs, so score deltas reflect the model, not the sample."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                Cases are stratified by <Em>complexity</Em> (Simple / Intermediate /
                Complicated) crossed with a difficulty <Em>level</Em> (L0–L3 + Corner
                Case), then sampled with a fixed seed. A handful of <Em>pinned</Em> ids are
                always included so trend lines stay comparable as the manifest grows.
              </p>
              <p>
                bench40 is a stratified 40-case slice of benchmark: small enough to sweep
                models cheaply, balanced enough to stay representative.
              </p>
            </div>
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">bench40 by complexity</CardTitle>
                <CardDescription>40 cases, stratified</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {COMPLEXITY.map((c) => (
                  <MetricBar
                    key={c.label}
                    label={c.label}
                    fillPct={(c.n / BENCH40_TOTAL) * 100}
                    value={String(c.n)}
                    barClassName="bg-primary"
                    forceLabelOutside
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* Anatomy */}
        <Section
          icon={FlaskConical}
          title="Anatomy of a case"
          subtitle="Each evalCase pairs a question with everything the scorers need."
        >
          <div className="overflow-hidden rounded-xl border border-border/50 divide-y divide-border/40">
            {CASE_FIELDS.map(([name, desc]) => (
              <div key={name} className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-[220px_1fr] sm:gap-4">
                <code className="font-mono text-sm font-medium text-foreground">{name}</code>
                <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Full schema on the{" "}
            <Link to="/database" className="text-primary underline-offset-2 hover:underline">
              Database
            </Link>{" "}
            page (<code className="font-mono text-foreground/80">evalCases</code>).
          </p>
        </Section>

        {/* Evaluation */}
        <Section
          icon={Scale}
          title="How we evaluate"
          subtitle="Cases become LangSmith experiments, run via a GitHub Action and judged by an LLM."
        >
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              The eval harness pulls a suite from Convex, runs each architecture, and logs
              the results to LangSmith as a comparable experiment. Example metadata
              (category, complexity, level) rides along so scores can be sliced without
              re-running anything.
            </p>
            <p>
              Answers are graded by a <Em>claude-sonnet-4.5</Em> judge for correctness and
              faithfulness, alongside deterministic rule/citation/card recall checks: six
              metrics in all. See the{" "}
              <Link to="/technical" className="text-primary underline-offset-2 hover:underline">
                Technical
              </Link>{" "}
              page for the scores and the{" "}
              <Link to="/api-reference" className="text-primary underline-offset-2 hover:underline">
                API
              </Link>{" "}
              reference to query the cases yourself.
            </p>
          </div>

          <div className="mt-5 rounded-xl border border-border/50 bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Attribution.</span> Questions
            sourced from RulesGuru (rulesguru.org) for non-commercial evaluation only.
          </div>
        </Section>
      </div>
    </main>
  )
}

function Em({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof FlaskConical
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="scroll-mt-20">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      {subtitle && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}
