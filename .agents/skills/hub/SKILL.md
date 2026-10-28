---
name: hub
description: "Connect this machine to the status hub (its own token) and open the MoonCellar project there. Use when the user invokes $hub or /hub in this repository."
---

Run scripts from the repository root, even when Codex starts inside a workspace.

The status hub (https://status.mooncellar.space, MoonCellar admins only) is where MoonCellar's plan
lives: sections and tasks that people take and finish on the site and agents through `$task`. To
read and change the plan from here, this machine needs its own token for the `mooncellar` project.
Token name: the arguments supplied by the user (empty — `<user>@<host>`).

1. Check: `bun scripts/tasks.ts list --free`. If it runs without an error (there may be no free
   tasks), the machine is connected: give the link (`bun scripts/tasks.ts url`), say briefly how
   many tasks are free, and stop — unless the user asked to connect again, for example after a
   token was revoked. "No hub token" or a 401 — go to step 2.
2. Connect: run `bun scripts/hub-connect.ts mooncellar` (with a name — `--name "<name>"`) so that it
   keeps waiting while you answer (use `exec_command` with a short yield time, then poll the returned session with `write_stdin`). It prints a link
   and opens it in the browser. Tell the user to sign in with a MoonCellar admin account and press
   "Allow" (not an admin — a hub admin has to open the link). The command waits up to ten minutes
   and saves the token to `~/.config/mooncellar/mooncellar-hub-token` (mode 600) by itself.
3. Wait for the command to finish. "Connected" — check `bun scripts/tasks.ts list --free` and give
   the link. "Not connected" or ten minutes passed — say what the command answered and offer to run
   `$hub` again.

Never print the token, pass it in a command or copy it anywhere: only the scripts read it
(`scripts/hub-client.ts`). A machine's token is revoked in the hub: Manage projects → "N tokens" →
Revoke.

At the end: whether the machine is connected, the link to the project, and what next — `$task`.
