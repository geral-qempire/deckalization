"""Fetch all RulesGuru questions and upsert into Convex `evalCases`.

Respects RulesGuru rate limit (1 request / 2 seconds). The full corpus stays in
Convex; benchmark/smoke subsets are applied later via build_benchmark_manifest.py.

Usage:
    uv run python -m agents.evals.scripts.ingest_rulesguru
    uv run python -m agents.evals.scripts.ingest_rulesguru --dry-run --max-batches 1
"""

from __future__ import annotations

import argparse
import json
import re
import time
from typing import Any

import httpx

from agents.core.config import get_settings
from agents.core.tools.convex_client import get_convex_client

API_URL = "https://rulesguru.org/api/questions/"
_HEADERS = {"User-Agent": "deckalization/0.1 (eval ingest; non-commercial)"}
_BATCH = 100
_RATE_SEC = 3.0
_MAX_RETRIES = 5

# Broad settings to walk the full supported corpus.
_BASE_QUERY: dict[str, Any] = {
    "count": _BATCH,
    "level": ["0", "1", "2", "3", "Corner Case"],
    "complexity": ["Simple", "Intermediate", "Complicated"],
    "legality": "all",
    "tags": [],
    "tagsConjunc": "OR",
    "from": "deckalization",
}

_RULE_IN_PARENS = re.compile(r"\(([\d]+(?:\.[\d]+(?:[a-z])?)*)\)")


def _extract_rules(q: dict[str, Any]) -> list[str]:
    cited = q.get("citedRules")
    if isinstance(cited, dict) and cited:
        return sorted(cited.keys())
    text = q.get("answerSimpleCited") or ""
    found = _RULE_IN_PARENS.findall(text)
    return sorted(set(found))


def _omit_none(row: dict[str, Any]) -> dict[str, Any]:
    """Convex v.optional() rejects JSON null — omit absent fields instead."""
    return {k: v for k, v in row.items() if v is not None}


def _map_row(q: dict[str, Any]) -> dict[str, Any]:
    cards = [
        c["name"]
        for c in q.get("includedCards") or []
        if isinstance(c, dict) and c.get("name")
    ]
    return _omit_none(
        {
            "source": "rulesguru",
            "externalId": str(q["id"]),
            "kind": "rules_qa",
            "question": q.get("questionSimple") or "",
            "expectedAnswer": q.get("answerSimple") or "",
            "expectedRules": _extract_rules(q),
            "cards": cards,
            "tags": list(q.get("tags") or []),
            "complexity": q.get("complexity"),
            "level": q.get("level"),
            "sourceUrl": q.get("url"),
            "suites": [],
            "updatedAt": int(time.time() * 1000),
        }
    )


def _fetch_page(client: httpx.Client, previous_id: int | None) -> list[dict[str, Any]]:
    payload = dict(_BASE_QUERY)
    if previous_id is not None:
        payload["previousId"] = previous_id
    params = {"json": json.dumps(payload, separators=(",", ":"))}
    for attempt in range(_MAX_RETRIES):
        resp = client.get(API_URL, params=params)
        if resp.status_code == 400:
            return []
        if resp.status_code == 429:
            wait = _RATE_SEC * (attempt + 2)
            print(f"  rate limited — sleeping {wait:.0f}s")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, list):
            raise RuntimeError(f"Unexpected API response: {data!r}")
        return data
    raise RuntimeError("RulesGuru API rate limit exceeded after retries.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest RulesGuru into Convex.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--max-batches", type=int, default=0, help="Stop after N API pages.")
    parser.add_argument("--upsert-batch", type=int, default=50)
    args = parser.parse_args()

    settings = get_settings()
    if not settings.convex_url:
        raise SystemExit("CONVEX_URL not set.")

    seen: set[str] = set()
    all_rows: list[dict[str, Any]] = []
    previous_id: int | None = None
    batches = 0

    with httpx.Client(headers=_HEADERS, timeout=120.0) as http:
        while True:
            if batches > 0:
                time.sleep(_RATE_SEC)
            batch = _fetch_page(http, previous_id)
            batches += 1
            if not batch:
                break
            new_ids = [q for q in batch if str(q["id"]) not in seen]
            if not new_ids:
                break
            for q in new_ids:
                eid = str(q["id"])
                seen.add(eid)
                row = _map_row(q)
                if row["question"] and row["expectedAnswer"]:
                    all_rows.append(row)
            previous_id = int(batch[-1]["id"])
            print(f"  fetched batch {batches}: +{len(new_ids)} new (unique total {len(all_rows)})")
            if args.max_batches and batches >= args.max_batches:
                break

    print(f"Mapped {len(all_rows):,} eval cases from RulesGuru.")

    if args.dry_run:
        print("Dry run — not writing to Convex.")
        return

    convex = get_convex_client()
    inserted = updated = 0
    bs = args.upsert_batch
    for i in range(0, len(all_rows), bs):
        res = convex.mutation("evalCases:upsertEvalCasesBatch", {"cases": all_rows[i : i + bs]})
        inserted += res["inserted"]
        updated += res["updated"]
        print(f"  upserted {min(i + bs, len(all_rows)):,}/{len(all_rows):,}")

    stats = convex.query("evalCases:countEvalCases", {})
    print(f"Done. inserted={inserted} updated={updated} convex_total={stats['total']}")


if __name__ == "__main__":
    main()
