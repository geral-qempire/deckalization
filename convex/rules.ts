import { v } from "convex/values";
import { action, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

type RuleChunkDoc = {
  _id: Id<"ruleChunks">;
  _creationTime: number;
  ruleNumber: string;
  section: string;
  text: string;
  rulesVersion?: string;
};

/**
 * Comprehensive Rules chunk storage. Chunks are parsed + embedded in Python
 * (agents/ingest) and pushed here. Upserts are idempotent on ruleNumber so a
 * re-ingest after a set release updates in place.
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

/** Exact rule lookup by number (e.g. "601.2a"). */
export const getByRuleNumber = query({
  args: { ruleNumber: v.string() },
  handler: async (ctx, { ruleNumber }) => {
    return await ctx.db
      .query("ruleChunks")
      .withIndex("by_rule_number", (q) => q.eq("ruleNumber", ruleNumber))
      .first();
  },
});

/** Fetch chunks by id (used to hydrate vector-search hits). */
export const getByIds = internalQuery({
  args: { ids: v.array(v.id("ruleChunks")) },
  returns: v.array(
    v.object({
      _id: v.id("ruleChunks"),
      _creationTime: v.number(),
      ruleNumber: v.string(),
      section: v.string(),
      text: v.string(),
      rulesVersion: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { ids }) => {
    const rows = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return rows
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(({ embedding: _embedding, ...rest }) => rest);
  },
});

/**
 * Semantic vector search over the Comprehensive Rules. Takes a pre-computed
 * query embedding (Python embeds the query with the same pinned model). This is
 * the seed of Phase 2's `searchRules` tool — vector search must run in an action.
 */
export const searchByEmbedding = action({
  args: { embedding: v.array(v.float64()), limit: v.optional(v.number()) },
  handler: async (ctx, { embedding, limit }) => {
    const hits = await ctx.vectorSearch("ruleChunks", "by_embedding", {
      vector: embedding,
      limit: limit ?? 8,
    });
    const scoreById = new Map<string, number>(hits.map((h) => [h._id, h._score]));
    const docs: RuleChunkDoc[] = await ctx.runQuery(internal.rules.getByIds, {
      ids: hits.map((h) => h._id),
    });
    return docs
      .map((d) => ({ score: scoreById.get(d._id) ?? 0, ...d }))
      .sort((a, b) => b.score - a.score);
  },
});

/** A few chunks for smoke-testing that ingestion populated the table. */
export const sample = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("ruleChunks").take(limit ?? 5);
    // Trim the heavy embedding from the smoke-test payload.
    return rows.map(({ embedding, ...rest }) => ({
      ...rest,
      embeddingDims: embedding.length,
    }));
  },
});
