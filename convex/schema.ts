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
    colors: v.array(v.string()),
    keywords: v.array(v.string()),
    legalities: v.any(),
    rulings: v.array(v.any()),
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
});
