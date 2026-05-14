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

- **MUST** eager-load any relation referenced by a column via dot-notation (`customer.name`). The Resource's `getEloquentQuery()` is the right place — see `app/Filament/Resources/CLAUDE.md`.
- **MUST** call `->searchable()` and `->sortable()` only on indexed columns. Adding `->searchable()` to a non-indexed column hits the DB with an unindexed `LIKE` on every keystroke.
- **MUST** prefer `TextColumn::make('relation.column')->searchable()` over a raw query — Filament builds a correct join.
- **SHOULD** persist user state across reloads via `->persistFiltersInSession()` / `->persistSortInSession()` / `->persistSearchInSession()`. **AVOID** persisting search if it leaks across users on shared admin accounts.
- **MUST** scope bulk actions with appropriate authorization — the policy is **not** auto-checked on bulk actions.

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
ImageColumn::make('avatar')->circular()->size(40);                 // single
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

## Empty state

```php
->emptyStateHeading('No orders yet')
->emptyStateDescription('Create your first order to get started.')
->emptyStateActions([CreateAction::make()])
```

## v5+ notes

- **Stacked rows** (v5.2+) — render table rows as cards on mobile:

  ```php
  $table->stackedAt('md')
  ```
- **Deferred filter** support on chart widgets (v5.2+).
