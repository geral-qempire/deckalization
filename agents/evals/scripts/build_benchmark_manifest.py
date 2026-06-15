"""Build a fixed stratified benchmark manifest from the full Convex corpus.

Selects ~125 RulesGuru cases for the ~€10 full 3-pipeline benchmark and ~15 for
smoke CI. Writes evals/datasets/benchmark_manifest.json and applies suite tags
in Convex so every eval run uses the same subset (apples-to-apples).

Usage:
    uv run python -m agents.evals.scripts.build_benchmark_manifest
"""

from __future__ import annotations

import json
import random
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from agents.core.tools.convex_client import get_convex_client

MANIFEST_PATH = Path(__file__).resolve().parents[1] / "datasets" / "benchmark_manifest.json"

TARGET_BENCHMARK = 125
TARGET_BENCH40 = 40
TARGET_SMOKE = 15
SEED = 42

# Always included in benchmark (RulesGuru external ids as strings).
PINNED_BENCHMARK = [
    "1554",  # Null Profusion / Trusted Advisor hand size
    "2208",  # Thieves' Auction / Valakut layer-adjacent
    "1411",  # Phyrexian Ingester linked abilities
    "685",   # Deafening Clarion + Slimefoot timing
    "384",   # Replacement effect ordering
    "220",   # Soulbond / Man-o'-War
]

# Smoke = quick CI subset (must be subset of benchmark after build).
PINNED_SMOKE = ["1554", "685", "2208"]


def _stratum(row: dict[str, Any]) -> str:
    return f"{row.get('complexity') or 'Unknown'}/L{row.get('level') or '?'}"


def _select_benchmark(rows: list[dict[str, Any]]) -> list[str]:
    by_id = {r["externalId"]: r for r in rows}
    chosen: list[str] = []
    chosen_set: set[str] = set()

    for pid in PINNED_BENCHMARK:
        if pid in by_id and pid not in chosen_set:
            chosen.append(pid)
            chosen_set.add(pid)

    remaining = [r for r in rows if r["externalId"] not in chosen_set]
    strata: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in remaining:
        strata[_stratum(r)].append(r)

    total_rem = len(remaining)
    need = TARGET_BENCHMARK - len(chosen)
    rng = random.Random(SEED)

    # Proportional allocation per stratum.
    allocations: dict[str, int] = {}
    for key, items in strata.items():
        allocations[key] = max(1, round(need * len(items) / total_rem)) if total_rem else 0

    # Adjust to exact target.
    while sum(allocations.values()) > need:
        k = max(allocations, key=lambda x: allocations[x])
        allocations[k] -= 1
    while sum(allocations.values()) < need:
        k = max(strata, key=lambda x: len(strata[x]))
        allocations[k] = allocations.get(k, 0) + 1

    for key, n in allocations.items():
        pool = strata[key]
        rng.shuffle(pool)
        for r in pool[:n]:
            if r["externalId"] not in chosen_set:
                chosen.append(r["externalId"])
                chosen_set.add(r["externalId"])
            if len(chosen) >= TARGET_BENCHMARK:
                break
        if len(chosen) >= TARGET_BENCHMARK:
            break

    # Tag coverage: ensure top tags appear at least twice when possible.
    tag_counts = Counter(t for r in rows for t in r.get("tags") or [])
    top_tags = [t for t, _ in tag_counts.most_common(25) if t]
    chosen_rows = [by_id[i] for i in chosen if i in by_id]
    covered = Counter(t for r in chosen_rows for t in r.get("tags") or [])

    for tag in top_tags:
        if covered[tag] >= 2:
            continue
        candidates = [
            r
            for r in rows
            if tag in (r.get("tags") or []) and r["externalId"] not in chosen_set
        ]
        if not candidates:
            continue
        pick = rng.choice(candidates)
        if len(chosen) >= TARGET_BENCHMARK:
            # swap out a non-pinned row from an over-represented stratum
            for i in range(len(chosen) - 1, -1, -1):
                eid = chosen[i]
                if eid in PINNED_BENCHMARK:
                    continue
                chosen_set.discard(eid)
                chosen.pop(i)
                break
        chosen.append(pick["externalId"])
        chosen_set.add(pick["externalId"])
        covered[tag] += 1

    return sorted(chosen, key=lambda x: int(x) if x.isdigit() else x)[:TARGET_BENCHMARK]


def _select_bench40(
    benchmark_ids: list[str], rows: list[dict[str, Any]]
) -> list[str]:
    """Fixed 40-case subset of the benchmark for cheap, repeatable experiments.

    Stratified by complexity/level like the parent set, keeps the pinned hard
    cases, and prefers cases with golden expectedRules + cards so the retrieval
    metrics (rule_recall, card_recall, citation_recall) always have labels.
    """
    by_id = {r["externalId"]: r for r in rows}
    bench_rows = [by_id[i] for i in benchmark_ids if i in by_id]

    chosen: list[str] = [i for i in PINNED_BENCHMARK if i in set(benchmark_ids)]
    chosen_set = set(chosen)

    def labeled(r: dict[str, Any]) -> bool:
        return bool(r.get("expectedRules")) and bool(r.get("cards"))

    remaining = [r for r in bench_rows if r["externalId"] not in chosen_set]
    strata: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in remaining:
        strata[_stratum(r)].append(r)

    need = TARGET_BENCH40 - len(chosen)
    total_rem = len(remaining)
    rng = random.Random(SEED)

    allocations: dict[str, int] = {}
    for key, items in strata.items():
        allocations[key] = max(1, round(need * len(items) / total_rem)) if total_rem else 0
    while sum(allocations.values()) > need:
        k = max(allocations, key=lambda x: allocations[x])
        allocations[k] -= 1
    while sum(allocations.values()) < need:
        k = max(strata, key=lambda x: len(strata[x]))
        allocations[k] = allocations.get(k, 0) + 1

    for key, n in allocations.items():
        # Fully-labeled cases first within each stratum; deterministic shuffle.
        pool = sorted(strata[key], key=lambda r: not labeled(r))
        head = [r for r in pool if labeled(r)]
        tail = [r for r in pool if not labeled(r)]
        rng.shuffle(head)
        rng.shuffle(tail)
        for r in (head + tail)[:n]:
            if r["externalId"] not in chosen_set:
                chosen.append(r["externalId"])
                chosen_set.add(r["externalId"])
            if len(chosen) >= TARGET_BENCH40:
                break
        if len(chosen) >= TARGET_BENCH40:
            break

    return sorted(chosen, key=lambda x: int(x) if x.isdigit() else x)[:TARGET_BENCH40]


def _select_smoke(benchmark_ids: list[str]) -> list[str]:
    bench_set = set(benchmark_ids)
    smoke: list[str] = [i for i in PINNED_SMOKE if i in bench_set]
    for eid in benchmark_ids:
        if len(smoke) >= TARGET_SMOKE:
            break
        if eid not in smoke:
            smoke.append(eid)
    return smoke[:TARGET_SMOKE]


def main() -> None:
    client = get_convex_client()
    rows = client.query(
        "evalCases:listAllEvalCases", {"source": "rulesguru", "kind": "rules_qa"}
    )
    if not rows:
        raise SystemExit("No RulesGuru rows in Convex — run ingest_rulesguru first.")

    benchmark_ids = _select_benchmark(rows)
    bench40_ids = _select_bench40(benchmark_ids, rows)
    smoke_ids = _select_smoke(benchmark_ids)

    strata = Counter(_stratum(r) for r in rows if r["externalId"] in benchmark_ids)
    strata40 = Counter(_stratum(r) for r in rows if r["externalId"] in set(bench40_ids))
    manifest = {
        "version": 2,
        "seed": SEED,
        "target_benchmark": TARGET_BENCHMARK,
        "target_bench40": TARGET_BENCH40,
        "target_smoke": TARGET_SMOKE,
        "benchmark_ids": benchmark_ids,
        "bench40_ids": bench40_ids,
        "smoke_ids": smoke_ids,
        "pinned_benchmark": PINNED_BENCHMARK,
        "strata_in_benchmark": dict(strata),
        "strata_in_bench40": dict(strata40),
        "source": "rulesguru",
        "attribution": "Questions from RulesGuru (rulesguru.org) — non-commercial eval only.",
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {MANIFEST_PATH} "
        f"({len(benchmark_ids)} benchmark, {len(bench40_ids)} bench40, {len(smoke_ids)} smoke)"
    )

    bench40_set = set(bench40_ids)
    smoke_set = set(smoke_ids)
    assignments: list[dict[str, Any]] = []
    for eid in benchmark_ids:
        suites = ["benchmark"]
        if eid in bench40_set:
            suites.append("bench40")
        if eid in smoke_set:
            suites.append("smoke")
        assignments.append({"source": "rulesguru", "externalId": eid, "suites": suites})

    # clearOthers wipes suites on every unlisted row — include the hand-curated
    # card_resolution cases so their suite assignment survives rebuilds.
    hand_rows = client.query("evalCases:listAllEvalCases", {"source": "hand"})
    for r in hand_rows:
        if r["kind"] == "card_resolution":
            assignments.append(
                {
                    "source": "hand",
                    "externalId": r["externalId"],
                    "suites": ["card_resolution"],
                }
            )

    res = client.mutation(
        "evalCases:applyEvalSuites",
        {"assignments": assignments, "clearOthers": True},
    )
    print(f"Applied suites: updated={res['updated']} cleared={res['cleared']}")

    stats = client.query("evalCases:countEvalCases", {})
    print("Convex counts:", stats)


if __name__ == "__main__":
    main()
