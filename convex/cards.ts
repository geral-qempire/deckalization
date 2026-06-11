import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";

/**
 * Card-mirror mutations (V8 runtime). The heavy Scryfall bulk download lives in
 * cardsImport.ts ("use node"); read queries live in queries.ts.
 */

// Shape of a card document accepted by the upserts.
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
  layout: v.optional(v.string()),
  setType: v.optional(v.string()),
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

/**
 * Public single-card upsert — used by the resolver's Scryfall fuzzy fallback to
 * cache a real card that's newer than the last bulk refresh (self-healing
 * coverage, keeping the "no row, no ruling" guarantee true).
 */
export const upsertOne = mutation({
  args: { card: cardValidator },
  returns: v.boolean(),
  handler: async (ctx, { card }) => {
    const existing = await ctx.db
      .query("cards")
      .withIndex("by_oracle_id", (q) => q.eq("oracleId", card.oracleId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, card);
      return false;
    }
    await ctx.db.insert("cards", card);
    return true;
  },
});
