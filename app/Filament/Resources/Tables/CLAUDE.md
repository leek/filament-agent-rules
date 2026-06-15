---
description: Reusable Table schema classes (columns, filters, recordActions, toolbarActions)
globs:
  - app/Filament/**/Tables/*.php
alwaysApply: false
---

# Tables

**Purpose:** the index view of a Resource (or a relation manager / table widget). Declarative columns + filters + actions.

## Where they live

Per-resource, under `app/Filament/Resources/{Models}/Tables/`:

```
app/Filament/Resources/Orders/
├── OrderResource.php
└── Tables/
    └── OrdersTable.php
```

## Naming

- **MUST** be `{Models}Table` (plural): `OrdersTable`, `UsersTable`.

## Shape

```php
final class OrdersTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('reference')->searchable()->sortable(),
                TextColumn::make('customer.name')->searchable()->sortable(),
                TextColumn::make('status')->badge(),
                TextColumn::make('total_cents')->money()->sortable(),
                TextColumn::make('created_at')->dateTime()->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')->options(OrderStatus::class),
                Filter::make('high_value')->query(fn (Builder $q) => $q->where('total_cents', '>', 100_00)),
                TrashedFilter::make(),
            ])
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                    ForceDeleteBulkAction::make(),
                    RestoreBulkAction::make(),
                ]),
            ])
            ->defaultSort('created_at', 'desc')
            ->persistFiltersInSession()
            ->persistSortInSession()
            ->persistSearchInSession();
    }
}
```

## Rules

- **MUST** make `configure()` `static` and return the `$table`.
- **MUST NOT** extend a parent class or interface on `*Table` classes — keep them open so `configure()` can accept extra context args (`configure(Table $table, ?Customer $forCustomer = null)`) for reuse across panels / pages. Compose, don't inherit.
- **MUST** eager-load any relation referenced by a column via dot-notation (`customer.name`). The Resource's `getEloquentQuery()` is the right place — see `app/Filament/Resources/CLAUDE.md`.
- **MUST** call `->searchable()` and `->sortable()` only on indexed columns. Adding `->searchable()` to a non-indexed column hits the DB with an unindexed `LIKE` on every keystroke.
- **MUST** prefer `TextColumn::make('relation.column')->searchable()` over a raw query — Filament builds a correct join.
- **SHOULD** persist user state across reloads via `->persistFiltersInSession()` / `->persistSortInSession()` / `->persistSearchInSession()`. **AVOID** persisting search if it leaks across users on shared admin accounts.
- **MUST** scope bulk actions with appropriate authorization — the policy is **not** auto-checked on bulk actions.

## Per-column / per-filter extraction — `Tables/Columns/`, `Tables/Filters/`

For a single heavily-configured column or filter, extract into its own class with a static `make()` returning one column/filter. Mirrors the `Schemas/Components/` pattern.

```php
// app/Filament/Resources/Customers/Tables/Columns/CustomerCountryColumn.php
final class CustomerCountryColumn
{
    public static function make(): TextColumn
    {
        return TextColumn::make('country.name')
            ->label('Country')
            ->searchable(['country.name', 'country.iso_code'])
            ->sortable()
            ->badge()
            ->color(fn (Customer $record) => $record->country?->is_eu ? 'info' : 'gray');
    }
}

// app/Filament/Resources/Customers/Tables/Filters/CustomerCountryFilter.php
final class CustomerCountryFilter
{
    public static function make(): SelectFilter
    {
        return SelectFilter::make('country_id')
            ->relationship('country', 'name')
            ->searchable()
            ->preload()
            ->multiple();
    }
}
```

Used in the table:

```php
$table
    ->columns([
        CustomerNameColumn::make(),
        CustomerCountryColumn::make(),
    ])
    ->filters([
        CustomerCountryFilter::make(),
    ]);
```

- **MUST** return one column/filter from `make()`. For grouped columns (e.g. `Group::make([...])`), use a fragment returning `array` instead.
- **MUST NOT** extend `TextColumn` / `SelectFilter` / etc. Wrap, don't subclass.
- **SHOULD** extract when a column has >5 chained modifiers (badge + color callback + state + tooltip + copyable…), or appears in ≥2 tables (resource table + relation manager + widget).
- **AVOID** extracting trivial columns (`TextColumn::make('reference')->searchable()`) — keeps the table file readable.

## Column types

| Column         | Use for                                                  |
| -------------- | -------------------------------------------------------- |
| `TextColumn`   | plain text, money, datetime, dot-notation relations; call `->badge()` for enum chips |
| `IconColumn`   | boolean / enum → icon (`->boolean()`, `->options(...)`)  |
| `ImageColumn`  | thumbnails (use `->disk('s3')` for cloud)                |
| `ColorColumn`  | hex color swatch                                         |
| `ToggleColumn` | inline edit a boolean — **commits on click**             |
| `SelectColumn` / `TextInputColumn` | inline edit — commit on blur         |
| `CheckboxColumn` | inline edit a boolean checkbox                          |
| `ViewColumn`   | arbitrary Blade markup when no built-in column fits — see "Custom columns" |

- v5 **removed `BadgeColumn`**. Use `TextColumn::make(...)->badge()->color(fn ($state) => ...)` instead.

- **MUST** authorize inline-editable columns (`ToggleColumn`, `SelectColumn`, etc.) — Filament does NOT auto-check the policy's `update` ability.

```php
ToggleColumn::make('is_published')
    ->disabled(fn (Order $record) => ! auth()->user()->can('update', $record));
```

## Common column modifiers

- `->money()` / `->money('USD')` — divides by 100 if `->state(...)` returns cents.
- `->dateTime()` / `->date()` / `->since()` — Carbon-aware formatting.
- `->limit(50)` — truncate.
- `->tooltip(fn ($state) => $state)` — full value on hover when truncated.
- `->copyable()` — click-to-copy.
- `->color(fn ($state) => match ($state) { ... })` — conditional badge color.
- `->placeholder('—')` — render when value is null.
- `->state(fn ($record) => /* computed */)` — derived value.
- `->toggleable(isToggledHiddenByDefault: true)` — let user hide.

## Custom columns — when the built-ins can't render it

When the cell isn't plain text, a badge, an icon, an image, or a color swatch — a progress bar, a star rating, a sparkline, a stacked avatar + name + email cell, an audio player — **don't** give up and dump raw HTML through `->formatStateUsing(fn () => new HtmlString(...))`, and **don't** jump straight to a bespoke custom *page*. Filament has two purpose-built escape hatches for table cells, and agents reach for neither often enough. This is the table rung of the hub's "Prefer built-in components over custom Blade" ladder (`app/Filament/CLAUDE.md`).

First exhaust the built-in column + its modifiers — most "I need a custom column" is really one of:

- `->state(fn ($record) => ...)` (derived value), `->formatStateUsing(fn ($state) => ...)` (display formatting), `->badge()->color()->icon()`, `->description(fn ($record) => ..., position: 'below')` (a second line under the value), `->html()` (trusted inline HTML only — never user input).

Only when no combination of those renders the cell do you drop to Blade — via `ViewColumn` (quick, no class) or a custom column class (reusable).

### `ViewColumn` — point a column at a Blade view (no class)

`Filament\Tables\Columns\ViewColumn` is the lightweight hatch: a real column whose body is your Blade view. Undocumented, but first-class and long-lived. Use it for **one-off** bespoke markup that won't be reused.

```php
use Filament\Tables\Columns\ViewColumn;

ViewColumn::make('rating')
    ->view('filament.tables.columns.star-rating')
    ->viewData(['max' => 5])          // extra data for the view
    ->sortable();                     // still a real column — state/sort/search hit the underlying attribute
```

```blade
{{-- resources/views/filament/tables/columns/star-rating.blade.php --}}
@php($rating = (int) $getState())
<div class="flex gap-0.5">
    @for ($i = 1; $i <= $max; $i++)
        <x-filament::icon
            :icon="$i <= $rating ? 'heroicon-s-star' : 'heroicon-o-star'"
            @class([
                'h-4 w-4',
                'text-warning-500' => $i <= $rating,
                'text-gray-300 dark:text-gray-600' => $i > $rating,
            ])
        />
    @endfor
</div>
```

Inside the view: `$getState()` is the cell value, `$record` is the row's model, `$column` is the column instance, `$this` is the Livewire component.

### Custom column class — when it's reused or configurable

When the same custom cell ships in ≥2 tables, or needs its own fluent config (`->speed(0.5)`, `->max(10)`), generate a class that **extends the base `Column`** and declares a `$view`:

```bash
php artisan make:filament-table-column AudioPlayerColumn
```

```php
namespace App\Filament\Tables\Columns;

use Closure;
use Filament\Tables\Columns\Column;

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
        return $this->evaluate($this->speed);   // resolves a closure + injects utilities ($record, etc.)
    }
}
```

Every public getter is callable from the view as a "variable function" — `getSpeed()` → `$getSpeed()`:

```blade
{{-- resources/views/filament/tables/columns/audio-player-column.blade.php --}}
<audio src="{{ $getState() }}" controls data-speed="{{ $getSpeed() }}"></audio>
```

```php
AudioPlayerColumn::make('recording')
    ->speed(fn (Recording $record) => $record->isGlobal() ? 1 : 0.5);
```

### Where it lives — resource-scoped vs. global

- **MUST** put a custom column **specific to one resource** in that resource's namespace — `app/Filament/Resources/Recordings/Tables/Columns/AudioPlayerColumn.php`, the same `Tables/Columns/` directory the per-column wrappers use.
- **MAY** put a **generic, model-agnostic** custom column (a `StarRatingColumn`, `ProgressColumn`, `MoneyDiffColumn` reused across resources) in the global `app/Filament/Tables/Columns/` namespace — the path `make:filament-table-column` scaffolds by default. Global is acceptable here precisely *because* the column is model-agnostic; resource-specific ones are not.
- Keep the Blade view under `resources/views/filament/tables/columns/` either way; when resource-scoped, namespace the view file (`recordings/audio-player-column.blade.php`) so it can't collide with a global one.

### Custom column vs. extraction wrapper — don't confuse them

Both live in `Tables/Columns/` and both are named `{Thing}Column`, but they're opposite patterns:

| | Extraction wrapper (above) | Custom column class (here) |
| --- | --- | --- |
| Method | `static make(): TextColumn` | inherits `Column::make(string)` |
| Base relationship | **wraps** a built-in, returns it | **extends** `Column`, *is* a new type |
| Blade view? | no | yes (`protected string $view`) |
| Use when | a built-in + heavy config | no built-in can render the cell |

- The "**MUST NOT** extend `TextColumn` / `SelectFilter`" rule above is about not subclassing the **concrete** columns. A genuinely custom column **type** legitimately extends the **abstract base** `Filament\Tables\Columns\Column` — that's Filament's sanctioned extension point, not a violation of that rule.
- **MUST** keep custom-column Blade dark-mode-aware (Filament/Tailwind classes, `dark:` variants) — an unthemed one-off cell is exactly the rot the hub's Blade ladder warns about.
- **MUST NOT** run queries or heavy computation inside the column's Blade view — it renders once per row (25+ times per page). Compute in `->state(fn ($record) => ...)` and eager-load on the Resource's `getEloquentQuery()`.

## Filters

| Filter         | Use for                                                  |
| -------------- | -------------------------------------------------------- |
| `SelectFilter` | one-of-N enum                                            |
| `Filter` + `->form([...])` | custom (date range, numeric range, multi-select) |
| `TernaryFilter`| boolean (yes / no / all)                                 |
| `TrashedFilter`| soft-deleted records                                     |

Custom filter:

```php
Filter::make('created_at')
    ->form([
        DatePicker::make('from'),
        DatePicker::make('until'),
    ])
    ->query(function (Builder $query, array $data): Builder {
        return $query
            ->when($data['from'], fn ($q, $d) => $q->whereDate('created_at', '>=', $d))
            ->when($data['until'], fn ($q, $d) => $q->whereDate('created_at', '<=', $d));
    });
```

- **MUST** index columns referenced in filters — they run as part of the index query.

## Row actions

```php
->recordActions([
    ViewAction::make(),
    EditAction::make(),
    Action::make('approve')
        ->icon(Heroicon::Check)
        ->color('success')
        ->requiresConfirmation()
        ->visible(fn (Order $record) => $record->status === 'pending')
        ->action(fn (Order $record) => app(ApproveOrderAction::class)->run($record)),
])
```

> v5 renamed `->actions(...)` to `->recordActions(...)`. The v4 name no longer exists.

- **MUST** call `->requiresConfirmation()` on any destructive action.
- **MUST** use `->visible(...)` / `->hidden(...)` to hide actions the policy denies — keep UI honest.
- **PREFER** wrapping >2 row actions in `ActionGroup::make([...])->dropdown()` — otherwise the table actions column eats half the row width on dense lists.

## Header actions

Table-scoped operations (Create, Import, Export, Attach) belong here, not on the page:

```php
->headerActions([
    CreateAction::make(),
    Action::make('import')
        ->icon('heroicon-o-arrow-up-tray')
        ->form([FileUpload::make('file')->acceptedFileTypes(['text/csv'])->required()])
        ->action(fn (array $data) => app(ImportOrdersAction::class)->run($data['file'])),
])
```

- **MUST** delegate non-trivial work to an `app/Actions/` class.
- **AVOID** putting record-scoped actions in `headerActions()` — they have no `$record` and confuse the admin.

## ImageColumn options

```php
ImageColumn::make('avatar')->circular()->imageSize(40);            // single (or ->imageWidth()/->imageHeight())
ImageColumn::make('images')->stacked()->limit(3)->limitedRemainingText();  // multi
ImageColumn::make('logo')->defaultImageUrl(asset('placeholder.svg')); // fallback
```

- **MUST** set `->defaultImageUrl(...)` on any column where the value can be null — broken `<img>` placeholders look like bugs.
- **MUST** scope file-disk thumbnails via `->disk('s3')` (or whichever) — the panel server may not have the same default disk as the queue worker.

## Bulk actions

```php
->toolbarActions([
    BulkActionGroup::make([
        DeleteBulkAction::make(),
        BulkAction::make('archive')
            ->requiresConfirmation()
            ->authorizeIndividualRecords('archive')
            ->action(fn (Collection $records) => app(ArchiveOrdersAction::class)->run($records)),
    ]),
])

// Shorthand when every bulk action is in one group:
->groupedBulkActions([
    DeleteBulkAction::make(),
    BulkAction::make('archive')->action(fn (Collection $records) => /* ... */),
])
```

- v5 renamed `->bulkActions(...)` to `->toolbarActions(...)`. Use `->groupedBulkActions([...])` as a shorthand when wrapping in a single `BulkActionGroup`.
- **MUST** authorize bulk actions explicitly — policies do not run automatically. v5 ships `->authorizeIndividualRecords('ability')` which runs the policy check per record and silently drops those the user can't touch.
- **MUST** chunk bulk operations for >1k rows; do not iterate the full `$records` collection in memory.

## Polling

```php
->poll('10s')
```

- **MUST NOT** poll faster than 5 seconds in production — every poll runs the full index query.

## Striped / grouped

```php
->striped()
->groups([
    Group::make('status')->collapsible(),
])
```

## Card grid layout — a table rendered as cards, not rows

A table doesn't have to render as rows. A people directory, product gallery, media library, or anything that reads better as a **card** can be laid out as a responsive grid using Filament's built-in **column layout components** — no custom page, no hand-built Livewire component, no Blade table. Agents almost always reach for a hand-built page here; **don't**: the table layout keeps filters, search, sorting, pagination, actions, authorization, and the empty state for free.

**Drop to a custom page only when the cards need behavior the table layout can't express** — drag-to-reorder kanban, per-card inline editing of many fields, a genuinely non-grid canvas. Absent that complexity, build the grid in the `*Table` class.

### The pieces

| Component | Role |
| --------- | ---- |
| `Layout\Stack` | stacks its columns **vertically** (the card body) |
| `Layout\Split` | lays its columns **horizontally** (image beside text); collapses on mobile, tune with `->from('md')` |
| `Layout\Grid` | arranges columns on a responsive grid **inside** a card (`->grid(['lg' => 2])->schema([...])`) |
| `Layout\Panel` | wraps columns in a bordered/background card surface; supports `->collapsible()` |
| `Table::contentGrid([...])` | lays **the cards themselves** out as a responsive grid across the page |

All four layout components live under `Filament\Tables\Columns\Layout\*`. `Split`/`Stack`/`Grid` arrange columns *within one record's card*; `->contentGrid()` arranges the *cards* across the page — you need both.

### Example — a user directory as cards

```php
use Filament\Support\Enums\FontWeight;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\Layout\{Split, Stack};
use Filament\Tables\Columns\TextColumn;

public static function configure(Table $table): Table
{
    return $table
        ->columns([
            Split::make([
                ImageColumn::make('profile_image')
                    ->imageHeight(150)
                    ->imageWidth(120)
                    ->extraImgAttributes(['class' => 'rounded-md'])
                    ->grow(false),                 // fixed-width image side

                Stack::make([
                    TextColumn::make('name')->weight(FontWeight::Medium)->searchable(),
                    TextColumn::make('location')->icon(Heroicon::OutlinedMapPin),
                    TextColumn::make('profession')->color('gray'),
                ])
                    ->extraAttributes(['class' => 'space-y-2'])
                    ->grow(),                      // text side consumes the remaining width
            ]),
        ])
        ->contentGrid(['md' => 2, 'xl' => 3])      // 2 cards/row at md, 3 at xl
        ->recordUrl(fn (User $record) => UserResource::getUrl('view', [$record]))
        ->paginated([9, 18, 27]);                  // multiples of the column count keep rows full
}
```

- **MUST** pair `->contentGrid([...])` with pagination options that are **multiples of the widest column count** (`9, 18, 27` for a 3-up grid) — otherwise the last row is ragged.
- **MUST** put the fixed-size element (avatar/thumbnail) on `->grow(false)` and the flexible content on `->grow()` inside a `Split`, or the image stretches to fill.
- **SHOULD** wrap the card body in `Panel::make([...])` when you want a visible card surface (border/background) and optional `->collapsible()` — a bare `Stack` has no chrome.
- **SHOULD** keep `->searchable()` / `->sortable()` on the columns and lift filters above the grid with `FiltersLayout::AboveContent` (see "Filters") — a card grid with no visible filter bar is hard to scan.
- This is distinct from `->stackedAt('md')` (see "v5+ notes"), which renders an ordinary **row** table as cards *only below* a breakpoint. `contentGrid()` is a card grid at every breakpoint.

### Don't hack a button into a column

Tutorials build the card's "Details" button by returning `new HtmlString(Blade::render('<x-filament::button .../>'))` from a `TextColumn->default()`. **Don't** — that's the unthemed-Blade anti-pattern the "Custom columns" section and the hub's Blade ladder warn against. Cleaner, in order:

1. **`->recordUrl(fn ($record) => ...)`** — makes the whole card a link (shown above). The right default for "click the card to open it."
2. **A real `Action`** in `->recordActions([...])` — themed buttons with confirmation/authorization intact.
3. **A `ViewColumn`** (see "Custom columns") — only when you genuinely need bespoke button markup inside the card.

## Empty state

Filament ships a generic empty state (a faded icon + "No records"), but it reads as a bug, not a designed state. **MUST** give every table a full empty state — heading **and** description **and** icon — and an action when one makes sense.

```php
->emptyStateIcon(Heroicon::OutlinedShoppingCart)
->emptyStateHeading('No orders yet')
->emptyStateDescription('Orders placed by customers will appear here. Create one to get started.')
->emptyStateActions([
    CreateAction::make()
        ->visible(fn () => auth()->user()?->can('create', Order::class)),
])
```

- **MUST** set all three of `->emptyStateHeading()`, `->emptyStateDescription()`, `->emptyStateIcon()`. A heading alone is not enough — the description tells the admin *why* it's empty and *what to do*.
- **SHOULD** pick an `emptyStateIcon` that matches the model (reuse the resource's nav icon) so the empty table still reads as "Orders."
- **SHOULD** add `->emptyStateActions([CreateAction::make()])` when the admin can act from here — but gate it on the policy so you don't dangle a button they can't use.
- **PREFER** distinguishing "never had any" from "filtered to nothing": when the table is filtered, an `emptyStateHeading` like "No orders match these filters" with a description nudging the admin to clear filters beats the generic create prompt. Branch with a closure reading the active filters/`$livewire` if the distinction matters.
- This rule applies equally to **relation manager** tables and **table widgets** — same `emptyState*` methods, same bar. Use `->emptyStateActions([])` to suppress the default create button on read-only relations.

## v5+ notes

- **Stacked rows** (v5.2+) — render table rows as cards on mobile:

  ```php
  $table->stackedAt('md')
  ```
- **Deferred filter** support on chart widgets (v5.2+).
