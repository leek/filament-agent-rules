---
name: filament-tables
description: Use this skill whenever creating, editing, reviewing, or debugging a Filament table, including table schema classes, columns, filters, record actions, toolbar or bulk actions, eager loading, persistence, custom columns, and table tests.
---

# Filament Table Workflow

Use this skill for resource tables, relation manager tables, table widgets, and
Livewire table components.

## Read First

Resolve paths from the current project root:

1. `app/Filament/CLAUDE.md`
2. `app/Filament/Resources/Tables/CLAUDE.md`
3. `app/Filament/Actions/CLAUDE.md`
4. `app/Filament/Resources/CLAUDE.md` when the table belongs to a resource
5. `app/Filament/Widgets/CLAUDE.md` when the table is a widget
6. `tests/Feature/Filament/CLAUDE.md` when tests are expected

Also inspect the model, casts, relationships, indexes, policy, existing
`getEloquentQuery()`, and global table defaults.

## Build Flow

1. Put reusable resource table configuration in
   `app/Filament/Resources/{Models}/Tables/{Models}Table.php`.
2. Return the configured table from a static `configure(Table $table): Table`
   method unless the surrounding codebase uses a different established pattern.
3. Choose columns by admin task, not by dumping every database field.
4. Only mark columns searchable or sortable when the database can support it.
5. Use `TextColumn::badge()` for enum/status chips. Do not use removed or
   legacy badge column classes.
6. Eager-load relationships used in dot-notation columns.
7. Put row-level operations in `recordActions()` and bulk/header operations in
   `toolbarActions()`, `headerActions()`, or `groupedBulkActions()` according to
   scope.
8. Authorize inline-editable columns and bulk actions explicitly.
9. Persist filters, sorting, and search when it matches project behavior and
   does not create shared-account leakage.
10. Extract heavily configured repeated columns and filters into small
    `Tables/Columns/` or `Tables/Filters/` classes.

## Tests To Add

- Page or widget renders successfully.
- Expected records are visible.
- Search, sort, and filters behave correctly.
- Dot-notation columns can render.
- Row actions, bulk actions, and authorization paths work.
