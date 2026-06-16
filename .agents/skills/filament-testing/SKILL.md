---
name: filament-testing
description: Use this skill whenever writing, editing, reviewing, or debugging Pest and Livewire tests for Filament resources, pages, forms, tables, actions, relation managers, widgets, panel access, and authorization.
---

# Filament Testing Workflow

Use this skill for focused Pest + Livewire feature coverage of Filament admin
surfaces.

## Read First

Resolve paths from the current project root:

1. `tests/Feature/Filament/CLAUDE.md`
2. `app/Filament/CLAUDE.md`
3. The rule file for the surface under test:
   - `app/Filament/Resources/CLAUDE.md`
   - `app/Filament/Resources/Schemas/CLAUDE.md`
   - `app/Filament/Resources/Tables/CLAUDE.md`
   - `app/Filament/Actions/CLAUDE.md`
   - `app/Filament/Widgets/CLAUDE.md`
   - `app/Filament/Resources/RelationManagers/CLAUDE.md`

Inspect existing test style, factories, panel access rules, policies, and
database refresh conventions before adding tests.

## Build Flow

1. Authenticate a user that passes the panel access check in setup.
2. Add the lowest-cost render test for every page, relation manager, or widget
   touched.
3. For forms, test create/edit success, required validation, unique rules with
   current-record ignore behavior, relationship fields, and conditional state.
4. For tables, test visible records, search, sort, filters, important columns,
   dot-notation rendering, row actions, and bulk actions.
5. For actions, test success, validation failures, visibility/authorization,
   redirects/downloads, and resulting database state.
6. For authorization, test both allowed and forbidden users when the behavior is
   security relevant.
7. Keep tests targeted. Do not snapshot whole rendered pages.

## Review Checklist

- Successful saves assert no form/action errors.
- Factories create all related data needed by fields, filters, and columns.
- Assertions check database state after mutations.
- Tests cover the regression risk introduced by the change, not unrelated
  framework behavior.

## Helper Reference

Common Filament Livewire helpers:

| Helper | Use |
| ------ | --- |
| `callAction('name')` | header/footer action |
| `callAction('name', data: [...])` | action with modal form state |
| `callTableAction('name', $record)` | row action |
| `callTableBulkAction('name', $records)` | bulk action |
| `assertActionVisible('name')` / `assertActionHidden('name')` | action visibility |
| `assertHasNoActionErrors()` / `assertHasActionErrors([...])` | action modal validation |
| `assertFormSet([...])` | hydrated form state |

For deferred table filters, call `filterTable(...)` and then
`call('applyTableFilters')` before asserting records.
