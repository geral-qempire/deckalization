import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { normalizeName } from "@convex/lib/normalize"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

// Image links come from our own Convex card mirror (stored at ingest from the
// Scryfall CDN) — never the Scryfall API at render time.
function useCardImage(name: string) {
  const rows = useQuery(api.queries.getCardsByNormalizedName, {
    normalizedName: normalizeName(name),
  })
  const match = rows?.find((r) => r.imageUrl ?? r.imageUrlSmall)
  return {
    small: match?.imageUrlSmall ?? match?.imageUrl,
    normal: match?.imageUrl ?? match?.imageUrlSmall,
  }
}

/** Small static thumbnail (no hover). Renders nothing if we have no art. */
export function CardThumb({ name }: { name: string }) {
  const { small } = useCardImage(name)
  if (!small) return null
  return (
    <img
      src={small}
      alt={name}
      loading="lazy"
      className="aspect-[63/88] w-[74px] shrink-0 self-start rounded-md border border-border/60 bg-muted object-cover shadow-sm"
    />
  )
}

/**
 * Wraps any trigger element so hovering it reveals the full-size card image in
 * a portaled popover (floats above scroll/overflow containers). If we have no
 * art for the card, the children render unchanged.
 */
export function CardPreview({
  name,
  children,
}: {
  name: string
  children: React.ReactNode
}) {
  const { normal } = useCardImage(name)
  if (!normal) return <>{children}</>
  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        className="w-auto border-0 bg-transparent p-0 shadow-none"
      >
        <img
          src={normal}
          alt={name}
          className="w-60 max-w-[70vw] rounded-2xl border border-border/60 shadow-2xl"
        />
      </HoverCardContent>
    </HoverCard>
  )
}
