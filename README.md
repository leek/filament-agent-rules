# filament-agent-rules

Directory-scoped agent rules for Filament projects. Each `CLAUDE.md` lives next to the code it governs and mirrors the [filamentphp/filament](https://github.com/filamentphp/filament) panel skeleton — agents pick up the rules for whatever file you're editing.

Targets **Filament v4 and v5**. v5 (released Jan 2026) bumps to Livewire v4 and ships a handful of API renames — most notably `Tables\Actions\*` collapsing into `Filament\Actions\*`, table method renames (`actions` → `recordActions`, `bulkActions` → `toolbarActions`), the removal of `BadgeColumn` (use `TextColumn::badge()`), and action modals moving from `->form()` to `->schema()`. Layout components (`Section`, `Grid`, `Tabs`, `Wizard`) live under `Filament\Schemas\Components\*` in v5 only. Rules show v5 names and flag the v4 form inline.

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
npx apply-agent-rules apply leek/filament-agent-rules@v0.1.0 --agents claude

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

### Claude glob-based rules (`.claude/rules/*.md`)

In addition to the per-directory `CLAUDE.md` files, this repo ships a `.claude/rules/` directory containing the same content with `globs:` frontmatter. Filament projects often deviate from the stock layout — domain-grouped resources like `app/Filament/Resources/Shop/Products/Pages/...` won't match a strict per-directory CLAUDE.md, but a glob like `app/Filament/Resources/**/Pages/*.php` catches them all.

The `.claude/rules/` files copy the canonical CLAUDE.md content and add Cursor-style frontmatter:

```yaml
---
description: Resource page classes (lifecycle hooks)
globs:
  - app/Filament/Resources/**/Pages/*.php
alwaysApply: false
---
```

Both systems coexist: the per-dir `CLAUDE.md` is the source of truth, and `.claude/rules/*.md` mirrors it for dynamic glob matching. Edit the per-dir file; `.claude/rules/` regenerates from it.

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
| `tests/Feature/Filament/CLAUDE.md`                | Pest + Livewire tests: pages, forms, tables, actions, authorization        |

## Companion

Use alongside [leek/laravel-agent-rules](https://github.com/leek/laravel-agent-rules) for general Laravel conventions. This repo only covers Filament-specific patterns.

## Versioning

Releases are tagged. Pin with `leek/filament-agent-rules@v0.1.0` if you want reproducible installs.

## License

MIT
