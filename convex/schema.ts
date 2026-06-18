import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * deckalization data layer — two datasets, two access patterns:
 *
 *  - cards      : keyed/relational lookup by normalized name (+ full-text fuzzy).
 *                 NEVER vectorized — the question already names the card.
 *  - ruleChunks : semantic vector search over the Comprehensive Rules.
 *                 You don't know the rule number up front, so retrieve by meaning.
 *  - aliases    : community nicknames -> oracleId, for the resolver ladder.
 *
 * Embedding dimensions (3072) MUST match agents/config.py EmbeddingConfig.dimensions
 * (openai/text-embedding-3-large via OpenRouter).
 */
export default defineSchema({
  cards: defineTable({
    oracleId: v.string(),
    name: v.string(),
    normalizedName: v.string(),
    oracleText: v.string(),
    typeLine: v.string(),
    manaCost: v.optional(v.string()),
    // Scryfall strings ("3", "*", "1+*"); multi-face joined with " // ".
    power: v.optional(v.string()),
    toughness: v.optional(v.string()),
    loyalty: v.optional(v.string()),
    defense: v.optional(v.string()),
    colors: v.array(v.string()),
    keywords: v.array(v.string()),
    legalities: v.any(),
    rulings: v.array(v.any()),
    // Scryfall layout (e.g. "normal", "token", "art_series") + set type. Used by
    // the resolver to prefer playable cards over tokens/art among same-name rows.
    layout: v.optional(v.string()),
    setType: v.optional(v.string()),
    // Scryfall CDN image links (front face for multi-faced cards). Stored at
    // ingest so the UI never has to hit the Scryfall API at render time.
    imageUrl: v.optional(v.string()), // "normal" size (~488×680)
    imageUrlSmall: v.optional(v.string()), // "small" size (~146×204), for thumbnails
    // Bookkeeping for idempotent bulk refresh.
    scryfallId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    // Exact / range lookups by normalized name.
    .index("by_normalized_name", ["normalizedName"])
    // Idempotent upserts keyed on Scryfall's oracleId.
    .index("by_oracle_id", ["oracleId"])
    // Keyword / prefix / typo-tolerant fuzzy name search.
    .searchIndex("search_name", { searchField: "name" }),

  ruleChunks: defineTable({
    ruleNumber: v.string(),
    section: v.string(),
    text: v.string(),
    embedding: v.array(v.float64()),
    // Rules version (e.g. effective date) for idempotent re-ingest.
    rulesVersion: v.optional(v.string()),
  })
    .index("by_rule_number", ["ruleNumber"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 3072,
    }),

  aliases: defineTable({
    // Normalized nickname, e.g. "bob" -> Dark Confidant.
    alias: v.string(),
    normalizedAlias: v.string(),
    oracleId: v.string(),
    canonicalName: v.string(),
  }).index("by_normalized_alias", ["normalizedAlias"]),

  // Golden eval cases — full RulesGuru corpus + fixed benchmark/smoke subsets.
  evalCases: defineTable({
    source: v.string(), // "rulesguru" | "hand"
    externalId: v.string(),
    kind: v.union(v.literal("rules_qa"), v.literal("card_resolution")),
    question: v.string(),
    expectedAnswer: v.string(),
    expectedRules: v.array(v.string()),
    cards: v.array(v.string()),
    tags: v.array(v.string()),
    complexity: v.optional(v.string()),
    level: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    // card_resolution only
    expectedStatus: v.optional(v.string()),
    expectedCardName: v.optional(v.string()),
    // eval suites this row belongs to: "benchmark", "smoke", etc.
    suites: v.array(v.string()),
    updatedAt: v.number(),
  })
    .index("by_source_external_id", ["source", "externalId"])
    .index("by_kind", ["kind"]),
});
