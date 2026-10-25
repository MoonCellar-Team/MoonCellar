# Deployment variables

Every value the CI/CD pipeline needs, and where it has to live once the two repositories
become one.

Today each repository has its own set of GitHub secrets, so both workflows can read
`secrets.HOST_ENV` and `secrets.WORK_DIR` and get different values. In a monorepo there is one
secret store for both apps: **anything that differs between the frontend and the backend must
be split by name**, or the second workflow silently deploys with the first one's values.

---

## GitHub secrets

Repository settings → Secrets and variables → Actions → *Repository secrets*.

### Shared — one value for the whole repository

| Secret | Used by | Description |
|---|---|---|
| `SSH_HOST` | both workflows | Production host the image is copied to and deployed on |
| `SSH_USER` | both workflows | SSH user on the production host. It must reach the root Docker daemon — `root` itself, or a user in the `docker` group |
| `SSH_PRIVATE_KEY` | both workflows | Private key for that user, no passphrase |
| `TURN_SECRET` | ci.yml deploy | Optional. coturn's REST `static-auth-secret` (random, `openssl rand -hex 32`). The deploy appends it to `infra/.env` and to `apps/game/.env` together with `TURN_URLS=game.mooncellar.space:3478`, so it stays one value; without it the relay is off ([game-service.md](game-service.md#turn-relay)). Create it with `gh secret set TURN_SECRET --body "$(openssl rand -hex 32)"`, then deploy infra and game (`gh workflow run ci.yml --ref main`) |

If the API and the site ever move to different hosts, these split the same way as everything
below (`SSH_HOST_WEB` / `SSH_HOST_API`).

### Per app — must be split

| Secret | Replaces | Description |
|---|---|---|
| `HOST_ENV_WEB` | `HOST_ENV` (frontend repo) | Whole `.env` file for `apps/web`, written by the workflow before `docker build` |
| `HOST_ENV_API` | `HOST_ENV` (backend repo) | Whole `.env` file for `apps/api` |
| `HOST_ENV_GAME` | new | Whole `.env` file for `apps/game` — see below |
| `HOST_ENV_INFRA` | new | Whole `.env` file for `infra/docker-compose.prod.yml` — see below |

There is no path secret any more. The deploy owns the containers outright — `docker run
--restart always` from the workflow — so nothing has to exist on the host beforehand and no
directory is `cd`-ed into. `WORK_DIR` and `DEPLOY_ROOT` can both be deleted.

`HOST_ENV_INFRA` has no equivalent on the old host — it is a new file, written from
`infra/.env.example`, with passwords generated once (`openssl rand -base64 24`). One catch:
`MONGO_ROOT_*` is applied only to an empty `mongo-data` volume. Restoring a dump into a fresh
volume takes the new credentials; copying the old volume across keeps the old ones, and then
these two keys have to repeat what the old host used.

`HOST_ENV_*` is a multi-line secret: the entire file, one `KEY=value` per line. The workflow
writes it to the app's own directory, not to the repository root:

```yaml
- name: Build images
  run: |
    if [ "$DEPLOY_WEB" = "true" ]; then
      echo "${{ secrets.HOST_ENV_WEB }}" > apps/web/.env
      docker build -f apps/web/Dockerfile -t mooncellar-frontend:latest .
    fi
```

### Where the production values actually live

**A GitHub secret cannot be read back** — not through the UI, not through the API, not by the
repository owner. The existing `HOST_ENV` of either repository is therefore not a source you
can copy from.

The production environment exists on the host, baked into the running image by the current
`COPY ./.env .env`. Lift it from there:

```bash
docker ps
docker exec <container> cat /app/.env
# or, without touching the running container:
docker run --rm --entrypoint cat mooncellar-frontend:latest /app/.env
```

After the migration those paths become `/app/apps/web/.env` and `/app/apps/api/.env`.

**Do not seed the secrets from a developer's local `.env`.** Ours mixes localhost URLs with
live credentials, and it is missing half the variables the code reads — a build from it would
ship a site calling `localhost:3228` with empty canonical links. Reconcile what you pull off
the host against the tables below, then set the secrets from that file:

```bash
gh secret set HOST_ENV_WEB   < prod-web.env
gh secret set HOST_ENV_API   < prod-api.env
gh secret set HOST_ENV_INFRA < prod-infra.env
```

Managing repository secrets requires the **admin** role; write access is not enough. Check with
`gh api repos/<owner>/<repo> --jq .permissions`.

### `HOST_ENV_INFRA` — contents

Written to `infra/.env` before the directory is copied, and read by
`infra/docker-compose.prod.yml` through `${...}` interpolation. Every key is required: compose
refuses to start rather than fall back to `admin`.

| Variable | Secret | Description |
|---|---|---|
| `MONGO_DATA_DIR` | no | Absolute path on the host bind-mounted as MongoDB's `/data/db` — `/home/admin/mongodb` on the old host, which is what the podman `run.sh` mounted. A directory, not a named volume, so the data stays where an operator can see it and `docker compose down -v` cannot take it with the rest. **A typo here does not fail** by default: Docker creates the missing directory and MongoDB initialises an empty database in it, which looks like a successful deploy of a site with no games. All three data mounts therefore set `create_host_path: false`, so compose refuses to start on a path that does not exist |
| `MONGO_ROOT_USERNAME` | **yes** | MongoDB root user, created **only** when `MONGO_DATA_DIR` is empty. A directory carried over from another host already holds its users, and these two keys are then ignored — set them to the old values anyway, or the next person cannot tell which credentials are live. Must match the API's `MONGO_CONNECTION_STRING` |
| `MONGO_ROOT_PASSWORD` | **yes** | Its password |
| `GRAFANA_DATA_DIR` | no | Host directory bind-mounted as `/var/lib/grafana` — `/home/admin/grafana` on the old host. It holds every dashboard built in the UI; only the JSON under `infra/grafana/provisioning/` comes from the repository |
| `GRAFANA_ADMIN_USER` | **yes** | Grafana admin login |
| `GRAFANA_ADMIN_PASSWORD` | **yes** | Grafana admin password |
| `PROMETHEUS_DATA_DIR` | no | Host directory bind-mounted as `/prometheus` — `/home/admin/prometheus` on the old host. Seven days of metrics history; losing it is survivable, keeping it is one line |
| `METRICS_TOKEN` | **yes** | Bearer token Prometheus sends when scraping the API's `/metrics`. Must be byte-identical to the API's own `METRICS_TOKEN`, or every scrape is a 401 |
| `SEARXNG_SECRET` | **yes** | SearXNG's `server.secret_key` (`openssl rand -hex 32`). `infra/searxng/settings.yml` is committed without it, so the key never lands in git |
| `TURN_SECRET` | **yes** | Not here: the deploy appends it from the `TURN_SECRET` repository secret. Without it the `coturn` container only logs that the relay is off. coturn runs on the host network, so `ufw` filters it: the infra deploy opens UDP 3478 and 49160–49200 when ufw is active and `SSH_USER` may run it (root, or passwordless sudo); otherwise `ufw allow 3478/udp` and `ufw allow 49160:49200/udp` by hand, and the provider's firewall in any case |
| `TURN_REALM` | no | Optional realm coturn announces, `game.mooncellar.space` by default |
| `TURN_EXTERNAL_IP` | no | Optional public address of the host when it sits behind 1:1 NAT (a cloud VM whose interface has a private address); leave it empty when the public address is on the interface |

`METRICS_TOKEN` is also written to `infra/prometheus/metrics_token`, because a Prometheus
config file cannot read an environment variable — `prometheus.prod.yml` points
`credentials_file` at it. The file is gitignored; it exists only on the runner and the host.

The two `MONGO_INITDB_ROOT_*` values in `infra/docker-compose.yml` stay `admin`/`admin`: that
file is the local development stack and is never deployed.

### The host runs root Docker

The deploy job builds both images on the runner, ships them as one gzipped archive and starts
them with `docker run -d --restart always`. Two consequences worth knowing before touching it:

- **The container is the unit of deployment — there is no `run.sh` and no systemd unit on the
  host.** A redeploy is `docker rm -f` followed by `docker run`, and `--restart always` is what
  brings both apps back after a reboot or a crash — including one stopped by hand, because the
  policy is re-applied when the daemon starts. `docker stop` therefore holds only until the next
  reboot; to take an app down for longer, remove the container. This needs `systemctl enable
  docker` on the host: a restart policy is executed by the daemon, so a daemon that does not
  start at boot brings nothing up with it.
- **Everything shares one user-defined network, `mooncellar`, and talks over container DNS.**
  The deploy creates it before anything starts; `infra/docker-compose.prod.yml` joins it as an
  external network. The old host published every one of these ports and had the apps reach them
  back through the podman gateway; inside the network they reach `mongodb:27017`, `loki:3100`,
  `alloy:12347`, `searxng:8080` and each other (`mooncellar-backend:3228`) by name, so **no
  infrastructure port is published on a public interface** — a database on a root-Docker box
  would otherwise be on the public internet, because Docker's iptables rules are not filtered by
  a host firewall. Only Grafana (`127.0.0.1:3000`) and MongoDB (`127.0.0.1:27017`) are
  published, on loopback; reach them through an SSH tunnel.
- **Because nothing is published, the address variables must be set — the code's fallbacks are
  wrong here.** `INTERNAL_API_URL` and `LOKI_HOST` (web) default to
  `host.containers.internal` / `localhost`, which resolve to the host gateway or the container
  itself, where nothing listens any more; an unset `LOKI_HOST` in the API ships no logs at all. The values are in the `HOST_ENV_*` tables below. `--add-host` still maps
  `host.containers.internal` and `host.docker.internal` to the gateway, for anything genuinely
  running on the host.
- **Every container port is published on loopback only** (`-p 127.0.0.1:3111:3111`,
  `-p 127.0.0.1:3228:3228`, `4333` for the documentation, `4222` for Storybook), for a reverse proxy running on the host. A proxy in a container
  cannot reach them there; it has to join the `mooncellar` network instead.
- **Infrastructure is deployed only when `infra/**` or the workflow file changes.** The
  `changes` job has its own `infra` filter; the deploy `scp`s the directory to `/opt/mooncellar/infra` and runs
  `docker compose -f docker-compose.prod.yml up -d`, which is idempotent: it starts what is
  missing and leaves what is already running. A push that only touches `apps/**` does not
  restart MongoDB.

### Not secrets — these live in the workflow file

A single `.github/workflows/ci.yml` deploys both apps: a `changes` job decides which
workspaces were touched, and the deploy job builds only those, ships them in one
multi-image archive over one SSH session, and restarts only the services it rebuilt.

| Value | Frontend | Backend | Documentation | Storybook |
|---|---|---|---|---|
| Image and container name | `mooncellar-frontend` | `mooncellar-backend` | `mooncellar-docs` | `mooncellar-storybook` |
| Dockerfile | `apps/web/Dockerfile` | `apps/api/Dockerfile` | `static.Dockerfile` | `static.Dockerfile` |
| Exposed port | `3111` | `3228` | `4333` | `4222` |
| Path filter | `apps/web/**`, `packages/**`, `package.json`, `bun.lock`, `ci.yml` | `apps/api/**`, `packages/**`, `package.json`, `bun.lock`, `ci.yml` | `docs/**`, `package.json`, `bun.lock`, `static.Dockerfile`, `ci.yml` | `apps/web/**`, `packages/**`, `package.json`, `bun.lock`, `static.Dockerfile`, `ci.yml` |
| Deploy flag in the SSH script | `DEPLOY_WEB` | `DEPLOY_API` | `DEPLOY_DOCS` | `DEPLOY_STORYBOOK` |

Documentation and Storybook are static sites: `static.Dockerfile` runs the build command passed
as `BUILD`, copies the `OUT` directory into `nginx:alpine` and listens on `PORT`. They take no
`.env`.

### The reverse proxy lives in the repository

nginx runs on the host, but its site configuration is `infra/nginx/mooncellar.conf`. An infra
deploy copies it over `/etc/nginx/conf.d/mooncellar.conf` and reloads nginx; never edit the
file on the server, the next infra deploy overwrites it.

- **A new site is one `server` block plus a name in the port-80 redirect block.** Before
  swapping the file, the deploy collects every `server_name` and runs `certbot certonly --nginx
  --cert-name mooncellar.space --keep-until-expiring --renew-with-new-domains` with them: a no-op
  while the list is unchanged, a reissue of the shared certificate when a domain was added. The
  DNS record must exist before that deploy, or certbot fails and the deploy stops there.
- **Use `certbot certonly`, never `certbot --nginx` without it** — the installer writes `ssl_*`
  lines into the live file, which the next deploy discards.
- **A config that fails `nginx -t` is rolled back:** the previous file is kept as
  `/etc/nginx/mooncellar.conf.prev`, copied back, and the deploy goes red with the old
  configuration still serving.
- **`client_max_body_size` of a `server` block must cover the largest upload its app accepts.**
  `api.mooncellar.space` and `game.mooncellar.space` set `8m`; without it nginx's default of
  1 MB answers 413 itself, with no CORS headers, so the browser reports
  `No 'Access-Control-Allow-Origin' header` and axios a Network Error instead of the real status.
- The deploy user must be able to run `certbot`, `nginx` and `systemctl`, which in practice means
  `root`.

---

## What production sets today

Verified against the running containers. The host ships far fewer keys than the tables below
list, because almost every variable the code reads has a hardcoded fallback — and in this
deployment those fallbacks happen to be the production values.

**Frontend — two keys set:** `NEXT_PUBLIC_API_URL` and `REVALIDATE_SECRET`. The two dead keys
noted below, `NEXT_PUBLIC_LOKI_HOST` and `NEXT_PUBLIC_S3_HOST`, have since been dropped.

**Backend — fifteen keys set:** everything in its table except `FRONT_URL`, `LOCAL_CONNECTION`,
`INDEXNOW_KEY` and `STEAM_API_KEY` (added with the Steam import, not set on the host yet).

| Unset in production | Falls back to | Verdict |
|---|---|---|
| `INTERNAL_API_URL` | `http://host.containers.internal:3228` | **No longer correct** — set it to `http://mooncellar-backend:3228` |
| `NEXT_PUBLIC_FRONT_URL` | `https://mooncellar.space` | Correct; canonical links and the sitemap are fine |
| `LOKI_HOST` (web) | `http://host.containers.internal:3100` | **No longer correct** — set it to `http://loki:3100` |
| `GEO_BLOCK_COUNTRIES` | `RU` | Country blocking is on in production through this default alone |
| `NEXT_PUBLIC_FARO_APP_NAME` | `mooncellar-frontend` | Correct |
| `NEXT_PUBLIC_APP_VERSION` | `0.0.0` | Every Faro event reports 0.0.0, so telemetry cannot be filtered by release |
| `NEXT_PUBLIC_CORS_SERVER` | **nothing** | Read only by dead code — see below |
| `FRONT_URL` (api) | `https://mooncellar.space` | Correct |
| `INDEXNOW_KEY` | a key hardcoded in `apps/api/src/shared/constants.ts` | Works; an IndexNow key is public by design, since the host must serve it at `/<key>.txt` |

Two keys were set in production but referenced nowhere in the code — `NEXT_PUBLIC_LOKI_HOST` and
`NEXT_PUBLIC_S3_HOST`. They have been dropped from `HOST_ENV_WEB`.

> **`NEXT_PUBLIC_CORS_SERVER` is unset, and setting it would change nothing.**
> It is read only by `countVisitors` in `apps/web/src/lib/shared/utils/visitors.utils.ts`,
> which nothing imports — the request is never made. The cleanup is deleting that file, not
> adding the variable.

## `HOST_ENV_WEB` — contents

> **`NEXT_PUBLIC_*` values are inlined into the bundle at build time.** The workflow writes the
> `.env` before `docker build`, so a change here needs a rebuild and redeploy — restarting the
> container picks up nothing.
>
> **Re-running a workflow from the GitHub UI does not do it either.** A re-run reads the new
> secret, but it re-evaluates the same `changes` filters against the same commit: a run whose
> commit touched only `infra/**` skips `Build images` again and the old image keeps serving the
> old `.env`. Rotating a `HOST_ENV_*` value is what **Actions → CI/CD → Run workflow** is for —
> `workflow_dispatch` forces all three outputs to `true` and rebuilds everything.

| Variable | Secret | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | no | Public API URL used from the browser — `https://api.mooncellar.space` in production, `http://localhost:3228` in dev |
| `INTERNAL_API_URL` | no | API URL used from server components and route handlers — `http://mooncellar-backend:3228`, the container name on the `mooncellar` network. Separate from the public one, and it must be set: the fallback points at the host gateway, where nothing listens. Never the public `https://api.mooncellar.space`: requests through nginx are rate-limited per address, and every server-side render would share the server's one ([rate-limits.md](rate-limits.md)) |
| `NEXT_PUBLIC_GAME_URL` | no | Public URL of the game service (`apps/game`), for the achievements of the MoonCellar Team ports on game pages and profiles; defaults to `https://game.mooncellar.space` |
| `INTERNAL_GAME_URL` | no | The game service from server components — `http://mooncellar-game:3229` on the `mooncellar` network; unset, the server goes through the public URL |
| `NEXT_PUBLIC_FRONT_URL` | no | Public URL of the site. Canonical links, sitemap and Open Graph URLs are built from it — a wrong value here is an SEO incident, not a cosmetic bug |
| `NEXT_PUBLIC_CORS_SERVER` | no | Origin sent as the CORS credentials target; must match the API's `FRONT_URL` |
| `NEXT_PUBLIC_APP_VERSION` | no | Version tag attached to every Faro event, so telemetry can be filtered by release |
| `NEXT_PUBLIC_FARO_APP_NAME` | no | Application name in Grafana Faro |
| `NEXT_PUBLIC_FARO_ENABLED` | no | `true` turns Faro on under `next dev`. A production build always starts it; in development it stays off by default, so a machine without the API's `FARO_COLLECTOR_URL` sends no telemetry at all |
| `LOKI_HOST` | no | Loki push endpoint for the `/api/logs` route handler — `http://loki:3100`. Server-side only — it must not become `NEXT_PUBLIC_*`, or the endpoint ends up in the browser bundle. Must be set: in a production build the fallback is `http://host.containers.internal:3100` (`LOKI_HOST` in `apps/web/src/lib/shared/utils/logger.utils.ts`), and Loki no longer publishes a port on the host. In development there is no fallback: unset, the server logger and `/api/logs` ship nothing and the logs stay in the console |
| `GEO_BLOCK_COUNTRIES` | no | Comma-separated ISO country codes for which adult content is hidden, e.g. `RU,BY`. Unset or empty falls back to `RU`; it cannot be switched off this way. The country comes from `/app/geo/GeoLite2-Country.mmdb`, downloaded by the web `Dockerfile`, and the client IP from `X-Real-IP` / `X-Forwarded-For`. Outside `next dev` an unknown country — no IP header, no match, or a missing database — counts as blocked, so a proxy that does not forward the client IP blocks every visitor |
| `REVALIDATE_SECRET` | **yes** | Shared secret for `POST /api/revalidate`, compared against the `x-revalidate-secret` header. Server-side only — never `NEXT_PUBLIC_*`, or the secret ships in the browser bundle. Unset disables the endpoint: it answers 503 instead of falling back to an unguarded default |

Everything the frontend needs is public by design except `REVALIDATE_SECRET`; the file also
pins the internal API address, so it stays a secret on both counts.

---

## `HOST_ENV_API` — contents

| Variable | Secret | Description |
|---|---|---|
| `MONGO_CONNECTION_STRING` | **yes** | Full MongoDB URI including credentials, database `games` — `mongodb://<MONGO_ROOT_USERNAME>:<MONGO_ROOT_PASSWORD>@mongodb:27017/games?authSource=admin` against the compose MongoDB |
| `JWT_SECRET` | **yes** | Signing key for access and refresh tokens. Rotating it logs every user out |
| `JWT_EXPIRE` | no | Access token lifetime, e.g. `15m` — consumed via `ConfigService` in `auth.module.ts` |
| `FRONT_URL` | no | Public frontend URL. Drives CORS and links in generated content; must match the frontend's `NEXT_PUBLIC_FRONT_URL` |
| `LOCAL_CONNECTION` | no | Extra comma-separated origins allowed by CORS. Development convenience — leave empty in production |
| `TWITCH_CLIENT_ID` | no | IGDB authenticates through Twitch; this is the app id |
| `TWITCH_CLIENT_SECRET` | **yes** | Twitch app secret for the IGDB sync job |
| `RETROACHIEVEMENTS_API_KEY` | **yes** | RetroAchievements API key |
| `S3_ID` | **yes** | S3 access key id for user uploads |
| `S3_KEY` | **yes** | S3 secret access key |
| `S3_ENDPOINT` | no | Spaces API endpoint, `https://sfo3.digitaloceanspaces.com` (the default). The Space name goes in `S3_BUCKET`, never in this host. Replaces `S3_HOST`; `S3_HOST`, `S3_HOST_CDN` and `S3_REGION` are no longer read |
| `S3_CDN_URL` | no | CDN origin stored URLs are built from, `https://mooncellar.sfo3.cdn.digitaloceanspaces.com` (the default). Must stay allowed by the frontend's `images.remotePatterns` and the image proxy allowlist |
| `S3_BUCKET` | no | The single Space every upload goes to, `mooncellar` (the default). The former buckets are its top-level folders: `covers/`, `screenshots/`, `artworks/`, `characters/`, `avatars/`, `backgrounds/`, `comments/`, `common/` |
| `LOKI_HOST` | no | Loki endpoint for `pino-loki` — `http://loki:3100`. Set, the API logs **only** to Loki; unset, it logs to the console through `pino-pretty`. Leave it unset in local development unless Loki is running, or a 500 leaves no trace anywhere |
| `FARO_COLLECTOR_URL` | no | Grafana Alloy endpoint the `faro` module forwards browser telemetry to — `http://alloy:12347/collect`. The browser never reaches Alloy itself; it posts to the API's `/faro`, which is why Alloy needs no published port. Keep the `/collect` path. Unset, the API drops the telemetry instead of forwarding it — there is no default, so local development without Alloy logs no "Failed to reach Faro collector" errors |
| `PROMETHEUS_ENABLED` | no | `true` / `false` — switches the `/metrics` endpoint off entirely |
| `METRICS_TOKEN` | **yes** | Bearer token guarding `/metrics`. Prometheus must be configured with the same value |
| `INDEXNOW_KEY` | **yes** | IndexNow key used to submit new game pages to search engines |
| `SEARXNG_URL` | no | SearXNG the admin "Fill with AI" draft searches through — `http://searxng:8080`, the `searxng` service of `infra/docker-compose.prod.yml`. The default, `http://localhost:8891`, is empty inside the container: every search step then fails |
| `ANTHROPIC_API_KEY` | **yes** | Claude key for the admin "Fill with AI" draft, its web-search fallback, the AI conflict review and the image elements split. Every one of them asks Claude first and goes to OpenAI only when this is unset or the Claude request fails. Without both keys `POST /games/ai-drafts` and `POST /conflicts/:source/ai` answer 503 |
| `ANTHROPIC_WORKSPACE_ID` | with an organization key | Workspace the requests run in, sent as the `anthropic-workspace-id` header. A key not scoped to a workspace is refused without it (400 "This API key is not scoped to a workspace…"), and every call then silently goes to OpenAI. Leave it empty for a key created inside a workspace |
| `ANTHROPIC_MODEL` | no | Claude model for the same calls, `claude-opus-5-5` by default |
| `OPENAI_API_KEY` | **yes** | OpenAI key: the fallback for every call above, and the only provider of OpenAI image generation in the Images tab |
| `OPENAI_MODEL` | no | Model the OpenAI fallback runs on, `gpt-5-mini` by default |
| `SITE_SESSIONS_KEY` | **yes** | Any long random string; the cookies of the admin Sites tab are encrypted with its SHA-256. Must be the same wherever the same database is used, or stored cookies cannot be read. Without it saving a site answers 503 |
| `RECRAFT_API_TOKEN` | **yes** | Recraft API token for the admin Images tab (recraft.ai → Profile → API). Without it generating with a Recraft model answers 503; OpenAI models keep working through `OPENAI_API_KEY` |
| `STEAMGRIDDB_API_KEY` | **yes** | SteamGridDB API key (steamgriddb.com → Preferences → API) the draft takes covers and hero banners from. Without it that step fails and the draft falls back to images found elsewhere |
| `STEAM_API_KEY` | **yes** | Steam Web API key (steamcommunity.com/dev/apikey) the Steam library import reads owned games with. Without it linking Steam answers 503 |
| `IGDB_AUTO_LINK` | no | `true` lets the nightly IGDB sync link a new IGDB game to a parser-created game it matches with confidence. Unset or anything else sends every match to the admin Conflicts tab instead. A game added by hand always goes to Conflicts, whatever the value |
| `VAPID_PUBLIC_KEY` | no | Web push public key. Generate the pair once with `bunx web-push generate-vapid-keys`. Every instance on the same database (production and a local `dev:api`) must use the same pair: a browser subscribes to one public key, and a push signed with another pair is refused. Replacing the pair silently invalidates every existing subscription. Without it the push toggle is hidden and nothing is sent |
| `VAPID_PRIVATE_KEY` | **yes** | Web push private key of the same pair |
| `VAPID_SUBJECT` | no | Contact the push services see, `mailto:admin@mooncellar.space` by default |
| `DISABLE_CRONS` | no | `true` stops every `@Cron` job. Local development only, because the local `.env` points at the production database and Space. Never set it in `HOST_ENV_API` |

## `HOST_ENV_GAME` — contents

The game service (`apps/game`, [game-service.md](game-service.md)) runs as the
`mooncellar-game` container on port 3229 behind `game.mooncellar.space`. Its image is built and
deployed whenever `apps/game/**`, `packages/**`, `package.json` or `bun.lock` change.

| Variable | Secret | Description |
|---|---|---|
| `MONGO_CONNECTION_STRING` | **yes** | The compose MongoDB with credentials — `mongodb://<MONGO_ROOT_USERNAME>:<MONGO_ROOT_PASSWORD>@mongodb:27017/?authSource=admin`. The service picks its own `game` database; the path part of the URI is ignored |
| `PORT` | no | `3229`; the deploy publishes the same port to `127.0.0.1` for nginx |
| `API_URL` | no | `http://mooncellar-backend:3228` — the API container in the `mooncellar` network. Game sign-in and token checks go through it ([game-sign-in.md](game-sign-in.md)); without it `/account/*` and submitting a time answer 503, reading leaderboards still works. Keep it the container address, not the public host, or the API rate-limits the whole game service as one client ([rate-limits.md](rate-limits.md)) |
| `LOKI_HOST` | no | `http://loki:3100`. Logs carry the label `app=mooncellar-game` |
| `PROMETHEUS_ENABLED` | no | `true` / `false` — default process metrics on `/metrics` |
| `METRICS_TOKEN` | **yes** | Bearer token guarding `/metrics`. Must equal `METRICS_TOKEN` of `HOST_ENV_INFRA`: Prometheus scrapes the job `mooncellar-game` with the same credentials file as the API |
| `MODERATION_TOKEN` | **yes** | Bearer token of the player-level moderation endpoints (`/games/:game/levels/reported`, `…/moderation`, [game-service.md](game-service.md#player-levels)). Without it nobody can hide or show a level; reports still hide one after three |
| `TURN_SECRET`, `TURN_URLS` | **yes** | Not here: the deploy appends both from the `TURN_SECRET` repository secret (`TURN_URLS=game.mooncellar.space:3478`). With them the signalling hands players time-limited TURN credentials ([game-service.md](game-service.md#turn-relay)); without them players connect only directly |

Before the first deploy of the service:

1. Add an `A` record for `game.mooncellar.space` pointing at the host. The infra deploy reissues
   the shared certificate with every `server_name` of `infra/nginx/mooncellar.conf` and stops if
   a name does not resolve.
2. Create the secret: `gh secret set HOST_ENV_GAME < prod-game.env`. A secret created before
   game sign-in existed needs `API_URL` added.
3. Merge: the push to `main` builds and starts `mooncellar-game`, and the infra deploy adds the
   site and the Prometheus job. `curl https://game.mooncellar.space/health` answers
   `{"status":"ok","database":"up",…}`.

---

## Not part of deployment

These exist locally but must never end up in `HOST_ENV_*`:

| Variable | Where it belongs |
|---|---|
| `API_BASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The `game-adder` MCP server — a local development tool. `ADMIN_PASSWORD` is a real account password; keep it out of any shared secret |
| `CHROME_PATH`, `CHECK_BASE_URL` | `bun --filter web check:layout`, run on a developer machine |
| `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD` | `infra/docker-compose.yml`, local MongoDB only |
| `LEGACY_S3_ID`, `LEGACY_S3_KEY`, `LEGACY_S3_ENDPOINT` | The one-off `apps/api/scripts/transfer-s3.ts` run that copies the regru buckets into the Space. Drop them once the old buckets are deleted |

## Dead variables — drop them during the migration

Present in the current `.env` files, referenced nowhere in the code:

| Variable | Why it is dead |
|---|---|
| `GEOIP_DB_PATH` | The database path is hardcoded as `/app/geo/GeoLite2-Country.mmdb` in `geo.utils.ts`, matching the `ADD` in the Dockerfile |
| `NEXT_PUBLIC_S3_HOST` | No reference in `apps/web/src` — image hosts come from `next.config.mjs` |
| `NEXT_PUBLIC_LOKI_HOST` | No reference either; the route handler uses the server-side `LOKI_HOST` |
| `MOONCELLAR_CLIENT_PATH` | Only used by `check-schema-parity.ts`, which is deleted together with the duplicated schemas |

---

## Checklist before the first monorepo deploy

1. `HOST_ENV_WEB`, `HOST_ENV_API` and `HOST_ENV_INFRA` created. The old `HOST_ENV`, `WORK_DIR` and
   `DEPLOY_ROOT` are deleted only after the first successful deploy — until the merge lands
   they still serve the workflow on `main`.
2. The workflow references the new names — grep the yml for `HOST_ENV` without a suffix and for
   `WORK_DIR`, and expect no hits.
3. `git check-ignore -v apps/web/.env apps/api/.env infra/.env` reports a match for all three. The merged root
   `.gitignore` must keep the pattern as `.env`, not `/.env`: with a leading slash it only
   matches the repository root, and `apps/api/.env` — `JWT_SECRET`, `S3_KEY`,
   `TWITCH_CLIENT_SECRET` — becomes committable.
4. `FRONT_URL` (api) and `NEXT_PUBLIC_FRONT_URL` (web) point at the same origin, as do
   `NEXT_PUBLIC_CORS_SERVER` and the API's CORS configuration.
5. The first run after the migration touches root files, so the `changes` job marks both
   apps as changed and both are rebuilt and restarted in one pass. Watch that run: a failure
   in either image build stops the deploy before anything is copied, so the host keeps
   running the previous versions of both.

---

## `.env.example`

`apps/web/.env.example`, `apps/api/.env.example` and `infra/.env.example` are committed with
keys only and no values; the real `.env` files stay untracked. The blocks below mirror them,
with one comment per key — what each value means is in the tables above.

<details>
<summary><code>apps/web/.env.example</code></summary>

```dotenv
# Public API URL used from the browser
NEXT_PUBLIC_API_URL=http://localhost:3228
# API URL used from server components and route handlers
INTERNAL_API_URL=http://localhost:3228
# Public URL of this app — canonical links, sitemap, Open Graph
NEXT_PUBLIC_FRONT_URL=http://localhost:3000
# Game service (apps/game) from the browser and from the server: ports' achievements
NEXT_PUBLIC_GAME_URL=http://localhost:3229
INTERNAL_GAME_URL=http://localhost:3229
# Origin sent as the CORS credentials target
NEXT_PUBLIC_CORS_SERVER=http://localhost:3000
# Release tag attached to Faro telemetry
NEXT_PUBLIC_APP_VERSION=dev
# Application name in Grafana Faro
NEXT_PUBLIC_FARO_APP_NAME=mooncellar-web
# Start Faro under next dev as well (a production build always does)
# NEXT_PUBLIC_FARO_ENABLED=true
# Loki push endpoint for the /api/logs handler (server-side only); leave unset locally
# unless Loki is running — the logs then stay in the console
# LOKI_HOST=http://localhost:3100
# Comma-separated ISO country codes that hide adult content; empty falls back to RU
GEO_BLOCK_COUNTRIES=
# Shared secret guarding POST /api/revalidate
REVALIDATE_SECRET=

# check:layout — run on a developer machine, never part of HOST_ENV_WEB
CHROME_PATH=
CHECK_BASE_URL=http://localhost:3111
```

</details>

<details>
<summary><code>infra/.env.example</code></summary>

```dotenv
# Host directory bind-mounted as MongoDB's /data/db
MONGO_DATA_DIR=
# MongoDB root user — created only when that directory is empty
MONGO_ROOT_USERNAME=
MONGO_ROOT_PASSWORD=
# Host directory bind-mounted as /var/lib/grafana
GRAFANA_DATA_DIR=
# Grafana admin login, published on 127.0.0.1:3000
GRAFANA_ADMIN_USER=
GRAFANA_ADMIN_PASSWORD=
# Host directory bind-mounted as /prometheus
PROMETHEUS_DATA_DIR=
# Bearer token Prometheus sends to the API's /metrics — identical to the API's METRICS_TOKEN
METRICS_TOKEN=
# SearXNG server.secret_key
SEARXNG_SECRET=
```

</details>

<details>
<summary><code>apps/api/.env.example</code></summary>

```dotenv
# MongoDB URI including credentials, database `games`
MONGO_CONNECTION_STRING=mongodb://admin:admin@localhost:27017/games?authSource=admin
# Stops every @Cron job — local development only, never part of HOST_ENV_API
DISABLE_CRONS=true
# Signing key for access and refresh tokens
JWT_SECRET=
# Access token lifetime
JWT_EXPIRE=15m
# Public frontend URL — CORS and generated links
FRONT_URL=http://localhost:3000
# Extra comma-separated CORS origins for local development
LOCAL_CONNECTION=http://localhost:3000

# IGDB authenticates through Twitch
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=

RETROACHIEVEMENTS_API_KEY=

# DigitalOcean Spaces: one bucket, a folder per content type
S3_ID=
S3_KEY=
S3_ENDPOINT=https://sfo3.digitaloceanspaces.com
S3_BUCKET=mooncellar
S3_CDN_URL=https://mooncellar.sfo3.cdn.digitaloceanspaces.com

# Observability — leave LOKI_HOST unset locally: with it set the API logs only to Loki,
# and without a running Loki every log line, errors included, is lost
# LOKI_HOST=http://localhost:3100
# FARO_COLLECTOR_URL=http://localhost:12347/collect
PROMETHEUS_ENABLED=false
METRICS_TOKEN=

# IndexNow submission key
INDEXNOW_KEY=

# AI game draft — in production SEARXNG_URL=http://searxng:8080
SEARXNG_URL=http://localhost:8891
ANTHROPIC_API_KEY=
ANTHROPIC_WORKSPACE_ID=
ANTHROPIC_MODEL=claude-opus-5-5
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
# IGDB sync: link confident matches instead of queueing them in Conflicts
IGDB_AUTO_LINK=false
RECRAFT_API_TOKEN=
SITE_SESSIONS_KEY=
STEAMGRIDDB_API_KEY=

# game-adder MCP server — local tooling, never part of HOST_ENV_API
API_BASE_URL=http://localhost:3228
ADMIN_EMAIL=
ADMIN_PASSWORD=

# transfer-s3 script — one-off copy of the regru buckets, never part of HOST_ENV_API
LEGACY_S3_ID=
LEGACY_S3_KEY=
LEGACY_S3_ENDPOINT=https://s3.regru.cloud
```

</details>

---

## Moving to a new host

The deploy creates its own containers and network, so the host needs almost nothing prepared.
What it does need, and what the pipeline will not do for you:

1. **Docker with Compose v2, enabled at boot.** `systemctl enable --now docker`, and
   `docker compose version` must answer — `docker-compose.prod.yml` is a Compose Spec file
   (top-level `name:`, `${VAR:?}`, `external: true`) that the old Python `docker-compose` v1
   cannot parse. The `Check the server` step asserts both before anything is built.
   `--restart always` is executed by the daemon, so a daemon that does not start brings nothing
   up with it. `SSH_USER` must reach it: `root`, or a user in the `docker` group.
2. **The MongoDB data.** Nothing in the pipeline copies a database. MongoDB bind-mounts
   `MONGO_DATA_DIR`, so moving hosts is moving that directory — put it in place *before* the
   first deploy, or compose starts an empty one and initialises a new root user.

   Copy it from a **stopped** MongoDB: a `dbpath` snapshotted while mongod was writing can
   refuse to start. An empty `mongod.lock` is the sign of a clean shutdown — two bytes in it
   means the copy was taken from a running server, and it is worth repeating.

   The files are also WiredTiger internals, readable only by the same major version. The old
   host ran `mongo:latest` and its `WiredTiger` file reads `WiredTiger 12.0.0`, which is
   MongoDB 8 — hence `image: mongo:8` in `docker-compose.prod.yml`. Confirm with
   `podman exec Mongo mongod --version` before trusting a file copy; pointing `mongo:7` at
   these files fails at startup rather than silently.

   ```bash
   # old host, mongod stopped
   tar -C <old dbpath> -czf mongo-data.tgz .

   # new host
   mkdir -p <MONGO_DATA_DIR> && tar -C <MONGO_DATA_DIR> -xzf mongo-data.tgz
   ```

   Ownership sorts itself out: the `mongo` image's entrypoint starts as root and `chown`s
   `/data/db` to its own `mongodb` user before dropping privileges.

   Across major versions, or from a running instance, use a dump instead:

   ```bash
   # old host
   podman exec mongodb mongodump --archive --gzip -u <user> -p <pass> \
     --authenticationDatabase admin > mooncellar.archive.gz

   # new host, after the first infra deploy created the mongodb container
   docker exec -i mongodb mongorestore --archive --gzip -u <user> -p <pass> \
     --authenticationDatabase admin < mooncellar.archive.gz
   ```

   A carried-over directory keeps its own users. Changing `MONGO_ROOT_PASSWORD` afterwards does
   nothing — the credentials live in the data files, and only `db.changeUserPassword` in a shell
   changes them.
3. **The reverse proxy and TLS.** Ports `3111` and `3228` are published on `127.0.0.1`; nothing
   else terminates HTTPS or routes `mooncellar.space` / `api.mooncellar.space` to them. The
   proxy must pass the client address in `X-Real-IP` or `X-Forwarded-For`: without it the web
   app cannot resolve a country and treats every visitor as geo-blocked.
4. **A firewall that understands Docker.** `ufw` filters the `INPUT` chain, while Docker's
   published ports traverse `FORWARD` through `DOCKER-USER`. Everything is published on loopback
   only, so nothing is exposed until the proxy is — keep it that way when adding a port. The one
   exception is `coturn` on the host network: `ufw` filters it like any host service, so its UDP
   3478 and 49160–49200 need `ufw allow` rules.
5. **DNS last.** Deploy, check the new host through a hosts entry, and only then move the A
   records. The old host keeps serving until they propagate.
