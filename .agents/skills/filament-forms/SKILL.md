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

## Deep Pattern: Component Class Vs Fragment

Use a component class when one heavily configured field deserves a named,
reusable builder:

```php
final class CustomerCountrySelect
{
    public static function make(): Select
    {
        return Select::make('country_id')
            ->relationship('country', 'name')
            ->searchable(['name', 'iso_code'])
            ->preload()
            ->required();
    }
}
```

Use a fragment when a logical cluster returns several components:

```php
final class ContactFields
{
    public static function get(): array
    {
        return [
            TextInput::make('email')->email()->required(),
            TextInput::make('phone')->tel(),
            TextInput::make('website')->url()->prefix('https://'),
        ];
    }
}
```

Reserve `make()` for one Filament component and `get()` for an array. That
name difference keeps call sites readable.

## Deep Pattern: Client-Side State Reactions

Use the `*Js` methods when the reaction is pure form state and needs no PHP,
database, auth, relationship, enum, or cast logic:

```php
Select::make('insurance_provider_id')
    ->afterStateUpdatedJs(<<<'JS'
        $set('insurance_plan_id', null)
        JS);

TextInput::make('other_reason')->visibleJs("\$get('reason') === 'other'");
```

Inside these strings, `$get('field')` reads state, `$set('field', value)`
mutates state, and `$state` is the current field value. It is JavaScript
syntax (`===`, `!==`, `&&`), not PHP. Never concatenate user input into a JS
string; read values through `$get()` or `$state`.

When server logic is required, use PHP callbacks with a narrow render scope:

```php
Select::make('product_variant_id')
    ->live()
    ->afterStateUpdated(fn (Set $set) => $set('price_cents', null))
    ->partiallyRenderComponentsAfterStateUpdated(['price_cents']);
```
