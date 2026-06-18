import { useCallback, useEffect, useRef, useState } from "react"
import type {
  GraphEvent,
  RecordedRun,
  RefereeNodeId,
  RefereeStateDelta,
  RulingResponse,
} from "@/lib/graph-events"
import type { NodeState } from "@/components/demo/graph-canvas"
import { streamLiveRun } from "@/lib/live-client"
import { streamReplay } from "@/lib/run-player"

export type RunStatus = "idle" | "running" | "done" | "error"

export interface TimelineEntry {
  node: RefereeNodeId
  delta: RefereeStateDelta
}

export interface RunState {
  status: RunStatus
  mode: "live" | "replay" | null
  question: string
  nodeStates: Partial<Record<RefereeNodeId, NodeState>>
  timeline: TimelineEntry[]
  final: RulingResponse | null
  error: string | null
}

const INITIAL: RunState = {
  status: "idle",
  mode: null,
  question: "",
  nodeStates: {},
  timeline: [],
  final: null,
  error: null,
}

export function useRefereeRun() {
  const [state, setState] = useState<RunState>(INITIAL)
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  // User-initiated stop: abort the stream AND settle the UI out of "running" so
  // controls (showcase chips, Run live) re-enable. `cancel` alone only aborts.
  const stop = useCallback(() => {
    cancel()
    setState((prev) => {
      if (prev.status !== "running") return prev
      const nodeStates = { ...prev.nodeStates }
      for (const k of Object.keys(nodeStates) as RefereeNodeId[]) {
        if (nodeStates[k] === "active") nodeStates[k] = "done"
      }
      return { ...prev, nodeStates, status: "idle" }
    })
  }, [cancel])

  useEffect(() => cancel, [cancel])

  const onEvent = useCallback((e: GraphEvent) => {
    setState((prev) => {
      switch (e.type) {
        case "start":
          return {
            ...INITIAL,
            status: "running",
            mode: e.mode,
            question: e.question,
          }
        case "node": {
          const nodeStates: Partial<Record<RefereeNodeId, NodeState>> = {
            ...prev.nodeStates,
          }
          for (const k of Object.keys(nodeStates) as RefereeNodeId[]) {
            if (nodeStates[k] === "active") nodeStates[k] = "done"
          }
          nodeStates[e.node] = "active"
          return {
            ...prev,
            nodeStates,
            timeline: [...prev.timeline, { node: e.node, delta: e.delta }],
          }
        }
        case "final": {
          const nodeStates = { ...prev.nodeStates }
          for (const k of Object.keys(nodeStates) as RefereeNodeId[]) {
            if (nodeStates[k] === "active") nodeStates[k] = "done"
          }
          return { ...prev, nodeStates, final: e.response, status: "done" }
        }
        case "error": {
          const nodeStates = { ...prev.nodeStates }
          for (const k of Object.keys(nodeStates) as RefereeNodeId[]) {
            if (nodeStates[k] === "active") nodeStates[k] = "done"
          }
          return { ...prev, nodeStates, error: e.message, status: "error" }
        }
        default:
          return prev
      }
    })
  }, [])

  const runReplay = useCallback(
    (run: RecordedRun) => {
      cancel()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      void streamReplay(run, onEvent, ctrl.signal)
    },
    [cancel, onEvent],
  )

  const runLive = useCallback(
    (question: string) => {
      const q = question.trim()
      if (!q) return
      cancel()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      void streamLiveRun(q, onEvent, ctrl.signal)
    },
    [cancel, onEvent],
  )

  const reset = useCallback(() => {
    cancel()
    setState(INITIAL)
  }, [cancel])

  return { state, runReplay, runLive, reset, cancel, stop }
}
