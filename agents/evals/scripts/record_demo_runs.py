"""Record referee_v2 runs to static JSON traces for the frontend demo's replay mode.

Streams the local v2 graph with ``stream_mode="updates"`` for a curated set of
showcase questions and writes one normalized-event JSON file per question into the
frontend at ``app/deckalization-front-end/src/data/demo-runs/``. The demo's replay
player consumes these instantly (no live LLM call), while typed questions still hit
the deployed graph live.

Each file matches the TS ``RecordedRun`` shape
(see app/.../src/lib/graph-events.ts): ``{slug, question, blurb, events[]}``.

    uv run python -m agents.evals.scripts.record_demo_runs
    uv run python -m agents.evals.scripts.record_demo_runs --only deathtouch-trample
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from agents.core.tracing import export_langsmith_env, referee_run_config
from agents.referee.state import initial_state
from agents.referee.v2.graph import build_referee_v2_graph

# Curated showcase questions. Each names real cards so card_lookup resolves them
# (showing oracle text + power/toughness) and the reasoning is interesting.
SHOWCASE: list[dict[str, str]] = [
    {
        "slug": "deathtouch-trample",
        "blurb": "Two combat keywords interacting",
        "question": (
            "If a creature with both deathtouch and trample attacks and is blocked "
            "by a single 5/5 creature, how much damage does the attacker need to "
            "assign to the blocker before the rest can trample over?"
        ),
    },
    {
        "slug": "bolt-vs-giant-growth",
        "blurb": "Stack resolution & combat math",
        "question": (
            "I cast Lightning Bolt targeting my opponent's Grizzly Bears, and they "
            "respond with Giant Growth on it. Does the Grizzly Bears survive?"
        ),
    },
    {
        "slug": "tarmogoyf-power",
        "blurb": "Characteristic-defining ability",
        "question": (
            "How are Tarmogoyf's power and toughness determined, and can they change "
            "in the middle of combat as cards are put into graveyards?"
        ),
    },
]

OUT_DIR = (
    Path(__file__).resolve().parents[3]
    / "app"
    / "deckalization-front-end"
    / "src"
    / "data"
    / "demo-runs"
)


def _to_jsonable(obj: Any) -> Any:
    if isinstance(obj, BaseModel):
        return obj.model_dump()
    raise TypeError(f"not serializable: {type(obj)!r}")


def record_one(item: dict[str, str]) -> dict[str, Any]:
    app = build_referee_v2_graph()
    question = item["question"]
    events: list[dict[str, Any]] = [
        {"type": "start", "question": question, "mode": "replay"}
    ]
    last_final: Any = None
    index = 0

    for update in app.stream(
        initial_state(question),
        config=referee_run_config(question=question, question_id=item["slug"]),
        stream_mode="updates",
    ):
        for node, delta in update.items():
            # Round-trip through json so pydantic objects become plain dicts.
            delta_json = json.loads(json.dumps(delta, default=_to_jsonable))
            if isinstance(delta_json, dict) and delta_json.get("final_response"):
                last_final = delta_json["final_response"]
            events.append(
                {"type": "node", "node": node, "delta": delta_json, "index": index}
            )
            index += 1

    events.append({"type": "final", "response": last_final})
    return {
        "slug": item["slug"],
        "question": question,
        "blurb": item["blurb"],
        "events": events,
    }


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Record demo runs for the frontend.")
    parser.add_argument("--only", help="Record a single showcase slug.")
    args = parser.parse_args(argv)

    export_langsmith_env()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    items = [s for s in SHOWCASE if not args.only or s["slug"] == args.only]
    if not items:
        parser.error(f"No showcase question with slug {args.only!r}.")

    for item in items:
        print(f"Recording {item['slug']!r} …")
        run = record_one(item)
        out = OUT_DIR / f"{item['slug']}.json"
        out.write_text(json.dumps(run, indent=2, ensure_ascii=False), encoding="utf-8")
        n_nodes = sum(1 for e in run["events"] if e["type"] == "node")
        print(f"  → {out.relative_to(OUT_DIR.parents[4])} ({n_nodes} node events)")

    print("Done.")


if __name__ == "__main__":
    main()
