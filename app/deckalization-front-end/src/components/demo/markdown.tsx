import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Components } from "react-markdown"
import { cn } from "@/lib/utils"

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h3 className="mt-4 text-sm font-semibold tracking-tight first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h4 className="mt-4 text-sm font-semibold tracking-tight first:mt-0">{children}</h4>
  ),
  h3: ({ children }) => (
    <h4 className="mt-3 text-sm font-semibold tracking-tight first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="ml-1 flex list-none flex-col gap-1.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="ml-5 flex list-decimal flex-col gap-1.5 marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="relative pl-4 leading-relaxed before:absolute before:left-0 before:top-[0.55em] before:size-1.5 before:-translate-y-1/2 before:rounded-full before:bg-primary/60 [ol_&]:pl-1 [ol_&]:before:hidden">
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border/60" />,
}

export function Markdown({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2 text-sm text-foreground/90", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
