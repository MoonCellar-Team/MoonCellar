# GauntletPage

The game picker: a wheel that spins over either the filtered catalogue (Gauntlet mode) or the
viewer's crowned shortlist (Royal mode, knock-out). Public; history and royal games persist per
viewer — on the account for a signed-in user, in the browser for a guest.

## Routes

- `/gauntlet` — `src/app/gauntlet/page.tsx`.
- Static metadata: title `Gauntlet`, canonical `/gauntlet`, own keywords. The route renders
  `BreadcrumbList` JSON-LD.
- No server data fetch. The route renders the JSON-LD and `<GauntletPage />` from the barrel and
  nothing else; the page owns its layout, its `Suspense` (with `GauntletPageSkeleton`, because the
  panel and the filters read the query string) and its styles.

## Data

- `useWheelStore` — the current `winner` (drives `BGImage`) and the royal round state.
- `useStatesStore().isRoyal` — which mode is on.
- Filters live in the URL (Gauntlet mode only) and are written by `Filters` through
  `pushState`. `GauntletModePanel` counts matching games with `useGamesQuery({ …, take: 1 })`.
- Royal games are read and written only through `useRoyalGames` (guest store or the `/royal`
  socket for a signed-in user).
- History (every Gauntlet winner) goes through `entities/gauntlet-history`: `useGauntletHistory`
  adds, removes and clears, `useGauntletHistoryPageQuery` reads a page of
  `GAUNTLET_HISTORY_TAKE` (6) games and `useGauntletHistoryIds` feeds "Exclude history". A
  signed-in user's history is REST (`/gauntlet-history`, paged on the server); a guest's stays in
  the persisted `games` store and is paged on the client. `useGauntletHistorySync` (mounted in
  `Layout`) moves a guest history into the account at sign-in and empties the local one.

## Composition

Everything sits in `.wrapper` inside one `Suspense`:

1. `widgets/gauntlet/GauntletModePanel` — a one-row toolbar: breadcrumbs, `SectionTitle as="h1"`
   "Gauntlet", the mode switch (`ModeCards`, the shared segmented `Tabs` "Catalogue" / "Royal" — the
   first is not called "Gauntlet", which would repeat the `<h1>` right above it; only Royal shows a count,
   the crowned games, which is known at once — a Gauntlet match count arrives after loading and
   made the tab widths and the text jump) and `AppliedGameFilters` (or the crowned games in Royal mode).

Then, in `.page`:

2. Left `ExpandMenu` "Filters" → `Filters isGauntlet` — hidden in Royal mode.
3. Right `ExpandMenu` "Lists" → `widgets/main/ConsolesList` (Gauntlet games, Royal list, History tabs;
   History is `GauntletHistoryList`, with an inline `Pagination` under it).
4. `BGImage` of the current winner.
5. `widgets/wheel/WheelContainer` — the wheel, as tall as the space under the toolbar, and beside
   it the winner block, which always reaches the bottom of the page and scrolls inside. Before a
   spin the block shows `GauntletIntro`: the mode's title, lede and three steps, which used to
   take half the height above the wheel. After a spin it shows the winner (`GauntletWinner`), whose
   facts under the name are the game page's `entities/game/ui/GameFacts`; its "More about the game"
   no longer repeats genres and platforms.

## Loading state

- `GauntletPageSkeleton` (`GauntletPageSkeleton.tsx`, its own `"use client"` module sharing
  `GauntletPage.module.scss`) is the fallback of the page's `Suspense`, which sits inside
  `.wrapper`. It paints the toolbar `Box` (crumbs line, `h1` bar, the two segmented mode pills,
  the "Filters" label and the match-count line) and, in `.page`, the wheel container's own grid —
  the square wheel placeholder at `aspect-ratio: 1` and `--gauntlet-wheel-max-width`, and the
  winner panel as a `Box` stretched to the bottom with the intro block's icon, title, two lede
  lines and three step rows.
- It carries the `role="status"` on the wheel/panel grid: the toolbar above it is decoration.
- The skeleton shares `GauntletPage.module.scss`, so `.wrapper` and `.page` are the page's own —
  including the `height: var(--page-height-available)` that the fallback would otherwise lose,
  which is what made the wheel's page collapse and then grow to full height on the swap.

## Rules and gotchas

- **The winner block slides: the winner enters from the right, leaves to the right with a fade,
  and the intro then enters from the right again** (from below and to below on mobile).
  `useDelayedSwap` keeps the old content (winner or intro) mounted until its exit animation ends and
  only then renders the new one; `WheelContainer` keys the block on it so the entry animation
  replays. Swapping the content at once made the intro vanish in one frame when a winner arrived.
- **The toolbar stays one row on desktop; never put the mode copy back above the wheel.** The wheel
  takes whatever height the toolbar leaves, and the former two-column panel with cards, lede and
  steps left a ~400px wheel at 1280×800. Explanations belong in `GauntletIntro`, the winner block's
  empty state. Mockup: `docs/mockups/gauntlet-responsive.html` (option A).
- **Read and change the history only through `entities/gauntlet-history`.** Reading
  `useGamesStore().historyGames` shows a signed-in user the guest leftovers, and writing to it
  never reaches the account. A guest's list is capped at `GAUNTLET_HISTORY_LIMIT` and deduplicated
  like the server's, so a re-won game moves to the top instead of appearing twice.
- **"Exclude history" sends every history id as `excludeGames`**, so the ids come from
  `GET /gauntlet-history/ids`, not from the paged list — a page holds only 6 of them.
- **Read and change royal games only through `useRoyalGames`.** Reading
  `useGamesStore().royalGames` directly shows a signed-in user the leftover guest list, and
  writing to it changes nothing on the account.
- **`socket.io-client` for `/royal` stays a dynamic `import()` on its own `Manager`.** A static
  import ships it to every guest, and sharing the `/comments` manager sends no credentials.
- **The `<h1>` and breadcrumbs live in `GauntletModePanel`.** Removing the panel from the page
  drops them from the HTML.
- **The route imports the page through its barrel and nothing else from it.** A route that
  imports the page's `.module.scss` or composes widgets itself breaks the FSD rule that a route
  only loads data and picks a page.
- The two `ExpandMenu`s are told apart by `position` (`left`/`right`), which `ExpandMenu` uses
  as the element id; never give both the same id.
- **A full-height wheel panel needs `minHeight: 0` in `templateStyle`.** `WheelContainer`
  carries it; without it the panel grows past a short container.
- Royal mode hides the Filters menu on purpose: the crowned list is the filter.
- **Switching the mode clears the winner and the royal round** (`ModeCards.switchMode`). The
  winner lives in `useWheelStore` for both modes, so without the reset a Gauntlet result stayed on
  screen in Royal mode, captioned "Last one standing" and highlighted in the crowned list.
