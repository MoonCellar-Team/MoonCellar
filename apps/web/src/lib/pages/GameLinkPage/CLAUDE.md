# GameLinkPage

Where a player confirms the code a game port shows while signing in with a MoonCellar account
(device sign-in, `docs/game-sign-in.md`). The game opens this page, or the player scans its QR
code on a phone; the code is prefilled from `?code=`. A guest who arrives with a code gets the
auth modal opened for them — in sign-up mode with `?signup=1` (the game's "Create an account"),
in login mode otherwise — and the form appears once they are signed in, keeping the code. Without
a code a guest sees the "Log in" prompt and opens the modal with its button.

## Routes

- `/link` — `src/app/link/page.tsx`, wrapped in `Suspense` with `GameLinkPageSkeleton` (the page
  reads `useSearchParams`).
- Static metadata: title `Link a game`, `robots: { index: false, follow: false }`.
- Client-only content: the route fetches nothing.

## Data

- `useAuthStore().isAuth` — decides between the form and the login prompt.
- Query param `code`, read once as the initial value of the code field; `signup=1` picks the
  modal's sign-up mode for a guest.
- `useAuthStore().isAuthChecked` — the modal opens only after the session check, so a signed-in
  player never sees it flash.
- `features/user/ui/GameDeviceLink` runs `GET /auth/game/device/:userCode` (which device is
  waiting) and `POST /auth/game/device/approve` through `entities/game-session`.

## Composition

1. `Box` → `Breadcrumbs` (Home / Link a game).
2. Header: `SectionTitle as="h1"` "Link a game" and the lede.
3. `GameDeviceLink` with `initialCode`, or, for guests, a compact `EmptyState` "Log in to link a
   game." whose Sign in action calls `openAuthModal`.

## Loading state

- `GameLinkPageSkeleton` (`GameLinkPageSkeleton.tsx`, its own `"use client"` module sharing
  `GameLinkPage.module.scss`) is the route's `Suspense` fallback. It paints the page's own frame:
  the `Box` with its `page` padding and gaps, the crumbs line, the `h1` bar, the two-line lede at
  65ch, and the code form column at `--game-link-form-width` — the same token
  `GameDeviceLink.module.scss` sizes the real form with — a label line, a
  `--field-control-height` field and the confirm button.
- The page skeleton carries the `role="status"` wrapper.

## Rules and gotchas

- **The device name is shown before the player confirms, and confirming is a separate click.**
  A code typed from someone else's screen would otherwise sign that person's game in to this
  account; the confirmation text says to confirm only a sign-in the player started.
- The code field accepts any case and spacing and formats it as `ABCD-EFGH`; the API normalizes
  it the same way, so a code typed without the dash still matches.
- Signed-in devices are listed and signed out in Settings → Game devices
  (`features/user/ui/GameDevices`), not on this page.
