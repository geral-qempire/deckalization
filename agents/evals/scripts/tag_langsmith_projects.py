"""Group the deckalization LangSmith resources under the `deckalization` Application.

In LangSmith, an *Application* (the sidebar grouping) is a resource tag, not a
routing target. `LANGSMITH_PROJECT`/`DECKALIZATION_ENV` only decide which *tracing
project* a run lands in; eval *datasets* and *experiments* are separate resources.
Untagged resources only appear under "All applications", which is why CI experiments
and the tracing projects don't show up under `deckalization` until tagged.

This idempotent setup script:
  1. ensures the three tracing projects exist (pre-creating `-ci` / `-prod` so they're
     tagged before their first run arrives),
  2. finds (or creates) the `Application: deckalization` tag value,
  3. assigns the projects AND the eval datasets to it, skipping anything already tagged.

Tagging is per-resource, so once a dataset/project is tagged every future
experiment/trace on it shows up under the application automatically.

Requires a LangSmith Plus/Enterprise plan (resource tags) and an API key for the
target workspace.

    uv run python -m agents.evals.scripts.tag_langsmith_projects
"""

from __future__ import annotations

import os
from collections.abc import Callable

import requests
from langsmith import Client

from agents.core.config import get_settings
from agents.core.tracing import export_langsmith_env
from agents.evals.langsmith_eval import CARD_DATASET, RULES_DATASET

APPLICATION_KEY = "Application"


def _ensure_project(client: Client, name: str) -> str:
    """Return the project id, creating the project if it doesn't exist yet."""
    try:
        proj = client.read_project(project_name=name)
    except Exception:
        proj = client.create_project(project_name=name)
        print(f"  created project {name}")
    return str(proj.id)


def main() -> None:
    export_langsmith_env()
    settings = get_settings()
    application_value = settings.langsmith_app

    host = os.environ.get("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")
    key = os.environ["LANGSMITH_API_KEY"]
    headers = {"x-api-key": key, "Content-Type": "application/json"}
    base = f"{host}/api/v1/workspaces/current"

    client = Client()

    print("Ensuring tracing projects exist...")
    project_ids = {
        name: _ensure_project(client, name)
        for name in settings.langsmith_projects.values()
    }

    # Eval datasets only exist after a first eval run; skip any not created yet.
    dataset_ids: dict[str, str] = {}
    for name in (RULES_DATASET, CARD_DATASET):
        try:
            dataset_ids[name] = str(client.read_dataset(dataset_name=name).id)
        except Exception:
            print(f"  dataset {name} not found yet — skipping (run an eval first)")

    # Locate the default `Application` tag key and its `<app>` value.
    tags = requests.get(f"{base}/tags", headers=headers)
    tags.raise_for_status()
    app_key = next((t for t in tags.json() if t["key"] == APPLICATION_KEY), None)
    if app_key is None:
        raise SystemExit(
            f"No '{APPLICATION_KEY}' tag key found. Resource tags require a "
            "LangSmith Plus/Enterprise plan; check the API key's workspace."
        )

    value = next((v for v in app_key["values"] if v["value"] == application_value), None)
    if value is None:
        resp = requests.post(
            f"{base}/tag-keys/{app_key['id']}/tag-values",
            headers=headers,
            json={"value": application_value},
        )
        resp.raise_for_status()
        value = resp.json()
        print(f"  created tag value {APPLICATION_KEY}:{application_value}")
    tag_value_id = value["id"]

    # Resource ids already carrying this tag value (so re-runs are no-ops). The
    # taggings response groups resources by type under `resources.<type>`.
    existing = requests.get(
        f"{base}/taggings", headers=headers, params={"tag_value_id": tag_value_id}
    )
    existing.raise_for_status()
    already = {
        r["resource_id"]
        for entry in existing.json()
        for group in entry.get("resources", {}).values()
        for r in group
    }

    def tag(resource_type: str, name: str, rid: str) -> None:
        if rid in already:
            print(f"  {name}: already tagged — skipping")
            return
        resp = requests.post(
            f"{base}/taggings",
            headers=headers,
            json={"tag_value_id": tag_value_id, "resource_type": resource_type, "resource_id": rid},
        )
        status = "ok" if resp.ok else f"FAILED {resp.status_code}: {resp.text[:200]}"
        print(f"  {name} -> {status}")

    print(f"\nTagging resources into Application '{application_value}'...")
    tag_one: Callable[[str, str, str], None] = tag
    for name, pid in project_ids.items():
        tag_one("project", name, pid)
    for name, did in dataset_ids.items():
        tag_one("dataset", name, did)

    print(
        "\nDone. These projects/datasets (and their future traces/experiments) "
        f"now appear under the '{application_value}' application."
    )


if __name__ == "__main__":
    main()
