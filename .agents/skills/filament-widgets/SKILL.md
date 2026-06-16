---
name: filament-widgets
description: Use this skill whenever creating, editing, reviewing, or debugging Filament widgets, including stats overview widgets, chart widgets, table widgets, custom widgets, polling, lazy loading, dashboard registration, and widget tests.
---

# Filament Widget Workflow

Use this skill for dashboard widgets and resource page widgets.

## Read First

Resolve paths from the current project root:

1. `app/Filament/CLAUDE.md`
2. `app/Filament/Widgets/CLAUDE.md`
3. `app/Providers/Filament/CLAUDE.md` for discovery and registration
4. `app/Filament/Resources/Tables/CLAUDE.md` for table widgets
5. `tests/Feature/Filament/CLAUDE.md` when tests are expected

Inspect nearby widgets, panel registration, model relationships, aggregate
cost, cache conventions, and project chart styling.

## Build Flow

1. Choose the narrowest widget type:
   - stats overview for compact KPIs
   - chart widget for trend or distribution data
   - table widget for recent/actionable records
   - custom widget only when built-ins cannot represent the UI
2. Keep widget queries scoped, indexed, and cacheable when expensive.
3. Use lazy loading and polling deliberately. Poll only when data freshness is
   valuable and the query is cheap enough.
4. Use semantic colors and icons that match the rest of the panel.
5. For table widgets, reuse table rules: eager loading, authorization, filters,
   actions, and indexed search/sort.
6. Register widgets through the panel or resource page surface already used by
   the project.
7. Test renderability and the main displayed values, not every presentation
   detail.

## Review Checklist

- The widget has a clear audience and refresh strategy.
- Aggregates do not scan large tables per request unnecessarily.
- Visibility is policy-backed when data is sensitive.
- Custom Blade is wrapped in Filament components and only used when needed.
