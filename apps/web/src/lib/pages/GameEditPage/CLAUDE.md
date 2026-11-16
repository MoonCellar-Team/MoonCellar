# GameEditPage

Admin-only form that edits every stored field of a game, or creates a new game (optionally from
an AI draft). It also triggers IGDB / VNDB / HLTB re-parses and deletes games.

## Routes

- `/admin/games/[id]` — `src/app/admin/games/[id]/page.tsx`. `id === "new"` is create mode
  (`gameId` undefined). Wrapped in `Suspense` with `GameEditPageSkeleton`. Dynamic, no metadata.
- Gated by `src/app/admin/layout.tsx` (see `Admin`) and by the client
  `isAuthChecked && !isAdmin → notFound()`.

## Data

- `useAdminGameQuery(gameId)` — the game; on error the page `router.push`es back to
  `/admin/games`.
- `useGameFiltersQuery` — option lists for enum fields (genres, modes, companies, …).
- `usePlatformsQuery` — the platform dropdown (`platformIds` holds platform `_id`s).
- Mutations from `entities/game/api/game.mutations`: create, update, delete, upload image,
  find images, import image. Parses call `igdbApi`, `vndbApi`, `hltbApi` directly.
- Form: react-hook-form with a zod resolver (`AddGameRequestSchema` in create mode,
  `UpdateGameRequestSchema` otherwise). The field layout is data — `GAME_SECTIONS` in
  `features/game/model/game-edit-sections.ts` — and `renderField` maps each `kind` to a shared
  `Fields` control. The descriptors live in the feature, not in this folder: a page folder
  holds only the page and its route constants, and the form layout is the game-editing
  feature's model.
- `original` (state) is the last server copy; Save sends only top-level keys whose JSON differs
  from it.
- No URL state besides the path segment; create redirects to `/admin/games/<newId>`.

## Composition

1. `Box` → `Breadcrumbs` (Home / Admin / Games / game name or "Create game").
2. Header: `SectionTitle as="h1"`, and in edit mode View game (a `Button href`), Parse from IGDB, Full reparse from IGDB, Parse
   from VNDB, Parse from HLTB (by id when `hltb.hltbId` is filled), Delete (`ConfirmModal`).
3. `widgets/admin/AiGameDrafts` — create mode only; `reset`s the form with a draft.
4. The form: read-only facts (id, dates, ratings, character count, source), then one
   `CollapsibleSection` per `GAME_SECTIONS` entry, then the Create/Save button.
5. `ImageFinder` inside the cover and image-list fields — picked URLs are applied on submit
   (imported to storage in edit mode, stored as-is on create).

## Loading state

- `GameEditPageSkeleton` (`GameEditPageSkeleton.tsx`, its own `"use client"` module sharing
  `GameEditPage.module.scss`) is both the route's `Suspense` fallback and what the page renders
  while `isPageLoading` or the filter options are missing. It paints the page's `content` column —
  the crumbs line, the `header` with the `h1` bar and the action row, a `section` row per
  `GAME_SECTIONS` entry (the same count the loaded form has, so a new section is reflected there
  without a second list) and the footer button.
- The section rows are drawn collapsed; the form's first sections open by default, so the loaded
  page is taller than the fallback.

## Rules and gotchas

- **Validate and diff `pruneEmpty(values)`, never the raw form values.** Every `Controller` on a
  nested path creates that key with `undefined`, so a game without IGDB data carried `igdb: {}`
  and failed `igdb.gameId` as required.
- **Keep `characters` out of the form.** The update response returns them as ids, which fail
  `CharacterSchema` and lock Save after the first save; `toFormValues` strips them and
  `setOriginal` carries the previous value over.
- **Every field is wired through `Controller`.** A field driven only by `setValue` never
  recomputes `isValid`; `addImageUrl` uses `setValue` only on fields whose `Controller` is
  already registered.
- **After any change made here, call `revalidateGamePage(oldSlug, newSlug)`.** The game page is
  ISR (`revalidate = 3600`); without it the public page shows the old data for up to an hour,
  and a slug change leaves the old URL cached. Save, every parse, and Delete all do it.
- **Hydrate the form once per `gameId`** (`hydratedGameIdRef`). A refetch of the admin query
  must not `reset` a form the admin is typing into; `reloadGame` resets explicitly after a parse.
- **Buttons outside the submit button need no `type` only because they sit outside the
  `<form>`.** Anything added inside the form must pass `type="button"`, or it submits.
- Images are uploaded only after the game exists (`gameId` is needed for the storage path);
  create mode shows "Save the game first" instead of the upload buttons.
- The platform `Dropdown` passes `isThroughPortal`; keep it on any new dropdown in the form, since
  an inline list is cut off by any ancestor with `overflow`.
- Creating a game whose name matches existing ones fails with possible duplicates;
  `confirmPossibleDuplicates` asks and retries with `force: true`.
