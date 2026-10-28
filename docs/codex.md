# Codex setup

Open this repository in Codex and start a new session after changing its configuration.
The project configuration lives in `.codex/config.toml`; it applies to this repository
without changing the user's global Codex settings. Codex loads project configuration only
for trusted projects. Hooks also follow Codex's normal hook trust requirements.

## Instructions

`AGENTS.md` points Codex to the shared root `CLAUDE.md` and `.claude/CLAUDE.md`. The
`project_doc_fallback_filenames = ["CLAUDE.md"]` setting loads existing nested instructions
for workspaces, pages and shared UI components. There is one maintained copy of each rule.
The instruction budget is 128 KiB so the frontend's detailed instructions fit together with
component guidance.

## Commands and skills

| Claude Code           | Codex                 | Purpose                                 |
| --------------------- | --------------------- | --------------------------------------- |
| `/hub [machine name]` | `$hub [machine name]` | Connect this machine to the status hub  |
| `/task [id]`          | `$task [id]`          | List tasks or carry out a selected task |

The Codex workflows live in `.agents/skills/hub/SKILL.md` and
`.agents/skills/task/SKILL.md`. Keep them consistent with `.claude/commands/`.
Existing `frontend-design`, `graphify`, `mockup` and `seo-audit` skills already live in
`.agents/skills/` and need no migration or duplication. Scripts run from the repository root.

The hub keeps using `.claude/status-hub.json` and the existing token under
`~/.config/mooncellar/`; reconnecting or copying the token is unnecessary.
See [the status hub guide](status-hub.md) for its workflow.

## MCP servers

The five project servers from `.mcp.json` are configured in Codex:

| Server       | Launcher                                                            | Requirements                                                            |
| ------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `codegraph`  | `codegraph serve --mcp`                                             | CodeGraph installed on `PATH`                                           |
| `playwright` | `bunx @playwright/mcp@latest`                                       | Bun and the browser dependencies required by Playwright                 |
| `mongodb`    | `bunx mongodb-mcp-server@latest --readOnly`                         | Bun; MongoDB connection configured for the server                       |
| `game-adder` | `bun run --env-file=apps/api/.env apps/api/mcp/game-adder/index.ts` | Bun, workspace dependencies and the API environment                     |
| `grafana`    | `docker run … mcp/grafana -t stdio …`                               | Docker and `GRAFANA_SERVICE_ACCOUNT_TOKEN` in the launching environment |

`game-adder` resolves the repository root before launching, so it also works from a workspace.
Grafana receives the token through `env_vars`; its value is never stored in the config.
MongoDB remains read-only. Grafana retains all the original disabled write tools and
integration flags. Use `codex mcp list` to inspect registration; registration alone does not
verify a server's connection. Keep `.mcp.json` and `.codex/config.toml` consistent when
changing a shared server.

## Hooks and Claude-specific settings

The two graphify `PreToolUse` guards are configured inline in `.codex/config.toml`, using
`graphify hook-guard search` and `graphify hook-guard read` from `PATH`. This replaces the
original machine-specific absolute executable paths. Codex shell tools match `Bash`;
the read guard applies when the corresponding file tools are exposed. The shared graph
navigation rules still apply to shell-based file reads.

Claude's permission syntax (`Bash(...)`, `Read(...)`, `mcp__...`) is not a Codex configuration
format. The local allow list contains old scratch files, old checkout paths and broad
command approvals; it remains in `.claude/settings.local.json` rather than being converted
into sandbox exceptions. Codex keeps its existing approval and sandbox settings.

`ponytail@ponytail` is a Claude plugin identifier, not a Codex plugin configuration. Its
enabled flag remains in Claude's settings; the plugin itself has not been installed into
Codex. `.claude/settings.json.graphify-bak` is a backup, not an active configuration.
The original Claude files are retained so both agents can use this repository.

Configuration formats follow the official OpenAI documentation for
[project instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md),
[skills](https://learn.chatgpt.com/docs/build-skills),
[configuration](https://learn.chatgpt.com/docs/config-file/config-reference) and
[hooks](https://learn.chatgpt.com/docs/hooks).
