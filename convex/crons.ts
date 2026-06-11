import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

/**
 * Scheduled jobs. The card mirror refreshes daily from Scryfall's bulk export
 * so all lookups hit our local DB (the live Scryfall API is a fallback only).
 *
 * Rules (Comprehensive Rules) are NOT refreshed here — they change only on set
 * releases and are re-ingested via the Python CLI (agents/ingest/run.py).
 */
const crons = cronJobs();

crons.daily(
  "refresh-card-mirror",
  { hourUTC: 9, minuteUTC: 0 },
  api.cardsImport.importOracleCards,
);

export default crons;
