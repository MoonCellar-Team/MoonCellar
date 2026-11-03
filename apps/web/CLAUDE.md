# MoonCellar frontend (apps/web)

Rules that apply to the Next.js app. Repository-wide rules live in the root
[`CLAUDE.md`](../../CLAUDE.md).

## Architecture (Feature-Sliced Design)

- **Every component belongs to a layer, and never sits next to the page that happens to render
  it first.** `src/lib` is Feature-Sliced Design: `app` → `pages` → `widgets` → `features` →
  `entities` → `shared`, and `src/app` holds Next route files that do nothing but load data and
  pick a page. A page directory contains the page and nothing else — `<Name>.tsx`,
  `<Name>.module.scss`, `index.ts`, at most its own route constants and its own loading state
  as `<Name>Skeleton.tsx` — and composes everything it shows out of the layers below. A
  `components/` folder inside a page, or a sibling folder like `pages/UserProfile/UserInfo/`, is the violation this rule exists to
  prevent: the second screen that needs the component either imports it out of a page, which
  reverses the layer order, or copies it and the two drift apart.
- **A new `shared/ui` component is not done without `<Name>/CLAUDE.md` and
  `<Name>/<Name>.stories.tsx`, and a new page is not done without `pages/<Page>/CLAUDE.md`.** The
  repository-root `CLAUDE.md` lists what each must contain; Storybook (`bun run storybook`, port 4222) is where the component is checked in every state before it is used on a screen.
- **A page's skeleton is its own `"use client"` module, never a second export of the page
  file.** A route's `Suspense` fallback is what shows while the page's client chunk is still
  loading, so it must not be part of that chunk. It shares the page's `.module.scss`, so its
  frame cannot drift from the page's (`UserProfileSkeleton`).
- **`bun run lint` fails on a component inside a page folder and on any import that points up
  a layer** (`scripts/check-fsd.mjs`). It runs after ESLint, needs no dependencies, and there is
  no exception list — a component that has to reach up belongs one layer higher.
- **Pick the layer from what the code is, not from where it is used first:**
  - `entities/<entity>/` — one domain object: `api/` for its queries, mutations and query keys,
    `ui/` for components that render that object and nothing else
    (`entities/game/ui/GameOverview`), `model/` for its client state.
  - `features/<feature>/` — one thing the user does, with the state that action needs
    (`features/user/ui/PeopleDrawer`, `features/favorites/ui/TopFive`,
    `features/user/model/useViewerFollowings`).
  - `widgets/<area>/` — a self-contained page section that composes features and entities
    (`widgets/user/UserInfo`, `widgets/game/GameHero`, `widgets/admin/UserList`).
  - `pages/<Page>/` — layout and route state only: which tab is open, what the params mean,
    which widgets to place and in what order.
  - `shared/` — no domain knowledge at all: the UI kit, hooks, utils, types, api client.
    A generic form control belongs here (`shared/ui/Fields`), not in the one page that needs it.
- **Imports point down the layer list, and never sideways between `entities` slices or between
  `features` slices.** `features/lists/ui/ListsFilters` used to import
  `pages/ListsPage/lists-query.utils`, so the feature could not be used without the page it was
  supposed to serve; the helper lives in `features/lists/model/` now. When two slices of one
  layer need the same code, move that code one layer down — that is the fix, not a `../../` hop
  between siblings. The `widgets` groups are the exception: they are page areas, not independent
  slices, so `widgets/main` composing `widgets/game/GamesList` is fine.
- **A component that composes two different feature slices is a widget, not a feature.**
  `GameControls` puts the favourites button next to the lists button, which is why it sits in
  `widgets/game/` while the plain `GameControlButton` it is built from stays in `shared/ui/`.
  This is also why the whole `GameCard` → `GamesCards`/`GamesList` chain lives in `widgets/game`:
  a card that embeds those controls cannot be shared UI, and anything rendering that card follows
  it up.
- **A slice is consumed through its `index.ts` and exports named components, never a default.**
  `import { UserInfo } from "@/src/lib/widgets/user/UserInfo"`, not `.../UserInfo/UserInfo`.
  The barrel is the slice's public API: files behind it can be renamed or split without
  touching a consumer, and a default export imported under a second name is how one component
  ends up looking like two in a search.
- **Cross-slice imports use the `@/src/lib/...` alias; a relative path never leaves its own
  slice** — `entities/game`, `features/lists`, `widgets/user`, `pages/GamePage`, and each
  `shared/<segment>` (`shared/ui`, `shared/hooks`, …). A relative path that climbs out of the
  slice marks a component in the wrong place, and it breaks silently the next time either file
  moves.
- **Folder name, file name and exported name are the same word.**
  `widgets/user/UserGames/UserGames.tsx` exports `UserGames`. When they disagree, an import
  reads as one component and renders another.
- **A `.module.scss` never crosses a slice boundary.** `GauntletHeader` used to import
  `pages/GauntletPage/GauntletPage.module.scss`, which meant moving the component dragged the
  page's stylesheet with it and deleting a page rule would silently unstyle the widget.
  Components inside one slice may share that slice's module (`UserReviewItem` uses
  `UserReviews.module.scss`); anything outside it gets its own.

## Styling

- Only use the global CSS variables defined in `:root` (see `src/lib/app/styles/vars/`) for colors, borders, padding, radius, gap, etc. — never hardcode raw values (hex colors, px, etc.) for anything already covered by a `:root` variable.
- If a new value is needed that isn't covered by an existing `:root` variable, add it as a new CSS variable in `:root` (in the relevant file under `src/lib/app/styles/vars/`) instead of hardcoding it inline.
- **`--gap-x*` is only for the `gap` property; margins take `--padding-x*`.** The two scales hold
  the same values today, but they are separate knobs: `gap` spaces siblings from the parent, while a
  margin is space an element keeps around itself, like padding. A margin written in gap tokens
  changes the day the gap scale is retuned for flex and grid layouts. Prefer `gap` on the parent
  over a margin on the child wherever the layout allows it.
- **A CSS custom property that derives from other custom properties must be declared on the same element whose values it reads.** `var()` inside a custom property is substituted where the property is _declared_, not where it is used, so a value computed in `:root` freezes the root defaults and ignores any modifier class further down. `--page-height-available` is declared on `.container` for this reason — declaring it in `:root` silently ignored `.container_bottomBar`.
- **A button's inline padding is always twice its block padding** — the shared `Button` uses
  `var(--padding-x2) var(--padding-x4)` and `compact` uses `x05`/`x1`, and any override keeps
  the 1:2 ratio on the same scale. The only exception is a button that holds a single icon and
  nothing else, which keeps equal padding: `Button` detects that itself (one child that is a
  component element, e.g. `<SvgClose />`) and adds `button_icon`, so do not pass a padding
  override for it. **Squareness is opt-in through `isOnlyIcon`, never detected.** Detecting it
  from the children put `aspect-ratio: 1` on buttons stretched to their container's width (the
  sign-in loader, the external pages toggle), and a stretched button with a fixed ratio grows as
  tall as it is wide. Pass `isOnlyIcon` only where the button is sized by its content. A native
  `<button>` holding only an icon sets `aspect-ratio: 1` in its own module. Native `<button>`s styled in a module follow the same rule. This is the
  site's button shape; a text button with a 1:3 ratio reads as a different control next to its
  neighbours.
- **A text field's inline padding is one or two steps of the `--padding-x*` scale larger than
  its block padding** — the dropdown search box is `var(--padding-x2) var(--padding-x3)`. This
  covers every place the user types: `Input`, `Textarea`, `DatePicker`'s field, `Dropdown`'s
  field and search, `RichEditor`'s body. Equal padding pushes the caret and placeholder against
  the rounded border, and a larger block padding makes a field read as a card rather than a
  control. A field with a leading icon may raise only the side the icon sits on.
- **A consumer never repaints a shared `ui` component through `className`; a missing look becomes a
  prop of the component.** A parent stylesheet may place it — margin, grid placement, width or
  flex sizing, `align-self` — but colour, radius, padding, font, gap and opacity come from the
  component (`Button`'s `compact`, `isAccentText`, `--button-active-color`; `Tabs`' `isFit` and
  per-tab `isMuted`; `RichText`'s `tone`; `Badge`'s `isStruck`; `Avatar`'s `shape`; `Input`'s
  `icon`). A doubled selector such as `.x.x` or `& &__x` is the tell: it exists only to out-rank
  the component's own rule, so it breaks silently the next time that rule changes, and the same
  control ends up looking different on every screen. When a consumer-owned look is really the
  consumer's own element (`GameCard`'s rail chips), render a native element from its module
  instead of a restyled `Button`.
- **A component's own default for anything a consumer may place — `width`, margins, flex or grid
  sizing — goes in `:where(.root)`, not in `.root`.** The consumer's `.parent__child` and the
  component's `.root` have the same specificity, so the stylesheet loaded last wins, and production
  splits CSS modules into chunks in a different order than `next dev`: `CharacterPortrait`'s
  `width: 100%` loaded after `CharacterProfile`'s `--character-profile-portrait-width` and
  stretched the portrait across the whole drawer in production only. `:where()` has zero
  specificity, so the consumer's class wins in any order.
- For text colour use the semantic tokens, never a raw `--color-neutral-*`: `--color-text-primary` (headings and main copy), `--color-text-secondary` (body text, intro paragraphs), `--color-text-muted` (captions, notes, metadata, breadcrumbs). Picking neutrals by hand is how text ends up unreadable on a `Box` over `BGImage` — the muted step is deliberately the lightest one that still reads as secondary.

## Rich text

- **User-written HTML renders only through the shared `RichText`** (`shared/ui/RichText`), never
  through `dangerouslySetInnerHTML`. It wraps `Interweave`, which parses the markup into React
  elements and drops `script`/`iframe` outright — a second line of defence behind the API's
  `sanitizeRichText`. Every place that shows a playthrough comment goes through it, which is what
  keeps their formatting identical.
- **The look of rendered rich text is defined once, in the `richText` mixin** (`_mixins.scss`),
  and consumed by `RichText` and by `RichEditor`'s content area, so the editor shows what the
  reader gets. Block spacing comes from `--rich-text-gap`. Images are capped there at
  `min(100%, var(--rich-editor-image-width))`, and no consumer restates the width: while only the
  editor capped it, a review on the game page stretched a screenshot across the whole panel,
  and the profile looked right only because its column happened to be narrow. The `100%` half is
  load-bearing too — without it a comment image renders at natural size and blows the activity
  card open to the width of the upload.
- **A rich-text container must restate `font-size` on its own `p`.** `root.scss` declares a bare
  `p { font-size: 14px }`, and an explicit declaration beats an inherited one whatever the
  specificity, so a size set on the wrapper silently does nothing to paragraphs — the `richText`
  mixin sets `p { font-size: inherit; line-height: inherit }` for exactly this reason.
- **Never collapse `<br>` with `br + br`.** The adjacent-sibling combinator ignores text nodes,
  so in `Status<br/>Console<br/>Date<br/>` every `br` counts as the next one's sibling and the
  rule hides all but the first — the activity feed once collapsed into
  `3DO Interactive MultiplayerDate: 06.09.2026Time: 5h`.
- **The emoji picker hides what the browser cannot draw, and its probe must survive canvas
  noise.** `EmojiPicker/emoji.data.ts` draws one probe emoji per Emoji version to a canvas twice,
  in red and in blue: a colour glyph ignores `fillStyle` and both renders match, while a missing
  glyph (an empty box) or a monochrome fallback follows the fill. Brave, Firefox's fingerprinting
  protection and anti-fingerprinting extensions perturb `getImageData`; a probe that counted any
  non-red pixel as colour passed every version under that noise, and users saw empty boxes for
  Emoji 14 while headless Chrome looked correct. Keep the red/blue comparison and its thresholds,
  and draw with the picker's computed `font-family` so the canvas falls back to the same emoji
  font as the buttons. Fully random or blank readback fails every probe and drops to Emoji 5 —
  fewer emoji, never boxes.

## Layout

- **Every content block on a page must sit inside the shared `Box` component from `src/lib/shared/ui/Box`** — not only large sections and cards, but small ones too: breadcrumbs, page headings, intro paragraphs, link rows. Nothing renders directly on the page background.
- The reason is `BGImage`: pages render a full-bleed background image behind their content, and only `Box`'s semi-transparent panel keeps text legible over it. Text placed straight on the page background gets washed out by whatever artwork happens to be showing, and the result differs per game/user. If a block feels too small to deserve a panel, group it with the neighbouring block into one `Box` rather than leaving it outside.
- If a `Box` instance needs a different visual appearance, do it through `Box`'s own props (`className`, `classNameContent`, `wrapperStyle`, `templateStyle`, `contentStyle`, `isWithoutBorder`, `isWithBlur`, etc.) — never by overriding `Box`'s internal styles from outside or duplicating its markup/styles in a custom wrapper.
- **A percentage `max-height` only works if every ancestor up the chain has a definite height.**
  A grid item under `align-items: center` is content-sized, and `Box` is `height: fit-content`
  at both its wrapper and template level, so `contentStyle={{ maxHeight: "100%" }}` silently
  does nothing and the panel overflows the screen. Give the cell `align-self: stretch` plus
  `min-height: 0`, and pass `wrapperStyle`/`templateStyle` with `minHeight: 0; maxHeight: 100%`
  so the constraint reaches the scrollable content.
- **A child of a scrolling `Box` that sets its own `min-height` needs `flex-shrink: 0`.**
  With `isWithScrollBar` the content is a flex column capped at `max-height: 90vh`. An explicit
  `min-height` replaces the flex item's automatic content-based minimum, so the child shrinks to
  the cap and its content spills past its box — scrolled to the end, the last row (the playthrough
  modal's Save/Delete) sits on the container's bottom padding instead of above it. The same
  happens with a fixed `height` the content can outgrow.
- **Clamping `Box`'s height is not the same as clamping its content.** `.template` is a column
  flex container; its child is the resize-observer wrapper (`.template__resizer`), which carries
  `min-height: 0` so it can shrink below its content, as does the non-scrolling content element
  (`.template__content`) inside it, and `Scrollbar`'s container gets `min-height: 0` too.
  Without them, `max-height` on `.template` shrinks only the panel's own background while the
  text keeps flowing past the rounded border — the symptom is release dates spilling out of
  the gauntlet winner panel and down the page. Do not remove those `min-height: 0`
  declarations; the scroll area's height comes from flex shrinking, not from
  the `max-height: 100%` on the content (that percentage resolves against an indefinite box and
  is ignored).
- **A `Box` stretched to fill a fixed-height container (`templateStyle={{ height: "100%" }}`)
  also needs `minHeight: 0` in `templateStyle`.** `.wrapper` is a grid, and the template's
  default `min-height: auto` sizes the grid row to its content — the title plus a scroll area
  capped at `90vh` — so whenever the container is shorter than that, the panel grows past it.
  The symptom is a scroll area that stops short: the panel's bottom corners, the last lines and
  the bottom padding sit below the screen and cannot be scrolled to (the character drawer on
  mobile). `DrawerConnector` and `WheelContainer` carry it; any new full-height panel must too.
- **A row of equal-height `Box` panels needs `height: auto`, not `height: 100%`.** An explicit
  height on a flex item cancels `align-items: stretch`, and a percentage height resolves against
  an indefinite parent and is dropped — so `height: 100%` on the item produces the opposite of
  what it reads like. `Box` ships `height: fit-content` on both `.wrapper` and `.template`, which
  cancels stretch the same way, so a column of Boxes passes `wrapperStyle={{ height: "auto" }}`
  (the flex line stretches it) _and_ `templateStyle={{ height: "100%" }}` (the wrapper now has a
  definite height to resolve against). `.template__resizer` and `.template__content` carry
  `flex-grow: 1` for the last leg; without them only the panel's background grows and
  `justify-content: space-between` inside the content does nothing.
- **A `GamesCards` grid must never leave a ragged last row: its column count has to divide the
  list's page size.** Pass the page size as `limit` (`takeHubGames`, `takeGames`, …) and the
  component snaps each width tier down to the nearest divisor — with 30 games a 4-column tier
  renders 3 columns. Without `limit` the grid falls back to `auto-fill`, which lands on any
  count that fits. The `@container` thresholds live once, in the `gamesSnappedColumns` mixin
  (`_mixins.scss`), built from `$gamesCardMinWidth`/`$gamesCardsGap`, which duplicate
  `--games-card-min-width` and `--gap-x2` because a container query cannot read a custom
  property — change one and change the other, or the grid switches tiers at the wrong width.
  A custom list's Manage mode applies the same mixin to `--sortable-grid-columns` inside its own
  `container-type` wrapper, with `getSnappedColumns` on it, so editing keeps the columns and card
  size of the normal view.

- **The `/lists` grid has the same container-query duplication as `GamesCards`.**
  `ListsPage.module.scss` copies `--list-card-min-width` and `--gap-x4` into `$listCardMinWidth` and
  `$listCardsGap` for its `@container` thresholds; change the token and the variable together, and
  keep every column count a divisor of `CUSTOM_LISTS_PAGE_SIZE` (24).

- **The profile activity feed snaps its columns to divisors of `takeLogs` (24): 1, 2, 3, 4, 6.**
  `ActivityTimeline.module.scss` copies the entry width and `--gap-x6` into
  `$activityEntryMinWidth`/`$activityGap` for its `@container` thresholds; change the page size
  and the column list together, or every page but the last ends with empty cells.

- **Form fields and buttons have one radius each, wherever they sit: `--radius-control` (`Input`,
  `Textarea`, `Dropdown`, `DatePicker`) and `--radius-button` (`Button`).** A field in the middle of
  a form shares no corner with the panel around it, so a radius derived from nesting depth only
  made a dropdown and an input stacked in one `Box`, a modal and a sheet look different from each
  other. Do not override either from a consumer.
- **Derive a radius from the parent only for an element pressed against the parent's rounded
  edge** — closer than the parent's padding, such as a full-bleed card in a `Box`, the segments of
  `Tabs` (done inside `Tabs` itself, never by its consumer). Its corner is read together with the
  parent's, so it takes the parent's radius minus the gap, rounded to the `--radius-x*` scale
  (`Box` is `--radius-x5`). Decorative radii (covers, artwork) are a style choice and exempt.

- **A rounded image tile needs the radius on the image too, and its hover ring must be an
  `outline`, not a transparent `border`.** A `border: 2px solid transparent` shrinks the
  content box, so the tile's own `background-color` shows through the border as a light kant
  along the rounded corners; `overflow` alone also leaves a seam there, because the parent's
  clip is a mask while the image keeps square corners. Use `outline: 2px solid transparent`
  with `outline-offset: -2px` (draws inside, changes no geometry) plus `border-radius: inherit`
  on the `img`. The media rails in `Slideshow` and `VideosRow` are built this way; the
  alternatives and their trade-offs are in [`docs/rounded-tiles.md`](../../docs/rounded-tiles.md),
  which also records how the rails fade their cut edges and why scroll snapping was rolled back.
- **When the tile's content is positioned, put the ring on an `::after` overlay.** `next/image`
  with `fill`, or a grid of positioned cells, paints above its container's outline, so the ring is
  hidden and shows only through the gaps — the list tile's mosaic showed four accent dots on hover
  instead of a frame. Draw it on `&::after` (`position: absolute; inset: 0; z-index: 1;
border-radius: inherit; pointer-events: none`) with the same inset outline, as `ListCard`
  and `TopFive` do.

## Server rendering and SEO

The site's value in search is its game cards, so **every change must keep page content
in the server-rendered HTML**. See [`docs/seo.md`](../../docs/seo.md) for the full picture. The rules that broke it
before:

- **Never gate content on client-only state.** A wrapper that returns `null` until a value set
  in `useEffect` arrives (viewport size, hydration flag) removes the whole subtree from the
  HTML. Render both branches and switch with CSS media queries instead.
- **Never render a list through something that measures the DOM first.** `react-virtualized`'s
  `AutoSizer` returns `null` until it has a size, so the list produces no links on the server.
- **Never call `notFound()` from `generateMetadata`.** With streaming metadata the throw is
  caught below the flushed shell and the response stays 200 (a soft 404). Wrap the lookup in
  `React.cache`, return fallback metadata there, and call `notFound()` only from the page
  component.
- **Do not add a `Suspense` boundary above a page component that can call `notFound()`** — it
  reproduces the same soft 404. Boundaries belong inside the routes that need them
  (`useSearchParams`).
- **Reading `searchParams` in a route disables its cache.** Game pages and hubs are ISR; adding
  a `searchParams` read makes them dynamic again. Note also that `export const revalidate` does
  nothing on a dynamic segment without `generateStaticParams` — the hub and game routes export
  `generateStaticParams() { return []; }` so nothing is prerendered at build time (the build must
  not depend on the API) while the route still opts into caching.
- **`router.refresh()` does not clear the ISR cache.** Game pages are cached for an hour
  (`revalidate = 3600`), and a refresh only drops the client Router Cache — the server answers
  from the same cached entry, so a game edited from the browser keeps showing the old data until
  the hour is up. Any admin mutation made in the browser must call the `revalidateGamePage`
  server action (`entities/game/api/game.actions.ts`) _before_ `router.refresh()`, or the refresh
  refills the cache with the stale render. Background jobs on the server deliberately do not
  revalidate: a mass parse would turn every touched page into a cold render.
- **Never catch inside an `unstable_cache` callback.** Next stores whatever the callback resolves
  to, so a `.catch(() => [])` inside turns a failed request into a legitimate empty result cached
  for the whole `revalidate` window — the home page's platform links disappeared for
  an hour after a single render during an API outage, with `[]` sitting in the data cache. Let the
  callback throw and fall back at the call site, as `sitemap.ts` does: a thrown error is never
  written to the cache, so the next request retries.
- **A failed fetch in `generateMetadata` must never return `robots: noindex`.** The page
  component still renders, so the response stays 200 with real content under a "Page not found"
  head, and ISR caches that mix — the symptom is `<title>Page not found | MoonCellar</title>` on
  a game page that loads perfectly for a human, invisible until someone checks the HTML. Return
  neutral metadata on failure and leave the 404 to the page component, which calls `notFound()`
  and lets Next add the `noindex` itself.
- **`fetchOrNull` maps only 404 to `null`.** A 400 from the API is a contract violation, not a
  missing record — `by-slug` answers 400 when the `slug` query param is absent, and treating that
  as "not found" noindexed the whole catalogue. A route whose 404 really does come from a
  request-shape rule must check that shape itself before calling the API: `/user/[name]` validates
  the name with `GetUserByStringSchema` (an email, or 3–15 chars of `[a-zA-Z0-9_]`) so an
  impossible username is a 404 instead of a 500.
- **An `error.tsx` never renders `NotFoundPage`.** The game, profile and list segments did, so
  an API outage showed a "404" body with an error status. Errors bubble to `src/app/error.tsx`
  (`pages/ErrorPage`); a missing record is `notFound()` in the page component.
- **Purge a poisoned ISR entry with `POST /api/revalidate`** — header `x-revalidate-secret`
  matching `REVALIDATE_SECRET`, body `{"slugs": [...]}` (max 200). `revalidatePath` inside a Route
  Handler only _marks_ the path; the re-render happens on the next visit, so request each page
  once afterwards and check its `<title>`.
- **A page-level `openGraph` or `twitter` object replaces the parent's wholesale — it does not
  merge.** A route that declares `openGraph` must restate `siteName`, `type`, `locale` and
  `images`, or it loses them. Do not put `twitter.images` in the root layout: every page without
  its own `twitter` block inherits that image, and `twitter:image` stops following the page's
  own `og:image` (game pages shipped the site banner instead of the cover).
- **Collapse long lists with CSS, never by slicing the array.** The game page carries up to 215
  keyword links; rendering only the first N drops the rest from the HTML. `ExpandableBlock`'s
  `clampHeight` prop hides the overflow with `max-height` while every link stays in the DOM —
  use it (or the `lineClamp` mixin) instead of `items.slice(0, n)`.
- **Never serve image URLs from under `/api`** — `robots.ts` disallows it, so crawlers cannot
  fetch them. The cover proxy lives at `/img/image-proxy` for exactly this reason.

- **A server fetch of anything private must forward the request's cookies.** Server-side `agent`
  calls carry no session, and `GET /lists/by-slug` answers 404 for a private list unless the viewer
  is its owner — without forwarding `cookies()` as the `Cookie` header, owners get "Page not found"
  on their own private lists while everyone else sees the correct 404.

## Server and client components

Shared UI (`Box`, `Pagination`, `Tabs`, …) and the game widgets (`GamesCards`, `GameCard`)
carry no `"use client"`
directive — those components are client-side only because they are imported from client pages.
Importing one directly into a route under `src/app/` makes Next treat it as a server component
and it fails at runtime (`useRef is not a function`). Wrap it in a small `"use client"`
component instead of adding the directive to the shared primitive.

**Plain helpers never live in a component module.** A route under `src/app/` that imports
only a function from a component file still pulls in the whole module, so the day that
component gains a hook every page fails with "You're importing a module that depends on
`useState` into a React Server Component module". `getListHref` sat in `ListCard.tsx` and
broke every route when the card got a loading state; helpers go in `shared/utils`.

**The first client render must match the server's, so never read the DOM or roll a random
number during render.** A portal target looked up with `document.getElementById` in render is
`null` on the server and present during hydration, so `ExpandMenu` rendered its portal on the
client only and failed hydration on every game page ("Hydration failed … id={null}"). Look the
connector up in `useEffect` and keep it in state, as `ExpandMenu` and `Pagination` do.
`BGImage` picked the background with `Math.random()` and mismatched `src`; it now derives the
index from the game id.

Functions cannot be passed from a server component to a client one. Pass the data a client
component needs to build the value itself (a `basePath` string, not a `getHref` callback).

## Animations

- **Keyframes added to `_animations.scss` are copied into every CSS module.** `next.config.mjs`
  injects `styles/index.scss` into each module through sass `additionalData`, and CSS Modules hash
  `@keyframes` names per file, so every shared keyframe is emitted once per module in the built
  CSS. Keep keyframes used by one component in that component's own `.module.scss`; move them to
  `_animations.scss` only when a second component needs them.
- **Nothing inside a card that can be reordered may carry an appear `animation`.** Reordering a
  keyed list moves the existing DOM nodes, and the browser restarts every CSS animation on a
  moved node — `GameCard`'s corner badges (rank, rating, status, "…") faded in again on each
  re-sort of a custom list. A `transition` does not restart on a move.
- **`Loader`'s `text-align: start` is load-bearing.** `react-spinners`' `PacmanLoader` places
  its two body halves with `position: absolute` and no `left`, so they sit at their inline static
  position; an inherited `text-align: center` (the search modal's empty state has one) pushes the
  body right while the dots keep their explicit `left`, and the dots fly past the mouth.
- **An exit animation whose end unmounts the node must never be switched off with `animation:
none`.** `useDelayedUnmount` drops the node on `animationend`; with no animation the event never
  fires and the block stays on screen forever. Inside the `reducedMotion` mixin set
  `animation-duration: var(--duration-instant)` (1ms) instead of removing the animation.
- Put the animation on the grid cell that already holds the block, never on a new wrapper around
  `Box` — an extra element between the cell and `Box` breaks the definite-height chain that the
  panel's `max-height: 100%` depends on. Animate only `opacity` and `transform`: animating height
  makes `Box`'s `useResizeDetector` fire on every frame.

## Forms

- **A field driven only by `setValue` never recomputes `formState.isValid`.** react-hook-form
  runs its validity pass when a field _registers_; `setValue` without `shouldValidate` does not,
  so a form whose fields are all `setValue`/`watch`-driven keeps the initial `isValid: false`
  after `reset()`, and a `disabled: !isValid` button stays locked on a valid form. The symptom
  was the playthrough modal's Save staying disabled for Wishlist until something was typed into
  the comment — and staying enabled after the text was erased again. Completed, Played and
  Dropped hid it because they render the registered `time` input. Wire custom inputs through
  `Controller` (as `PlaythroughModal`'s `RichEditor` and `GameEditPage`'s fields do) so the
  field registers. Hiding such a field must not unmount it: `{isShown && <Controller />}` drops
  the registration and locks the button again — keep the `Controller` rendered and hide its
  wrapper with a modifier class, as the modal does with the comment for Wishlist.
- **The shared `Button` sets no `type`, so inside a `<form>` every button without one submits
  it.** The request page's Game/Character tabs submitted the form and showed validation errors
  on every switch. Pass `type="button"` to anything that is not the submit button (`Tabs` does
  it for its own buttons), or drive the form from the submit button's `onClick` without a native
  `<form>`, as `RequestForm` does — shared controls like `Dropdown` and `DatePicker` render
  buttons of their own, and Enter in any input submits a native form too.
- **The game edit form validates and diffs `pruneEmpty(values)`, never the raw form values.**
  Every `Controller` on a nested path (`igdb.gameId`, `vndb.vnId`, `relatedGames.sequels`)
  creates that key with `undefined`, so a game without IGDB data carried `igdb: {}` and failed
  `igdb.gameId` as required — the same would block every IGDB game once the VNDB section
  exists. `characters` stays out of the form too: the update response returns them as ids,
  which fail `CharacterSchema` and lock Save after the first save.

## Data fetching

- **Never pass an array in axios `params` for a GET.** axios writes `ids: ["a"]` as `ids[]=a`, the
  API only reads `ids=a`, and the filter is silently dropped: `/admin/characters/<id>` loaded the
  first character in alphabetical order instead of the requested one. Pass a single id as a
  string, or build `key=a&key=b` by hand as `gamesApi.getByIds` does.
- **Never gate a loader on React Query's `isPending`.** A disabled query
  (`enabled: false`, e.g. `useGamesByIdsQuery`'s `ids.length > 0`) never leaves `status:
"pending"`, so `if (isPending) return <Loader />` renders forever and the empty-state branch
  below it is unreachable — that is how the profile's "List is empty" placeholder disappeared
  behind an endless spinner. Use `isLoading` (`isPending && isFetching`): it is `false` while a
  query is disabled and `true` on the first render of an enabled one, so nothing flashes before
  the loader appears.
- **Never gate a loader that replaces data on `isFetching` either.** It is also `true` during a
  background refetch, so once a query is older than its `staleTime` a remount swaps the cached
  list for the spinner — the `/games` catalogue showed a loader and refetched on every browser
  Back instead of rendering from the cache. Keep `isFetching` for secondary indicators.
- **A query whose key follows the URL gets `initialData` only for the key the server rendered.**
  React Query seeds _every_ new key with `initialData`, and within `staleTime` it never fetches
  it — changing a custom list's sort showed the server's order under the new key until a reload.
  `CustomListPage` keeps the first sort in state and passes `initialList` only while the key
  still matches it.
- **Page state of a client page that fetches through React Query goes into the URL with
  `window.history.pushState`, not `router.push`.** `router.push` re-runs the route's server
  component, and `useSearchParams` does not change until that server render finishes, so the
  client query never sees the new key in time: `/games` pagination just scrolled to the top and
  swapped the cards later with no loader, even for pages already in the cache. `pushState`
  updates `useSearchParams` immediately without a server request — `GamesPage` pagination and
  `Filters` both go through it.

## Mockups

Design proposals are built as standalone HTML in `docs/mockups/`, not as throwaway files
outside the repository, through the project skill `mockup` (`.agents/skills/mockup`), which
walks the template, the token sync, the checks and the Artifact publish in order. The full reference — palette roles, scales, what a mockup must respect
to be buildable — is [`docs/design-system.md`](../../docs/design-system.md). The rules that
break silently when ignored:

- **A mockup never restates a token.** It uses `var(--color-bg-primary)`, `var(--radius-x5)`,
  `var(--duration-fast)` directly. Copying a hex into a mockup is how a proposal ends up
  showing an accent the site stopped using six months ago, and nobody notices until it ships.
- **The token block is generated, not written.** `bun --filter web sync:tokens` reads
  `@forward "./vars/*"` out of `root.scss`, lifts each `:root` block, and injects the result
  between `/* mooncellar-tokens:start */` and `/* mooncellar-tokens:end */` in every
  `docs/mockups/*.html` plus `docs/design-tokens.css`. Edits inside those markers are
  overwritten on the next run. The flow is one-directional: SCSS is the source.
- **Start from `docs/mockups/_template.html`,** which already carries the markers, the
  `--mock-` prefix convention and the font substitution note. A file without both markers is
  reported as `no-markers` and skipped — the sync stays silent about it otherwise, so a
  hand-rolled mockup quietly stops tracking the design system.
- **Prefix anything the mockup invents with `--mock-`.** A name without the prefix came from
  the site; a name with it exists only in the proposal and is the list of things to promote
  into `vars/` if the design ships.
- **`bun --filter web check:tokens` is the same read, exit 1 when stale.** Run it after
  touching `vars/` — a token change that does not reach the mockups makes every open proposal
  wrong.
- **A mockup is named for its subject, never for a task number.** Ticket numbering lives in an
  external tracker and is meaningless to anyone reading the file a year later — `editor.html`
  with an eyebrow reading `MoonCellar · rich text editor`, not `task 7`. The filename, the
  `<title>` and the eyebrow all name the thing being designed.
- **The licensed faces cannot travel.** ApercuPro and Pentagra are local files, and a published
  mockup may only pull fonts from Google Fonts. Substitute Hanken Grotesk and say so on the
  page, or the mockup reads as a typography proposal it isn't.

## Auth

- **The auth cookies are `httpOnly` and set by the API, so only an API response can remove
  them.** `deleteCookie` writes `document.cookie`, which cannot touch an `httpOnly` cookie —
  every call on `accessMoonToken`/`refreshMoonToken` is a no-op. A session ends only through
  `POST /auth/:id/logout` or a rejected `POST /auth/refresh-token`, both of which clear the
  cookies in their response.
- **The persisted `auth` store and the cookies can disagree, so the profile trusts the viewer
  only when both do.** `/user/[name]` decodes `accessMoonToken` on the server to decide who is
  viewing, while `agent` sends `x-user-id` from the store. A browser logged out in the store but
  still carrying a live cookie got the owner's profile: `PATCH profile-time` fired on open, log
  deletion was offered, and every such request died with `400 Wrong user` from `UserIdGuard`.
  `UserProfile` accepts the server's `authUserId` only when the store's profile has the same id
  (the server render, which has no store, keeps the cookie's answer, and so does the hydration render through `useIsAuthHydrated` — a `typeof window` check there made the owner's Lists tab exist only on the server and failed hydration), and on disagreement calls
  `refreshAuth`, which either restores the session or gets the stale cookies cleared.

## Sockets

- **Nothing reachable from `shared/api` may import `socket.io-client`.** `shared/api/index.ts`
  re-exports every API module, so an import there lands in almost every client bundle.
  `comments.api.ts` reads the socket id from `shared/socket/socket-id.ts`, which has no
  dependencies; only `shared/socket/comments.socket.ts` loads the client, and only
  `useDiscussionSocket` imports that.
- **The socket opens only from a `CommentThread` someone is reading.** On a game page the thread
  mounts after the Discussion tab is first opened, so a game page nobody discusses holds no
  connection; under a news post it is `isDeferred` and neither fetches nor follows until it comes
  within 400px of the screen. Keep `useDiscussionSocket` out of `GamePage`, `GameCommunity`,
  `ArticlePage` and `ArticleComments`, or every visitor of the 10 000 game pages and of every post
  opens a socket to the API.
- **A comment thread takes a target, `{ type: "game" | "article", id }`, and every comment hook
  and query key goes through it** (`commentQueryKeys.discussion(target)`, `useCommentsQuery`, the
  comment mutations, `useDiscussionSocket`). Build request fields and socket payloads with
  `getCommentTargetFields` and compare events with `isCommentOfTarget` from
  `@mooncellar/schemas`. A post's comments live under `/articles/:id/comments` and are created
  with `articleId`, and their events carry `gameId: null`, so code written against a bare game id
  silently reads, posts and listens to nothing for a post.
- **`ReviewItem` and `CommentItem` share `CommentThread.module.scss`, which is why both live in the
  `features/comments` slice.** `GameReviews` must not import `features/game`: the "Write a review"
  modal (`PlaythroughModal`) is opened by `widgets/game/GameCommunity` through `onWriteReview`.
- **`NEXT_PUBLIC_API_URL` must stay a bare origin.** Socket.IO reads the path of the URL it is
  given as the namespace, so `https://api.mooncellar.space/v1` would ask for namespace
  `/v1/comments` and the connection fails with `Invalid namespace`. The full contract is in
  [`docs/sockets.md`](../../docs/sockets.md).
- **`/royal` and `/notifications` share the account `Manager` (`shared/socket/account.socket.ts`),
  and `socket.io-client` is loaded for it with a dynamic `import()`.** `io()` caches one manager
  per origin and keeps the first caller's options, and the API authenticates from the cookies of
  that manager's handshake — sharing it with the anonymous `/comments` socket would send no
  credentials over polling and keep a pre-login handshake after sign-in. Both namespaces must
  disconnect on sign-out, or the engine connection stays open with the old session. The dynamic import keeps the client out of guests' bundles:
  `useRoyalGames` is reached from every `GameCard`, so a static import ships it on every page.
- **Push lives in `public/worker.js`; `public/sw.js` stays the kill switch.** `sw.js` unregisters
  itself for browsers that still run an old service worker from that path. `worker.js` is
  registered on every page load from `src/app/providers.tsx` (`SERVICE_WORKER_URL`), because the
  installed app needs its offline fallback before anyone subscribes to push. Its `fetch` handler
  answers page navigations and `logo-icon.png` only (network first, the cached copy offline, so
  `offline.html` can show the logo) and caches nothing but those two; never widen it to other
  requests, since every request of the site would then go through the worker. Its
  `install` fails if `offline.html` or `logo-icon.png` is missing, and a worker that does not
  install delivers no push either — rename or move them together with `worker.js`. Subscribing
  goes through `usePushSubscription`, and `logout` calls `unsubscribePush` before the session is
  cleared.
  Keep "push" and "notification" out of the worker's file name: annoyance filter lists block
  scripts such as `push-sw.js`, and registration then fails with "An unknown error occurred when
  fetching the script" while the server answers 200.
- **`listenInstallPrompt` runs from `src/app/providers.tsx`, never from the component that shows
  the Install button.** `beforeinstallprompt` fires once, right after the page loads; a listener
  added when Settings mounts misses it and the button never appears. Read it through
  `useInstallApp`.
- **Read and change royal games only through `useRoyalGames`.** The list has two sources — the
  persisted `games` store for guests, `royal.store` (filled over `/royal`) for a signed-in user —
  and the hook picks the side and routes writes to it. Reading `useGamesStore().royalGames`
  directly shows a signed-in user the leftover guest list, and writing to it changes nothing on
  the account.

## Verification

- **Do not reason about pixels — measure them.** `bun run check:layout` drives the installed
  Chrome through `playwright-core` and reports `main.container` height against the viewport at
  three widths, failing when a page marked `mustFit` overflows. Requires a running
  `bun run start`; set `CHROME_PATH` if Chrome is not on the default channel.
- **Every route answering 404 in `next dev` while the log shows no `Compiling …` line means the
  Turbopack persistent cache is stale, not that the routes are gone.** The pages come back as the
  not-found body under a 404 status and nothing in the log mentions the cache. Delete
  `apps/web/.next/dev` and restart — the dev server rebuilds its route table from source.
- **`curl` cannot see JSON-LD or anything JS injects.** Check structured data with Google's
  Rich Results Test; a "no schema found" conclusion drawn from `curl` is a false finding.
- Before adding a helper, search for an existing one. The combined IGDB / HowLongToBeat / user
  rating is `getCombinedRating` in `@mooncellar/schemas`, wrapped as `getAverageRating` in
  `src/lib/shared/utils/rating.utils.ts`.

## Status hub

The admin-only project status site at `status.mooncellar.space` is part of this app; what it
shows and how projects upload to it is in [`docs/status-hub.md`](../../docs/status-hub.md).

- **The hub is reached by host, through the `beforeFiles` rewrites in `next.config.mjs`, never by
  a path on `mooncellar.space`.** A host starting with `status.` maps `/`, `/<a>` and `/<a>/<b>` to
  `src/app/status/...`; `src/app/status/layout.tsx` answers 404 on any other host. Links inside the
  hub are host paths (`/rooftops/plan`, `/manage`) — never `/status/...`, which the rewrites skip.
- **Every exclusion in those rewrites ends at the segment, `(?:/|$)`, never at `$`.** Next applies
  the `beforeFiles` rules one after another to the already rewritten path: with `status$` the
  two-segment rule took `/status/login` as `first = "status"`, so `/login` became
  `/status/status/login`, rendered the gated layout with `slug = "status"`, and the sign-in page
  showed the gate's loader in an endless redirect to itself.
- **`/hub-connector.zip` is a file in `public/`, so the rewrites exclude it by name** (`hub-connector\\.zip`
  in the segment list); without that the status host maps it to `/status/hub-connector.zip` and the
  "Download" on Manage projects is a 404. The file is not in git: `build` makes it first
  (`build:connector`, `scripts/build-hub-connector.ts`); in `dev` run `bun run build:connector` once.
- **`Layout` renders `StatusLayout` when `useSelectedLayoutSegment()` is `STATUS_SEGMENT`.** It
  keeps the page scroll, the connectors and `useMediaStore`, and none of the site's chrome or
  background work — the header, filters, platforms, the `/royal` and `/notifications` sockets, the
  last-online pings. Hooks of the site go in `SiteLayout`, or every hub page starts them too.
- **Access is decided on the server by `src/app/status/(gated)/layout.tsx`** with
  `GET /admin/access` and the request's cookies: 200 renders `StatusShell`, 403
  `StatusNoAccessPage`, 401 `StatusGate` (a refresh token present: refresh and `router.refresh()`;
  otherwise `/login?next=<page>`). The sign-in route sits outside `(gated)`, or it would gate itself.
  `next` carries the query too (`StatusGate` reads `location.search`): the connect link
  (`/connect?project=…&port=…&state=…`) must survive signing in, or the waiting command never hears back.
- **Signing out on the hub is a full page load: `logout(id, { href: STATUS_SIGN_IN_PATH })`.** The gate
  is a server layout shared by every hub route, and a soft `router.push` keeps it rendered: Sign out
  cleared the cookies but left "No access" (or the shell) on screen, so it looked like it did nothing.
- **The hub draws only from `@mooncellar/schemas` shapes, never from a project's own format.** A
  Decompilation block is uploaded by the project as `DecompBlockSchema`; the Plan lives in the hub and
  is read and changed through `/projects/:slug/plan` (`PlanBlockSchema` out, the plan requests in).
  A new block type is a schema, the API and `widgets/status`.
- **Panels and modals of the plan read the plan from `useProjectPlanQuery` by id, never from props.**
  `drawer.open` and `modal.open` keep the JSX they were given, so a `PlanTaskPanel` handed a task
  would keep showing its old state after Take or Mark done.

## Drawer

- **Open long content beside the page with `drawer.open(node, { title })` from
  `shared/ui/Drawer`, never with a second panel of your own.** `DrawerConnector` is mounted once
  in `Layout`, docked to the window's right edge under the header, and it is what keeps the panel
  and `ExpandMenu` from overlapping: opening the drawer clears `useExpandStore`, and any menu that
  expands closes the drawer. A hand-rolled panel on the right edge ends up on top of the
  bottom-right menus (the profile's Menu, the admin controls on game pages).
- **Every element that opens the drawer carries `data-drawer-trigger`.** The drawer closes on a
  mousedown outside it, and mousedown fires before click — without the attribute, clicking
  "Show more" on the next review closes the panel and reopens it with a slide instead of swapping
  the text in place. `ExpandableBlock mode="drawer"` sets it on its own button.
- **Size a fixed full-height panel (the drawer, `ExpandMenu`) with `100dvh`, never `100vh`.**
  On mobile `100vh` is the viewport with the browser toolbar collapsed, so the panel's bottom sits
  under the toolbar and its scroll area cannot reach the last item or the bottom padding.

## Modals

- **Modals must not push history entries.** `ModalsConnector` closes every open modal on
  `popstate`, so Back and Forward dismiss the modal _and_ still navigate. Pushing an entry per
  modal (so Back only closes it) was tried and rejected: it swallows the Back press, and keeping
  the pushed depth in sync with programmatic closes needs bookkeeping that breaks as soon as
  anything else touches history.

- **A modal's height cap is `dvh`, never plain `vh`.** A modal sits in a `position: fixed`
  container sized to the visible viewport, while mobile `vh` is the viewport with the browser
  toolbars hidden. `Box`'s scroll area was capped at `90vh`, so in mobile Brave (toolbars at the
  top and bottom) the panel stood taller than the screen, both edges were clipped, and the
  playthrough modal's Save sat below the screen even with its scroll area at the end — which
  users reported as "scroll does not work". Keep the `vh` line before the `dvh` one as the
  fallback for engines without the unit.

- **`modal.open` stores the JSX it is given, so props passed at open time never update.**
  `ModalsConnector` keeps the element in state; the component that opened it can re-render all it
  likes and the modal will not see the new values. A modal that needs a pending state owns it —
  `ConfirmModal` disables its buttons from its own `useState` while it awaits `onConfirm`, which is
  why that callback may return a promise.

- Before building a new modal that shows a title plus a list of "row" blocks (an icon/content on one side, text on the other — e.g. `GamePlaysInfo`), ask the user whether the shared `RowsModal` component (`src/lib/shared/ui/RowsModal`) should be used instead of a bespoke layout. Do not silently assume either way.

## Adult content

- **An unknown country counts as blocked everywhere except `next dev`.** `getClientGeo` and
  `GeoInit` fail closed: no client IP, a missing `GeoLite2-Country.mmdb` or a failed `/api/geo`
  all hide adult media and the "Show adult content" setting, because the blocked region
  (`GEO_BLOCK_COUNTRIES`, `RU` by default) must stay filtered even when the lookup breaks.
  Local development is exempt so the setting can be tested without the GeoIP file; a production
  build without that file hides adult content from everyone.

## Remote images

- **Every host a `next/image` loads from must be listed in `images.remotePatterns` in
  `next.config.mjs`.** An unlisted host shows no error in the UI: the image request fails and the
  `<img>` stays empty. Steam conflicts rendered no covers until `shared.akamai.steamstatic.com` was
  added. A new data source with remote images adds its host in the same change.

## Data fetching failures

- **Every failed request already shows a toast with the API's `message`**, from the response
  interceptor in `shared/api/agent.api.ts` — the API guarantees one in English for every error (the
  Errors section of `apps/api/CLAUDE.md`), so a toast that reads "Request failed with status …" is an
  API bug to fix there, not here. Never call `toast.error` for an `agent` request yourself — not in a
  mutation's `onError`, not in a `catch` around `mutateAsync`. The API's message then appears
  twice, once under the interceptor's "Error" title and once without it ("Steam import is not
  configured" stacked twice). Handle the failure without a toast — re-enable a button, keep a modal
  open (`ConfirmModal` already does when `onConfirm` rejects) — and keep `toast.error` for failures
  that never reached `agent`. Anything that makes a request the user did not ask for — a background
  refetch above all — turns a routine failure into a notification they cannot explain.
- **A request the user did not make passes `{ isSilent: true }` in its axios config.** The
  interceptor then logs the failure and toasts nothing; `agent.api.ts` declares the flag on
  `AxiosRequestConfig`. The view a post registers on open (`articlesAPI.registerView`) is one: a
  reader who only opened the page must not get an error about it.
- **A mutation that deletes a resource must not leave a query for that resource to refetch.**
  Deleting a list used to invalidate `listQueryKeys.all`, which included the `bySlug` query the open
  list page was still rendering: it refetched, got `404 List not found`, and the interceptor toasted
  it. `useDeleteListMutation` now skips that one key with a `predicate`. `removeQueries` does not
  work here — an active observer immediately recreates the query and refetches it.
- **`QueryClient` does not retry 4xx.** A 404 or a 403 is not transient, and React Query's default
  `retry: 3` turned one deletion into four requests and four toasts, spread over the 1s/2s/4s
  backoff — which is why the success toast arrived seconds later and the delete looked like it had
  failed twice first.
- **Do not return the invalidation promise from a mutation's `onSuccess`.** React Query awaits it
  before the per-call `onSuccess`, so the toast, the modal close and the navigation all wait for
  every refetch to settle.

## Text truncation

- Never write raw `-webkit-line-clamp`/`-webkit-box-orient`/`line-clamp` rules. Use the shared `lineClamp($count)` mixin from `src/lib/app/styles/_mixins.scss` (available globally, no import needed) for any multi-line text truncation, passing the desired line count.

## Date fields

- Never render a native date input (`<input type="date">`). Use the shared `DatePicker`
  (`src/lib/shared/ui/DatePicker`): the browser's own picker paints a dark calendar icon and a
  white popup that ignore the site's dark theme. `DatePicker` takes and emits ISO `yyyy-mm-dd`
  and displays `dd.mm.yyyy` through `commonUtils.formatDate`.
- Its popover renders into `#dropdown-connector` through a portal, so a field inside a modal or
  a clipped panel cannot cut it off. Parse the incoming ISO string by hand (`new Date(y, m - 1,
d)`), never `new Date("2026-09-20")` — the latter is parsed as UTC midnight and shows the
  previous day in any negative-offset timezone.

## Filters

- **The chip row that shows which filters are applied is the shared `AppliedFilters`
  (`shared/ui/AppliedFilters`); each page derives its own chips.** It renders nothing when the
  list is empty, so a page can mount it unconditionally. `/games` binds through
  `AppliedGameFilters`, which sits next to `Filters` because it is the companion of the same
  `ExpandMenu`, reads the query with `parseQueryFilters` and writes it back with
  `pushFiltersToQuery`; `/lists` builds its chips from `parseListsQuery` and pushes with
  `pushListsQuery`. Neither keeps filter state of its own — the URL is the state.
- **`selected.platforms` and `excluded.platforms` hold platform `_id`s; every other category
  holds the value that is displayed.** `Filters` feeds the platform dropdown
  `systems.map(item => item.name)` for display and `systems.map(item => item._id)` for the
  value, so anything rendering a platform filter has to map the id back through
  `useCommonStore().systems` or a raw ObjectId lands on screen.
- **Removing the last value of a category must also drop its `mode` entry.** `mode.<category>`
  carries the any/all toggle, and leaving it behind keeps a match mode in the URL for a filter
  that no longer exists — harmless to the query, but it comes back the next time that category
  is used.
- **"Clear all" keeps `sortBy`/`sortOrder`.** Sorting is not a filter, and dropping it resets
  the catalogue to its default order, which reads as the page losing the user's place.
- **`pushFiltersToQuery` replaces only the filter keys (and drops `page`); every other query
  param stays.** The custom list page keeps its own `sort`/`order` next to the catalogue filters,
  and writing the filter string over the whole query reset the list's order on every apply. A
  new filter param must be added to `FILTER_QUERY_KEYS`, or it piles up instead of being
  replaced.
- **`Filters` re-reads its draft from the URL whenever the filter part of the query changes, and
  remounts its fields with that string as the `key`.** The category `Dropdown`s
  (`initialMultiValue`) and the `RangeSelector`s (`defaultValue`) read their value only on mount,
  so "Clear all" or a chip removed on the page cleared the URL and the results while the menu kept
  showing the old selection — and the next "Filter games" put it back. The draft is replaced
  during render, not in an effect, so the remounted fields never see the old values; "Clear
  filters" and a saved filter go through `resetFields` for the same reason.
- **A page that has its own sort renders `Filters isSortHidden`.** The catalogue's "Sort by"
  writes `sortBy` with catalogue values (`total_rating`, …) that mean nothing to a list.

## Selecting several games

- **Select mode keeps the Manage drawer open by marking each selectable card with
  `EXPAND_KEEP_OPEN_ATTRIBUTE` (`data-keep-expand-open`).** `ExpandMenu` closes on any outside
  `mousedown` unless the target sits inside an element carrying that attribute, and the whole point
  of the mode is that the count, select-all and the two destinations live in that panel — without
  it, picking the first card collapses the controls you are using. `PopoverSheet` carries it for
  the same reason; anything else that wears it keeps the drawer from closing.
- **In select mode the card's `Link` is neutralised and the top-left rail is hidden.**
  `GameCard`'s `onClick` calls `preventDefault` so a pick does not navigate, and
  `wrapper_selectable` hides `card__rail_topLeft` — rank and the per-game royal crown sit exactly
  where the selection checkbox goes and mean something different while picking.
- **The selected ring is an `::after` overlay, never an `outline` on `.card`.** The cover `img`
  fills the card and paints over an outline drawn on the parent, which is the same trap the rounded
  tile rule in Layout describes.
- **Adding a selection to a list is one request per game.** `listsAPI.addGame` takes a single
  `gameId`, so `useAddListGamesMutation` awaits them in order — `position: "end"` means the order
  is the selection order — and invalidates once at the end rather than per game. Making this faster
  is a batch route on the API, not parallel requests.
- **The selection never reaches the URL.** The query string is what decides which games the page
  shows; a selection in it would turn a shared link into someone else's checkboxes. It lives in
  `games-selection.store`, which is deliberately not persisted, and turning the mode off clears it.

## Reordering

- **Every drag-and-drop reorder editor is `shared/ui/SortableGrid`** — favourite games, favourite
  characters and a custom list's Manage mode. The consumer passes the cover (`renderCover`), the
  caption (`getName`) and keeps the order in a draft that is saved only by its own Save/Done;
  never write the order on every move.
- **Set a `SortableGrid`'s columns and gap through `--sortable-grid-columns` and
  `--sortable-grid-gap` on the class you pass, never with `grid-template-columns` or `gap`.** Both rules would have the same specificity, and the order two
  CSS modules land in is not guaranteed, so the override wins in development and loses in a
  production chunk.
- **A custom list's editor removes a game on the server at once and keeps reorder strict.**
  `PATCH …/reorder` must receive exactly the list's games, so a draft that drops a game would be
  rejected, and relaxing it to a subset would let a stale draft delete games added from another
  tab — the bug favourites had. The search box is hidden while managing for the same reason.

## Custom list order

- **`by-slug` returns a list's games in the requested order, so neither a rank nor Manage mode
  may read the array index — both use each game's `position`.** With the index, sorting a ranked
  list by name renumbered it 1…n in alphabetical order, and pressing Done in Manage mode would
  have saved the sorted order as the list's own.
- **The order a visitor picks lives only in the URL (`sort`, `order`); the owner's default is
  `sortBy`/`sortOrder` on the list.** The page drops both params when the pick equals the default,
  so a shared link keeps following the owner's setting. The sort is part of the `bySlug` query key,
  which is why deleting a list excludes every key under the slug by prefix.
- **Sorting by rating uses `getCombinedRating` from `@mooncellar/schemas`, the number the card
  shows.** The server sorts, because the page loads only 30 of up to 500 games; a separate formula
  on either side would sort by a number nobody sees.

## Tables

- **Every table is the shared `Table` (`shared/ui/Table`) — never a hand-written `<table>`.** It
  is what gives admin lists resizable columns, header sorting, the mobile card layout
  (`mobileHeadField`) and the shared loader and empty state; the characters list was a raw
  `<table>` and silently had none of them. Size columns through `columnStyles` (`width` becomes
  the flex basis, add a `minWidth`) so one long column cannot squeeze the others' headers.
- **A row that opens a page is clickable as a whole; do not add an "Open"/"Edit" button column.**
  Pass `onRowClick(rowIndex)` to `Table` and list the interactive columns in
  `rowClickExcludeKeys` (roles dropdown, toggles, the actions menu); the index is the row's
  position in the `rows` you passed, even after the table sorts. Destructive actions such as
  Delete stay in the actions menu.
- **A table whose cells must line up across a row uses `layout="rows"`.** The default layout
  renders each column as its own flex column, so cells of different heights (URL lists, related
  games, hints) drift apart; `rows` is one CSS grid with `display: contents` rows. The request
  field diff (`RequestReviewPanel`) uses it with `isWithoutSorting`, a visually hidden "Apply"
  header and `getRowClassName` for the skipped (dimmed) rows.

## Tabs

- **Every row of mutually exclusive switches is the shared `Tabs`** (`shared/ui/Tabs`) — never a
  hand-rolled row of buttons. `SortToggle` was exactly that duplicate and is gone; its pill look
  is now `theme="segmented"` on `Tabs`, with the button half living as `ButtonColor.SEGMENTED`.
- **`theme="segmented"` is the compact pill switcher** used for sorting and status filters
  (comments Top/New, reviews sort, the admin report status). The default `fancy` theme stays for
  full-width page tabs. Pass `ariaLabel` with it: the theme sets `role="group"` and
  `aria-pressed` on the buttons, and without a label the group is unnamed for a screen reader.
- **The segmented modifier has to out-specify the base tab rules.**
  `.tabs__buttons_segmented .tabs__button` restores the radius and cancels the `flex: 1` and
  `margin-left: -1px` that make the default tabs a joined strip; a single-class modifier loses to
  `.tabs__button` and the pills render as one welded bar.

## Dropdowns

- **`Dropdown`'s wrapper carries `min-width: 170px`, so two of them never fit side by side on a
  phone.** The profile's rating filter (`From`/`To`) ran off the screen edge until its row gave the
  wrappers `flex: 1 1 0; min-width: 0` — a child selector from the parent module beats
  `.wrapper`'s own rule, so override it there instead of lowering the shared minimum.
- **`Dropdown` renders its list inline unless it gets `isThroughPortal`.** Unlike `DatePicker`,
  the portal is opt-in: without the prop the list is an absolutely positioned child of the field,
  so any ancestor with `overflow` — a modal's scroll area, a `Box` with `isWithScrollBar`, a
  compact panel — cuts it off. The playthrough modal's category list was clipped in the compact
  Wishlist layout for exactly this reason. Pass `isThroughPortal` for every dropdown inside a
  modal or a scrollable panel; the portal list follows the field on scroll and resize, and
  `#dropdown-connector` sits after `ModalsConnector` in `Layout`, so it stays above the modal.

## Scrolling

- **The page is not the document. Everything scrolls `#page-scroll`** — the `Scrollbar` that
  `Layout` wraps around `main` (`PAGE_SCROLL_ID` in `shared/utils/common.utils`), while `html` and
  `body` carry `overflow: hidden`. Anything that reads, moves or freezes page scroll targets that
  container, never `window`/`document.body`: `scrollPageToTop` and `useDisableScroll` both look it
  up by id, and a `window.scrollY` read is always 0.
- **Never size that container in `vh`.** `100vh` is the _large_ viewport on mobile — the height
  with the URL bar retracted — while `html`/`body` at `height: 100%` are the visible one, so a
  `max-height: 100vh` scroller stood taller than `body` by the URL-bar height. The document then
  grew a second, parasitic scroll of those few dozen pixels: a full-height native scrollbar that
  `root.scss`'s `* { scrollbar-width: none }` does not reliably hide on every Chromium (it showed
  in Berry), and a page that swiped away under every `position: fixed` modal. The chain is
  `html`/`body` `height: 100%` → `.layout` flex column `height: 100%` → the scroll container
  `flex: 1 1 auto; min-height: 0` → content `max-height: 100%`. It is percentages the whole way
  down on purpose; `dvh` would fix the same bug only on engines new enough to know the unit.
- **`.layout` is what holds that chain, not `.root`/`#__next`.** Those selectors match nothing under
  the App Router — `app/layout.tsx` renders `body` → `QueryProvider` (no DOM node) → `Layout` — and
  the `reset.scss` rule that used to size them was dead, which is why the height chain broke and a
  `vh` value was reached for in the first place.
- **Modals freeze the page from `ModalsConnector`, once, through `useDisableScroll(!!content.length)`.**
  The hook counts locks in a module-level counter, so closing the top of a stack does not hand
  scrolling back while a modal underneath is still open. Do not call it from an individual modal.
- **Never put `overscroll-behavior: contain` on a panel inside the page.** The ancestor it refuses
  to chain to is `#page-scroll`, so the wheel over that panel stops moving the page entirely once
  the panel hits its end — the game page's Summary and Storyline are 132px tall and sit mid-page,
  and they froze the whole site under the cursor. `Scrollbar` deliberately leaves the property
  unset.
- **`Scrollbar`'s `fadeType` is not a fade on a vertical scroll area.** The transparent mask is
  applied only with `isHorizontal` and `isWithArrows`. On a vertical area `fadeType` renders
  gradient overlays at the chosen edges, shown while more content lies past that edge, painted
  from transparent to a solid `--color-bg-primary` — on a translucent `Box` or any other
  background they read as a dark band, not a fade (`Box`, `Dropdown`, `EmojiPicker` and
  `GamesCards` pass it). A vertical scroll with fading edges is `ExpandableBlock mode="scroll"`,
  which measures the scroll position itself and drives the mask from its own classes.
- Never rely on the browser's default/native scrollbar for a scrollable area. Use the shared `Scrollbar` component from `src/lib/shared/ui/Scrollbar` for any element that needs to scroll (vertically or horizontally via the `isHorizontal` prop).
- **Measure the scrollbar track with `offsetWidth`/`offsetHeight`, never `clientWidth`/`clientHeight`.**
  The track carries a 1px border, and the client box excludes it — sizing the thumb from the
  client box leaves it short of the track end by exactly the border width on both axes. The
  thumb's position is a plain proportion: `scrolled / (scrollSize - clientSize)` mapped onto
  `trackSize - thumbSize`, so it reaches both ends exactly.

## Icons

- Do not use the `Icon` component from `@iconify/react` (or any other icon library component).
- Use SVG components from `src/lib/shared/ui/svg` instead. If the needed icon doesn't exist there yet, add a new `Svg*` component to that folder (following the existing components' pattern) and export it from `src/lib/shared/ui/svg/index.ts`.
- New `Svg*` components must be built with the shared `Svg` and `Path` components from `src/lib/shared/ui/svg/Svg/Svg.tsx` — do not write raw `<svg>`/`<path>` tags.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
<!-- END:nextjs-agent-rules -->
