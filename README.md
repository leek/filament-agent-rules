# filament-agent-rules

Directory-scoped agent rules for Filament projects. Each `CLAUDE.md` lives next to the code it governs and mirrors the [filamentphp/filament](https://github.com/filamentphp/filament) panel skeleton — agents pick up the rules for whatever file you're editing.

Targets **Filament v4 and v5**. v5 (released Jan 2026) is a Livewire v4 compat bump with the same public API as v4; rules call out the few deltas inline.

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
