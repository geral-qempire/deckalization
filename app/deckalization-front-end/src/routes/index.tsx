import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, GitCompare, Network, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { HEADLINE_STATS } from "@/data/scores"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <section className="flex flex-col items-start gap-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          Multi-agent LangGraph referee · grounded in the Comprehensive Rules
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          A Magic: The Gathering rules referee that{" "}
          <span className="text-primary">shows its work.</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          deckalization answers MTG rules questions with citations to the
          Comprehensive Rules and Oracle card text. It compares four answering
          architectures, measures them on a golden benchmark, and lets you watch the
          winning agent reason through a question, node by node.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link to="/demo">
              Try the live demo
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/technical">See the technical results</Link>
          </Button>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {HEADLINE_STATS.map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="flex flex-col gap-1 p-5">
              <span className="text-3xl font-semibold tracking-tight">{s.value}</span>
              <span className="text-sm font-medium">{s.label}</span>
              <span className="text-xs text-muted-foreground">{s.detail}</span>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-2">
        <FeatureCard
          to="/technical"
          icon={<GitCompare className="size-5" />}
          title="The technical story"
          body="Zero-shot vs RAG vs the multi-agent referee. The metrics we built, what they mean and how they're measured, and the scores each architecture and model earned on the benchmark."
          cta="Read the results"
        />
        <FeatureCard
          to="/demo"
          icon={<Network className="size-5" />}
          title="Inside the graph"
          body="Send a question and watch it flow through the referee: routing, card resolution, query decomposition, rules retrieval, adjudication, and the verifier loop — each node's output revealed in real time."
          cta="Open the demo"
        />
      </section>
    </main>
  )
}

function FeatureCard(props: {
  to: string
  icon: React.ReactNode
  title: string
  body: string
  cta: string
}) {
  return (
    <Link to={props.to} className="group">
      <Card className="h-full border-border/60 transition-colors group-hover:border-primary/50">
        <CardContent className="flex h-full flex-col gap-3 p-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {props.icon}
          </span>
          <h2 className="text-xl font-semibold">{props.title}</h2>
          <p className="text-sm text-muted-foreground">{props.body}</p>
          <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-primary">
            {props.cta}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
