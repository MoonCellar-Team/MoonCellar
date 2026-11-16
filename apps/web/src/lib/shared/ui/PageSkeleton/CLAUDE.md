# PageSkeleton

The generic loading state of a whole route: a breadcrumb line, a title bar and a panel that
fills the rest of `--page-height-available`, all `Skeleton`s.

## When to use

- **Only for a page that really is a breadcrumb line and one panel.** Every page whose layout is
  its own — a grid of cards, a two-column form, a wheel under a toolbar — gets a skeleton next to
  it instead, as the profile has `UserProfileSkeleton`, the admin tabs `AdminSkeleton`, the feed
  `NewsPageSkeleton` and the editors `ArticleEditPageSkeleton`, `CharacterEditPageSkeleton` and
  `GameEditPageSkeleton`.
- The reason is the swap: a generic panel that is replaced by a grid of cards, a sidebar or a
  form changes the page's width and height when the data arrives, and the content reflows under
  the reader's eyes. A page's own skeleton draws the same `Box`es, columns, card sizes and row
  heights, so only the placeholders change.
- **No route imports it today:** `/games`, `/lists`, `/news`, `/requests`, `/link`, `/gauntlet`
  and the three admin editors all have a frame of their own. Keep it for a page that is one
  panel.
- Inside a section or a panel use `Skeleton`, shaped like that section; `PageSkeleton` is a full
  page tall and pushes everything below it off the screen.

## API

No props.

## Usage

```tsx
import { Suspense } from "react";
import { SomePage, SomePageSkeleton } from "@/src/lib/pages/SomePage";

<Suspense fallback={<SomePageSkeleton />}>
  <SomePage />
</Suspense>;
```

## PageCrumbsSkeleton

The breadcrumb line of every page skeleton, exported from this folder. It draws one
`--page-skeleton-crumbs-width` bar inside the line box of the real `Breadcrumbs` — 13px tall
with `line-height: 1`, 16px below `mediaSm`, where the row grows to the chevron — so the crumbs
row keeps its height on both layouts. A page skeleton imports it instead of restating the
crumbs' font size in its own module.

## Rules and gotchas

- **It has no hooks and no `Box`, so a route file under `src/app/` can import it directly.**
  Wrapping it in `Box` would pull `useResizeDetector` into a server component and the route
  would fail with "useRef is not a function". A page skeleton that needs `Box` is its own
  `"use client"` module next to the page and is imported through the page's barrel.
- **One `role="status"` per fallback, on the element that wraps the placeholder**, never on each
  `Skeleton` (`PageSkeleton` carries it itself). Where a child already announces — `GamesCards`
  and `ListCardsGrid` set it on their own grid when `isLoading` — the page skeleton leaves its
  wrapper without one, or a screen reader says "Loading" twice.
- Do not place a `Suspense` boundary with a page fallback above a page component that can call
  `notFound()`: the throw is caught below the flushed shell and the response stays a soft 200.
- The bar widths are `--page-skeleton-crumbs-width` and `--page-skeleton-title-width`
  (`vars/_components.scss`).
- A filter page's chip row is drawn only when the URL carries filters: `GamesPageSkeleton` and
  `ListsPageSkeleton` take `isFiltered`, which the route computes with `hasGameFilters` /
  `hasListsFilters` from the query it already parsed. `AppliedFilters` renders nothing without
  filters, so a chip row drawn unconditionally would collapse the page up when the data arrives.

## Storybook

`Shared/PageSkeleton`: Default, Crumbs.
