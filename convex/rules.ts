import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Comprehensive Rules chunk storage. Chunks are parsed + embedded in Python
 * (agents/ingest) and pushed here. Upserts are idempotent on ruleNumber so a
 * re-ingest after a set release updates in place. Read queries live in queries.ts.
 */

const ruleChunkValidator = v.object({
  ruleNumber: v.string(),
  section: v.string(),
  text: v.string(),
  embedding: v.array(v.float64()),
  rulesVersion: v.optional(v.string()),
});

export const upsertRuleChunks = mutation({
  args: { chunks: v.array(ruleChunkValidator) },
  returns: v.object({ inserted: v.number(), updated: v.number() }),
  handler: async (ctx, { chunks }) => {
    let inserted = 0;
    let updated = 0;
    for (const chunk of chunks) {
      const existing = await ctx.db
        .query("ruleChunks")
        .withIndex("by_rule_number", (q) => q.eq("ruleNumber", chunk.ruleNumber))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, chunk);
        updated += 1;
      } else {
        await ctx.db.insert("ruleChunks", chunk);
        inserted += 1;
      }
    }
    return { inserted, updated };
  },
});
