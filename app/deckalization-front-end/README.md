# TanStack Start + shadcn/ui

This is a template for a new TanStack Start project with React, TypeScript, and shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```

## Convex

This app talks to the **shared Convex deployment at the monorepo root** (`../../convex`),
the same one the Python agents use — it does **not** create its own Convex project.

- The generated API is imported via the `@convex/*` alias (e.g.
  `import { api } from "@convex/_generated/api"`), pointing at `../../convex`.
- Set the deployment URL in a git-ignored `.env` at the app root:

```bash
VITE_CONVEX_URL=https://<your-convex-deployment>.convex.cloud
```

Run `npx convex dev` from the **repo root** (not here) to edit backend functions and
regenerate `convex/_generated`.

## Pages

- `/` — overview / landing.
- `/technical` — architecture comparison, metric definitions, and benchmark scores
  (static data in `src/data/`, snapshotted from `docs/eval-findings.md`).
- `/demo` — the interactive graph: watch a question flow through `referee_v2`
  node-by-node. Two modes share one renderer:
  - **Showcase (replay):** instant, pre-recorded runs in `src/data/demo-runs/`.
    Regenerate them with `uv run python -m agents.evals.scripts.record_demo_runs`
    from the repo root.
  - **Live:** typed questions stream from the deployed `referee_v2` graph via the
    server route `src/routes/api/referee-stream.ts`.

## Live demo config (optional)

The live path is gated behind server-only env vars (loaded into `process.env`, never
exposed to the browser — do **not** prefix with `VITE_`). Add them to `.env`:

```bash
LANGGRAPH_DEPLOYMENT_URL=https://<your-langgraph-deployment>.langgraph.app
LANGSMITH_API_KEY=lsv2_...
# LANGGRAPH_ASSISTANT_ID=referee_v2   # defaults to "referee_v2"
```

Without these, "Run live" returns a friendly "disabled" message and the showcase
replay runs still work. On a host (Vercel/Netlify/etc.) set the same vars in the
deployment's environment settings.
