import { Link, Outlet, createFileRoute } from "@tanstack/react-router"
import { MethodBadge } from "@/components/api-bits"
import { GROUPS } from "@/data/api-endpoints"

export const Route = createFileRoute("/api-reference")({ component: ApiLayout })

function ApiLayout() {
  return (
    <div className="relative">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_120%_at_50%_-10%,color-mix(in_oklab,var(--color-primary)_12%,transparent),transparent)]" />
    <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[230px_1fr]">
      <aside className="hidden lg:block">
        <nav className="sticky top-20 space-y-6">
          <Link
            to="/api-reference"
            activeOptions={{ exact: true }}
            className="block rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            Introduction
          </Link>
          {GROUPS.map((g) => (
            <div key={g.id}>
              <div className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.title}
              </div>
              <ul className="mt-2 space-y-0.5">
                {g.endpoints.map((e) => (
                  <li key={e.slug}>
                    <Link
                      to="/api-reference/$slug"
                      params={{ slug: e.slug }}
                      className="flex items-center gap-2 rounded-md px-2 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      activeProps={{ className: "bg-muted text-foreground" }}
                    >
                      <MethodBadge kind={e.kind} className="w-[68px]" />
                      <span className="truncate">{e.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
    </div>
  )
}
