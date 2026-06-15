"""Ingest hand-curated card resolution eval cases into Convex."""

from __future__ import annotations

import json
import time
from pathlib import Path

from agents.core.tools.convex_client import get_convex_client

_DATA = Path(__file__).resolve().parents[1] / "datasets" / "card_resolution.json"


def main() -> None:
    rows = json.loads(_DATA.read_text(encoding="utf-8"))
    now = int(time.time() * 1000)
    cases = []
    for r in rows:
        row = {
            "source": "hand",
            "externalId": r["externalId"],
            "kind": "card_resolution",
            "question": r["question"],
            "expectedAnswer": "",
            "expectedRules": [],
            "cards": [],
            "tags": ["card_resolution"],
            "expectedStatus": r["expectedStatus"],
            "expectedCardName": r.get("expectedCardName"),
            "suites": ["card_resolution"],
            "updatedAt": now,
        }
        cases.append({k: v for k, v in row.items() if v is not None})
    client = get_convex_client()
    res = client.mutation("evalCases:upsertEvalCasesBatch", {"cases": cases})
    print(f"Card resolution cases: inserted={res['inserted']} updated={res['updated']}")


if __name__ == "__main__":
    main()
