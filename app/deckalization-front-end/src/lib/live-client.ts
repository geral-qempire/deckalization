import type { GraphEvent } from "@/lib/graph-events"

/**
 * POST a question to the server proxy and stream back GraphEvents (one NDJSON
 * line each). Resolves when the stream ends; surfaces failures as an `error`
 * event rather than throwing (except on abort).
 */
export async function streamLiveRun(
  question: string,
  onEvent: (e: GraphEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response
  try {
    res = await fetch("/api/referee-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) return
    onEvent({
      type: "error",
      message: err instanceof Error ? err.message : "Network error.",
    })
    return
  }

  if (!res.ok) {
    let msg = `Live run failed (${res.status}).`
    try {
      const j = (await res.json()) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* ignore */
    }
    onEvent({ type: "error", message: msg })
    return
  }

  if (!res.body) {
    onEvent({ type: "error", message: "Empty response stream." })
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""

  const flush = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      onEvent(JSON.parse(trimmed) as GraphEvent)
    } catch {
      /* skip malformed line */
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf("\n")) >= 0) {
        flush(buf.slice(0, nl))
        buf = buf.slice(nl + 1)
      }
    }
    flush(buf)
  } catch (err) {
    if (signal?.aborted) return
    onEvent({
      type: "error",
      message: err instanceof Error ? err.message : "Stream interrupted.",
    })
  }
}
