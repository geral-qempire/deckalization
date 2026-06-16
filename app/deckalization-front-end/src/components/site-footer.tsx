import { Link } from "@tanstack/react-router"
import { Gavel } from "lucide-react"
import { SOCIAL_LINKS } from "@/components/brand-icons"

const socials = SOCIAL_LINKS

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-sm sm:flex-row sm:justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Gavel className="size-3.5" />
          </span>
          <span>Deckalization</span>
        </Link>

        <p className="order-last text-center text-xs text-muted-foreground sm:order-none sm:text-left">
          A Magic: The Gathering rules referee.
        </p>

        <div className="flex items-center gap-2">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              aria-label={s.label}
              className="flex size-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <s.icon className="size-4" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
