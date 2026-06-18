import { useMemo, useState } from "react"
import { Link, createFileRoute, useParams } from "@tanstack/react-router"
import { useConvex } from "convex/react"
import type { FunctionReference } from "convex/server"
import { ArrowLeft, Check, Link2, Loader2, Play } from "lucide-react"
import { normalizeName } from "@convex/lib/normalize"
import { cn } from "@/lib/utils"
import { CodeBlock, MethodBadge } from "@/components/api-bits"
import { getEndpoint } from "@/data/api-endpoints"
import type { Endpoint, Param } from "@/data/api-endpoints"

export const Route = createFileRoute("/api-reference/$slug")({ component: EndpointPage })

type RunStatus = "idle" | "running" | "done" | "error"

function EndpointPage() {
  const { slug } = useParams({ from: "/api-reference/$slug" })
  const found = getEndpoint(slug)

  if (!found) {
    return (
      <div className="py-10">
        <p className="text-sm text-muted-foreground">Unknown endpoint.</p>
        <Link to="/api-reference" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary">
          <ArrowLeft className="size-4" />
          Back to the API reference
        </Link>
      </div>
    )
  }

  return (
    <EndpointDetail
      key={found.endpoint.slug}
      endpoint={found.endpoint}
      groupTitle={found.group.title}
    />
  )
}

function EndpointDetail({ endpoint, groupTitle }: { endpoint: Endpoint; groupTitle: string }) {
  const convex = useConvex()
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(endpoint.params.map((p) => [p.name, p.default ?? ""])),
  )
  const [status, setStatus] = useState<RunStatus>("idle")
  const [statusLabel, setStatusLabel] = useState<string>("")
  const [body, setBody] = useState<string>("")
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  const runnable = !!endpoint.run
  const setVal = (name: string, v: string) =>
    setValues((prev) => ({ ...prev, [name]: v }))

  const copyLink = () => {
    if (typeof window === "undefined") return
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 1400)
    })
  }

  async function run() {
    if (!endpoint.run) return
    const started = performance.now()
    setStatus("running")
    setStatusLabel("")
    setBody("")
    setElapsed(null)
    try {
      if (endpoint.run.kind === "convex-query") {
        const args = buildArgs(endpoint.params, values)
        const query = convex.query.bind(convex) as (
          ref: FunctionReference<"query">,
          a: Record<string, unknown>,
        ) => Promise<unknown>
        const result = await query(endpoint.run.ref, args)
        setBody(JSON.stringify(result, null, 2))
        setStatusLabel("200 OK")
        setStatus("done")
      } else {
        await runStream(values.question ?? "", setBody, setStatusLabel)
        setStatus("done")
      }
    } catch (err) {
      setBody(err instanceof Error ? err.message : String(err))
      setStatusLabel("Error")
      setStatus("error")
    } finally {
      setElapsed(Math.round(performance.now() - started))
    }
  }

  return (
    <div>
      <Link
        to="/api-reference"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground lg:hidden"
      >
        <ArrowLeft className="size-3.5" />
        API reference
      </Link>

      {/* Header */}
      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {groupTitle}
          </span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight break-all sm:text-3xl">
            {endpoint.name}
          </h1>
        </div>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copiedLink ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
          {copiedLink ? "Copied" : "Copy link"}
        </button>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {endpoint.summary}
      </p>

      {/* Playground bar */}
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-3 py-2.5">
        <MethodBadge kind={endpoint.kind} />
        <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
          {endpoint.path}
        </code>
        {runnable ? (
          <button
            type="button"
            onClick={run}
            disabled={status === "running"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {status === "running" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Try it
          </button>
        ) : (
          <span className="rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground">
            Reference only
          </span>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Left: params + returns */}
        <div className="min-w-0">
          <SectionLabel>{runnable ? "Parameters" : "Authorizations & parameters"}</SectionLabel>
          {endpoint.params.length === 0 ? (
            <p className="mt-2 text-xs italic text-muted-foreground">No parameters.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {endpoint.params.map((p) => (
                <ParamField
                  key={p.name}
                  param={p}
                  value={values[p.name] ?? ""}
                  editable={runnable}
                  onChange={(v) => setVal(p.name, v)}
                />
              ))}
            </div>
          )}

          <div className="mt-6">
            <SectionLabel>Returns</SectionLabel>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              <code className="font-mono text-foreground/80">{endpoint.returns}</code>
            </p>
          </div>

          {!runnable && (
            <p className="mt-6 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
              {referenceNote(endpoint)}
            </p>
          )}
        </div>

        {/* Right: request + response */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div>
            <SectionLabel>Request</SectionLabel>
            <div className="mt-2">
              <CodeBlock sample={endpoint.request} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <SectionLabel>Response</SectionLabel>
              {statusLabel && (
                <span
                  className={cn(
                    "text-[11px] font-medium tabular-nums",
                    status === "error" ? "text-rose-400" : "text-emerald-400",
                  )}
                >
                  {statusLabel}
                  {elapsed !== null && (
                    <span className="ml-2 text-muted-foreground">{elapsed} ms</span>
                  )}
                </span>
              )}
            </div>
            <div className="mt-2 overflow-hidden rounded-xl border border-border/60 bg-[#0d1117]">
              <pre className="max-h-[420px] overflow-auto p-4 text-xs leading-relaxed">
                <code className="font-mono text-foreground/90">
                  {body ||
                    (runnable
                      ? "// Click \u201cTry it\u201d to run this against the live deployment."
                      : endpoint.response?.code || "// No example response.")}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ParamField({
  param,
  value,
  editable,
  onChange,
}: {
  param: Param
  value: string
  editable: boolean
  onChange: (v: string) => void
}) {
  const id = useMemo(() => `p-${param.name}`, [param.name])
  return (
    <div className="rounded-lg border border-border/50 px-3 py-2.5">
      <label htmlFor={id} className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-xs font-medium text-foreground">{param.name}</code>
        <span className="font-mono text-[11px] text-muted-foreground">{param.type}</span>
        <span
          className={cn(
            "text-[10px] font-medium",
            param.required ? "text-rose-400" : "text-muted-foreground/70",
          )}
        >
          {param.required ? "required" : "optional"}
        </span>
      </label>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{param.desc}</p>
      {editable &&
        (param.options ? (
          <select
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-2 w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
          >
            {param.options.map((o) => (
              <option key={o} value={o}>
                {o === "" ? "(any)" : o}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            type={param.type === "number" ? "number" : "text"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={param.required ? "required" : "optional"}
            className="mt-2 w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
          />
        ))}
      {editable && param.normalize && value.trim() && normalizeName(value) !== value && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          sent as{" "}
          <code className="font-mono text-foreground/80">
            &quot;{normalizeName(value)}&quot;
          </code>
        </p>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  )
}

function buildArgs(params: Param[], values: Record<string, string>): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  for (const p of params) {
    const raw = (values[p.name] ?? "").trim()
    if (raw === "") {
      if (p.required) throw new Error(`Missing required parameter: ${p.name}`)
      continue
    }
    if (p.type === "number") {
      const n = Number(raw)
      if (Number.isNaN(n)) throw new Error(`${p.name} must be a number`)
      args[p.name] = n
    } else {
      args[p.name] = p.normalize ? normalizeName(raw) : raw
    }
  }
  return args
}

async function runStream(
  question: string,
  setBody: (s: string) => void,
  setStatusLabel: (s: string) => void,
) {
  if (!question.trim()) throw new Error("Missing required parameter: question")
  const res = await fetch("/api/referee-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  })
  setStatusLabel(`${res.status} ${res.statusText}`)
  if (!res.body) {
    setBody(await res.text())
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  let acc = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split("\n")
    buf = lines.pop() ?? ""
    for (const line of lines) {
      if (line.trim()) {
        acc += line + "\n"
        setBody(acc)
      }
    }
  }
  if (buf.trim()) {
    acc += buf
    setBody(acc)
  }
}

function referenceNote(endpoint: Endpoint): string {
  if (endpoint.kind === "tool") {
    return "Exposed over MCP. Call it from your MCP host (Cursor, Claude Desktop) after launching the server with `uv run python -m mcp_server.server`."
  }
  if (endpoint.kind === "stream") {
    return "Runs server-side with the LangSmith API key. Use the website proxy /api/referee-stream to try a live run from the browser."
  }
  return "Mutations and actions write to the shared deployment, so they're documented as reference only. Call them from the Convex client with the snippet above."
}
