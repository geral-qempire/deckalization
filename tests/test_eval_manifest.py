"""Benchmark manifest selection tests (offline)."""

from agents.evals.scripts.build_benchmark_manifest import _select_benchmark, _select_smoke


def _fake_rows(n: int) -> list[dict]:
    rows = []
    for i in range(n):
        rows.append(
            {
                "externalId": str(i + 1),
                "complexity": ["Simple", "Intermediate", "Complicated"][i % 3],
                "level": str(i % 3),
                "tags": [f"tag{i % 10}"],
            }
        )
    return rows


def test_benchmark_reproducible() -> None:
    rows = _fake_rows(500)
    a = _select_benchmark(rows)
    b = _select_benchmark(rows)
    assert a == b
    assert len(a) == 125


def test_smoke_subset_of_benchmark() -> None:
    bench = _select_benchmark(_fake_rows(500))
    smoke = _select_smoke(bench)
    assert len(smoke) == 15
    assert set(smoke) <= set(bench)
