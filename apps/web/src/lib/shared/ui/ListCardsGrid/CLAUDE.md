# ListCardsGrid

Responsive grid for custom-list tiles (`ListCard`). It fits as many columns of at least
`--list-card-min-width` (180px, the size of a game card) as its own width allows, and never fewer
than two, so a tile is the same size in the profile's narrow column and on the wide `/lists` page.
`isDense` is the one deliberate exception: eight columns for a single row in a full-width panel.

## When to use

- Any grid of `ListCard`s: the profile's lists, the lists block on `UserInfo`, the `/lists`
  page.
- `isDense` where the grid holds one row of at most eight cards across the page, as the lists
  panel of a game page does. Not for paged catalogues: the cards are smaller than
  `--list-card-min-width`, which is a compromise only a single row can afford.
- For game covers use `GamesCards`, which snaps its columns to the page size.

## API

| Prop         | Type        | Default | Purpose                                                                                                                     |
| ------------ | ----------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `children`   | `ReactNode` | —       | The tiles                                                                                                                   |
| `maxRows`    | `number`    | —       | Shows only that many whole rows at the current column count; the rest stay in the DOM, `hidden` (a profile preview shows 2) |
| `isGameSized`| `boolean`   | —       | Six columns, snapping by container width, for a grid of game covers rather than lists                                       |
| `isDense`    | `boolean`   | —       | Eight columns wide, four from 1250px of grid, two below 768px — one row of up to eight cards                                |
| `isLoading`  | `boolean`   | —       | Marks the grid as a loading `status`; pass `ListCardSkeleton`s as the children                                              |
| `className`  | `string`    | —       | Extra class on the outer wrapper                                                                                            |

## Usage

```tsx
import { ListCardsGrid } from "@/src/lib/shared/ui/ListCardsGrid";
import { ListCard } from "@/src/lib/shared/ui/ListCard";

<ListCardsGrid>
  {lists.map((list) => (
    <ListCard key={list._id} list={list} />
  ))}
</ListCardsGrid>;

<ListCardsGrid isDense>
  {lists.map((list) => (
    <ListCard
      key={list._id}
      list={list}
      authorLabel={list.isGenerated ? "Collection" : undefined}
    />
  ))}
</ListCardsGrid>;
```

## Rules and gotchas

- **The column count follows the grid's width, not the viewport**, through `auto-fill` and
  `--list-card-min-width`. Breakpoints on the container width made the profile's lists tab three
  columns wide while `/lists` had six, so the same tile was half again as large on the profile.
- **The minimum is `min(--list-card-min-width, half the row)`,** which keeps two columns on a
  phone, where two 180px tiles do not fit.
- **`isDense` fixes 8 → 4 → 2 and ignores `--list-card-min-width` on purpose.** The counts divide
  the eight lists the game page fetches, so the row never ends ragged; at the page's 1360px a
  card is about 150px wide, below the token's 180, which is why this variant belongs on one row
  and nowhere else.
- **`isDense` turns the wrapper into a `container-type: inline-size` container** and the tiers are
  `@container` queries, not media queries, so the grid snaps to the space it is given. Do not add
  a media-query breakpoint for the same job: a narrow parent would then keep eight columns.
- **`isDense` and `isGameSized` are alternatives.** Passing both leaves the column count to the
  order of the two rules in the module.
- The column count is not fixed, so a paged list can end in a short last row; that is expected.

## Storybook

`Shared/ListCardsGrid` — `Default`, `FewItems`, `TwoRows`, `GameSized`, `Dense`, `Loading`.
