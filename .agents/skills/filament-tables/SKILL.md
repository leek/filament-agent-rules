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

## Deep Pattern: Custom Column Choices

First exhaust built-in columns and modifiers:

- `->state(fn ($record) => ...)` for derived values
- `->formatStateUsing(fn ($state) => ...)` for display formatting
- `->badge()->color()->icon()` for status chips
- `->description(fn ($record) => ..., position: 'below')` for a second line
- trusted `->html()` only when the HTML is not user-controlled

Then choose between two Blade-backed hatches:

| Pattern | Method | Use when |
| ------- | ------ | -------- |
| Extraction wrapper | `static make(): TextColumn` returns a configured built-in | a built-in works but has heavy/repeated config |
| Custom column class | extends `Filament\Tables\Columns\Column` and declares `$view` | no built-in can render the cell |

Use `ViewColumn` for one-off bespoke cells:

```php
ViewColumn::make('rating')
    ->view('filament.tables.columns.star-rating')
    ->viewData(['max' => 5])
    ->sortable();
```

For a reusable custom type, generate a table column class and expose config via
getters. Public getters become variable functions in the view (`getSpeed()` to
`$getSpeed()`):

```php
final class AudioPlayerColumn extends Column
{
    protected string $view = 'filament.tables.columns.audio-player-column';

    protected float | Closure | null $speed = null;

    public function speed(float | Closure | null $speed): static
    {
        $this->speed = $speed;

        return $this;
    }

    public function getSpeed(): ?float
    {
        return $this->evaluate($this->speed);
    }
}
```

Never query inside column Blade; it renders once per row. Compute through
`->state(...)` and eager-load in the resource query.

## Deep Pattern: Card Grid Tables

For people directories, product galleries, media libraries, or similar card
UIs, keep the table and use table column layout components:

| Component | Role |
| --------- | ---- |
| `Layout\Stack` | stacks columns vertically inside a card |
| `Layout\Split` | lays columns horizontally inside a card |
| `Layout\Grid` | arranges columns in a grid inside a card |
| `Layout\Panel` | adds bordered/background card chrome |
| `Table::contentGrid([...])` | lays the cards across the page |

```php
return $table
    ->columns([
        Split::make([
            ImageColumn::make('profile_image')
                ->imageHeight(150)
                ->imageWidth(120)
                ->grow(false),

            Stack::make([
                TextColumn::make('name')->searchable(),
                TextColumn::make('location'),
                TextColumn::make('profession')->color('gray'),
            ])->grow(),
        ]),
    ])
    ->contentGrid(['md' => 2, 'xl' => 3])
    ->recordUrl(fn (User $record) => UserResource::getUrl('view', [$record]))
    ->paginated([9, 18, 27]);
```

Use pagination counts that are multiples of the widest grid column count. Use
`recordUrl()` or real `Action`s for card buttons; do not inject raw button
Blade through a `TextColumn`.
