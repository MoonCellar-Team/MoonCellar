# ProjectsManager

Manage status hub projects, their upload tokens and their enabled blocks.

## Composition

- `ProjectsManager` creates projects and lists existing ones.
- `ProjectForm` edits the name, address, group, enabled blocks and default page. The default page
  must be one of the enabled blocks; turning that block off selects an enabled page automatically.
- `useProjectActions` opens the shared edit, token and delete dialogs from both Manage projects and
  a project's page.

## Rules

- Keep `defaultBlock` in the project request and response contract. `/<slug>` opens that enabled
  block; explicit `/<slug>/<block>` paths still select their named block.
- Turning a block off removes its uploaded data, so keep the warning in `ProjectForm` visible when
  editing an existing project.
- **A group is free text on the project (`ProjectSchema.group`, at most 40 characters), not a list
  of its own.** An empty field leaves the project ungrouped, and the projects menu builds its
  sections from whatever names exist — renaming a group renames it for every project that carries
  the old name.
