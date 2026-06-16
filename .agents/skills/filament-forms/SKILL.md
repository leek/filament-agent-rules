---
name: filament-forms
description: Use this skill whenever creating, editing, reviewing, or debugging a Filament form schema, including fields, validation, layout, relationship inputs, repeaters, dependent state, dehydrated fields, and resource form extraction.
---

# Filament Form Workflow

Use this skill for form schemas in resources, actions, pages, widgets, or
embedded schema components.

## Read First

Resolve paths from the current project root:

1. `app/Filament/CLAUDE.md`
2. `app/Filament/Resources/Schemas/CLAUDE.md`
3. `app/Providers/Filament/CLAUDE.md`
4. If the form lives inside an action, also read
   `app/Filament/Actions/CLAUDE.md`.
5. If tests are expected, read `tests/Feature/Filament/CLAUDE.md`.

Inspect the model casts, migrations, relationships, validation rules, existing
global `configureUsing()` defaults, and any current form layout in nearby
resources.

## Build Flow

1. Return a configured `Filament\Schemas\Schema` from the relevant `configure()`
   or `form()` method.
2. Organize fields into meaningful sections. Use a 12-column grid when the
   surrounding project does, size fields to their content, and pair related
   fields on shared rows.
3. Choose components from data semantics: enum or finite set to `Select`,
   temporal values to date/time pickers, booleans to toggles/checkboxes,
   paragraphs to `Textarea` or rich/markdown editors, related records to
   relationship-aware components.
4. Mirror model casts and database requirements. Add `required()`,
   `unique(ignoreRecord: true)`, numeric/date constraints, and relationship
   validation where appropriate.
5. Treat dehydration as the write boundary. Display-only fields use
   `dehydrated(false)`. Hidden privileged state must not persist accidentally.
6. For dependent fields, use Livewire state callbacks and reset stale child
   values when parent choices change.
7. Prefer reusable schema component classes over duplicated heavy chains.

## Avoid

- Flat full-width field lists.
- Free-text inputs for finite values.
- Re-declaring global component defaults.
- Custom Blade before built-in fields, layout components, prime components, or
  reusable schema component classes have been exhausted.
