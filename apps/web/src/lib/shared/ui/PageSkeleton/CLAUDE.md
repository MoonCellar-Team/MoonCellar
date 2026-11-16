# PageSkeleton

The loading state of a whole route: a breadcrumb line, a title bar and a panel that fills the
rest of `--page-height-available`, all `Skeleton`s.

## When to use

- As the `Suspense` fallback of a route (`app/games/page.tsx`, `/requests`, `/lists`, the admin
  editors under `app/admin/<tab>/[id]`).
- Not for a page whose layout is distinctive enough that a generic panel visibly jumps into it —
  that page gets its own skeleton next to it, as the profile has `UserProfileSkeleton` and the
  admin tabs have `AdminSkeleton`.
- As the placeholder of a page that waits for something before it can render anything.
- Inside a section or a panel use `Skeleton`, shaped like that section; `PageSkeleton` is a full
  page tall and pushes everything below it off the screen.

## API

No props.

## Usage

```tsx
import { Suspense } from "react";
import { PageSkeleton } from "@/src/lib/shared/ui/PageSkeleton";

<Suspense fallback={<PageSkeleton />}>
  <GamesPage initialParams={params} initialData={initialData} />
</Suspense>;
```

## Rules and gotchas

- It has no hooks and no `Box`, so a route file under `src/app/` can import it directly.
  Wrapping it in `Box` would pull `useResizeDetector` into a server component and the route
  would fail with "useRef is not a function".
- Do not place a `Suspense` boundary with this fallback above a page component that can call
  `notFound()`: the throw is caught below the flushed shell and the response stays a soft 200.
- The bar widths are `--page-skeleton-crumbs-width` and `--page-skeleton-title-width`
  (`vars/_components.scss`).

## Storybook

`Shared/PageSkeleton`: Default.
