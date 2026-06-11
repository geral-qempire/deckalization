import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Community nickname -> card aliases for the resolver ladder
 * (e.g. "bob" -> Dark Confidant, "goyf" -> Tarmogoyf).
 */

export const upsert = mutation({
  args: {
    alias: v.string(),
    normalizedAlias: v.string(),
    oracleId: v.string(),
    canonicalName: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("aliases")
      .withIndex("by_normalized_alias", (q) =>
        q.eq("normalizedAlias", args.normalizedAlias),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return false;
    }
    await ctx.db.insert("aliases", args);
    return true;
  },
});

export const getByNormalizedAlias = query({
  args: { normalizedAlias: v.string() },
  handler: async (ctx, { normalizedAlias }) => {
    return await ctx.db
      .query("aliases")
      .withIndex("by_normalized_alias", (q) =>
        q.eq("normalizedAlias", normalizedAlias),
      )
      .first();
  },
});

export const sample = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db.query("aliases").take(limit ?? 20);
  },
});
