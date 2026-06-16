---
name: filament-dashboard
description: Use this skill whenever creating, editing, reviewing, or debugging a Filament dashboard or custom panel page that composes widgets, schemas, tabs, callouts, embedded Livewire components, navigation, or page-specific actions.
---

# Filament Dashboard And Page Workflow

Use this skill for dashboards and custom panel pages. Prefer composing existing
Filament widgets, schema components, and embedded Livewire components before
building bespoke Blade-heavy pages.

## Read First

Resolve paths from the current project root:

1. `app/Filament/CLAUDE.md`
2. `app/Filament/Pages/CLAUDE.md`
3. `app/Filament/Widgets/CLAUDE.md`
4. `app/Providers/Filament/CLAUDE.md`
5. `app/Filament/Actions/CLAUDE.md` when the page has actions
6. `tests/Feature/Filament/CLAUDE.md` when tests are expected

Inspect existing panel pages, dashboard widgets, navigation groups, panel
discovery paths, and global defaults.

## Build Flow

1. Decide whether the request is really a dashboard page. If the standard panel
   dashboard plus widgets is enough, register widgets instead of creating a
   page.
2. If a custom page is needed, keep standard Filament page behavior and compose
   custom content through schema components, widgets, or embedded Livewire.
3. Use tabs, sections, grids, callouts, and prime components for layout and
   explanatory content.
4. Keep expensive metrics in widgets or query objects with clear caching,
   polling, and lazy-loading behavior.
5. Use page header actions for page-level commands and delegate domain work.
6. Register navigation metadata consistently with nearby pages and clusters.
7. Add render tests and targeted assertions for critical widgets/actions.

## Avoid

- Reimplementing a resource page as a custom page when only one area is custom.
- Large Blade views that bypass Filament theming and authorization.
- Dashboard queries that run expensive aggregates on every request without
  caching, filters, or lazy loading.
