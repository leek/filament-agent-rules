# filament-agent-rules

Directory-scoped agent rules for Filament projects. Each `CLAUDE.md` lives next to the code it governs and mirrors the [filamentphp/filament](https://github.com/filamentphp/filament) panel skeleton — agents pick up the rules for whatever file you're editing.

Targets the current Filament panel builder APIs: extracted resource `Schemas/` and `Tables/` classes, `Filament\Actions\*`, table `recordActions()` / `toolbarActions()`, action modal `schema()`, `TextColumn::badge()`, and layout components under `Filament\Schemas\Components\*`.

## Install

Use [apply-agent-rules](https://github.com/leek/apply-agent-rules) to drop the rules into a Filament project:

```bash
# Preview what will be written
npx apply-agent-rules list leek/filament-agent-rules --agents claude

# Install into the current project, interactive agent picker
npx apply-agent-rules apply leek/filament-agent-rules

# Non-interactive (pick agents explicitly)
npx apply-agent-rules apply leek/filament-agent-rules --agents claude,codex

# Pin to a release tag
npx apply-agent-rules apply leek/filament-agent-rules@v0.14.0 --agents claude

# Re-pull later, preserving local edits and pruning removed files
npx apply-agent-rules update
```

Supported agents: `claude`, `codex`, `gemini`, `cursor`, `windsurf`, `cline`.

## How install works

Every `CLAUDE.md` in this repo is the canonical source. The installer walks the tree and, for each `CLAUDE.md` it finds, writes one file per selected agent into the **same directory** under that agent's expected filename:

| Agent     | Filename written          |
| --------- | ------------------------- |
| `claude`  | `CLAUDE.md`               |
| `codex`   | `AGENTS.md`               |
| `gemini`  | `GEMINI.md`               |
| `cursor`  | `.cursor/rules/*.mdc`     |
| `windsurf`| `.windsurfrules`          |
| `cline`   | `.clinerules`             |

So picking `--agents claude,codex` against this repo produces, for example:

```
app/Filament/Resources/CLAUDE.md      ← Claude reads this
app/Filament/Resources/AGENTS.md      ← Codex reads this
app/Filament/Widgets/CLAUDE.md
app/Filament/Widgets/AGENTS.md
app/Providers/Filament/CLAUDE.md
app/Providers/Filament/AGENTS.md
...
```

Each agent picks up the rules colocated with the file it's editing — no central rules file, no manual wiring. Subdirectory rules ship as separate files in their own subdirectories, not concatenated into the root.

## Optional skills

This repo also ships optional task-scoped skills in `.agents/skills/`. They are a workflow layer for agents that support `SKILL.md` folders. Each skill is also exposed as an individual symlink under `.claude/skills/` for Claude-style skill discovery.

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

The skills intentionally do **not** duplicate the full rule content. They route an agent from a task intent ("build a Filament table") to the canonical directory rules and use relative project paths only — no user-specific home directories.

### Path-scoped rules (`.claude/rules/*.md`)

In addition to the per-directory `CLAUDE.md` files, this repo ships a `.claude/rules/` directory that applies the same rules by path match. Filament projects often deviate from the stock layout — domain-grouped resources like `app/Filament/Resources/Shop/Products/Pages/...` or multi-panel layouts like `app/Filament/Admin/Resources/...` won't match a strict per-directory CLAUDE.md, but a path pattern like `app/Filament/**/Pages/*.php` catches them all.

Each `.claude/rules/*.md` is a **symlink** to its canonical `CLAUDE.md`, so the two can never drift — edit the per-directory file and both surfaces update. The path-scoped frontmatter lives at the top of the canonical file itself (Claude Code / agent path matching uses `paths:`):

```yaml
---
description: Resource page classes (lifecycle hooks)
paths:
  - app/Filament/**/Pages/*.php
---
```

Agents that read `CLAUDE.md` / `AGENTS.md` directly see this frontmatter block as inert text and ignore it.

**Eight** rule types are path-scoped and symlinked under `.claude/rules/`:

| Symlink | Canonical file |
| ------- | -------------- |
| `filament-actions.md` | `app/Filament/Actions/CLAUDE.md` |
| `filament-resources.md` | `app/Filament/Resources/CLAUDE.md` |
| `filament-resource-pages.md` | `app/Filament/Resources/Pages/CLAUDE.md` |
| `filament-relation-managers.md` | `app/Filament/Resources/RelationManagers/CLAUDE.md` |
| `filament-schemas.md` | `app/Filament/Resources/Schemas/CLAUDE.md` |
| `filament-tables.md` | `app/Filament/Resources/Tables/CLAUDE.md` |
| `filament-widgets.md` | `app/Filament/Widgets/CLAUDE.md` |
| `filament-providers.md` | `app/Providers/Filament/CLAUDE.md` |

The rest (`app/Filament/CLAUDE.md`, `Clusters/`, `Pages/`, `tests/Feature/Filament/`, `resources/css/filament/`) live at fixed paths that don't vary with domain grouping, so the per-directory `CLAUDE.md` already matches and a path rule would be redundant.

## What you get

| Path                                              | Covers                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| `app/Filament/CLAUDE.md`                          | Cross-cutting: naming, where things live, panel discovery                  |
| `app/Filament/Resources/CLAUDE.md`                | Resources: model binding, navigation, global search, authorization         |
| `app/Filament/Resources/Pages/CLAUDE.md`          | ListRecords / CreateRecord / EditRecord / ViewRecord lifecycle hooks       |
| `app/Filament/Resources/RelationManagers/CLAUDE.md` | Relation managers + ManageRelatedRecords pages                            |
| `app/Filament/Resources/Schemas/CLAUDE.md`        | Forms + Infolists: components, layout, lifecycle hooks, dependent fields  |
| `app/Filament/Resources/Tables/CLAUDE.md`         | Tables: columns, filters, bulk actions, eager loading, persistence         |
| `app/Filament/Clusters/CLAUDE.md`                 | Cluster grouping for multi-resource sections                               |
| `app/Filament/Pages/CLAUDE.md`                    | Custom panel pages (settings, dashboards, wizards)                         |
| `app/Filament/Widgets/CLAUDE.md`                  | Stats / Chart / Table widgets, polling, lazy loading                       |
| `app/Filament/Actions/CLAUDE.md`                  | Action plumbing: forms inside actions, modals, bulk, requires-confirmation |
| `app/Providers/Filament/CLAUDE.md`                | PanelProvider: discovery, middleware, multi-panel, tenancy                 |
| `resources/css/filament/CLAUDE.md`                | Theme CSS: tokens, vendor override mapping, build step                     |
| `tests/Feature/Filament/CLAUDE.md`                | Pest + Livewire tests: pages, forms, tables, actions, authorization        |

## Companion

Use alongside [leek/laravel-agent-rules](https://github.com/leek/laravel-agent-rules) for general Laravel conventions. This repo only covers Filament-specific patterns.

## Versioning

Releases are tagged. Pin with `leek/filament-agent-rules@v0.14.0` if you want reproducible installs.

## More Filament plugins by Leek

**Premium**

- [**Filament UI Plus**](https://filamentphp.com/plugins/leek-ui-plus) — Enhanced UI components: dual sub-navigation, animated sidebar, horizontal-scroll tables, loading bar, and more.
- [**Filament Workflow Engine**](https://filamentphp.com/plugins/leek-workflow-engine) — Automated workflows with a visual builder, triggers/actions, async execution, and audit logging.
- [**Filament Decision Tables**](https://filamentphp.com/plugins/leek-decision-tables) — Business rules engine with spreadsheet-style decision tables.

**Free & open source**

- [**Filament Right Click**](https://github.com/leek/filament-right-click) — Right-click context menus for table rows.
- [**Filament Header Filters**](https://github.com/leek/filament-header-filters) — Inline filters attached to table column headers.
- [**Filament Subtenant Scope**](https://github.com/leek/filament-subtenant-scope) — Second-level tenancy scoping via a topnav dropdown.
- [**Filament DiceBear**](https://github.com/leek/filament-dicebear) — DiceBear avatar provider with 31 styles.

## License

MIT
