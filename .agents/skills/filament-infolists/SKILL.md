---
name: filament-infolists
description: Use this skill whenever creating, editing, reviewing, or debugging a Filament infolist or read-only schema for a view page, action modal, relation manager, or custom page.
---

# Filament Infolist Workflow

Use this skill for read-only record display. Infolists are schema component
trees that use entries for display, layout components for structure, and prime
components for static or computed content.

## Read First

Resolve paths from the current project root:

1. `app/Filament/CLAUDE.md`
2. `app/Filament/Resources/Schemas/CLAUDE.md`
3. `app/Filament/Resources/Pages/CLAUDE.md` when used on View pages
4. `app/Filament/Actions/CLAUDE.md` when used in an action modal
5. `tests/Feature/Filament/CLAUDE.md` when tests are expected

Inspect the model casts, relationships, sensitive attributes, existing form
schema, and nearby view pages before designing the display.

## Build Flow

1. Use entries for read-only data: `TextEntry`, `IconEntry`, `ImageEntry`,
   `ColorEntry`, key-value/repeatable entries, and custom entries only when
   built-ins cannot represent the data.
2. Group record facts by domain meaning, not by database order.
3. Mirror the form's conceptual groups where that helps the admin compare edit
   and view surfaces.
4. Use enum presentation contracts for labels, colors, and icons instead of
   duplicating `match` blocks across fields, columns, and entries.
5. Use badges, icons, copyable values, placeholders, and date/money formatting
   where they make scanning easier.
6. Keep sensitive values out of the infolist unless the current user is
   authorized to see them.

## Review Checklist

- Entries use `Filament\Infolists\Components\*`.
- Layout wrappers use schema layout components.
- Dot-notation relationship entries are loaded safely.
- Long content is limited, wrapped, or placed in a full-width section.
- View-page tests assert rendering and important displayed state.

## Deep Pattern: Custom Entry Choices

Use the lowest-level escape hatch that fits:

1. Built-in entry plus modifiers: `TextEntry`, `IconEntry`, `ImageEntry`,
   `ColorEntry`, `->badge()->color()->icon()`, `->formatStateUsing()`,
   trusted `->html()`, `->markdown()`.
2. Prime component or `Callout` when the content is not bound to a record
   attribute.
3. `ViewEntry` for one-off bespoke record-bound markup.
4. A custom entry class when reused or configurable.

```php
ViewEntry::make('health_score')
    ->view('filament.infolists.components.score-gauge')
    ->viewData(['max' => 100])
    ->columnSpanFull();
```

For a reusable custom entry, extend the abstract `Entry`, declare `$view`, and
expose fluent config through getters. Public getters are available in the view
as variable functions (`getMax()` becomes `$getMax()`):

```php
final class ScoreGaugeEntry extends Entry
{
    protected string $view = 'filament.infolists.components.score-gauge-entry';

    protected int | Closure $max = 100;

    public function max(int | Closure $max): static
    {
        $this->max = $max;

        return $this;
    }

    public function getMax(): int
    {
        return $this->evaluate($this->max);
    }
}
```

Wrap custom entry Blade in the entry wrapper so labels, hints, layout, and dark
mode stay consistent:

```blade
<x-dynamic-component :component="$getEntryWrapperView()" :entry="$entry">
    @php($score = (int) $getState())
    <div class="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
        <div class="h-2 rounded-full bg-primary-500" style="width: {{ $score / $getMax() * 100 }}%"></div>
    </div>
</x-dynamic-component>
```

Resource-specific entries belong in
`app/Filament/Resources/{Models}/Schemas/Components/`; generic entries may
live in `app/Filament/Infolists/Components/`.
