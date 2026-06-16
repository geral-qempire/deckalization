import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import { KIND_STYLE } from "@/data/api-endpoints"
import type { Kind, Sample } from "@/data/api-endpoints"

export function MethodBadge({ kind, className }: { kind: Kind; className?: string }) {
  const s = KIND_STYLE[kind]
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        s.cls,
        className,
      )}
    >
      {s.label}
    </span>
  )
}

export function CodeBlock({
  sample,
  label,
  className,
}: {
  sample: Sample
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(sample.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/60 bg-[#0d1117]", className)}>
      <div className="flex items-center justify-between border-b border-border/60 bg-white/[0.03] px-3 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          {label ?? sample.lang}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
        <code className="font-mono text-foreground/90">{sample.code}</code>
      </pre>
    </div>
  )
}
