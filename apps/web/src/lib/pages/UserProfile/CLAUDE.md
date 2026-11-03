# UserProfile

A user's public profile: info and activity, games by status, lists, liked lists, favourite
games and characters, reviews, and — for the owner only — settings. Public; the owner gets
editing controls.

## Routes

- `/user/[name]` and `/user/[name]/<tab>` — the page is rendered by the layout
  `src/app/user/[name]/(profile)/layout.tsx`; the child routes return `null` and only shape
  metadata and status:
  - `(profile)/page.tsx` — the Profile tab. It `permanentRedirect`s the legacy
    `?list=<tab>` to `/user/<name>/<tab>`, keeping the other params.
  - `(profile)/[tab]/page.tsx` — `notFound()` for a tab outside `profileTabs`; metadata
    `<Tab label>: <name>`, canonical per tab and `noindex, follow` on every tab (`follow: false`
    for `settings`).
  - `(profile)/favourites/[kind]/page.tsx` — `favourites/games` and `favourites/characters`, the
    only two-segment tabs; same metadata through `getProfileTabMetadata`. The layout reads the
    tab with `useSelectedLayoutSegments()` joined by `/`, since a single segment would read
    "favourites" for both.
  - The former `/favorites`, `/characters` and a bare `/favourites` (and `?list=` with those
    names) `permanentRedirect` through `legacyProfileTabs`. They were public URLs; drop an entry
    only once nothing links to it.
- **User-facing text and URLs spell it "favourite(s)".** Code identifiers, the `user.favorites`
  field and the API routes keep `favorites`; renaming those is a data migration, not a copy fix.
- Dynamic (cookies). `getProfileUser` (`profile.data.ts`) is `React.cache`d: it validates the
  name with `GetUserByStringSchema` before calling `userAPI.getByString` through `fetchOrNull`,
  so an impossible username is a 404, not a 500.
- Layout metadata: `Profile: <name>` (with its own `%s | MoonCellar` template for the tabs),
  description from the user's bio, keywords, canonical `/user/<name>`; "Page not found" +
  `noindex` when the user is missing (404), a neutral `{ title: "Profile" }` when the lookup
  fails for any other reason. The tab route's metadata returns `{}` on the same failure.
  `notFound()` is called from the layout component.
- There is no segment `error.tsx`: an API failure bubbles to `src/app/error.tsx`, which renders
  `ErrorPage`. A boundary that rendered `NotFoundPage` answered an outage with a 404 body.

## Data

- Server (layout), in two parallel batches: decode `accessMoonToken` → `authUserId`; the
  viewer's followings together with the profile user; then playthroughs, ratings, followings and followers of that user; favourite games
  (`gamesApi.getByIds`, kept in `favorites` order), public lists, liked lists and favourite
  characters (these four fall back to `[]`).
- Client: `useAuthStore().profile`, `useIsAuthHydrated`, `usePlaythroughsStore` (filled with
  the server's playthroughs for the owner so edits show up immediately). Tab widgets fetch
  their own data.
- The tab is the path segment, read with `useSelectedLayoutSegment()` (`null` → `profile`).
  `UserNavigation` renders each tab as a link (`Button href={getProfileHref(name, tab)}`) — a
  real route change, since each tab is its own route, and crawlable; its `onClick` only closes
  the mobile `ExpandMenu`. Sort state for games and reviews is local `useState`.

## Composition

1. `BGImage` with the user's background (the store's copy for the owner).
2. Mobile only: `UserNavigationMenu` (`features/user/ui/UserNavigation`) — the shared icon-only burger `ExpandMenu`, bottom-right, holding `UserNavigation`. A custom list page uses the same component; never inline a copy.
3. `Box`: `Breadcrumbs` on every tab except Profile, then the tab:
   - `profile` → `widgets/user/UserInfo`. Its `ports` block is `widgets/user/UserPortAchievements`
     with `isPreview`: the MoonCellar Team ports the user has achievements in, Steam-style — each
     port's site game card (its `siteGame`) in a three-row subgrid with a `Badge` "unlocked /
     total" ("Mastered" when complete) and "% · last unlock date", at most two rows, and "All"
     leading to the `mooncellar` tab. Hidden while the user has none
   - `mooncellar` (`PORTS_TAB`) → the same widget in full: every port from the game service
     (`GET /achievements/players/:userId`, then each port's
     `/games/:game/achievements/players/:userId`), each as the game card, "unlocked of total · %",
     a progress bar, the last unlock date and every achievement's icon, muted until unlocked, with
     its texts in a `Tooltip` (`UserPortGame`). The navigation shows its MoonCellar entry only
     when the user has port achievements
   - `all` and each status → `widgets/user/UserGames`. It is one Games page: a `Tabs` row
     (`isFit` in a horizontal `Scrollbar`) of All, Playing … Dropped with their game counts sits
     on top, each tab a `tabLink` to its route, so the URL is the selected tab. Below `$screenMd` it
     is a `TabsMenu` selector titled "Games" (`mobileMenuTitle`), as in the admin; above it, a row
     too wide for the panel scrolls the selected tab into view. The navigation has a single Games entry, active on
     all of these routes, that opens Playing (so does Games in the header's account menu); the
     Profile tab's Games counter opens All. Status categories are never rows of the navigation
   - `lists` / `liked` → `widgets/user/UserLists` (`kind="liked"`)
   - `favourites/games` → `widgets/user/FavoriteGames`; `favourites/characters` →
     `FavoriteCharacters`. They are one Favourites page: both routes render a `Tabs` row
     (Games / Characters) whose tabs are `tabLink`s to the two routes, so the URL is the selected
     tab and "All" on the Profile tab opens the right one. The navigation has a single Favourites
     entry, active on both, counting both lists.
   - `reviews` → `widgets/user/UserReviews`
   - `steam` → `widgets/user/UserSteamGames`: every game of the linked Steam library that is in
     the catalogue, from `POST /steam/library` (`useSteamLibraryQuery`), each captioned "Mastered"
     with its date, "unlocked / total" with the percentage, or a muted "0 / total" or "No
     achievements", and always its playtime. Each `li` is a three-row subgrid (card, badge, text)
     so the cards of a row line up whatever their captions hold. Default order
     is Achievements (mastered newest first, then by completion, games without achievements last);
     `SortControl` also offers Playtime, Last played, Name, Release date and Rating, and the left "Filters"
     menu takes the catalogue filters. Sort (`sort`, `order`) and filters live in the URL, written
     with `pushState`; a change of either returns to page 1. The navigation shows the tab only for
     a linked Steam account; the Profile tab shows the same widget as a two-row preview in the
     default order (`steam` block). The whole flow is in `docs/steam.md`.
   - `activity` → `features/user/ui/ActivityTimeline`, the whole feed with pagination
     (`takeLogs` per page). The Profile tab shows the same component with `isPreview`: the first
     12 entries, no pagination, and "All" leading here.
   - `retroachievements` → `widgets/user/UserRaGames`: every catalogue game the user has an RA
     award for, from `GET /user/ra/:userId/games`, each card captioned with its best RA status
     (Mastered, Completed, Beaten, Beaten (softcore)) and the award date, sorted by that status
     and, within it, newest award first (`getUserGames` on the API). The navigation shows the
     tab only when the user has an `raUsername`. Both achievement tabs page with the fixed
     `Pagination`, 48 games at a time on Steam and 24 on RetroAchievements (both fill whole rows
     at 6, 4, 3 and 2 columns); the Steam tab loads game cards for the current page only.
   - `settings` → `features/user/ui/Settings`, owner only: one column of `CollapsibleSection`s,
     Account always open (`isStatic`) and every other section collapsed until clicked; Steam is
     `isKeptMounted` because `SteamAccount` finishes the Steam sign-in on mount and must run while
     its section is closed. "Game devices" (`features/user/ui/GameDevices`) lists the game ports signed in through `/link` (`GET /auth/game/sessions`) and signs one out with `DELETE /auth/game/sessions/:id`. Its "Danger zone" opens `features/user/ui/DeleteAccountModal`, which asks for the password, calls `DELETE /user/account/:userId`, clears the auth store and the React Query cache and goes home; its "App" section installs the PWA through `useInstallApp` (the browser's install prompt where there is one, menu instructions otherwise) and links the APK releases
4. Desktop column: `features/user/ui/UserNavigation` (tabs and counts; sorting lives in `UserGames` and `UserReviews`, above their content).
   Its first block — avatar and name, linking to Profile and active there — is shown on every
   tab. The second holds every other entry, Games first, then Reviews, Favourites,
   RetroAchievements, Steam, MoonCellar, Lists, Liked lists and Activity. Settings is not a tab in it: the owner reaches it from the gear icon at the right of
   that block, and from the account menu in the header.

## Loading state

- `UserProfileSkeleton` (`UserProfileSkeleton.tsx`) is the `Suspense` fallback of the layout. It
  draws the page's own frame — `.container`, the content `Box` and the navigation column — and
  fills it from the components' skeletons: `UserNavigationSkeleton` for the column, and on the
  Profile tab `UserInfoSkeleton` (banner, avatar, name, `StatTile isLoading` counters, a card row
  and `ActivityTimelineSkeleton`). Other tabs get a breadcrumb line and a panel; their widgets
  show their own skeletons once the page mounts.
- **The fallback is on screen only while the page's client chunk loads, not while the layout
  fetches.** The layout awaits its data before it returns the `Suspense`, and no `loading.tsx` may
  sit above it: the layout calls `notFound()`, and a boundary above that answers a missing user
  with a soft 200.
- **A change to the hero, the counters or the navigation's rows changes their skeleton too.**
  Each skeleton is built on its component's classes, so sizes follow automatically, but a new
  block or row only appears in the placeholder when it is added there.

## Rules and gotchas

- **The owner hides Profile-tab blocks in Settings → Profile page, stored as
  `settings.hiddenProfileBlocks` (`ProfileBlockSchema`).** `UserInfo` drops a hidden block for every
  viewer, the owner included; the block's own tab stays reachable. A new Profile-tab block gets an
  entry in `ProfileBlockSchema` and `PROFILE_BLOCK_LABELS`, or it cannot be hidden. The activity
  preview takes 12 entries because that fills whole rows at every column count the feed snaps to
  (divisors of `takeLogs`).

- **Every card block on the Profile tab shows at most two whole rows, never a fixed number of
  cards** — favourite games, favourite characters, RetroAchievements, MoonCellar Team ports, lists
  and liked lists; the activity feed is the exception and keeps its 12 entries. `useGridRows` (`shared/hooks`) reads the
  grid's column count and hides the cards past the second row (they stay in the HTML), so a
  block shows 12, 8, 6 or 4 cards depending on the width; `ListCardsGrid` takes it as `maxRows`.
  A block renders a cap (12 games, 20 characters, 12 lists) so the first paint is not a full list.
  Favourite games, RetroAchievements and the ports use fixed columns: 6, 4 up to `$screenLaptop` (1250px),
  3 up to `mediaLg`, 2 up to `mediaSm`. Never write "the first N" in copy: N depends on the screen.

- **Trust the cookie's `authUserId` only when the store's profile has the same id.** A browser
  logged out in the store but holding a live cookie got owner controls, and every owner request
  failed with `400 Wrong user`. On disagreement the page calls `refreshAuth`.
- **Use `useIsAuthHydrated`, never `typeof window`, to keep the cookie's answer during
  hydration.** The first client render must equal the server's; a `typeof window` check made the
  owner's Lists tab exist only on the server and failed hydration.
- **Never gate a loader on `isPending`.** A disabled `useGamesByIdsQuery` stays pending forever,
  which once hid the "List is empty" placeholder behind an endless spinner.
- **The activity feed's columns are divisors of `takeLogs` (24).** `ActivityTimeline.module.scss`
  duplicates the entry width and `--gap-x6` for its container queries; change them together.
- **Two `Dropdown`s side by side need `flex: 1 1 0; min-width: 0` from the parent module** —
  `Dropdown`'s 170px minimum pushed the rating filter off a phone screen.
- **Open long content (reviews, comments) in the shared drawer**, never a panel of your own; the
  drawer is what keeps it off the bottom-right Menu.
- `PATCH profile-time` (`userAPI.updateUserTime`) fires only when the viewer is the owner.
- **Every profile tab is `noindex, follow`; `/user/<name>` is the only indexable URL of a user.**
  A tab is a filtered view of the same person — the same games, lists and reviews behind the same
  name — so it carries nothing the profile does not already answer, and indexing it puts a dozen
  thin, near-identical URLs per account in front of Google while the sitemap lists no profile at
  all. It is `noindex` rather than a canonical to the profile because it is not a duplicate: it
  holds a different list, and a canonical would point at a page that does not contain it. `follow`
  stays on, so the links a tab renders stay crawlable; `settings` is the owner's own page and is
  `noindex, nofollow`. Every tab gets this from `getProfileTabMetadata` (`profile.data.ts`), so a
  new tab route must not set `robots` of its own, and a failed user lookup there still returns
  `{}` rather than `noindex` (a 200 page must not be headlined as a 404).
