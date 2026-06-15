"""Tag the deckalization tracing projects into the `deckalization` Application.

In LangSmith, `LANGSMITH_PROJECT` only controls which *tracing project* a run lands
in (`deckalization-dev` / `-ci` / `-prod`). The `deckalization` *Application* shown in
the sidebar is a separate concept: an `Application` resource tag attached to projects.
Untagged projects only appear under "All applications" — which is why traces weren't
showing up under `deckalization`.

This script is the one-time (idempotent) setup that:
  1. ensures the three tracing projects exist (pre-creating `-ci` / `-prod` so they're
     tagged before their first run ever arrives),
  2. finds (or creates) the `Application: deckalization` tag value,
  3. assigns all three projects to it, skipping any already tagged.

After this runs, every FUTURE trace sent to any of these projects shows up under the
`deckalization` Application automatically — tagging is per-project, not per-trace.

Requires a LangSmith Plus/Enterprise plan (resource tags) and an API key for the
target workspace.

    uv run python -m agents.evals.scripts.tag_langsmith_projects
"""

from __future__ import annotations

import os

import requests
from langsmith import Client

from agents.core.config import get_settings
from agents.core.tracing import export_langsmith_env

# Project names + application come from central config (LANGSMITH_APP in .env).
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
    projects = list(settings.langsmith_projects.values())

    host = os.environ.get("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")
    key = os.environ["LANGSMITH_API_KEY"]
    headers = {"x-api-key": key, "Content-Type": "application/json"}
    base = f"{host}/api/v1/workspaces/current"

    client = Client()

    print("Ensuring tracing projects exist...")
    project_ids = {name: _ensure_project(client, name) for name in projects}

    # Locate the default `Application` tag key and its `<app>` value.
    tags = requests.get(f"{base}/tags", headers=headers)
    tags.raise_for_status()
    app_key = next((t for t in tags.json() if t["key"] == APPLICATION_KEY), None)
    if app_key is None:
        raise SystemExit(
            f"No '{APPLICATION_KEY}' tag key found. Resource tags require a "
            "LangSmith Plus/Enterprise plan; check the API key's workspace."
        )

    value = next(
        (v for v in app_key["values"] if v["value"] == application_value), None
    )
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

    # Project ids already carrying this tag value (so re-runs are no-ops). The
    # taggings response groups resources by type under `resources.projects`.
    existing = requests.get(
        f"{base}/taggings", headers=headers, params={"tag_value_id": tag_value_id}
    )
    existing.raise_for_status()
    already = {
        p["resource_id"]
        for entry in existing.json()
        for p in entry.get("resources", {}).get("projects", [])
    }

    print(f"\nTagging projects into Application '{application_value}'...")
    for name, pid in project_ids.items():
        if pid in already:
            print(f"  {name}: already tagged — skipping")
            continue
        resp = requests.post(
            f"{base}/taggings",
            headers=headers,
            json={
                "tag_value_id": tag_value_id,
                "resource_type": "project",
                "resource_id": pid,
            },
        )
        status = "ok" if resp.ok else f"FAILED {resp.status_code}: {resp.text[:200]}"
        print(f"  {name} -> {status}")

    print("\nDone. Future traces to these projects will appear under "
          f"the '{application_value}' application.")


if __name__ == "__main__":
    main()
