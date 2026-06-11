import { v } from "convex/values";
import { action, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Read API — the typed data-access surface the Python tool layer wraps. These
 * are the same functions the LangGraph nodes call directly (off the MCP hot
 * path) and that the FastMCP server re-exposes as read-only tools.
 *
 *   getCardsByNormalizedName : exact lookup, ALL same-name rows (resolver ranks)
 *   getCardByOracleId        : full card by oracle id (alias + Scryfall fallback)
 *   searchCardsByName        : full-text fuzzy candidates
 *   getRuleByNumber          : exact rule lookup
 *   searchRules              : semantic vector search (takes a query embedding)
 */

// ---- Cards ----

export const getCardsByNormalizedName = query({
  args: { normalizedName: v.string() },
  handler: async (ctx, { normalizedName }) => {
    return await ctx.db
      .query("cards")
      .withIndex("by_normalized_name", (q) =>
        q.eq("normalizedName", normalizedName),
      )
      .collect();
  },
});

export const getCardByOracleId = query({
  args: { oracleId: v.string() },
  handler: async (ctx, { oracleId }) => {
    return await ctx.db
      .query("cards")
      .withIndex("by_oracle_id", (q) => q.eq("oracleId", oracleId))
      .first();
  },
});

export const searchCardsByName = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { query, limit }) => {
    const rows = await ctx.db
      .query("cards")
      .withSearchIndex("search_name", (q) => q.search("name", query))
      .take(limit ?? 15);
    return rows.map((c) => ({
      oracleId: c.oracleId,
      name: c.name,
      normalizedName: c.normalizedName,
      typeLine: c.typeLine,
      layout: c.layout,
      setType: c.setType,
    }));
  },
});

// ---- Rules ----

export const getRuleByNumber = query({
  args: { ruleNumber: v.string() },
  handler: async (ctx, { ruleNumber }) => {
    const row = await ctx.db
      .query("ruleChunks")
      .withIndex("by_rule_number", (q) => q.eq("ruleNumber", ruleNumber))
      .first();
    if (!row) return null;
    const { embedding: _embedding, ...rest } = row;
    return rest;
  },
});

type RuleChunkDoc = {
  _id: Id<"ruleChunks">;
  _creationTime: number;
  ruleNumber: string;
  section: string;
  text: string;
  rulesVersion?: string;
};

export const getRuleChunksByIds = internalQuery({
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

/** Semantic vector search over the Comprehensive Rules (vector search must run in an action). */
export const searchRules = action({
  args: { embedding: v.array(v.float64()), limit: v.optional(v.number()) },
  handler: async (ctx, { embedding, limit }) => {
    const hits = await ctx.vectorSearch("ruleChunks", "by_embedding", {
      vector: embedding,
      limit: limit ?? 8,
    });
    const scoreById = new Map<string, number>(hits.map((h) => [h._id, h._score]));
    const docs: RuleChunkDoc[] = await ctx.runQuery(
      internal.queries.getRuleChunksByIds,
      { ids: hits.map((h) => h._id) },
    );
    return docs
      .map((d) => ({ score: scoreById.get(d._id) ?? 0, ...d }))
      .sort((a, b) => b.score - a.score);
  },
});
