import { Link } from "@tanstack/react-router"
import { Gavel } from "lucide-react"
import { cn } from "@/lib/utils"

const links = [
  { to: "/", label: "Overview" },
  { to: "/technical", label: "Technical" },
  { to: "/demo", label: "Live Demo" },
] as const

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gavel className="size-4" />
          </span>
          <span>
            deckalization
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.to === "/" }}
              className={cn(
                "rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
              )}
              activeProps={{ className: "bg-muted text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto text-xs text-muted-foreground">
          MTG rules referee
        </div>
      </div>
    </header>
  )
}
