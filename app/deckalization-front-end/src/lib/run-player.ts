import type { GraphEvent, RecordedRun } from "@/lib/graph-events"

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("aborted", "AbortError"))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t)
        reject(new DOMException("aborted", "AbortError"))
      },
      { once: true },
    )
  })
}

/**
 * Replays a pre-recorded run with realistic pacing so it feels like a live
 * stream. Resolves when done; stops quietly on abort.
 */
export async function streamReplay(
  run: RecordedRun,
  onEvent: (e: GraphEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  try {
    for (const event of run.events) {
      if (signal?.aborted) return
      onEvent(event)
      await delay(event.type === "node" ? 850 : 300, signal)
    }
  } catch {
    // aborted — nothing to clean up
  }
}
