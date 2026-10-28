# StatusProjectPage

One project of the status hub: its name, when it last uploaded, a tab per block and the selected
block — `PlanBlock` or `DecompBlock` (`widgets/status`).

## Routes

- `/<slug>` and `/<slug>/<block>` on the status host — `src/app/status/(gated)/[slug]/page.tsx` and
  `[slug]/[block]/page.tsx`, inside the gated layout. A missing or unknown `block` falls back to the
  project's saved `defaultBlock` when enabled, then its first enabled block.

## Data

- `useProjectsQuery` — the project, its blocks and `uploads` (time, size, progress per block; the
  Plan's entry moves with every change of the plan).
- Decompilation: `useProjectBlockQuery(slug, "decomp", hasUpload)` — the block as uploaded
  (`GET /projects/:slug/data/decomp`), enabled only when it was uploaded.
- Plan: `useProjectPlanQuery(slug)` — the plan stored in the hub (`GET /projects/:slug/plan`); every
  edit's answer is the new plan, written straight into this query's cache. Both refetch on a timer
  (a minute, the plan every 30 seconds).

## Composition

1. `Box`: `SectionTitle as="h1"`, "Updated … ago" (turns `--color-attention` after
   `STALE_UPLOAD_MS`, a day), the uploaded commit and a "⋯" `ActionsMenu` — Edit project, Upload
   tokens, Delete project (`useProjectActions` from `widgets/status/ProjectsManager`; after a delete
   the page goes to `/`), then `Tabs` with `tabLink` per block when the project has more than one.
2. Decompilation never uploaded → inline `EmptyState` naming the upload endpoint. An empty plan is
   `PlanBlock`'s own empty state with "Add a section".
3. Loading → `Skeleton`; loaded → `PlanBlock` (editable, `slug` passed for its mutations) or
   `DecompBlock` (`slug` for its map: `FunctionMap` loads what the cells are with
   `useDecompFunctionsQuery` on the first hover or tap and shows it in a tooltip at the pointer).

Its loading state is `StatusProjectSkeleton.tsx`.

## Rules and gotchas

- **Tab links are host paths (`/<slug>/<block>`), never `/status/...`.** The host rewrite adds the
  segment; a link with it is excluded from the rewrite and lands on the real route only by accident.
- **`/<slug>` uses `project.defaultBlock`;** keep it in sync with the project settings form and API
  so the project list opens the configured page.
- An unknown slug renders the page-shaped `EmptyState`, not `notFound()`: the projects come from a
  client query, after the server response.
