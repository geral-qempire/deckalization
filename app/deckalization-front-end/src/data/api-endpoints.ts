import { api } from "@convex/_generated/api"
import type { FunctionReference } from "convex/server"

// The full deckalization API surface, modelled for a per-endpoint reference with
// an interactive playground. Reads (Convex public queries) and the agent stream
// are runnable straight from the browser; writes/admin/MCP are reference-only.

export type Kind = "query" | "mutation" | "action" | "post" | "stream" | "tool"

export interface Param {
  name: string
  type: string
  required: boolean
  desc: string
  /** Prefilled value in the playground form. */
  default?: string
  /** Renders a <select> instead of a text input. */
  options?: string[]
  /** Run the value through normalizeName() before sending (normalized-key params). */
  normalize?: boolean
}

export interface Sample {
  lang: string
  code: string
}

export type Run =
  | { kind: "convex-query"; ref: FunctionReference<"query"> }
  | { kind: "stream" }

export interface Endpoint {
  slug: string
  kind: Kind
  name: string
  path: string
  summary: string
  params: Param[]
  returns: string
  request: Sample
  response?: Sample
  /** Present when the endpoint can be executed live from the browser. */
  run?: Run
}

export interface Group {
  id: string
  title: string
  description: string
  endpoints: Endpoint[]
}

export const KIND_STYLE: Record<Kind, { label: string; cls: string }> = {
  query: { label: "QUERY", cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" },
  mutation: { label: "MUTATION", cls: "border-amber-500/30 bg-amber-500/15 text-amber-300" },
  action: { label: "ACTION", cls: "border-violet-500/30 bg-violet-500/15 text-violet-300" },
  post: { label: "POST", cls: "border-sky-500/30 bg-sky-500/15 text-sky-300" },
  stream: { label: "STREAM", cls: "border-primary/40 bg-primary/15 text-primary" },
  tool: { label: "TOOL", cls: "border-rose-500/30 bg-rose-500/15 text-rose-300" },
}

const KIND_OPTIONS = ["", "rules_qa", "card_resolution"]

export const GROUPS: Group[] = [
  {
    id: "cards",
    title: "Cards",
    description:
      "The Oracle-card mirror. Read functions back the resolver ladder; the public upsert lets the Scryfall fuzzy fallback self-heal coverage.",
    endpoints: [
      {
        slug: "cards-by-name",
        kind: "query",
        name: "getCardsByNormalizedName",
        path: "queries:getCardsByNormalizedName",
        summary:
          "Exact lookup by normalized name. Returns every same-name row so the resolver can rank printings.",
        params: [
          {
            name: "normalizedName",
            type: "string",
            required: true,
            desc: "Card name — normalized (lower-cased, punctuation/diacritics stripped) before the exact lookup.",
            default: "Lightning Bolt",
            normalize: true,
          },
        ],
        returns: "Card[] — all matching card documents (empty array if none).",
        request: {
          lang: "typescript",
          code: `import { api } from "@convex/_generated/api"

const cards = await convex.query(
  api.queries.getCardsByNormalizedName,
  { normalizedName: "lightning bolt" },
)`,
        },
        run: { kind: "convex-query", ref: api.queries.getCardsByNormalizedName },
      },
      {
        slug: "card-by-oracle-id",
        kind: "query",
        name: "getCardByOracleId",
        path: "queries:getCardByOracleId",
        summary: "Fetch a single card by its Scryfall oracle id.",
        params: [
          {
            name: "oracleId",
            type: "string",
            required: true,
            desc: "Scryfall oracle_id.",
            default: "",
          },
        ],
        returns: "Card | null",
        request: {
          lang: "typescript",
          code: `const card = await convex.query(api.queries.getCardByOracleId, {
  oracleId: "4457ed35-7c10-48c8-9994-...",
})`,
        },
        run: { kind: "convex-query", ref: api.queries.getCardByOracleId },
      },
      {
        slug: "search-cards-by-name",
        kind: "query",
        name: "searchCardsByName",
        path: "queries:searchCardsByName",
        summary:
          "Full-text fuzzy search over card names — the candidate generator for disambiguation.",
        params: [
          {
            name: "query",
            type: "string",
            required: true,
            desc: "Free-text name fragment.",
            default: "lightning",
          },
          {
            name: "limit",
            type: "number",
            required: false,
            desc: "Max candidates. Default 15.",
            default: "10",
          },
        ],
        returns:
          "Array<{ oracleId, name, normalizedName, typeLine, layout, setType }> — slim candidate rows.",
        request: {
          lang: "typescript",
          code: `const hits = await convex.query(api.queries.searchCardsByName, {
  query: "jace",
  limit: 10,
})`,
        },
        run: { kind: "convex-query", ref: api.queries.searchCardsByName },
      },
      {
        slug: "upsert-card",
        kind: "mutation",
        name: "upsertOne",
        path: "cards:upsertOne",
        summary:
          "Idempotent single-card upsert keyed on oracleId. Used by the resolver to cache a card newer than the last bulk refresh.",
        params: [
          { name: "card", type: "Card", required: true, desc: "Full card document (see schema)." },
        ],
        returns: "boolean — true if a new row was inserted, false if an existing row was patched.",
        request: {
          lang: "typescript",
          code: `const inserted = await convex.mutation(api.cards.upsertOne, {
  card: { oracleId, name, normalizedName, oracleText, /* ... */ updatedAt: Date.now() },
})`,
        },
      },
    ],
  },
  {
    id: "rules",
    title: "Comprehensive Rules",
    description:
      "Parsed + embedded CR chunks. Reads power retrieval; the upsert is driven by the Python ingest pipeline.",
    endpoints: [
      {
        slug: "rule-by-number",
        kind: "query",
        name: "getRuleByNumber",
        path: "queries:getRuleByNumber",
        summary:
          "Exact rule lookup by number, e.g. '601.2a'. The embedding field is stripped from the result.",
        params: [
          {
            name: "ruleNumber",
            type: "string",
            required: true,
            desc: "Comprehensive Rule number.",
            default: "601.2a",
          },
        ],
        returns: "RuleChunk | null — { ruleNumber, section, text, rulesVersion? }",
        request: {
          lang: "typescript",
          code: `const rule = await convex.query(api.queries.getRuleByNumber, {
  ruleNumber: "601.2a",
})`,
        },
        run: { kind: "convex-query", ref: api.queries.getRuleByNumber },
      },
      {
        slug: "search-rules",
        kind: "action",
        name: "searchRules",
        path: "queries:searchRules",
        summary:
          "Semantic vector search over the CR. Runs in an action (vector search isn't allowed in a query). Takes a precomputed query embedding.",
        params: [
          { name: "embedding", type: "number[]", required: true, desc: "Query embedding vector (same model as ingest)." },
          { name: "limit", type: "number", required: false, desc: "Max chunks. Default 8." },
        ],
        returns: "Array<RuleChunk & { score: number }> — sorted by descending similarity.",
        request: {
          lang: "typescript",
          code: `const hits = await convex.action(api.queries.searchRules, {
  embedding: queryVector, // number[]
  limit: 8,
})`,
        },
      },
      {
        slug: "upsert-rule-chunks",
        kind: "mutation",
        name: "upsertRuleChunks",
        path: "rules:upsertRuleChunks",
        summary: "Idempotent batch upsert of CR chunks keyed on ruleNumber. Called by agents/ingest.",
        params: [
          { name: "chunks", type: "RuleChunk[]", required: true, desc: "{ ruleNumber, section, text, embedding, rulesVersion? }" },
        ],
        returns: "{ inserted: number, updated: number }",
        request: {
          lang: "typescript",
          code: `const res = await convex.mutation(api.rules.upsertRuleChunks, {
  chunks: [{ ruleNumber: "601.2a", section: "6", text: "...", embedding: [/* ... */] }],
})`,
        },
      },
    ],
  },
  {
    id: "aliases",
    title: "Aliases",
    description:
      'Community nickname → card mappings for the resolver ladder (e.g. "bob" → Dark Confidant).',
    endpoints: [
      {
        slug: "alias-by-name",
        kind: "query",
        name: "getByNormalizedAlias",
        path: "aliases:getByNormalizedAlias",
        summary: "Resolve a normalized nickname to its alias row.",
        params: [
          {
            name: "normalizedAlias",
            type: "string",
            required: true,
            desc: "Nickname — normalized (lower-cased, punctuation stripped) before the lookup.",
            default: "Bob",
            normalize: true,
          },
        ],
        returns: "Alias | null — { alias, normalizedAlias, oracleId, canonicalName }",
        request: {
          lang: "typescript",
          code: `const alias = await convex.query(api.aliases.getByNormalizedAlias, {
  normalizedAlias: "bob",
})`,
        },
        run: { kind: "convex-query", ref: api.aliases.getByNormalizedAlias },
      },
      {
        slug: "alias-sample",
        kind: "query",
        name: "sample",
        path: "aliases:sample",
        summary: "Sample a handful of aliases (debugging / seeding checks).",
        params: [
          { name: "limit", type: "number", required: false, desc: "Max rows. Default 20.", default: "20" },
        ],
        returns: "Alias[]",
        request: {
          lang: "typescript",
          code: `const aliases = await convex.query(api.aliases.sample, { limit: 20 })`,
        },
        run: { kind: "convex-query", ref: api.aliases.sample },
      },
      {
        slug: "upsert-alias",
        kind: "mutation",
        name: "upsert",
        path: "aliases:upsert",
        summary: "Insert or update an alias keyed on normalizedAlias.",
        params: [
          { name: "alias", type: "string", required: true, desc: "Display nickname." },
          { name: "normalizedAlias", type: "string", required: true, desc: "Normalized key." },
          { name: "oracleId", type: "string", required: true, desc: "Target card oracle id." },
          { name: "canonicalName", type: "string", required: true, desc: "Canonical card name." },
        ],
        returns: "boolean — true if inserted, false if patched.",
        request: {
          lang: "typescript",
          code: `await convex.mutation(api.aliases.upsert, {
  alias: "Bob",
  normalizedAlias: "bob",
  oracleId: "...",
  canonicalName: "Dark Confidant",
})`,
        },
      },
    ],
  },
  {
    id: "eval-cases",
    title: "Eval cases",
    description:
      "The golden benchmark store. Queries back the eval harness; mutations ingest datasets and apply suite tags from the manifest.",
    endpoints: [
      {
        slug: "eval-by-suite",
        kind: "query",
        name: "listEvalCasesBySuite",
        path: "evalCases:listEvalCasesBySuite",
        summary: "List the cases tagged with a suite (e.g. 'bench40'), optionally filtered by kind.",
        params: [
          { name: "suite", type: "string", required: true, desc: 'Suite tag, e.g. "bench40".', default: "bench40" },
          { name: "kind", type: '"rules_qa" | "card_resolution"', required: false, desc: "Filter by case kind.", options: KIND_OPTIONS },
          { name: "limit", type: "number", required: false, desc: "Cap the result count.", default: "5" },
        ],
        returns: "EvalCase[] — sorted by externalId.",
        request: {
          lang: "typescript",
          code: `const cases = await convex.query(api.evalCases.listEvalCasesBySuite, {
  suite: "bench40",
  kind: "rules_qa",
})`,
        },
        run: { kind: "convex-query", ref: api.evalCases.listEvalCasesBySuite },
      },
      {
        slug: "eval-all",
        kind: "query",
        name: "listAllEvalCases",
        path: "evalCases:listAllEvalCases",
        summary: "List every case, optionally filtered by source or kind.",
        params: [
          { name: "source", type: "string", required: false, desc: "Dataset source filter.", default: "" },
          { name: "kind", type: '"rules_qa" | "card_resolution"', required: false, desc: "Filter by case kind.", options: KIND_OPTIONS },
        ],
        returns: "EvalCase[]",
        request: {
          lang: "typescript",
          code: `const all = await convex.query(api.evalCases.listAllEvalCases, {
  source: "rulesguru",
})`,
        },
        run: { kind: "convex-query", ref: api.evalCases.listAllEvalCases },
      },
      {
        slug: "eval-count",
        kind: "query",
        name: "countEvalCases",
        path: "evalCases:countEvalCases",
        summary: "Aggregate counts across the benchmark.",
        params: [],
        returns: "{ total: number, bySource: Record<string, number>, bySuite: Record<string, number> }",
        request: {
          lang: "typescript",
          code: `const stats = await convex.query(api.evalCases.countEvalCases, {})`,
        },
        run: { kind: "convex-query", ref: api.evalCases.countEvalCases },
      },
      {
        slug: "eval-upsert-batch",
        kind: "mutation",
        name: "upsertEvalCasesBatch",
        path: "evalCases:upsertEvalCasesBatch",
        summary: "Idempotent batch upsert keyed on (source, externalId). Preserves existing suite tags.",
        params: [
          { name: "cases", type: "EvalCase[]", required: true, desc: "Dataset rows to ingest." },
        ],
        returns: "{ inserted: number, updated: number }",
        request: {
          lang: "typescript",
          code: `const res = await convex.mutation(api.evalCases.upsertEvalCasesBatch, {
  cases: [/* EvalCase rows */],
})`,
        },
      },
      {
        slug: "eval-apply-suites",
        kind: "mutation",
        name: "applyEvalSuites",
        path: "evalCases:applyEvalSuites",
        summary: "Apply suite tags from the pinned benchmark manifest. Optionally clear suites on unlisted rows.",
        params: [
          { name: "assignments", type: "Array<{ source, externalId, suites }>", required: true, desc: "Suite assignments per case." },
          { name: "clearOthers", type: "boolean", required: false, desc: "If true, clears suites on cases not in the list." },
        ],
        returns: "{ updated: number, cleared: number }",
        request: {
          lang: "typescript",
          code: `await convex.mutation(api.evalCases.applyEvalSuites, {
  assignments: [{ source: "rulesguru", externalId: "123", suites: ["bench40"] }],
  clearOthers: true,
})`,
        },
      },
    ],
  },
  {
    id: "ingestion",
    title: "Ingestion",
    description: "Heavyweight Node action that refreshes the card mirror from Scryfall bulk data.",
    endpoints: [
      {
        slug: "import-oracle-cards",
        kind: "action",
        name: "importOracleCards",
        path: "cardsImport:importOracleCards",
        summary:
          "Download the Scryfall Oracle-cards + rulings bulk files, join them, and batch-upsert into the cards mirror.",
        params: [],
        returns: "{ cards: number, inserted: number, updated: number, rulings: number }",
        request: {
          lang: "typescript",
          code: `const res = await convex.action(api.cardsImport.importOracleCards, {})
// { cards: 30000+, inserted, updated, rulings }`,
        },
      },
    ],
  },
  {
    id: "agent",
    title: "Agent",
    description:
      "The multi-agent referee_v2 graph, deployed on LangGraph Platform. The website calls it through a server-side proxy that keeps the API key off the client.",
    endpoints: [
      {
        slug: "referee-stream",
        kind: "post",
        name: "/api/referee-stream",
        path: "POST /api/referee-stream",
        summary:
          "Website proxy. Streams a live run of referee_v2 as newline-delimited JSON — one GraphEvent per line (start → node… → final).",
        params: [
          {
            name: "question",
            type: "string",
            required: true,
            desc: "The MTG rules question to adjudicate (JSON body).",
            default: "Does Lightning Bolt deal damage to a creature with protection from red?",
          },
        ],
        returns:
          "200 application/x-ndjson stream of GraphEvent. 400 on invalid/empty body; 503 if LANGGRAPH_DEPLOYMENT_URL is unset.",
        request: {
          lang: "bash",
          code: `curl -N -X POST https://<your-site>/api/referee-stream \\
  -H 'Content-Type: application/json' \\
  -d '{"question": "Does Lightning Bolt deal damage to a creature with protection from red?"}'`,
        },
        response: {
          lang: "json",
          code: `{"type":"start","question":"Does Lightning Bolt...","mode":"live"}
{"type":"node","node":"router","delta":{"route":"rules"},"index":0}
{"type":"node","node":"adjudication","delta":{"draft_ruling":{...}},"index":4}
{"type":"final","response":{"ruling":"...","rule_citations":[...],"confidence":"high"}}`,
        },
        run: { kind: "stream" },
      },
      {
        slug: "referee-langgraph",
        kind: "stream",
        name: "referee_v2 (LangGraph)",
        path: 'client.runs.stream(null, "referee_v2")',
        summary:
          "The deployed assistant directly. Authenticate with the LangSmith API key; stream in 'updates' mode to get one payload per node.",
        params: [
          { name: "assistantId", type: "string", required: true, desc: 'Graph name. Default "referee_v2" (also: baseline_rag, referee).' },
          { name: "input", type: "RefereeState", required: true, desc: "Initial state — at minimum { question }, with list fields initialized." },
          { name: "streamMode", type: '"updates" | "values"', required: false, desc: '"updates" emits per-node deltas.' },
        ],
        returns: "Async stream of { event, data } chunks; node deltas mirror RefereeState.",
        request: {
          lang: "typescript",
          code: `import { Client } from "@langchain/langgraph-sdk"

const client = new Client({
  apiUrl: process.env.LANGGRAPH_DEPLOYMENT_URL,
  apiKey: process.env.LANGSMITH_API_KEY,
})

const stream = client.runs.stream(null, "referee_v2", {
  input: { question: "Can I respond to a fetchland activation?" },
  streamMode: "updates",
})

for await (const chunk of stream) {
  if (chunk.event === "updates") console.log(chunk.data)
}`,
        },
      },
    ],
  },
  {
    id: "mcp",
    title: "MCP tools",
    description:
      "FastMCP server exposing the same read-only Python tool layer to any MCP host (Cursor, Claude Desktop). Run over stdio: uv run python -m mcp_server.server.",
    endpoints: [
      {
        slug: "mcp-resolve-card",
        kind: "tool",
        name: "resolveCard",
        path: "resolveCard(name)",
        summary: "Resolve a misspelled or nicknamed card name through the full resolver ladder.",
        params: [{ name: "name", type: "string", required: true, desc: "Raw card name or nickname." }],
        returns: "{ status, card, candidates, confidence } — status ∈ resolved | ambiguous | not_found | rules_concept.",
        request: {
          lang: "json",
          code: `{ "tool": "resolveCard", "arguments": { "name": "bob" } }`,
        },
      },
      {
        slug: "mcp-get-card",
        kind: "tool",
        name: "getCard",
        path: "getCard(name)",
        summary: "Look up a card by exact name (normalized internally).",
        params: [{ name: "name", type: "string", required: true, desc: "Exact card name." }],
        returns: "Card | null",
        request: {
          lang: "json",
          code: `{ "tool": "getCard", "arguments": { "name": "Lightning Bolt" } }`,
        },
      },
      {
        slug: "mcp-search-rules",
        kind: "tool",
        name: "searchRules",
        path: "searchRules(query, limit=8)",
        summary: "Semantic search over the Comprehensive Rules (embeds the query for you).",
        params: [
          { name: "query", type: "string", required: true, desc: "Natural-language rules query." },
          { name: "limit", type: "int", required: false, desc: "Max chunks. Default 8." },
        ],
        returns: "RuleChunk[]",
        request: {
          lang: "json",
          code: `{ "tool": "searchRules", "arguments": { "query": "protection from red", "limit": 8 } }`,
        },
      },
      {
        slug: "mcp-rule-by-number",
        kind: "tool",
        name: "getRuleByNumber",
        path: "getRuleByNumber(ruleNumber)",
        summary: "Fetch a specific Comprehensive Rule by number.",
        params: [{ name: "ruleNumber", type: "string", required: true, desc: "e.g. '601.2a'." }],
        returns: "Rule | null",
        request: {
          lang: "json",
          code: `{ "tool": "getRuleByNumber", "arguments": { "ruleNumber": "509.1a" } }`,
        },
      },
    ],
  },
]

export interface EndpointWithGroup {
  endpoint: Endpoint
  group: Group
}

export const ALL_ENDPOINTS: EndpointWithGroup[] = GROUPS.flatMap((group) =>
  group.endpoints.map((endpoint) => ({ endpoint, group })),
)

export function getEndpoint(slug: string): EndpointWithGroup | undefined {
  return ALL_ENDPOINTS.find((e) => e.endpoint.slug === slug)
}
