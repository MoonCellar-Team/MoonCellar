# MoonCellar agent instructions

Read the root `CLAUDE.md` and `.claude/CLAUDE.md` before working in this repository. They are
shared project instructions and apply to Codex too. Read each nested `CLAUDE.md` on the path
to any file you touch, and keep those documents current as the root instructions require.

`.codex/config.toml` includes `CLAUDE.md` in `project_doc_fallback_filenames`, so Codex also
discovers existing workspace, page and component instructions without duplicating them.
Keep shared rules in their existing files; use `AGENTS.md` for Codex-specific guidance.

## Commands and skills

Skills are shared in `.agents/skills/` and are available from every workspace. Claude's
`/hub [machine name]` and `/task [id]` workflows are available in Codex as `$hub [machine name]`
and `$task [id]`. Use the corresponding skill when the user invokes either spelling.
Run their scripts from the repository root. Keep both agents' workflows consistent when
changing them, together with `CONTRIBUTING.md`, `CLAUDE.md` and `docs/status-hub.md`.

The hub scripts still read `.claude/status-hub.json`; reuse that project binding and the
existing machine token. Do not copy credentials into Codex configuration.

## MCP and hooks

Project MCP servers and graphify hooks are configured in `.codex/config.toml`. Use `bunx`
for JavaScript MCP packages. Server commands must be available on `PATH`; Grafana also
requires `GRAFANA_SERVICE_ACCOUNT_TOKEN` in the environment. Preserve MongoDB's read-only
mode and Grafana's disabled write tools.

The graphify guards use the executable on `PATH` instead of a machine-specific home directory.
Follow the graphify and CodeGraph navigation rules in `CLAUDE.md` even when a hook or MCP
server is unavailable. Migration details and setup are in `docs/codex.md`.
