# ProjectsMenu

The hub's only navigation: the project column of every `status.mooncellar.space` page.

## Composition

- `ProjectsMenu` renders the sections, the rows and the phone `Dropdown`, and decides which project
  is current from the route segment.
- `ProjectsMenuRow` is one project: the link (freshness dot and name), the favourite star and the
  summary card as a `Tooltip` on the link.
- `ProjectSummaryCard` is the card's content — the blocks, their progress and the age of the last
  upload.
- `useHubMenuPrefs` keeps the reader's favourites and folded groups in `localStorage`.

## Rules

- **A starred project is listed once.** It moves out of its group into the Favourites section, so a
  menu that showed it twice would be the bug, not a feature.
- **Sections are: Favourites, the named groups alphabetically, then the projects without a group.**
  A single untitled rest is captioned "Projects"; a section with a title and a chevron folds, and the
  count beside it is its projects, not the star's.
- **The row is 24px and carries no progress.** The block icons, the numbers and the age of the last
  upload live in the card that opens on hover or keyboard focus (`Tooltip`, `position="right"`), so
  the row keeps only the name, the freshness dot and — on hover, focus or when set — the star.
- **The freshness dot and the card's "Updated" line read the same rule** (`isStaleUpload`, 24 hours):
  green/yellow/grey in the dot, muted/yellow in the card. Change one and change the other.
- **Never read `localStorage` during render.** The prefs hook reads after mount, so the server render
  is the plain list and hydration never disagrees with it; a folded group and a favourite therefore
  appear one frame later, which is the price of a menu that renders on the server at all.
- **The phone menu is the shared `Dropdown` and keeps the same order** (favourites first) — it has
  no groups and no card, and it is not a second implementation of the menu.
- The group itself is edited in Manage projects (`ProjectSchema.group`), never from the menu.

## Not here

- Which progress a block reports (`getProjectSummary`, `getProjectUpload`, `formatPercent`) lives in
  `entities/project/model`; the card only formats the lines.
