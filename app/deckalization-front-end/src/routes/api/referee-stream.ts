import { createFileRoute } from "@tanstack/react-router"
import type {
  GraphEvent,
  RefereeNodeId,
  RefereeStateDelta,
  RulingResponse,
} from "@/lib/graph-events"

// Server-only endpoint. Proxies a streaming run of the deployed referee_v2 graph
// on LangGraph Platform, keeping the API key server-side, and relays each node
// update to the browser as newline-delimited JSON (one GraphEvent per line).

const NODE_IDS: RefereeNodeId[] = [
  "router",
  "card_lookup",
  "decompose",
  "rules_retrieval",
  "adjudication",
  "patch",
  "verifier",
  "out_of_scope",
  "formatter",
]

function initialInput(question: string) {
  return {
    question,
    game_format: null,
    rel: null,
    route: "pending",
    card_names: [],
    resolved_cards: [],
    unresolved_notes: [],
    disambiguation: [],
    subqueries: [],
    retrieval_query: question,
    retrieved_rules: [],
    draft_ruling: null,
    verdict: null,
    loop_count: 0,
    final_response: null,
    router_decision: null,
  }
}

async function handlePost({ request }: { request: Request }): Promise<Response> {
  const deploymentUrl = process.env.LANGGRAPH_DEPLOYMENT_URL
  const apiKey = process.env.LANGSMITH_API_KEY
  const assistantId = process.env.LANGGRAPH_ASSISTANT_ID || "referee_v2"

  if (!deploymentUrl) {
    return Response.json(
      { error: "Live runs are disabled: LANGGRAPH_DEPLOYMENT_URL is not set." },
      { status: 503 },
    )
  }

  let question = ""
  try {
    const body = (await request.json()) as { question?: string }
    question = (body.question ?? "").trim()
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  if (!question) {
    return Response.json({ error: "Missing 'question'." }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: GraphEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))

      try {
        const { Client } = await import("@langchain/langgraph-sdk")
        const client = new Client({ apiUrl: deploymentUrl, apiKey })

        send({ type: "start", question, mode: "live" })

        let index = 0
        let lastFinal: RulingResponse | null = null

        const runStream = client.runs.stream(null, assistantId, {
          input: initialInput(question),
          streamMode: "updates",
        })

        for await (const chunk of runStream) {
          if (chunk.event !== "updates") continue
          const updates = chunk.data as Record<string, RefereeStateDelta | undefined>
          for (const [node, delta] of Object.entries(updates)) {
            if (!NODE_IDS.includes(node as RefereeNodeId) || !delta) continue
            if (delta.final_response) lastFinal = delta.final_response
            send({
              type: "node",
              node: node as RefereeNodeId,
              delta,
              index: index++,
            })
          }
        }

        send({ type: "final", response: lastFinal })
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Live run failed.",
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

export const Route = createFileRoute("/api/referee-stream")({
  server: {
    handlers: {
      POST: handlePost,
    },
  },
})
