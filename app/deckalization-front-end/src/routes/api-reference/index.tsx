import { Link, createFileRoute } from "@tanstack/react-router"
import { Database, KeyRound, Network, Plug } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { MethodBadge } from "@/components/api-bits"
import { GROUPS } from "@/data/api-endpoints"

export const Route = createFileRoute("/api-reference/")({ component: ApiIntro })

function ApiIntro() {
  return (
    <div className="max-w-3xl">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        <KeyRound className="size-3.5" />
        API Reference
      </span>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Introduction</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Two surfaces power deckalization: a Convex data layer (cards, rules, aliases, eval
        cases) and the LangGraph referee agent. The same tools are also exposed over MCP.
        Everything here is the real, deployed contract, and most read endpoints can be run
        right from the browser.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <SurfaceCard icon={Database} title="Convex data layer" env="CONVEX_URL" auth="Client / deploy key">
          Typed queries, mutations and actions, called through the generated{" "}
          <Code>api</Code> object (<Code>file:export</Code> ids).
        </SurfaceCard>
        <SurfaceCard icon={Network} title="LangGraph agent" env="LANGGRAPH_DEPLOYMENT_URL" auth="LANGSMITH_API_KEY">
          The referee_v2 graph, streamed per node and fronted by the key-safe{" "}
          <Code>/api/referee-stream</Code> proxy.
        </SurfaceCard>
        <SurfaceCard icon={Plug} title="MCP server" env="stdio" auth="Local process">
          FastMCP wraps the read-only tool layer for any MCP host.
        </SurfaceCard>
      </div>

      <div className="mt-10 rounded-xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Try it.</span> Read-only Convex
        queries and the agent stream run live against the shared deployment. Writes,
        actions, the direct LangGraph call and MCP tools are documented as reference only.
      </div>

      <h2 className="mt-12 text-lg font-semibold tracking-tight">All endpoints</h2>
      <div className="mt-4 space-y-6">
        {GROUPS.map((g) => (
          <div key={g.id}>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g.title}
            </div>
            <ul className="mt-2 divide-y divide-border/50 overflow-hidden rounded-lg border border-border/50">
              {g.endpoints.map((e) => (
                <li key={e.slug}>
                  <Link
                    to="/api-reference/$slug"
                    params={{ slug: e.slug }}
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <MethodBadge kind={e.kind} className="w-[72px]" />
                    <code className="font-mono text-sm text-foreground">{e.name}</code>
                    <span className="ml-auto hidden truncate text-xs text-muted-foreground sm:block">
                      {e.summary}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-foreground/80">{children}</code>
}

function SurfaceCard({
  icon: Icon,
  title,
  env,
  auth,
  children,
}: {
  icon: LucideIcon
  title: string
  env: string
  auth: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{children}</p>
      <dl className="mt-3 space-y-1 text-[11px]">
        <div className="flex gap-2">
          <dt className="w-10 shrink-0 text-muted-foreground">Base</dt>
          <dd className="font-mono break-all text-foreground/80">{env}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-10 shrink-0 text-muted-foreground">Auth</dt>
          <dd className="text-foreground/80">{auth}</dd>
        </div>
      </dl>
    </div>
  )
}
