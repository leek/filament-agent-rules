# filament-agent-rules

Directory-scoped agent rules for Filament projects. The rule tree mirrors the [filamentphp/filament](https://github.com/filamentphp/filament) panel skeleton. The inherited hub routes agents to class-type rules whose skeleton directories are siblings of actual resource code.

Targets Filament **5.9.0 or later in 5.x**, the released baseline used to verify these rules, including the security helpers. Examples use extracted resource `Schemas/` and `Tables/` classes, `Filament\Actions\*`, table `recordActions()` / `toolbarActions()`, action modal `schema()`, `TextColumn::badge()`, and layout components under `Filament\Schemas\Components\*`. Check the target project's installed version before applying guidance; older installations need an upgrade or version-appropriate rules.

## Install

Use [apply-agent-rules](https://github.com/leek/apply-agent-rules) to drop the rules into a Filament project:

```bash
# Preview what will be written
npx apply-agent-rules list leek/filament-agent-rules --agents claude --exclude 'scripts/**'

# Install into the current project, interactive agent picker
npx apply-agent-rules apply leek/filament-agent-rules --exclude 'scripts/**'

# Non-interactive (pick agents explicitly)
npx apply-agent-rules apply leek/filament-agent-rules --agents claude,codex --exclude 'scripts/**'

# Pin to a release tag
npx apply-agent-rules apply leek/filament-agent-rules@v0.15.2 --agents claude --exclude 'scripts/**'

# Re-pull later, preserving local edits and pruning removed files
npx apply-agent-rules update --exclude 'scripts/**'
```

Supported agents: `claude`, `codex`, `gemini`, `cursor`, `windsurf`, `cline`.

The installer walks the source filesystem, including gitignored files in a local checkout. To install from this maintenance checkout, also exclude the gitignored root meta file:

```bash
npx apply-agent-rules apply . --agents claude,codex --exclude CLAUDE.md --exclude 'scripts/**'
```

The root-only `CLAUDE.md` exclusion leaves nested canonical rules intact. The installer already excludes `.github/` maintenance records and workflows.

## How install works

Every `CLAUDE.md` in this repo is the canonical source. The installer walks the tree and, for each `CLAUDE.md` it finds, writes one file per selected agent into the **same directory** under that agent's expected filename:

| Agent     | Filename written          |
| --------- | ------------------------- |
| `claude`  | `CLAUDE.md`               |
| `codex`   | `AGENTS.md`               |
| `gemini`  | `GEMINI.md`               |
| `cursor`  | `.cursorrules`            |
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

Directory-aware agents inherit the hub at `app/Filament/`. Specialized skeleton rules such as `Resources/Tables/AGENTS.md` are **not** ancestors of `Resources/Orders/Tables/OrdersTable.php`. The hub requires agents to read the matching class-type rules explicitly, including for clustered resources and multi-panel layouts. Agents without directory inheritance must load the hub and follow its routing table through their own rule mechanism. Rules remain separate files rather than being concatenated into the root.

## Optional skills

This repo also ships optional task-scoped skills in `.agents/skills/`. They are a workflow layer for agents that support `SKILL.md` folders. In this source checkout, each skill is exposed as an individual directory symlink under `.claude/skills/`.

The current installer copies `.agents/skills/` but skips directory symlinks, so it does **not** install those Claude discovery links. After installation, create individual links from the target project root (review any existing same-name folders first):

```sh
mkdir -p .claude/skills
for skill_dir in .agents/skills/filament-*; do
    skill_name=${skill_dir##*/}
    if [ ! -e ".claude/skills/$skill_name" ] && [ ! -L ".claude/skills/$skill_name" ]; then
        ln -s "../../.agents/skills/$skill_name" ".claude/skills/$skill_name"
    fi
done
```

Run this step only for missing links; the guard ensures existing links or directories are left untouched.

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

In addition to the per-directory `CLAUDE.md` files, this repo ships a `.claude/rules/` directory that applies the same rules by path match. These patterns cover resource-specific, domain-grouped, multi-panel, and clustered resource directories. Resource-page patterns require a `Resources/` ancestor to avoid applying lifecycle guidance to standalone panel pages; classify nonstandard page locations by base class through the hub's routing table.

Each `.claude/rules/*.md` is a **symlink** to its canonical `CLAUDE.md`, so the two can never drift — edit the per-directory file and both surfaces update. The path-scoped frontmatter lives at the top of the canonical file itself (Claude Code / agent path matching uses `paths:`):

```yaml
---
description: Resource page classes (lifecycle hooks)
paths:
  - app/Filament/**/Resources/**/Pages/*.php
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

The remaining files are reached through directory inheritance where applicable and the hub's routing table. Custom pages and clusters can live below panel-specific directories; their canonical skeleton rule files are not automatically inherited there.

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
| `resources/css/filament/CLAUDE.md`                | Theme CSS: Vite registration, source scanning, tokens, build step          |
| `tests/Feature/Filament/CLAUDE.md`                | Pest + Livewire tests: pages, forms, tables, actions, authorization        |

## Companion

Use alongside [leek/laravel-agent-rules](https://github.com/leek/laravel-agent-rules) for general Laravel conventions. This repo only covers Filament-specific patterns.

## Versioning

Releases are tagged. Pin with `leek/filament-agent-rules@v0.15.2` if you want reproducible installs. A pin stays on that release; it does not include changes made afterward.

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
