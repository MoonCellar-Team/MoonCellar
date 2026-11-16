# Admin

The moderation and catalogue back office. One client page renders every admin tab; only users
whose account is an admin ever see it — everyone else gets a 404.

## Routes

- `/admin/users`, `/admin/games`, `/admin/comments`, `/admin/conflicts`, `/admin/characters`,
  `/admin/images`, `/admin/sites`, `/admin/news` — one route file each under `src/app/admin/<tab>/page.tsx`,
  each rendering `<Admin tab="<tab>" />` inside a `Suspense` with `<AdminSkeleton tab="<tab>" />`
  (the page reads `useSearchParams`).
- `/admin` (`src/app/admin/page.tsx`) only redirects: the legacy `?tab=<tab>` becomes
  `/admin/<tab>`, an unknown or missing tab becomes `/admin/users`, other query params are kept.
- `src/app/admin/layout.tsx` gates the whole segment on the server: no `accessMoonToken` and no
  `refreshMoonToken` cookie → `notFound()`; otherwise it calls `GET /admin/access` with the
  request's cookies (`no-store`) and answers 404 on `403`, or on `401` without a refresh cookie.
  A `401` with a refresh cookie, or an unreachable API, lets the page render so the client can
  refresh the session.
- Dynamic (cookies). No metadata of its own; `robots.ts` disallows `/admin`.

## Data

- `useAuthStore` — `isAdmin` and `isAuthChecked` gate the client render.
- Tab badge counts, all enabled only for admins: `useRequestsQuery` (pending game and character
  requests, `take: 1`, reads `total`), `useCommentReportsQuery("open", 1)`,
  `useConflictsSummaryQuery` (`pending`).
- Each widget fetches its own table data.
- URL state: the main tab is the path segment, switched with `router.push(getAdminHref(tab))`
  (a different route). The sub-view of Games, Comments and Characters is `?view=requests` /
  `?view=reports`, written with `setAdminQuery` (`window.history.pushState`), no server request.

## Composition

1. `Box` → `Breadcrumbs` (Home / Admin / tab label).
2. `Tabs` — the eight main tabs with badge counts; `mobileMenuTitle="Admin"`.
3. The active tab:
   - Users → `widgets/admin/UserList`.
   - Games → segmented `Tabs` List / Requests: `GameList` or `RequestsReview kind="game"`.
   - Comments → List / Reports: `CommentList` (opens on Visible comments) or `ReportList`. Each
     card (`ModeratedComment`) links the game, or the news post with a "News" badge.
   - Conflicts → `Conflicts`.
   - Characters → List / Requests: `CharactersAdmin` or `RequestsReview kind="character"`.
   - Images → `ImageGenerator`.
   - Sites → `SiteSessions`.
   - News → `NewsAdmin`: every post, drafts included, newest edit first, with its view count
     (`—` for a post never published); a row opens `/admin/news/<id>` (`pages/ArticleEditPage`),
     "Write a post" opens `/admin/news/new`.

## Loading state

- `AdminSkeleton` (`AdminSkeleton.tsx`, its own `"use client"` module sharing `Admin.module.scss`)
  is the frame of every admin screen before the data: the eight route files use it as their
  `Suspense` fallback and `Admin` returns it while `isAdmin` is false, so the route fallback and
  the auth gate paint the same thing and nothing moves when the gate opens.
- It draws the screen's own structure: the crumbs line, the eight-tab row as eight equal pills
  with an 8px badge placeholder on the four tabs that carry a count (Games, Comments, Conflicts,
  Characters — `COUNTED_TABS`, the same order as `ADMIN_TABS`), then a body per tab from
  `TAB_BODIES`. Below `$screenMd` the pills collapse into the single menu bar `Tabs
mobileMenuTitle="Admin"` renders.
- The bodies repeat each widget's own frame, not a generic panel: Users is the table alone; Games
  is List / Requests, the search toolbar with its button, the table and the pager; Comments is
  List / Reports, the status tabs with the count, three comment cards and the pager; Conflicts is
  the status row with its button, the source tabs, the AI controls, the filter row, the table and
  the pager; Characters is List / Requests, the search + source tabs + "New character" toolbar,
  the table and the pager; Images is the provider/model fields, the prompt and the Generate row
  followed by the empty state; Sites is the hint with "Add site" above the table; News is "Write
  a post" above the table and the pager.
- **A table block's column tracks and row height come from the widget it stands in for.** The
  block copies `Table`'s own container (`--color-bg-secondary`, `--padding-x2`, `--gap-x1`
  between rows) and draws a header row plus eight rows: 72px for the game covers, 56px for the
  user avatars, 48px for the character portraits, 40px for the text rows; the tracks are Games
  `100px minmax(160px, 250px) 1fr 1fr 1fr 90px`, News `40%` + six `1fr`, Characters and Sites the
  widget's `width` as a minimum with `1fr`, Conflicts five equal columns, Users five equal
  columns. Change a widget's `columnStyles` or the height of its cells and change its block in
  the same edit, or the list jumps when the rows arrive. Under `$screenMd` the block becomes four
  `--padding-x25` cards, the shape `MobileTable` loads.
- **A new tab needs a body in `TAB_BODIES`.** The record is keyed by `TAdminTab`, so a tab added
  to `ADMIN_TABS` does not compile until its body exists.
- The sub-views (`?view=requests`, `?view=reports`) are not drawn: the fallback is always the
  List shape of the tab, so a direct link to a sub-view swaps the content blocks once the data
  arrives.

## Rules and gotchas

- **Keep both gates: the server layout and the client `isAuthChecked && !isAdmin → notFound()`.**
  The layout lets a 401-with-refresh-cookie through, so only the client check catches a session
  that turns out not to be an admin after the refresh.
- **Render no admin content until `isAdmin` is true — show `AdminSkeleton tab={tab}` instead.**
  The badge queries are disabled until then, and rendering the widgets earlier fires admin
  requests that fail with toasts. Returning nothing left a blank page whenever the auth check
  stalled, and a generic `PageSkeleton` changed the screen's shape when the tab arrived.
- **Add a tab in `admin-url.utils.ts` (`ADMIN_TABS`, `ADMIN_TAB_LABELS`), add its route file, and
  keep `mainTabs` in the same order.** `tabIndex` is the index into `ADMIN_TABS`, and `selectTab`
  maps the clicked index back through it; a tab out of order opens the wrong section.
- **Sub-views use `setAdminQuery`, not `router.push`.** A `router.push` re-runs the server layout
  (including the `/admin/access` fetch) for what is only a client toggle.
- **An admin mutation that changes a game page must call `revalidateGamePage` before
  `router.refresh()`.** Game pages are ISR for an hour; a refresh alone refills the cache with
  the stale render.
- **The Images list has two sources: generated images not yet uploaded live only in the
  browser's `generated-images` store, and uploaded ones come from `GET /admin/images`.**
  `ImageGenerator` merges them, skipping a database image whose id is already a local entry's
  `savedId`. Reading only the store hid every upload from any other browser — images uploaded
  from a local run (which writes to the production database through the `bun run mongo` tunnel)
  never appeared on the production admin. A database-only row has no data URL, so it offers no
  Regenerate or Split; it can be opened, linked, downloaded and deleted.
- **Download fetches the image into a blob, and the Space sends no CORS headers.** A local row
  downloads its data URL; a database-only row's fetch to the CDN fails and `downloadImage` opens
  the file in a new tab instead. Either one is the compressed copy (`compressDataUrl`: 1536px,
  WebP 0.85) — the provider's full-size output is not kept anywhere.
- Tables in the widgets go through the shared `Table`; rows that open a page are clickable as a
  whole through `onRowClick` (interactive columns listed in `rowClickExcludeKeys`), with no
  separate "Open" column. The field diff in `RequestReviewPanel` stays a native `<table>`: `Table`
  lays out each column separately, so cells of different heights would not line up as rows.
