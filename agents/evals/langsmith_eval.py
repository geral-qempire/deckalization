"""LangSmith Experiments runner for Phase 5.

Each pipeline run becomes a LangSmith **experiment** against a golden **dataset**,
with code **evaluators** producing score columns. Results live under:

    LangSmith → Datasets & Experiments → <dataset> → Experiments (Compare view)

NOT under Tracing — experiments are a separate surface. The per-case pipeline
traces are linked from each experiment row.
"""

from __future__ import annotations

from typing import Any

from langsmith import Client
from langsmith.utils import LangSmithNotFoundError

from agents.core.tracing import export_langsmith_env
from agents.evals.categories import categorize
from agents.evals.evaluators import langsmith_resolver_evaluators, langsmith_rules_evaluators
from agents.evals.pipelines import TargetName, run_target, target_trace_tag

RULES_DATASET = "deckalization-rules-qa"
CARD_DATASET = "deckalization-card-resolution"


def dataset_for_suite(suite: str) -> str:
    return CARD_DATASET if suite == "card_resolution" else RULES_DATASET


def _case_id(case: dict[str, Any]) -> str:
    return f"{case['source']}:{case['externalId']}"


def _example_payload(case: dict[str, Any]) -> dict[str, Any]:
    return {
        "inputs": {
            "question": case["question"],
            "case_id": _case_id(case),
        },
        "outputs": {
            "expected_answer": case.get("expectedAnswer") or "",
            "expected_rules": case.get("expectedRules") or [],
            "expected_status": case.get("expectedStatus"),
            "expected_card_name": case.get("expectedCardName"),
            "kind": case.get("kind"),
            "cards": case.get("cards") or [],
        },
        # Metadata drives the LangSmith compare view's "group by" — slice scores
        # by interaction category or complexity without re-running anything.
        "metadata": {
            "case_id": _case_id(case),
            "source": case.get("source"),
            "external_id": case.get("externalId"),
            "category": categorize(case.get("tags")),
            "complexity": case.get("complexity") or "Unknown",
            "level": case.get("level") or "Unknown",
        },
        # Dataset splits: smoke / benchmark / card_resolution (drives suite selection).
        "split": case.get("suites") or [],
    }


def _ensure_dataset(client: Client, name: str, description: str, *, reset: bool):
    if reset:
        try:
            existing = client.read_dataset(dataset_name=name)
            client.delete_dataset(dataset_id=existing.id)
            print(f"  reset: deleted dataset {name!r}")
        except LangSmithNotFoundError:
            pass
    try:
        return client.read_dataset(dataset_name=name)
    except LangSmithNotFoundError:
        return client.create_dataset(dataset_name=name, description=description)


def sync_dataset(
    client: Client,
    name: str,
    cases: list[dict[str, Any]],
    *,
    description: str,
    reset: bool = False,
) -> str:
    """Upsert cases into the dataset (idempotent by case_id), syncing splits."""
    ds = _ensure_dataset(client, name, description, reset=reset)

    existing: dict[str, Any] = {}
    for ex in client.list_examples(dataset_id=ds.id):
        cid = (ex.metadata or {}).get("case_id")
        if cid:
            existing[str(cid)] = ex

    creates: list[dict[str, Any]] = []
    updates: list[dict[str, Any]] = []
    for case in cases:
        cid = _case_id(case)
        payload = _example_payload(case)
        if cid in existing:
            updates.append({"id": existing[cid].id, **payload})
        else:
            creates.append(payload)

    if creates:
        client.create_examples(dataset_id=ds.id, examples=creates)
    if updates:
        client.update_examples(dataset_id=ds.id, updates=updates)

    print(
        f"  dataset {name!r}: {len(cases)} cases "
        f"(+{len(creates)} new, {len(updates)} updated)"
    )
    return name


def _make_target(target: TargetName):
    def predict(inputs: dict[str, Any]) -> dict[str, Any]:
        case_id = inputs.get("case_id") or ""
        question = inputs["question"]
        run = run_target(target, case_id=case_id, question=question, trace=True)
        return {
            "case_id": case_id,
            "target": target,
            "ruling": run.ruling.model_dump() if run.ruling else None,
            "retrieved_rules": run.retrieved_rules,
            "resolved_card_names": run.resolved_card_names,
            "evidence": run.evidence,
            "resolver_status": run.resolver_status,
            "resolver_card_name": run.resolver_card_name,
            "error": run.error,
        }

    return predict


def _aggregate(results) -> dict[str, float]:
    buckets: dict[str, list[float]] = {}
    for row in results:
        eval_results = row["evaluation_results"]
        items = eval_results["results"] if isinstance(eval_results, dict) else eval_results.results
        for res in items:
            if res.key and res.score is not None:
                buckets.setdefault(res.key, []).append(float(res.score))
    return {k: sum(v) / len(v) for k, v in buckets.items()}


def run_experiments(
    *,
    suite: str,
    cases: list[dict[str, Any]],
    targets: list[TargetName],
    limit: int = 0,
    use_llm_judge: bool = True,
    max_concurrency: int = 1,
    experiment_suffix: str = "",
    reset: bool = False,
) -> list[dict[str, Any]]:
    """Sync the dataset and run one LangSmith experiment per target."""
    export_langsmith_env()
    client = Client()

    name = dataset_for_suite(suite)
    description = (
        "deckalization Phase 5 golden set "
        "(Convex evalCases; RulesGuru questions used for non-commercial eval only)."
    )
    sync_dataset(client, name, cases, description=description, reset=reset)

    ds = client.read_dataset(dataset_name=name)
    dataset_url = f"https://smith.langchain.com/datasets/{ds.id}"

    splits = None if suite == "full" else [suite]
    examples = list(client.list_examples(dataset_name=name, splits=splits))
    if limit:
        examples = examples[:limit]

    print(
        "\n[langsmith] Results → Datasets & Experiments (NOT Tracing).\n"
        f"  Dataset: {name}  ({len(examples)} examples in split {suite!r})\n"
        f"  URL: {dataset_url}\n"
        "  Open the dataset → Experiments tab → select rows → Compare.\n"
    )

    meta: list[dict[str, Any]] = []
    for target in targets:
        tag = target_trace_tag(target)
        print(f"\n→ experiment: {target} ({len(examples)} cases)")
        predict = _make_target(target)
        if target == "resolver":
            evaluators = langsmith_resolver_evaluators()
        else:
            evaluators = langsmith_rules_evaluators(target, use_llm_judge=use_llm_judge)

        results = client.evaluate(
            predict,
            data=examples,
            evaluators=evaluators,
            experiment_prefix=f"{suite}-{tag}{experiment_suffix}",
            description=f"deckalization Phase 5 — {suite} / {target}",
            metadata={"suite": suite, "target": target, "case_count": len(examples)},
            max_concurrency=max_concurrency,
        )

        scores = _aggregate(results)
        url = results.url
        print(f"  name: {results.experiment_name}")
        if url:
            print(f"  compare: {url}")

        meta.append(
            {
                "target": target,
                "experiment_name": results.experiment_name,
                "url": url,
                "dataset_url": dataset_url,
                "scores": scores,
            }
        )

    return meta
