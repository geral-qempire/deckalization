import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

/**
 * Card-mirror data functions (V8 runtime).
 *
 * The heavy Scryfall bulk download lives in cardsImport.ts ("use node"); this
 * file holds the lightweight mutation it calls plus lookup/verification queries.
 */

// Shape of a card document accepted by the batch upsert.
const cardValidator = v.object({
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
  scryfallId: v.optional(v.string()),
  updatedAt: v.number(),
});

/**
 * Idempotent batch upsert keyed on oracleId. Called repeatedly by the importer
 * with small batches so each mutation stays well within Convex limits.
 */
export const upsertCardsBatch = internalMutation({
  args: { cards: v.array(cardValidator) },
  returns: v.object({ inserted: v.number(), updated: v.number() }),
  handler: async (ctx, { cards }) => {
    let inserted = 0;
    let updated = 0;
    for (const card of cards) {
      const existing = await ctx.db
        .query("cards")
        .withIndex("by_oracle_id", (q) => q.eq("oracleId", card.oracleId))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, card);
        updated += 1;
      } else {
        await ctx.db.insert("cards", card);
        inserted += 1;
      }
    }
    return { inserted, updated };
  },
});

/** Exact lookup by normalized name (the resolver's first rung). */
export const getByNormalizedName = query({
  args: { normalizedName: v.string() },
  handler: async (ctx, { normalizedName }) => {
    return await ctx.db
      .query("cards")
      .withIndex("by_normalized_name", (q) =>
        q.eq("normalizedName", normalizedName),
      )
      .first();
  },
});

/** Full-text fuzzy name search (the resolver's fuzzy rung). */
export const searchByName = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { query, limit }) => {
    const rows = await ctx.db
      .query("cards")
      .withSearchIndex("search_name", (q) => q.search("name", query))
      .take(limit ?? 10);
    return rows.map((c) => ({
      oracleId: c.oracleId,
      name: c.name,
      normalizedName: c.normalizedName,
      typeLine: c.typeLine,
    }));
  },
});

/** A few rows for smoke-testing that ingestion populated the table. */
export const sample = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db.query("cards").take(limit ?? 5);
  },
});
