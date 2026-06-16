# Filament Skills

Optional task-scoped skills for agents that support `SKILL.md` folders.
The canonical skill folders live here; `.claude/skills/*` contains individual
symlinks back to each skill folder for Claude-style discovery.

These skills do not replace the directory-scoped rules in `app/`, `resources/`,
and `tests/`. They route an agent from a task intent ("build a table",
"write Filament tests", "create an action") to the relevant canonical rules.

The skills deliberately avoid absolute paths. When a skill asks for a rule file,
resolve it from the current project root. In a project where these rules were
installed for a specific agent, read the same scoped file using that agent's
filename when present, for example `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md`.

| Skill | Use for |
| ----- | ------- |
| `filament-docs` | Finding the right local rule files and official docs |
| `filament-resource` | Creating or reviewing complete resources |
| `filament-forms` | Building form schemas and field layouts |
| `filament-infolists` | Building read-only record schemas |
| `filament-tables` | Building tables, columns, filters, and table actions |
| `filament-actions` | Building page, table, modal, bulk, import, and export actions |
| `filament-dashboard` | Building dashboard/custom panel pages from widgets and schemas |
| `filament-widgets` | Building stats, chart, table, and custom widgets |
| `filament-testing` | Writing Pest + Livewire coverage for Filament surfaces |
