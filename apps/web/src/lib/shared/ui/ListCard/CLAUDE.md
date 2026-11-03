# ListCard

A link card for a custom game list: a 2x2 mosaic of the first covers, the name (with a lock for
private lists), the author, the game count, the last update and the like count. It renders as a
`tile` for grids or a compact `row` for search results and sidebars. The folder also exports
`ListMosaic`, the cover mosaic on its own.

## When to use

- Anywhere a custom list is shown as a link: `/lists`, the profile's lists, `UserInfo`, the
  search modal.
- `ListMosaic` alone where a list is shown without its text, such as the cover of each slot in
  the profile's list reorder grid (`UserLists` → `SortableGrid`).

## API

`ListCard`:

| Prop           | Type              | Default  | Purpose                                                                                                                            |
| -------------- | ----------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `list`         | `ICustomList`     | required | The list (`name`, `description`, `covers`, `gamesCount`, `likesCount`, `author`, `isPrivate`, `updatedAt`, slug data for the href) |
| `layout`       | `"tile" \| "row"` | `"tile"` | Grid tile or compact row                                                                                                           |
| `query`        | `string`          | –        | Highlights matches in the name; when only the description matches, the description is shown with the match highlighted             |
| `isWithAuthor` | `boolean`         | `true`   | Shows `author.userName` (hide it on the author's own profile)                                                                      |
| `isWithDate`   | `boolean`         | `true`   | Adds the human-readable `updatedAt` to the meta line                                                                               |
| `className`    | `string`          | –        | Class on the link                                                                                                                  |
| `onClick`      | `() => void`      | –        | Click handler on the link (closing the search modal)                                                                               |

`ListMosaic`: `covers: string[]`, `className?: string`, `sizes?: string` (default `"120px"`).
Always renders four cells; missing covers become empty cells.

`ListCardSkeleton`: `layout?: "tile" | "row"` (default `"tile"`). The loading placeholder of a
card, built on the card's own `tile`/`row` classes so it takes exactly the card's size in any grid.
Render as many as the page will hold — `CUSTOM_LISTS_PAGE_SIZE` on `/lists` — inside
`ListCardsGrid isLoading`.

## Usage

```tsx
import { ListCard } from "@/src/lib/shared/ui/ListCard";

<div className={styles.grid}>
  {lists.map((list) => (
    <ListCard key={list._id} list={list} />
  ))}
</div>

<ListCard list={list} layout="row" query={search} onClick={closeModal} />
```

## Rules and gotchas

- The href comes from `getListHref` in `shared/utils/links.utils`. Never move such a helper back
  into the component file: a route that imports only the helper pulls in the whole module, and
  once the card had a hook every route failed as a server component.
- A generated list (`list.isGenerated`) links to `/collections/<slug>`, a player's list to
  `/user/<name>/lists/<slug>`. The branch lives in `getListHref`, so this card, the search modal
  and the profile all point at the collection page without a second card.
- The `/lists` grid's column counts must divide `CUSTOM_LISTS_PAGE_SIZE` (24), and its
  `@container` thresholds copy `--list-card-min-width`/`--gap-x4`; change both together.
- The tile's hover ring is drawn on an `::after` overlay because the `fill` images paint above an
  outline on the parent. Keep it there if the hover style changes.
- The whole card is one `Link`; do not nest another link or a button inside it.
- **A loading list grid is `ListCardSkeleton`s, never a spinner.** The skeleton shares the card's
  classes, so a change to the tile's layout reaches the placeholder too; keep the two in one file.

## Storybook

`Shared/ListCard`: Tile, TilePrivateNoLikes, Row, RowDescriptionMatch, EmptyList, Mosaic,
TileSkeleton, RowSkeleton.
