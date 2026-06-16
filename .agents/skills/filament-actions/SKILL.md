---
name: filament-actions
description: Use this skill whenever creating, editing, reviewing, or debugging Filament UI actions, including page actions, table record actions, toolbar and bulk actions, modal schemas, wizard actions, import/export actions, notifications, and action authorization.
---

# Filament Action Workflow

Use this skill for UI actions rendered by Filament. Do not confuse these with
domain actions under `app/Actions/`; a Filament action should call domain logic,
not contain it.

## Read First

Resolve paths from the current project root:

1. `app/Filament/CLAUDE.md`
2. `app/Filament/Actions/CLAUDE.md`
3. `app/Filament/Resources/Tables/CLAUDE.md` for table actions
4. `app/Filament/Resources/Schemas/CLAUDE.md` for modal schemas
5. `tests/Feature/Filament/CLAUDE.md` when tests are expected

Check global action defaults in service providers before adding modal, color,
slide-over, icon, or confirmation settings locally.

## Build Flow

1. Identify the action surface:
   - page header action
   - table header action
   - table record action
   - toolbar or bulk action
   - schema action
   - notification action
2. Use `Filament\Actions\*` imports.
3. Use `schema([...])` or `steps([...])` for action modal input.
4. Add `requiresConfirmation()` for destructive or irreversible actions.
5. Set visibility and authorization from policies or explicit abilities.
6. Delegate non-trivial work to an app-level action/service.
7. Add success and failure notifications for work that changes state or can
   fail.
8. Chunk or queue bulk work that can touch many records.
9. Extract the action class only when it is reused or too large inline.

## Review Checklist

- The action has the right scope for the data it needs.
- The UI does not show unauthorized actions.
- Modal input is validated by the schema.
- Bulk actions are authorized and do not process huge selections in one
  request.
- Tests call the action and cover validation/error paths where meaningful.
