# Contributing

Pull requests are the reason this code is public. Bug reports, fixes and features are all
welcome.

## Licence terms for contributions

MoonCellar is source-available, not open source — see [`LICENSE`](LICENSE) and
[docs/license.md](docs/license.md). Two points matter before you start:

- You may clone the repository and run it locally to develop and test a change. You may not
  deploy it or make it available to anyone else.
- By opening a pull request you grant the copyright holders a perpetual, irrevocable,
  sublicensable licence to use, modify and relicense your contribution as part of the project,
  and you confirm the work is your own. This is section 4 of the licence; there is no separate
  CLA to sign.

If either of those is a problem for you, please open an issue instead of a pull request.

## Getting set up

Follow **Running the monorepo locally** in the [README](README.md#running-the-monorepo-locally).
Short version:

```bash
bun install
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
docker compose -f infra/docker-compose.yml up -d
bun run dev
```

This project uses **bun** exclusively. Do not run `npm install`, and never commit a
`package-lock.json` — the lockfile is shared across the whole monorepo and `bun.lock` is the
only one allowed.

## Before you open the pull request

```bash
bun run lint          # every workspace
bun run build         # every workspace
bun run format:check  # prettier
```

`lint-staged` runs the linters for the touched workspace on commit, and the build is what CI
checks, so running both locally saves a round trip.

## Commit messages

Commits are validated by commitlint on the `commit-msg` hook:

- [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`,
  `refactor:`, `chore:`, and so on.
- At least 5 characters in the header.
- **Latin letters only** — a Cyrillic character anywhere in the header fails the hook.

```
feat(gauntlet): add a filter for unreleased games
fix(api): keep partial settings updates from wiping other keys
```

## Scope of a pull request

One change per pull request. If a fix needs a refactor to make room for it, the refactor is
easier to review as its own commit inside the same pull request than mixed into the fix.

Repository-wide conventions that reviewers will check are collected in
[`CLAUDE.md`](CLAUDE.md) — the monorepo rules, the shared `@mooncellar/schemas` package, and the
constraints that are not visible from the code that breaks when they are violated.

Codex reads the same rules through [`AGENTS.md`](AGENTS.md) and the project's
`.codex/config.toml`. Its `$hub` and `$task` skills mirror Claude Code's `/hub` and `/task`
commands; see [Codex setup](docs/codex.md). Keep the two workflows consistent when changing
branches, pull requests or checks.
