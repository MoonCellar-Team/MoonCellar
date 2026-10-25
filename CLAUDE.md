# MoonCellar

## Keeping this file current

**When a non-obvious constraint costs real debugging time, add it here as a rule before moving
on.** Most sections below exist because something silently broke and the cause was not visible
in the code that broke.

What belongs here: a constraint whose violation produces a bug you cannot see by reading the
diff — framework behaviour that contradicts the obvious reading, a shared component that only
works in one context, an ordering requirement, a value that must stay in sync with something
in another file or repository.

Write it as a rule, not as history: what to do, and one sentence on why. A rule without its
reason gets worked around the next time it is inconvenient. Name the concrete symptom where
one exists — a status code, an error message, a wrong number.

What does not belong here: anything the code already states plainly, one-off fixes, changelog
entries, or a summary of work done. Those go in commit messages or `docs/`.

## Reading the other CLAUDE.md files

- **Before touching a folder, read every `CLAUDE.md` on the path from the repository root down to
  it.** Rules live next to the code they govern: `apps/web/CLAUDE.md` and `apps/api/CLAUDE.md`
  for each app, one per shared UI component in `apps/web/src/lib/shared/ui/<Name>/CLAUDE.md`,
  and one per page in `apps/web/src/lib/pages/<Page>/CLAUDE.md`. A rule in a nested file
  overrides a broader one for that folder only.
- **A change that alters what a component or page does, accepts or must not do updates its
  `CLAUDE.md` in the same change.** A stale one documents behaviour the code no longer has, and
  the next session trusts it.

## Keeping docs and Storybook current

- **Every change to a component, a page, a route, an API contract or a workflow ends with a
  check of what documents it, and that check is part of the change, not a follow-up.** Before
  calling the work done, go through:
  - the `CLAUDE.md` of every component and page you touched, and of the apps above them;
  - the `.stories.tsx` of every shared UI component you touched — a new prop, variant or state
    gets a story, a removed one loses its story, and the stories still render
    (`bun --filter web build-storybook`);
  - every file in `docs/` that names what you changed — grep `docs/` for the component, hook,
    route, endpoint, env var or constant you renamed, removed or changed;
  - this file, when a rule here describes behaviour you changed.
- **A doc that contradicts the code is a bug.** Fix it in the same change, or delete the stale
  part; never leave a claim you know is wrong for later. Stale docs cost more than missing ones,
  because the next session trusts them.

## Shared UI components

- **Build screens from the shared UI kit in `apps/web/src/lib/shared/ui`; never re-create a
  control that already exists there.** Read the component's `CLAUDE.md` and its Storybook
  stories first.
- **When a shared component almost fits, extend it with a generic prop instead of forking it
  or styling it from outside.** A second copy drifts from the first, and a one-off override
  breaks the next time the component changes.
- **A new reusable control goes into `shared/ui` as a universal component**: no domain
  knowledge, props instead of hard-coded copy or data.
- **Every new shared UI component ships with its `CLAUDE.md` and its Storybook stories in the
  same change, and every new page ships with its `CLAUDE.md`.** A component's file covers what it
  is, when to use it and when not, its props, a usage snippet and its gotchas; its
  `<Name>.stories.tsx` covers every meaningful state (variants, disabled, loading, empty, long
  text) with realistic data and no backend. A page's file covers its routes and rendering mode,
  where its data comes from, which widgets it composes and its gotchas. Existing ones follow the
  same shape — copy the structure of a neighbour. A component or page without them is unfinished
  work, not a follow-up.

## Storybook and documentation

- **Storybook runs on port 4222** (`bun run storybook`, or `bun --filter web storybook`) and
  picks up `apps/web/src/lib/shared/ui/**/*.stories.tsx`. `.storybook/main.ts` repeats the SCSS
  `additionalData` and `loadPaths` from `next.config.mjs`; change them together, or every
  component module fails to compile in Storybook with an undefined mixin.
- **The Storybook canvas is `--color-bg-secondary`, the colour of a `Box` panel, because that is
  what almost every component sits on in the app;** fields painted in `--color-bg-primary` vanish
  on a primary-coloured canvas. A modal rendered inline in a story takes the `asModal` decorator
  from `.storybook/decorators.tsx`, which sizes it to its content as `ModalsConnector` does —
  without it the `Box` stretches to the canvas and its rows hug the left edge.
- **The documentation site runs on port 4333** (`bun run docs`, VitePress, config in
  `docs/.vitepress/config.mts`) and renders the markdown files in `docs/`; the sidebar lists them
  on start, titled by each file's first `#` heading, so restart it after adding one. Inline code
  is rendered with `v-pre` because VitePress compiles markdown as Vue, and `style={{ … }}` in a
  code span otherwise breaks the build.

## Branding

- **`docs/branding.md` is the brand reference** — name spelling, the three logos and what not
  to do with them, the palette with its roles, the typefaces, the copy in use and where each
  surface applies the brand. Read it before building anything user-facing outside the app, and
  add a row to its "Where the brand is applied" table when a new surface ships.
- **MoonCellar is branded with exactly three images from `apps/web/public/images`, each in one
  role:**
  - `logo-icon.png` (the moon mark) is the favicon and any square or small slot: browser tab,
    avatar placeholder, app icon.
  - `logo-text.png` (the wordmark) goes in a header or navigation bar, sized by height. The site
    header and the documentation nav bar use it; the text "MoonCellar" is never typed next to it.
  - `logo-full.png` (mark above wordmark) is the hero or banner of a landing or home page, such
    as the documentation home.
- **Every new surface — a tool, a preview, an e-mail, a generated page — takes its favicon, header
  and banner from these files, never from a redrawn or recoloured copy,** so the brand looks the
  same everywhere. The `-black` variants exist for light backgrounds only.
- `docs/public/images` holds copies of the three for the documentation site, because pointing
  VitePress at the 37 MB `apps/web/public` would ship all of it in the docs build. Replace them
  together with the originals when the logo changes.

## Package manager

This project uses **bun** exclusively. Using `npm` is forbidden.

- Install dependencies with `bun install` (never `npm install`).
- Add/remove packages with `bun add` / `bun remove`.
- Run scripts with `bun run <script>` (or `bunx` for one-off binaries).
- Do not create or commit `package-lock.json` — only `bun.lock`/`bun.lockb` is allowed.

## Code generation

- Do not add comments when generating or modifying code.

## Language

- **Everything written into this repository is English.** Code and identifiers, commit
  messages, every `CLAUDE.md`, everything under `docs/` — including the copy inside
  `docs/mockups/*.html` — and the user-facing strings the apps ship.
- A mockup's headings, labels and placeholder text are UI copy for an English-language
  product. Written in another language they cannot be lifted into a real screen, and the
  mockup stops being a specification of what to build.
- The conversation with whoever asked for the work happens in whatever language they use;
  that never reaches a file.

## Plan and agent commands

- **The team's plan lives in the status hub, not in the repository: read and change it with
  `bun scripts/tasks.ts` (or `/task`), never from memory or a file.** People take and finish tasks
  on the site, so a copy is stale the moment someone clicks. A machine connects once with `/hub`
  (`bun scripts/hub-connect.ts mooncellar`); details are in `docs/status-hub.md`.
- **The hub scripts run in other repositories too: `scripts/hub-client.ts`, `hub-connect.ts` and
  `tasks.ts` are bundled into the hub connector (`scripts/hub-connector/`, `docs/status-hub.md`) that
  runs on Node 18+.** Keep them on `node:` modules and `fetch` — no `Bun.*` and no runtime import of a
  workspace package (types only) — or `/hub-init` breaks for everyone who downloads it. The project
  comes from `.claude/status-hub.json`, never from a default.
- The agent commands live in `.claude/commands/` (`/hub`, `/task`). A command that changes how work
  is done (branches, PRs, checks) is updated together with `CONTRIBUTING.md` and this file.

## Skills

- **Skills resolve from the monorepo root, so every skill is available both from the root and
  from inside a workspace** (`apps/web`, `apps/api`, `packages/schemas`) — do not copy one into
  a workspace to make it visible there. A skill that must apply to a single workspace only goes
  in `apps/<app>/.claude/skills/` and is then addressed with its directory prefix
  (`apps/web:<name>`).
- The checked-in skills live once in `.agents/skills/<name>/` and reach Claude Code through the
  symlinks in `.claude/skills/`, with their origin recorded in `skills-lock.json`. Install new
  ones into `.agents/skills` and symlink them, so the lockfile and any other agent tooling keep
  seeing the same single copy.

## User settings

- **`user.settings` is a Mongoose `Object` (Mixed) field, so a partial update must merge, not
  assign.** `updateSettings` takes a partial payload and spreads it over the stored object
  (with the schema defaults underneath, for accounts created before a key existed), then calls
  `markModified("settings")`. Assigning only the changed key wipes the rest.
- **`UpdateSettingsSchema` lists its fields without defaults; never derive it with
  `UserSettingsSchema.partial()`.** Zod 4 still applies a `.default()` inside `.partial()`, so a
  payload carrying only `showAdultContent` parsed as `bgOpacity: 0.85, mutedNotifications: []`
  and every save reset the background dim and the muted notifications.
- The background dim lives there as `bgOpacity` (0–1, default `DEFAULT_BG_OPACITY` in the
  shared user schema), not in the client's persisted `settings` store — that store keeps only
  `bgOpacityPreview`, a non-persisted override so the slider previews live before Save.

## Monorepo

- Four workspaces: `apps/web` (Next.js), `apps/api` (NestJS), `apps/game` (NestJS) and
  `packages/schemas` (`@mooncellar/schemas`). Install and run everything from the root
  with `bun --filter <workspace> <script>` — never `cd` into an app to install, the
  lockfile is shared.
- **The root `dev` script must launch each app with its own `bun --filter` call, never
  `bun --filter '*' dev`.** `apps/api` and `apps/game` have no `dev` script and the glob skips
  them in silence, so `dev:api` and `dev:game` call their `start:dev` by name. `build` and
  `lint` may keep `--filter '*'`, because those scripts terminate and the dependency ordering is
  what we want there.
- **`apps/api` has no compiled output: Bun executes `src/main.ts` in development and in the
  container, and its `build` script type-checks and boot-checks instead of compiling.**
  Never run the API with Node (`node dist/main`, `nest start`): `@mooncellar/schemas`
  resolves to TypeScript source, tsc does not compile a dependency, and Node dies at boot
  with `ERR_MODULE_NOT_FOUND` on the package's first extensionless import. The API-side rules
  that follow from Bun are in `apps/api/CLAUDE.md`.
- **`apps/web/next.config.mjs` points `turbopack.root` and `outputFileTracingRoot` at
  the monorepo root.** Pinning them to the app directory puts `packages/` outside the
  project root and imports from the shared package stop resolving.
- Every Dockerfile (`apps/web`, `apps/api`, `apps/game`, and `static.Dockerfile` for the documentation and
  Storybook images) builds with the repository root as context and copies every workspace
  manifest before `bun install --frozen-lockfile`; a partial copy fails the frozen
  lockfile check.
- **The static images serve HTML with `Cache-Control: no-cache` and only `/assets/` as
  `immutable`** (`static.Dockerfile`). Storybook and VitePress chunks are hashed and every deploy
  removes the old ones; without the header browsers cached `iframe.html` heuristically and kept
  requesting the previous build's chunks, which failed with "Failed to fetch dynamically
  imported module" (404).

- **The host's nginx site config is `infra/nginx/mooncellar.conf`, installed over
  `/etc/nginx/conf.d/mooncellar.conf` on every infra deploy.** Edits made on the server are lost
  on the next deploy, and so are the `ssl_*` lines `certbot --nginx` would write — certificates
  are issued with `certbot certonly` from the `server_name` list. Details in
  `docs/deploy-env.md`.
- **`/socket.io/` keeps its own `location` in that file, with the `Upgrade` headers and a read
  timeout above 45 s; never let it fall under the API's general `location /`.** That one clears
  `Connection` and reads for 15 s, so WebSockets never connect and every long-polling GET ends as a
  504 that the browser shows as a CORS error on `socket.io/?EIO=4&transport=polling`, followed by
  `400` on the next POST. Details in `docs/sockets.md`.
- **Every `location` in that file that proxies to the API or the game service keeps
  `include proxy_params`.** It sets `X-Forwarded-For`, and both apps treat a request without it as
  a call from inside the stack that is never rate-limited (`docs/rate-limits.md`), so a location
  without it would be an unlimited door from the internet.
- **Every `server` block in that file whose app takes uploads sets `client_max_body_size` above
  the app's own largest limit** — `api.mooncellar.space` and `game.mooncellar.space` take `8m`
  (the editor's images are 5 MiB, `COMMENT_IMAGE_MAX_BYTES`). nginx's default of 1 MB answers 413
  without CORS headers, so the browser shows a CORS error on the upload and the app says "The
  server could not be reached"; raising an upload limit in the API means raising it here too.

- **`infra/searxng/` is mounted read-write into the SearXNG container, and the container can
  chown it to its own user.** A file in the repository that the host user cannot write breaks the
  `pre-commit` hook: lint-staged hides unstaged changes, fails to restore them, and leaves the
  working tree reverted to `HEAD` with the real changes only in the index (and in its
  "lint-staged automatic backup" stash). Keep the folder owned by the host user
  (`podman exec -u root <container> chown -R 0:0 /etc/searxng` under rootless podman), and
  recover such a state with `git restore --worktree` from the index, not by committing it.

## Android app

- **The APK is a Trusted Web Activity built by `.github/workflows/android.yml` from
  `apps/android/twa-manifest.json` on an `android-v*` tag;** the release flow, the signing key and
  the secrets are in [`docs/android-app.md`](docs/android-app.md).
- **`apps/web/public/.well-known/assetlinks.json` must list the SHA-256 of every key the app is
  signed with.** A mismatch shows no error anywhere: the app silently opens with Chrome's address
  bar, as a plain Custom Tab.
- **Raise `appVersionCode` and set `appVersion` in `twa-manifest.json` before tagging,** and tag
  `android-v<appVersion>`. The workflow refuses a tag that differs, and Android refuses an APK whose
  version code is not higher than the installed one.
- **Deploy the site before building an APK whose icons or manifest changed.** Bubblewrap downloads
  them from `mooncellar.space`, not from the repository.

## Frontend architecture

- **`apps/web` is Feature-Sliced Design and every component belongs to a layer** —
  `app → pages → widgets → features → entities → shared`, all under `src/lib`. Nothing lives
  next to the page that renders it: a page composes widgets, a widget composes features and
  entities, and imports only ever point down that list. How to choose the layer, and the
  public-API and naming rules that go with it, are in
  [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md).

## Zod schemas

- Request and response shapes live once in `packages/schemas` and are imported as
  `@mooncellar/schemas` by both apps. There are no copies to keep in sync any more.
- **The package ships TypeScript source: `main` and `types` point at `src/index.ts`, and
  there is no build or watcher.** Each consumer compiles it itself — Bun inside the API,
  Turbopack for Next (it transpiles workspace packages on its own, so `transpilePackages`
  stays empty), ts-jest in the API's tests. This holds only while the API runs on Bun (see
  Monorepo).
- `zod` is a peer dependency pinned through the root `catalog`. A second copy anywhere
  in the tree silently breaks type inference across the package boundary.
- `igdb.schema.ts` stays in `apps/web`: it describes an upstream API the frontend reads
  directly, not the contract between the apps.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
