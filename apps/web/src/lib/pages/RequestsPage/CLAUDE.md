# RequestsPage

Where a signed-in user suggests a new game or character, or a correction to an existing one,
and follows the requests they sent. Moderators review them in the admin panel. Guests see a
"Log in" prompt with a Sign in button that opens the auth modal.

## Routes

- `/requests` — `src/app/requests/page.tsx`, wrapped in `Suspense` with `RequestsPageSkeleton`
  (the page reads `useSearchParams`).
- Static metadata: title `Requests`, `robots: { index: false, follow: true }`.
- Client-only content: the route fetches nothing.

## Data

- `useAuthStore().isAuth` — decides between the form and the login prompt.
- Query params, read once as initial values: `kind` (`character`, anything else → `game`),
  `targetId` + `targetName` (both required) to open the form as a correction of that entity.
  The game page's hero builds them (`GameHero`); the page never writes them back.
- `widgets/requests/UserRequests` runs its own queries and mutations.

## Composition

1. `Box` → `Breadcrumbs` (Home / Requests).
2. Header: `SectionTitle as="h1"` "Suggest a game or a character" and the lede.
3. `widgets/requests/UserRequests` with `initialKind` / `initialTarget`, or, for guests, a compact
   `EmptyState` "Log in to send a request." whose Sign in action calls `openAuthModal`.
   Withdrawing a pending request asks for confirmation through `ConfirmModal` first. "My
   requests" pages through `GET /requests/mine` 20 at a time; the `Pagination` shows only when
   there is more than one page.

## Loading state

- `RequestsPageSkeleton` (`RequestsPageSkeleton.tsx`, its own `"use client"` module sharing
  `RequestsPage.module.scss`) is the route's `Suspense` fallback. It paints the page's own frame:
  the `Box` with its `page` padding and gaps, the crumbs line, the `h1` bar, the two-line lede at
  65ch, then the same two columns the form and "My requests" take — `1.4fr / 1fr`, one column
  below `mediaMd` — with a form of field rows and a queue card of three request rows at the
  widgets' own `--field-control-height`, `--padding-x3` padding and `--radius-x3` cards.
- The page skeleton carries the `role="status"` wrapper; neither the form nor the queue
  announces a loading of its own.

## Rules and gotchas

- **Every button inside the request form that is not the submit button needs `type="button"`.**
  The shared `Button` sets no type; the Game/Character tabs once submitted the form and showed
  validation errors on every switch. `RequestForm` avoids a native `<form>` for this reason.
- The page is `noindex` on purpose, so gating the form on the client auth store does not cost
  search visibility.
