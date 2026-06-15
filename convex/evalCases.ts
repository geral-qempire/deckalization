import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const evalCaseValidator = v.object({
  source: v.string(),
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
  expectedStatus: v.optional(v.string()),
  expectedCardName: v.optional(v.string()),
  suites: v.array(v.string()),
  updatedAt: v.number(),
});

export const upsertEvalCasesBatch = mutation({
  args: { cases: v.array(evalCaseValidator) },
  returns: v.object({ inserted: v.number(), updated: v.number() }),
  handler: async (ctx, { cases }) => {
    let inserted = 0;
    let updated = 0;
    for (const row of cases) {
      const existing = await ctx.db
        .query("evalCases")
        .withIndex("by_source_external_id", (q) =>
          q.eq("source", row.source).eq("externalId", row.externalId),
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...row,
          suites: existing.suites.length ? existing.suites : row.suites,
        });
        updated += 1;
      } else {
        await ctx.db.insert("evalCases", row);
        inserted += 1;
      }
    }
    return { inserted, updated };
  },
});

/** Apply suite tags from the benchmark manifest (replaces suites on listed rows). */
export const applyEvalSuites = mutation({
  args: {
    assignments: v.array(
      v.object({
        source: v.string(),
        externalId: v.string(),
        suites: v.array(v.string()),
      }),
    ),
    clearOthers: v.optional(v.boolean()),
  },
  returns: v.object({ updated: v.number(), cleared: v.number() }),
  handler: async (ctx, { assignments, clearOthers }) => {
    const keySet = new Set(
      assignments.map((a) => `${a.source}:${a.externalId}`),
    );
    let updated = 0;
    for (const a of assignments) {
      const row = await ctx.db
        .query("evalCases")
        .withIndex("by_source_external_id", (q) =>
          q.eq("source", a.source).eq("externalId", a.externalId),
        )
        .first();
      if (row) {
        await ctx.db.patch(row._id, { suites: a.suites });
        updated += 1;
      }
    }
    let cleared = 0;
    if (clearOthers) {
      const all = await ctx.db.query("evalCases").collect();
      for (const row of all) {
        const key = `${row.source}:${row.externalId}`;
        if (!keySet.has(key) && row.suites.length > 0) {
          await ctx.db.patch(row._id, { suites: [] });
          cleared += 1;
        }
      }
    }
    return { updated, cleared };
  },
});

export const listEvalCasesBySuite = query({
  args: {
    suite: v.string(),
    kind: v.optional(v.union(v.literal("rules_qa"), v.literal("card_resolution"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { suite, kind, limit }) => {
    const rows = await ctx.db.query("evalCases").collect();
    const filtered = rows
      .filter((r) => r.suites.includes(suite))
      .filter((r) => (kind ? r.kind === kind : true))
      .sort((a, b) => a.externalId.localeCompare(b.externalId));
    return limit ? filtered.slice(0, limit) : filtered;
  },
});

export const countEvalCases = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("evalCases").collect();
    const bySource: Record<string, number> = {};
    const bySuite: Record<string, number> = {};
    for (const r of rows) {
      bySource[r.source] = (bySource[r.source] ?? 0) + 1;
      for (const s of r.suites) {
        bySuite[s] = (bySuite[s] ?? 0) + 1;
      }
    }
    return { total: rows.length, bySource, bySuite };
  },
});

export const listAllEvalCases = query({
  args: {
    source: v.optional(v.string()),
    kind: v.optional(v.union(v.literal("rules_qa"), v.literal("card_resolution"))),
  },
  handler: async (ctx, { source, kind }) => {
    const rows = await ctx.db.query("evalCases").collect();
    return rows
      .filter((r) => (source ? r.source === source : true))
      .filter((r) => (kind ? r.kind === kind : true))
      .sort((a, b) => a.externalId.localeCompare(b.externalId));
  },
});
