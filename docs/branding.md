# Branding

How MoonCellar looks and sounds wherever it appears: the site, the documentation, Storybook,
social previews and anything built next. The rules here are short on purpose — the brand is a
small set of files, colours and words, and it stays recognisable only if every surface uses
the same ones.

## Name

- Write the product name as **MoonCellar** — one word, capital M and capital C — in every
  sentence, title, label, `alt` text and metadata.
- The wordmark image is drawn as "Mooncellar". That is lettering, not spelling: never type the
  name that way.
- The domain is `mooncellar.space`. Page titles follow the template `%s | MoonCellar`; the
  default title is **MoonCellar — Game Tracker & Database**.
- Feature names are proper nouns and keep their capital: the **Gauntlet**, **Favourite games**,
  **Lists**.

## Logos

Three images, each with one job. The originals live in `apps/web/public/images`; the
documentation site serves copies from `docs/public/images` (see the root `CLAUDE.md`).

| Mark                                                              | File            | Use it for                                                                                                    |
| ----------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------- |
| <img src="/images/logo-icon.png" alt="Moon mark" width="56" />    | `logo-icon.png` | Favicon and any small square slot: browser tab, app icon, avatar placeholder.                                 |
| <img src="/images/logo-text.png" alt="Wordmark" width="180" />    | `logo-text.png` | Header and navigation bars, sized by height. Never followed by the name typed as text.                        |
| <img src="/images/logo-full.png" alt="Full logo" width="180" />   | `logo-full.png` | Hero or banner of a home or landing page — the documentation home, a splash, a launch post.                   |

Each has a `-black` variant (`logo-icon-black.png`, `logo-text-black.png`,
`logo-full-black.png`) for light backgrounds. The default variants are for dark backgrounds,
which is every MoonCellar surface today.

<p>
  <img src="/images/logo-full-black.png" alt="Full logo, black variant" width="220" style="background:#eaeaea;padding:16px;border-radius:12px" />
</p>

Do not:

- recolour, outline, add shadows or glows, or put the mark inside another shape;
- stretch or squash it — scale by one dimension and keep the aspect ratio;
- rebuild the wordmark in a font, or pair the wordmark with the name typed next to it;
- place the default (light) variant on a light background, or a `-black` one on a dark one;
- crowd it: leave clear space of at least the height of the wordmark's "o" around the mark.

## Colours

The palette is defined once, in `apps/web/src/lib/app/styles/vars/_colors.scss`, and exported
to `docs/design-tokens.css` by `bun --filter web sync:tokens`. Code always uses the token
(`var(--color-accent)`), never the hex; the hex values below are for reference and for tools
that cannot read CSS variables (Storybook's manager theme, image editors).

### Brand

| Swatch                                                                                                  | Token            | Hex       | Role                                                       |
| ------------------------------------------------------------------------------------------------------- | ---------------- | --------- | ---------------------------------------------------------- |
| <span style="display:inline-block;width:32px;height:20px;border-radius:4px;background:#6951ee"></span> | `--color-accent` | `#6951ee` | The MoonCellar violet: primary actions, active states, links, the moon's crescent. |

### Surfaces

| Swatch                                                                                                  | Token                  | Hex       | Role                                                     |
| ------------------------------------------------------------------------------------------------------- | ---------------------- | --------- | -------------------------------------------------------- |
| <span style="display:inline-block;width:32px;height:20px;border-radius:4px;background:#191d24"></span> | `--color-bg-primary`   | `#191d24` | Page background, inputs and fields.                      |
| <span style="display:inline-block;width:32px;height:20px;border-radius:4px;background:#212731"></span> | `--color-bg-secondary` | `#212731` | Panels (`Box`), the surface most components sit on.      |
| <span style="display:inline-block;width:32px;height:20px;border-radius:4px;background:#2c3340"></span> | `--color-bg-tertiary`  | `#2c3340` | Raised elements inside a panel: cards, rows, chips.      |
| <span style="display:inline-block;width:32px;height:20px;border-radius:4px;background:#374151"></span> | `--color-bg-hover`     | `#374151` | Hover and selected backgrounds.                          |

### Text

| Swatch                                                                                                  | Token                    | Hex       | Role                                       |
| ------------------------------------------------------------------------------------------------------- | ------------------------ | --------- | ------------------------------------------ |
| <span style="display:inline-block;width:32px;height:20px;border-radius:4px;background:#ffffff"></span> | `--color-text-primary`   | `#ffffff` | Headings and main copy.                    |
| <span style="display:inline-block;width:32px;height:20px;border-radius:4px;background:#d9d9d9"></span> | `--color-text-secondary` | `#d9d9d9` | Body text, intro paragraphs.               |
| <span style="display:inline-block;width:32px;height:20px;border-radius:4px;background:#b0b2bc"></span> | `--color-text-muted`     | `#b0b2bc` | Captions, metadata, breadcrumbs.           |

### Status

| Swatch                                                                                                  | Token               | Hex       | Role                                     |
| ------------------------------------------------------------------------------------------------------- | ------------------- | --------- | ---------------------------------------- |
| <span style="display:inline-block;width:32px;height:20px;border-radius:4px;background:#00c292"></span> | `--color-positive`  | `#00c292` | Success, "Completed", confirm actions.   |
| <span style="display:inline-block;width:32px;height:20px;border-radius:4px;background:#d02729"></span> | `--color-negative`  | `#d02729` | Errors, destructive actions.             |
| <span style="display:inline-block;width:32px;height:20px;border-radius:4px;background:#ffc451"></span> | `--color-attention` | `#ffc451` | Waiting, warnings, things that need a look. |

The violet is the only brand colour. Other hues in the palette (`--color-blue`, `--color-pink`,
…) are for data — statuses, charts, badges — and never stand in for the accent.

## Typography

| Face           | Variable          | Weights       | Use                                                                    |
| -------------- | ----------------- | ------------- | ---------------------------------------------------------------------- |
| **ApercuPro**  | `--font-general`  | 400, 500, 700 | Everything in the interface: text, labels, buttons, headings.          |
| **Pentagra**   | `--font-pentagra` | 400           | Display headlines only — the home page hero, hubs, the Gauntlet wheel. |

Both are licensed local files loaded through `next/font/local` in `apps/web/src/app/layout.tsx`
and cannot be served from anywhere else. Mockups and other published pages substitute
**Hanken Grotesk** from Google Fonts and say so on the page (see
[Design system](./design-system)).

## Copy

- English only, in the product and in everything published about it.
- Plain and direct: say what the feature does for the player, not how impressive it is.
- Descriptions in use, to quote rather than reinvent:
  - Site: _Track your game library, rate and review titles, unlock achievements, and find your
    next game with the Gauntlet — all in one place on MoonCellar._
  - Home page: _The ultimate games tracker and games database — manage your collection of
    thousands of games across all platforms. Track progress, discover new titles, and challenge
    the Gauntlet._

## Social preview

`apps/web/public/images/og-default.png` (1200 × 630) is the default Open Graph image for every
page that has no image of its own; game pages use the game's cover instead.

<img src="/images/og-default.png" alt="Default social preview" width="480" />

## Where the brand is applied

| Surface                  | Favicon         | Header          | Banner          |
| ------------------------ | --------------- | --------------- | --------------- |
| Site (`apps/web`)        | `logo-icon.png` | `logo-text.png` | —               |
| Documentation (port 4333)| `logo-icon.png` | `logo-text.png` | `logo-full.png` |
| Storybook (port 4222)    | `logo-icon.png` | `logo-text.png` | —               |
| Status hub (`status.mooncellar.space`) | `logo-icon.png` | `logo-text.png`, with "Status" beside it | — |
| Installed app (PWA and Android APK) | `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` — `logo-icon.png` placed on a square, generated, never redrawn | — | — |
| E-mail letters (`apps/api` mail module) | — | `logo-text.png` | — |

A new surface gets a row here when it ships.

### E-mail

A letter is the brand on a surface we do not control, so it reuses the files rather than drawing
a new mark: `logo-text.png` at 40 px high in the header, loaded from `<FRONT_URL>/images` — the
image the site already serves — with `alt="MoonCellar"`, which is what a client that blocks
images shows instead.

The colours are the palette values inline (`#191d24` page, `#212731` panel, `#6951ee` for the
one action), because a mail client drops `<style>` and does not know CSS variables. Two
substitutions are forced and both are fine: **ApercuPro cannot be served to a mail client**, so
the letters fall back to the system sans stack, and Pentagra is not used at all — a letter has no
display heading.

Letters are built in `apps/api/src/module/mail/mail.letter.ts`; the host and DNS that carry them
are in [Mail](./mail).

The system account (`MoonCellar`, owner of the generated lists) and notifications without a person
behind them (moderation, request decisions, wishlist releases) use `logo-icon.png` as the avatar:
`SYSTEM_USER_AVATAR` in `@mooncellar/schemas`, the site-relative path `/images/logo-icon.png`,
stored as is in `users.avatar`.

`logo-icon.png` at 16px also marks MoonCellar Team ports inside the site: the port's row in a game
page's Achievements block and the chip in a game card's bottom-right rail, both opening the port's
achievements.
