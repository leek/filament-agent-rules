---
name: filament-resource
description: Use this skill whenever creating, editing, reviewing, or debugging a Filament resource, including resource class shape, pages, forms, tables, relation managers, navigation, global search, authorization, and resource tests.
---

# Filament Resource Workflow

Use this skill for complete resource work. A resource change usually touches
the resource class plus extracted schema, table, page, relation, action, and
test files.

## Read First

Resolve paths from the current project root, using the active agent filename
where installed:

1. `app/Filament/CLAUDE.md`
2. `app/Filament/Resources/CLAUDE.md`
3. `app/Providers/Filament/CLAUDE.md`
4. Then read whichever resource surface applies:
   - `app/Filament/Resources/Schemas/CLAUDE.md`
   - `app/Filament/Resources/Tables/CLAUDE.md`
   - `app/Filament/Resources/Pages/CLAUDE.md`
   - `app/Filament/Resources/RelationManagers/CLAUDE.md`
   - `app/Filament/Actions/CLAUDE.md`
   - `tests/Feature/Filament/CLAUDE.md`

Before generating code, inspect the target model, casts, relationships,
database columns, policies, existing resource conventions, and panel discovery
paths.

## Build Flow

1. Use the project's existing resource layout and artisan generators when they
   are available.
2. Keep the resource class thin. Extract forms to `Schemas/`, tables to
   `Tables/`, and page behavior to `Pages/`.
3. Bind the model, record title, navigation metadata, global search behavior,
   Eloquent query customization, and policy-backed authorization explicitly.
4. Build forms and infolists as schema component trees. Use fields for input,
   entries for read-only display, and layout/prime components for structure.
5. Build tables with indexed searchable/sortable columns, eager-loaded
   relations, filters, record actions, toolbar actions, and persisted user
   state when appropriate.
6. Delegate non-trivial UI action work to app-level business actions.
7. Add focused Pest + Livewire tests for page rendering, create/edit flows,
   table behavior, actions, authorization, and relation managers when touched.

## Review Checklist

- The class is inside the panel's discovered namespace.
- Required model fields are represented and validated in the form.
- Privileged attributes are not editable unless explicitly intended.
- Dot-notation table columns have eager loading or a safe query strategy.
- Bulk and inline-edit actions are authorized.
- Tests authenticate a user that can access the panel.
