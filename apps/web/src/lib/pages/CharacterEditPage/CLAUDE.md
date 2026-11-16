# CharacterEditPage

Admin-only editor for one character, or the creation form for a new one with AI-generated
drafts. Reached from the Characters tab of the admin panel.

## Routes

- `/admin/characters/[id]` — `src/app/admin/characters/[id]/page.tsx`. `id === "new"` renders
  the create form (`characterId` undefined); any other value edits that character.
- The route wraps the page in `Suspense` with `CharacterEditPageSkeleton`. Dynamic, no metadata.
- Gated by `src/app/admin/layout.tsx` (404 for a viewer without admin access, see `Admin`), and
  again on the client.

## Data

- `useCharacterByIdQuery(characterId)` (`entities/character/api`) loads the character.
- `useAuthStore` — `isAdmin`, `isAuthChecked`.
- No URL state besides the path segment. After a successful create the page
  `router.replace`s to `/admin/characters/<newId>`; Close goes to `/admin/characters`.
- An applied AI draft lives in local state as `{ value, version }`.

## Composition

1. `Box` → `Breadcrumbs` (Home / Admin / Characters / character name or "New character").
2. `widgets/admin/AiCharacterDrafts` — create mode only; generates drafts and hands one to the
   editor through `onApply`.
3. `widgets/admin/CharacterEditor` — the form itself; saves, and reports back through
   `onSaved` / `onClose`.

## Loading state

- `CharacterEditPageSkeleton` (`CharacterEditPageSkeleton.tsx`, its own `"use client"` module
  sharing `CharacterEditPage.module.scss`) is both the route's `Suspense` fallback and the edit
  mode's loading state (`!isCreate && isLoading`); create mode renders the editor at once. It
  paints the page's `Box` and `content` column — the crumbs line over
  `CharacterEditorSkeleton` — and the editor skeleton is built on `CharacterEditor.module.scss`:
  the `editor` grid of `1.5fr / 1fr` at the panel's own `--padding-x4` and radius, the form's four
  fields in `.editor__grid`, its field rows, the actions row, and the portrait column with the
  `--character-editor-portrait-width` image at `aspect-ratio: 3 / 4`.

## Rules and gotchas

- **`CharacterEditor` is keyed by `character._id`, or `new-<draft.version>` in create mode.**
  Applying a draft bumps the version, which remounts the editor so its form re-initialises from
  the draft; passing a new `draft` prop to a mounted editor would not reset it.
- **Gate the loader on `isLoading`, never `isPending`.** In create mode the query is disabled
  and `isPending` would stay true forever.
- **`notFound()` only after loading finished and `character` is still empty.** Calling it while
  the query is in flight sends every edit link to the 404 page.
- `isAuthChecked && !isAdmin → notFound()`, and nothing renders until `isAdmin` is true — the
  server layout lets a refreshable session through, so the client check is the second gate.
- Never put an array into axios `params` for a single id lookup — the API reads `ids=a`, not
  `ids[]=a`, and `/admin/characters/<id>` once loaded the alphabetically first character.
- **The editor's "Role in each game" sets `roles` (one role per linked game).** An empty field
  means Auto: the VNDB role for that game's VN, else Protagonist when the description says so.
  A manual role wins over both, and roles for games that are no longer linked are dropped on
  save. The game page lists characters by role: Protagonist, Main, the rest, Side, Appears.
