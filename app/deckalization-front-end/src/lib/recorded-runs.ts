import type { RecordedRun } from "@/lib/graph-events"

// Eagerly bundle every pre-recorded showcase run captured by
// `agents/evals/scripts/record_demo_runs.py`. Empty until the recorder is run.
const modules = import.meta.glob<{ default: RecordedRun }>(
  "../data/demo-runs/*.json",
  { eager: true },
)

export const RECORDED_RUNS: RecordedRun[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.slug.localeCompare(b.slug))
