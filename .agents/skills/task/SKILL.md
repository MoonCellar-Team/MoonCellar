---
name: task
description: "Take a task of MoonCellar's plan (it lives in the status hub) and do it, or list the free ones. Use when the user invokes $task or /task in this repository."
---

Run scripts from the repository root, even when Codex starts inside a workspace.

Listing or inspecting tasks does not authorize taking a task. The workflow authorization below applies when the user asks to take or execute a task.

A task of the plan. Id: the arguments supplied by the user (empty — show the free tasks and ask).

The plan lives in the status hub (`bun scripts/tasks.ts url`), not in the repository: people take,
finish and add tasks on the site, so read its state from the hub every time, never from memory.
Every task has an id (section letter and number, `H6`), what to do, where, what it depends on,
when it is done and a size (S — a day or less, M — a few days, L — a week or more).

By running this command the user allows you to take, release, finish and add tasks in the hub
(`bun scripts/tasks.ts`), and to commit the task's work to a branch and open a pull request for it.
Never push to `main`. Merge only when the user's rules allow it, and only a PR with passing checks,
as a merge commit; otherwise the PR waits for a person.

Preparation: `bun scripts/tasks.ts list --free` answers "No hub token" — ask the user to run `$hub`
(or `bun scripts/hub-connect.ts mooncellar`) and stop.

1. `bun scripts/tasks.ts list` — tasks and their state: "free", "led by …", "waits for …" (tasks it
   depends on are not done), "done". No id given — show the free ones (`--free`), ask which one to
   take, and stop.
2. `bun scripts/tasks.ts show <id>`. If it waits for other tasks, say which and stop (take it only
   if the user confirms).
3. Take it: `bun scripts/tasks.ts take <id>` (it acts as git `user.name` in lower case; `--as` for
   someone else). A 409 means someone else leads it: say who and stop (`--force` only when the user
   explicitly asks).
4. Branch from a fresh `main`: `git fetch origin`, then
   `git switch -c <type>/<id>-<short-name> origin/main` — type `feat`, `fix`, `docs` or `chore`,
   the id in lower case.
5. Do the task so that its "done when" holds, following `CLAUDE.md` (read every `CLAUDE.md` on the
   path to what you touch; update the `CLAUDE.md`, stories and `docs/` that describe it in the same
   change). Run the checks of what you touched (`bun run lint`, `bun run build`, the workspace's
   tests).
6. Commit with a Conventional Commits header in Latin letters only (commitlint), push the branch and
   open a PR to `main` (`gh pr create`); its description names the task ("Task: H6 in the status
   hub") and what was checked.
7. When the PR is merged (by you, if the user's rules allow it, or by a person) and deployed if it
   ships something: `bun scripts/tasks.ts done <id>`.
8. Found a new task on the way — add it and say so:
   `bun scripts/tasks.ts add <section> "<task>"` with `--where`, `--depends <ids>`, `--done-when`
   and `--size S|M|L`; the hub picks the number. A new section:
   `bun scripts/tasks.ts section "<title>"`.

At the end: what was done, whether "done when" holds, the PR and whether it was merged, whether the
task is marked done, and which tasks it freed.
