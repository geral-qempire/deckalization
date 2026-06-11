"use node";

import { Readable } from "node:stream";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { streamArray } from "stream-json/streamers/StreamArray";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { normalizeName } from "./lib/normalize";

/**
 * Card-mirror ingestion (Node runtime).
 *
 * Downloads the Scryfall "Oracle Cards" bulk (one object per oracle_id) and the
 * "Rulings" bulk, joins rulings onto cards by oracle_id, and upserts in small
 * batches. The bulk files are large (~130MB cards), so both are *streamed* with
 * stream-json to keep the action's memory bounded — we never hold the full
 * parsed array in memory.
 *
 * Run manually (dev):  npx convex run cardsImport:importOracleCards
 * Scheduled daily by:  convex/crons.ts
 */

const SCRYFALL_BULK_ENDPOINT = "https://api.scryfall.com/bulk-data";
const SCRYFALL_HEADERS = {
  // Scryfall asks API consumers to identify themselves.
  "User-Agent": "deckalization/0.1 (MTG rules referee)",
  Accept: "application/json",
};
const UPSERT_BATCH = 300;

type Ruling = { source: string; published_at: string; comment: string };

async function getBulkDownloadUris(): Promise<{
  oracleCards: string;
  rulings: string;
}> {
  const res = await fetch(SCRYFALL_BULK_ENDPOINT, { headers: SCRYFALL_HEADERS });
  if (!res.ok) {
    throw new Error(`Scryfall bulk-data list failed: ${res.status}`);
  }
  const body = (await res.json()) as {
    data: Array<{ type: string; download_uri: string }>;
  };
  const find = (type: string) => {
    const entry = body.data.find((d) => d.type === type);
    if (!entry) throw new Error(`Scryfall bulk type not found: ${type}`);
    return entry.download_uri;
  };
  return { oracleCards: find("oracle_cards"), rulings: find("rulings") };
}

/** Stream a large Scryfall JSON array, invoking `onItem` for each element. */
async function streamJsonArray(
  url: string,
  onItem: (item: unknown) => void | Promise<void>,
): Promise<void> {
  const res = await fetch(url, { headers: SCRYFALL_HEADERS });
  if (!res.ok || !res.body) {
    throw new Error(`Scryfall download failed (${res.status}): ${url}`);
  }
  const nodeStream = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  const pipeline = chain([nodeStream, parser(), streamArray()]);
  for await (const entry of pipeline) {
    await onItem((entry as { value: unknown }).value);
  }
}

function firstString(...vals: Array<unknown>): string | undefined {
  for (const val of vals) {
    if (typeof val === "string" && val.length > 0) return val;
  }
  return undefined;
}

// Map a raw Scryfall card object into our schema, handling multi-faced cards.
function mapCard(raw: any, rulingsByOracle: Map<string, Ruling[]>) {
  const oracleId: string | undefined = raw.oracle_id;
  if (!oracleId) return null;

  const faces: any[] = Array.isArray(raw.card_faces) ? raw.card_faces : [];
  const oracleText = firstString(
    raw.oracle_text,
    faces.map((f) => f.oracle_text).filter(Boolean).join("\n//\n"),
  );
  const typeLine = firstString(
    raw.type_line,
    faces.map((f) => f.type_line).filter(Boolean).join(" // "),
  );
  const manaCost = firstString(
    raw.mana_cost,
    faces.map((f) => f.mana_cost).filter(Boolean).join(" // "),
  );
  const colors: string[] = Array.isArray(raw.colors)
    ? raw.colors
    : Array.from(new Set(faces.flatMap((f) => f.colors ?? [])));

  return {
    oracleId,
    name: raw.name ?? "",
    normalizedName: normalizeName(raw.name ?? ""),
    oracleText: oracleText ?? "",
    typeLine: typeLine ?? "",
    manaCost,
    colors,
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
    legalities: raw.legalities ?? {},
    rulings: rulingsByOracle.get(oracleId) ?? [],
    scryfallId: raw.id,
    updatedAt: Date.now(),
  };
}

export const importOracleCards = action({
  args: {},
  returns: v.object({
    cards: v.number(),
    inserted: v.number(),
    updated: v.number(),
    rulings: v.number(),
  }),
  handler: async (ctx) => {
    const { oracleCards, rulings } = await getBulkDownloadUris();

    // 1) Stream rulings → Map<oracle_id, Ruling[]>.
    const rulingsByOracle = new Map<string, Ruling[]>();
    let rulingCount = 0;
    await streamJsonArray(rulings, (item) => {
      const r = item as {
        oracle_id?: string;
        source?: string;
        published_at?: string;
        comment?: string;
      };
      if (!r.oracle_id || !r.comment) return;
      const list = rulingsByOracle.get(r.oracle_id) ?? [];
      list.push({
        source: r.source ?? "",
        published_at: r.published_at ?? "",
        comment: r.comment,
      });
      rulingsByOracle.set(r.oracle_id, list);
      rulingCount += 1;
    });

    // 2) Stream cards → batched idempotent upserts.
    let batch: ReturnType<typeof mapCard>[] = [];
    let total = 0;
    let inserted = 0;
    let updated = 0;

    const flush = async () => {
      if (batch.length === 0) return;
      const res = await ctx.runMutation(internal.cards.upsertCardsBatch, {
        cards: batch as NonNullable<ReturnType<typeof mapCard>>[],
      });
      inserted += res.inserted;
      updated += res.updated;
      batch = [];
    };

    await streamJsonArray(oracleCards, async (item) => {
      const mapped = mapCard(item as any, rulingsByOracle);
      if (!mapped) return;
      batch.push(mapped);
      total += 1;
      if (batch.length >= UPSERT_BATCH) await flush();
    });
    await flush();

    return { cards: total, inserted, updated, rulings: rulingCount };
  },
});
