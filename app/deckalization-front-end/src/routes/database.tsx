import { createFileRoute } from "@tanstack/react-router"
import { Database, Search, Sparkles, KeyRound } from "lucide-react"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/database")({ component: DatabasePage })

type IndexKind = "index" | "search" | "vector"

interface Field {
  name: string
  type: string
  desc: string
  optional?: boolean
}

interface IndexDef {
  name: string
  kind: IndexKind
  on: string
}

interface TableDef {
  name: string
  rows: string
  purpose: string
  fields: Field[]
  indexes: IndexDef[]
}

const INDEX_STYLE: Record<IndexKind, { label: string; cls: string }> = {
  index: { label: "INDEX", cls: "border-sky-500/30 bg-sky-500/15 text-sky-300" },
  search: { label: "SEARCH", cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" },
  vector: { label: "VECTOR", cls: "border-violet-500/30 bg-violet-500/15 text-violet-300" },
}

const TABLES: TableDef[] = [
  {
    name: "cards",
    rows: "~30,000 Oracle cards",
    purpose:
      "The Oracle-card mirror, refreshed from Scryfall bulk data. Keyed/relational lookup by normalized name, never vectorized, because the question already names the card.",
    fields: [
      { name: "oracleId", type: "string", desc: "Scryfall oracle_id; stable card identity and upsert key." },
      { name: "name", type: "string", desc: "Display name." },
      { name: "normalizedName", type: "string", desc: "Lower-cased, punctuation/diacritics-stripped key for exact lookup." },
      { name: "oracleText", type: "string", desc: "Full Oracle rules text." },
      { name: "typeLine", type: "string", desc: 'Type line, e.g. "Instant".' },
      { name: "manaCost", type: "string", optional: true, desc: 'Mana cost, e.g. "{R}".' },
      { name: "power", type: "string", optional: true, desc: 'Scryfall string ("3", "*", "1+*").' },
      { name: "toughness", type: "string", optional: true, desc: "Scryfall string." },
      { name: "loyalty", type: "string", optional: true, desc: "Planeswalker loyalty." },
      { name: "defense", type: "string", optional: true, desc: "Battle defense." },
      { name: "colors", type: "string[]", desc: "Color identity letters." },
      { name: "keywords", type: "string[]", desc: "Keyword abilities." },
      { name: "legalities", type: "any", desc: "Format → legality map." },
      { name: "rulings", type: "any[]", desc: "Official card rulings (full text, untruncated)." },
      { name: "layout", type: "string", optional: true, desc: 'Scryfall layout ("normal", "token", "art_series").' },
      { name: "setType", type: "string", optional: true, desc: "Set type; lets the resolver prefer playable printings." },
      { name: "scryfallId", type: "string", optional: true, desc: "Bookkeeping for idempotent refresh." },
      { name: "updatedAt", type: "number", desc: "Last-refresh timestamp." },
    ],
    indexes: [
      { name: "by_normalized_name", kind: "index", on: "normalizedName" },
      { name: "by_oracle_id", kind: "index", on: "oracleId" },
      { name: "search_name", kind: "search", on: "name" },
    ],
  },
  {
    name: "ruleChunks",
    rows: "Comprehensive Rules, chunked",
    purpose:
      "Parsed + embedded Comprehensive Rules. Semantic vector search by meaning, because you don't know the rule number up front, so you retrieve by similarity.",
    fields: [
      { name: "ruleNumber", type: "string", desc: 'CR number, e.g. "601.2a".' },
      { name: "section", type: "string", desc: "Top-level CR section." },
      { name: "text", type: "string", desc: "Rule text for this chunk." },
      { name: "embedding", type: "number[]", desc: "3072-dim vector (text-embedding-3-large)." },
      { name: "rulesVersion", type: "string", optional: true, desc: "Effective date for idempotent re-ingest." },
    ],
    indexes: [
      { name: "by_rule_number", kind: "index", on: "ruleNumber" },
      { name: "by_embedding", kind: "vector", on: "3072 dims" },
    ],
  },
  {
    name: "aliases",
    rows: "Community nicknames",
    purpose:
      'Nickname → card mappings powering a rung of the resolver ladder (e.g. "bob" → Dark Confidant).',
    fields: [
      { name: "alias", type: "string", desc: "Display nickname." },
      { name: "normalizedAlias", type: "string", desc: "Normalized lookup key." },
      { name: "oracleId", type: "string", desc: "Target card oracle id." },
      { name: "canonicalName", type: "string", desc: "Canonical card name." },
    ],
    indexes: [{ name: "by_normalized_alias", kind: "index", on: "normalizedAlias" }],
  },
  {
    name: "evalCases",
    rows: "~1,160 golden cases",
    purpose:
      "The golden benchmark store: the full RulesGuru corpus plus fixed benchmark/smoke subsets. See the Benchmarks page for how the suites are sampled.",
    fields: [
      { name: "source", type: "string", desc: '"rulesguru" | "hand".' },
      { name: "externalId", type: "string", desc: "Id within the source." },
      { name: "kind", type: '"rules_qa" | "card_resolution"', desc: "Case type." },
      { name: "question", type: "string", desc: "The prompt." },
      { name: "expectedAnswer", type: "string", desc: "Expert reference answer." },
      { name: "expectedRules", type: "string[]", desc: "Golden CR numbers." },
      { name: "cards", type: "string[]", desc: "Cards the question is about." },
      { name: "tags", type: "string[]", desc: "RulesGuru topic tags (drive category slices)." },
      { name: "complexity", type: "string", optional: true, desc: "Simple / Intermediate / Complicated." },
      { name: "level", type: "string", optional: true, desc: "Difficulty level (L0–L3 / Corner Case)." },
      { name: "sourceUrl", type: "string", optional: true, desc: "Link to the original question." },
      { name: "expectedStatus", type: "string", optional: true, desc: "card_resolution only: expected resolve status." },
      { name: "expectedCardName", type: "string", optional: true, desc: "card_resolution only: expected card." },
      { name: "suites", type: "string[]", desc: 'Suite membership: "benchmark", "bench40", "smoke", …' },
      { name: "updatedAt", type: "number", desc: "Last-write timestamp." },
    ],
    indexes: [
      { name: "by_source_external_id", kind: "index", on: "source, externalId" },
      { name: "by_kind", kind: "index", on: "kind" },
    ],
  },
]

function DatabasePage() {
  return (
    <main className="pb-24">
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_50%_-10%,color-mix(in_oklab,var(--color-primary)_12%,transparent),transparent)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Database className="size-3.5" />
            Data layer
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Database</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            deckalization runs on Convex with two datasets and two access patterns. Cards are
            looked up relationally by normalized name (plus fuzzy search); the
            Comprehensive Rules are retrieved by meaning through a vector index. Aliases
            feed the resolver, and eval cases hold the golden benchmark.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <Legend kind="index" label="B-tree index (keyed / range)" />
            <Legend kind="search" label="Full-text search" />
            <Legend kind="vector" label="Vector (semantic) index" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-10 px-4 pt-10">
        {TABLES.map((t) => (
          <TableCard key={t.name} table={t} />
        ))}
      </div>
    </main>
  )
}

function Legend({ kind, label }: { kind: IndexKind; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-muted-foreground">
      <IndexBadge kind={kind} />
      {label}
    </span>
  )
}

function IndexBadge({ kind }: { kind: IndexKind }) {
  const s = INDEX_STYLE[kind]
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        s.cls,
      )}
    >
      {s.label}
    </span>
  )
}

const TABLE_ICON: Record<string, typeof Database> = {
  cards: KeyRound,
  ruleChunks: Sparkles,
  aliases: Search,
  evalCases: Database,
}

function TableCard({ table }: { table: TableDef }) {
  const Icon = TABLE_ICON[table.name] ?? Database
  return (
    <section className="scroll-mt-20 rounded-2xl border border-border/60 bg-card/30">
      <div className="border-b border-border/60 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <code className="font-mono text-lg font-semibold text-foreground">{table.name}</code>
          <span className="rounded-md border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
            {table.rows}
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {table.purpose}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {table.indexes.map((idx) => (
            <span
              key={idx.name}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-background/40 px-2 py-1 text-xs"
            >
              <IndexBadge kind={idx.kind} />
              <code className="font-mono text-foreground/80">{idx.name}</code>
              <span className="text-muted-foreground">[{idx.on}]</span>
            </span>
          ))}
        </div>
      </div>
      <div className="divide-y divide-border/40">
        {table.fields.map((f) => (
          <div key={f.name} className="grid grid-cols-1 gap-1 px-5 py-2.5 sm:grid-cols-[200px_1fr] sm:gap-4">
            <div className="flex items-center gap-2">
              <code className="font-mono text-sm font-medium text-foreground">{f.name}</code>
              {f.optional && (
                <span className="text-[10px] text-muted-foreground/70">optional</span>
              )}
            </div>
            <div className="min-w-0">
              <code className="font-mono text-xs text-primary/80">{f.type}</code>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
