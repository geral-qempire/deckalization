import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Phase 0 trivial query — proves the Python `convex` client can reach a
 * deployed Convex function. Replaced/expanded by the real data-access
 * functions in Phase 2.
 */
export const ping = query({
  args: { name: v.optional(v.string()) },
  returns: v.string(),
  handler: async (_ctx, args) => {
    const who = args.name ?? "world";
    return `pong — hello, ${who}`;
  },
});
