# Status hub

`status.mooncellar.space` is where MoonCellar admins follow the team's projects: a plan of tasks, the
progress of a decompilation, or both. Each project uploads its own data; the hub only shows it.

## Who gets in

- Sign-in is the site's own account, on the hub's page (`/login`, the shared `AuthModal` with
  `isPage`). The session cookies are the site's — `Domain=mooncellar.space` covers the subdomain —
  so someone signed in on `mooncellar.space` is signed in here too.
- Only the `admin` role sees anything: the hub asks `GET /admin/access` on every server render.
  Anyone else gets "No access"; a missing or expired session goes to `/login?next=<page>`.
- Add or remove an admin as everywhere else, in the site's admin Users list.

## Pages

| Path                                  | What it shows                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `/login`                              | Sign in                                                                              |
| `/`                                   | Opens the first project, or "No projects yet"                                        |
| `/<project>` and `/<project>/<block>` | The project's default page, or the selected block; "⋯" — edit, tokens, delete        |
| `/manage`                             | Add a project, choose its default page, change its blocks, manage its tokens, delete |
| `/connect`                            | Allow a connect command to get a token                                               |
| `/hub-connector.zip`                  | The hub connector: a static file, built with the web app                             |

They live in `apps/web` (`src/app/status`, the pages `Status*` and `widgets/status`) and are answered
only for a host starting with `status.`; on `mooncellar.space` the same routes are a 404. How the
host reaches them is in the Status hub section of `apps/web/CLAUDE.md`.

## Projects and blocks

A new project joins in one step from where it will upload: its connect command
(`bun scripts/hub-connect.ts <slug> --title "<name>" --blocks plan,decomp`, or the project's own)
opens `/connect`; for an address that has no project yet the page offers to create it with that name
and those blocks, and "Create and allow" creates it and hands the command its token. Manage
projects → New project does the same by hand. A repository that has none of this gets it from the
[hub connector](#the-hub-connector).

A project has a name, an address (`slug`: lowercase letters, digits and dashes; `login`, `manage`,
`status`, `api`, `images`, `img` and `connect` are taken by the hub) and one or more blocks. A block is a type the hub
knows how to draw; a new project is data, a new block type is code.
Choose the default page from the project's enabled blocks in its settings. Opening `/<project>` uses
that choice; an explicit `/<project>/<block>` link always opens the selected block.

| Block                    | Schema (`@mooncellar/schemas`) | Shows                                                                                                                                         |
| ------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `decomp` — Decompilation | `DecompBlockSchema`            | Totals, categories that open into their areas, a map with one cell per function (hover or tap: name, address, size, state, file), files, feed |
| `plan` — Plan            | `PlanBlockSchema`              | Totals, tasks by section with state, owner and what a task waits for; editable                                                                |

Categories are the modules functions build into; areas are the hand-declared work split, each with
a lead. A category row opens into the areas whose files build into that module — an area that spans
modules appears under each — and a declared area whose globs match no file is named under the list
instead of disappearing.

The map's tooltip needs to know what each cell is, which would make the block ten times larger and
slower to refresh every minute. So a project uploads it beside the block, once per merge, as
`DecompFunctionsSchema` (`PUT /projects/:slug/data/decomp/functions`: every function in the map's
order — address, size, file as an index into `units`, name); the page reads it once, on the map's first
hover. Without it the tooltip shows only the state. It goes away with the block.

The project menu is a row per project: its name and a dot saying how fresh the last upload is — green
for today, yellow once the newest upload is older than a day, grey for a project that never uploaded.
The numbers are in a card that opens on hover or keyboard focus: functions done for `decomp`, tasks
done for `plan`, and the age of the last upload, which turns yellow when stale.

A project has an optional group (`ProjectSchema.group`, set in Manage projects). The menu lists
favourites first, then the named groups alphabetically, then the projects without a group; a group
folds and remembers its state. A starred project leaves its group rather than appearing twice.
Favourites and folded groups belong to the reader and live in this browser's `localStorage`
(`status-hub-favourites`, `status-hub-folded-groups`), so they do not follow an admin to another
machine; the phone menu below 960px is the shared `Dropdown` and keeps the same order without groups.

## The plan lives in the hub

A Decompilation block is uploaded by its project. A Plan is not: it is stored in the hub
(`projectplans`, one document per project) and changed there, by people on the site and by tools
through the API. Nobody keeps it in a file any more; a project with a markdown plan imports it once.

- **On the site** a task's "⋯" menu and its panel (click the row) take it (for yourself or "Assign
  to…" someone), release it, mark it done or reopen it, edit it and delete it; every section adds tasks,
  renames itself and, when empty, deletes itself; "Section" adds one. Admins on the site may override
  anyone (take a task someone else holds, finish it for them).
- **State** is derived, never stored: done; taken (has an owner); waiting (a task it depends on is not
  done); free. A task id is its section's letter and the next number (`H6`); a new section takes the
  first free letter unless one is given.
- **Every change is logged** (`projectplanevents`: who, what, when) and shown as the task's history.
- **Tools act with a project token and say for whom**: `"as": "<name>"` in the body of take, release,
  done and reopen. With a token, taking a task someone else holds, releasing it or finishing it answers
  409 unless `"force": true`; deleting is for admins on the site only.
- **Import**: a plan arrives once, into an empty hub plan — `PUT /projects/:slug/plan`, or the older
  `PUT /projects/:slug/data/plan` — with done tasks' `doneAt` when known. After that both answer 409.
  `bun scripts/import-plan.ts --file <plan.md>` parses a markdown plan (sections `## X. Title`, rows
  `| id | task | who | depends | done when | size |`, `✓` after a done id) and imports it with the
  token `bun scripts/hub-connect.ts <project>` saved (or `STATUS_HUB_TOKEN`) into the project of the
  repository's `.claude/status-hub.json` (or `STATUS_HUB_PROJECT`).

## The plan from a terminal and from agents

`bun scripts/tasks.ts` reads and changes a project's plan through the API with the machine's token:
`list [--free]`, `show <id>`, `take`, `release`, `done`, `reopen`, `add <section> "<task>"`,
`section "<title>"`, `edit`, `url`. It acts for git `user.name` in lower case (`--as` or
`STATUS_HUB_AS` for someone else) and needs `--force` to override someone else's task. It and
`import-plan.ts` share `scripts/hub-client.ts` (`STATUS_HUB_URL`, `STATUS_HUB_WEB`,
`STATUS_HUB_PROJECT`, `STATUS_HUB_TOKEN`). The project is the one the repository names in
`.claude/status-hub.json` (`{ "project": "mooncellar" }` here), found from the working directory up;
`STATUS_HUB_PROJECT` overrides it. Without either the scripts stop instead of guessing, so a
repository never changes another project's plan by accident.

Agents in this repository have two commands in `.claude/commands/`: `/hub` connects the machine (runs
`hub-connect.ts mooncellar`, the user presses "Allow") and gives the link; `/task [id]` lists the free
tasks or takes one, does it in a branch, opens a PR and, once it is merged, marks the task done.

Codex has the same workflows as `$hub [machine name]` and `$task [id]`, in
`.agents/skills/hub/` and `.agents/skills/task/`. Both agents use the same project binding
and machine token; see [Codex setup](codex.md).

## The hub connector

Any repository can work with the hub the way this one does, without copying anything from
MoonCellar: **Manage projects → Hub connector → Download** gives `hub-connector.zip`, which is
unpacked at the root of that repository:

| In the archive                             | What it is                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `.claude/commands/hub-init.md`             | `/hub-init`: sets the repository up once                                                      |
| `.claude/hub/tasks.mjs`, `hub-connect.mjs` | `scripts/tasks.ts` and `scripts/hub-connect.ts`, bundled for Node 18+ (Bun runs them too)     |
| `.claude/hub/templates/`                   | `hub.md`, `task.md` and `plan-section.md`, with `{{…}}` for what differs between repositories |
| `.claude/hub/README.md`, `version`         | What the connector is; a hash of its files                                                    |

`/hub-init` asks for the project (a new one, or one already here) and runs
`hub-connect.mjs <slug> --save --title … --blocks …`: an admin presses "Create and allow" (or
"Allow"), the machine gets its token and `--save` writes `.claude/status-hub.json`. Then it writes
`.claude/commands/hub.md` and `task.md` from the templates, filling the `{{…}}` from that repository
(its default branch, checks, commit convention, how a change gets merged), and adds the "Plan" section
to its `CLAUDE.md`. Committed, they give every teammate `/hub` (a token for their machine) and
`/task`. It is not called `/init`: that is Claude Code's own command, and a project command of the
same name would replace it.

The archive is built from `scripts/hub-connector/` by `scripts/build-hub-connector.ts`, which the web
app's `build` runs first (`bun --filter web build:connector` alone), into
`apps/web/public/hub-connector.zip` (not in git). Updating a repository is unpacking a fresh archive
over it: it replaces `.claude/hub/` and `/hub-init`, never the `/hub`, `/task` and
`.claude/status-hub.json` that `/hub-init` wrote.

## Uploading

A project uploads with a token of its own; a project has one token per machine or CI, named after it,
and any of them can be revoked in **Manage projects → Tokens** without touching the others. The API
keeps only their sha256 and records when each one last uploaded.

The way to get a token is to connect from where the project uploads, with nothing to copy:

```sh
bun scripts/hub-connect.ts <project>                       # saves ~/.config/mooncellar/<project>-hub-token
bun scripts/hub-connect.ts <project> --secret STATUS_HUB_TOKEN --repo <owner/repo>   # a CI secret
```

The command waits on `127.0.0.1`, opens `status.mooncellar.space/connect`, and after an admin presses
**Allow** receives a one-time code (ten minutes), exchanges it for a new token named after the machine
(`user@host`, or `CI` for a secret) and stores it. A project may ship its own connect command that does
the same (`POST /projects/:slug/tokens/exchange`). "Add token" in Manage projects issues one by hand
and shows it once.

A project then sends each block on its own:

```sh
gzip -c plan.json | curl -X PUT https://api.mooncellar.space/projects/<project>/data/plan \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Content-Encoding: gzip" --data-binary @-
```

- The body is validated against the block's schema; a failure answers 400 naming the fields, and
  nothing is stored. The answer of a success is the upload (`updatedAt`, `size`, `done`, `total`).
- A block replaces the previous one whole. The API reads at most 2 MB of JSON, counted after gzip
  is decoded; nginx passes up to 8 MB of body.
- A wrong token, a project that does not exist and a missing header all answer 401 with the same
  message, so the endpoint does not tell which projects exist.

Between uploads a Decompilation block's claims change without a new block: after someone takes or
releases a file, its tooling sends the whole current list with
`PATCH /projects/:slug/data/decomp/live` (`DecompLiveSchema` — `claims` of `unit`, `name` and an
optional `note`, and an optional `pending`). The hub then updates "In work", the files' `claimedBy`
and the map's claimed cells at once, so the page does not wait for the next merge. A claim on a
file the block does not have, or on a file that is already complete, is ignored — the block shows
neither of them. The upload's `updatedAt` stays where it was, because the block itself was not
uploaded again.

Projects send their Decompilation blocks from their own tooling, usually right after a merge into
their `main`, and their live claims after every take or release.

The MoonCellar project's plan lives in the hub (imported once from a markdown file that is gone
now): read and change it on the site or with `bun scripts/tasks.ts`.

## API

| Method and path                                                     | Who                            | What                                                      |
| ------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------- |
| `GET /projects`                                                     | admin                          | Every project with its uploads                            |
| `POST /projects`                                                    | admin                          | Create (no tokens yet)                                    |
| `GET /projects/:slug`                                               | admin                          | One project                                               |
| `PATCH /projects/:slug`                                             | admin                          | Rename, change blocks (a dropped block loses its upload)  |
| `DELETE /projects/:slug`                                            | admin                          | Delete with everything uploaded, the plan and its history |
| `POST /projects/:slug/tokens`                                       | admin                          | Add a named token; the answer carries it once             |
| `DELETE /projects/:slug/tokens/:id`                                 | admin                          | Revoke one token                                          |
| `POST /projects/:slug/connect`                                      | admin                          | A one-time code for a connect command                     |
| `POST /projects/:slug/tokens/exchange`                              | anyone with a code             | Exchange the code for a token                             |
| `GET /projects/:slug/data/:block`                                   | admin                          | The block as uploaded                                     |
| `PUT /projects/:slug/data/decomp/functions`                         | token                          | What the map's cells are (`DecompFunctionsSchema`)        |
| `GET /projects/:slug/data/decomp/functions`                         | admin                          | The same, for the map's tooltip                           |
| `GET /projects/:slug/plan`                                          | admin or token                 | The plan with every task's state                          |
| `PUT /projects/:slug/plan`                                          | admin or token                 | Import a whole plan into an empty one                     |
| `POST /projects/:slug/plan/sections`                                | admin or token                 | Add a section                                             |
| `PATCH`, `DELETE /projects/:slug/plan/sections/:id`                 | admin or token; delete — admin | Rename; delete an empty section                           |
| `POST /projects/:slug/plan/tasks`                                   | admin or token                 | Add a task                                                |
| `PATCH`, `DELETE /projects/:slug/plan/tasks/:id`                    | admin or token; delete — admin | Edit; delete                                              |
| `POST /projects/:slug/plan/tasks/:id/<take, release, done, reopen>` | admin or token                 | Change the state (`as`, `note`, `force`)                  |
| `GET /projects/:slug/plan/events?task=<id>`                         | admin or token                 | Recent changes, of the plan or of one task                |
| `PUT /projects/:slug/data/:block`                                   | project token                  | Upload a block                                            |
| `PATCH /projects/:slug/data/decomp/live`                            | project token                  | Live claims between uploads                               |

## Trying it locally

The hub is reached by host, and the session cookie is set for the domain the site and the API share
(`getCookieDomain` in `apps/api/src/module/auth/auth-cookies.ts`). `localhost` has no such domain —
Chromium refuses a cookie whose `Domain` is `.localhost` — so a local visit needs two names under a
domain of their own. `bun run dev:hub` sets that up and starts both apps:

```sh
bun run dev:hub            # the hub on http://status.mooncellar.test:3000
bun run dev:hub -- --check # only the checks, nothing is started
```

It looks for both names in `/etc/hosts` and offers to add `127.0.0.1 status.mooncellar.test
api.mooncellar.test` (the write asks for your `sudo` password), refuses to start when port 3000 or
3228 is taken, and starts the API with the hub allowed as a CORS origin and the web with
`NEXT_PUBLIC_API_URL` on the API's name. Signing in then puts a real cookie on `mooncellar.test`:
the API sets it for `api.mooncellar.test`, the hub reads it on `status.mooncellar.test`, and
`allowedDevOrigins` in `next.config.mjs` lists the host so the dev server serves its chunks there.
Chrome caches a failed lookup, so a browser that already refused the address needs a restart.

It expects a MongoDB on `127.0.0.1:27017`. `bun run mongo` opens the tunnel to it, and that tunnel
is the production database: the API then reads and writes there, which is what `DISABLE_CRONS=true`
in `apps/api/.env` keeps from spreading to the crons. `autoIndex` is on as well, so the first local
boot builds any index production is missing. A dump of `projects`, `projectplans`,
`projectplanevents` and `users` into a local database is enough to click through the hub without
touching production — point `MONGO_CONNECTION_STRING` at it and nothing else changes.
