---
description: Filament Resource classes (form/table/infolist wiring, eager loading, global search, authorization)
paths:
  - app/Filament/**/*Resource.php
---

# Resources

**Purpose:** CRUD UI for a single Eloquent model inside a Filament panel.

## Naming

- **MUST** be `{Model}Resource` (e.g. `UserResource`, `OrderResource`).
- **MUST** match the model singular — one model, one Resource per panel.

## Create

```bash
php artisan make:filament-resource Order --generate
php artisan make:filament-resource Order --view --soft-deletes
```

`--generate` introspects the model's fillable + casts and scaffolds form/table columns. `--view` adds a ViewRecord page; `--soft-deletes` wires the trash filter and restore/force-delete actions.

## Class shape

```php
final class OrderResource extends Resource
{
    protected static ?string $model = Order::class;

    protected static ?string $navigationIcon = 'heroicon-o-shopping-cart';

    protected static ?string $navigationGroup = 'Commerce';

    protected static ?int $navigationSort = 20;

    protected static ?string $recordTitleAttribute = 'reference';

    public static function form(Schema $schema): Schema
    {
        return OrderForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return OrdersTable::configure($table);
    }

    public static function infolist(Schema $schema): Schema
    {
        return OrderInfolist::configure($schema);
    }

    public static function getRelations(): array
    {
        return [
            RelationManagers\ItemsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListOrders::route('/'),
            'create' => Pages\CreateOrder::route('/create'),
            'view'   => Pages\ViewOrder::route('/{record}'),
            'edit'   => Pages\EditOrder::route('/{record}/edit'),
        ];
    }
}
```

## Rules

- **MUST** extract form, table, and infolist definitions into separate classes under `app/Filament/Resources/{Models}/Schemas/` and `.../Tables/`. No "trivial resource" exception — extract from day one. See "Code Quality — extract everything" below.
- **MUST** declare `$recordTitleAttribute` for global search and breadcrumb labels.
- **SHOULD** group resources via `$navigationGroup` once you have more than ~5 resources.
- **MUST NOT** put business logic in the Resource — funnel through `app/Actions/`.

## Code Quality — extract everything

Source: <https://filamentphp.com/docs/5.x/resources/code-quality-tips>. Treat as canonical.

A Resource file should be a **wiring manifest**, not a definition. Form, table, infolist, action, column, filter, and component definitions all live in dedicated classes the Resource references. Goal: no Resource file longer than ~80 lines.

### Per-resource layout

```
app/Filament/Resources/Customers/
├── CustomerResource.php
├── Pages/
│   ├── ListCustomers.php
│   ├── CreateCustomer.php
│   ├── EditCustomer.php
│   └── ViewCustomer.php
├── Schemas/
│   ├── CustomerForm.php              # configure(Schema): Schema
│   ├── CustomerInfolist.php          # configure(Schema): Schema
│   └── Components/
│       ├── CustomerNameInput.php     # make(): TextInput
│       └── CustomerCountrySelect.php # make(): Select
├── Tables/
│   ├── CustomersTable.php            # configure(Table): Table
│   ├── Columns/
│   │   ├── CustomerNameColumn.php    # make(): TextColumn
│   │   └── CustomerCountryColumn.php # make(): TextColumn
│   └── Filters/
│       └── CustomerCountryFilter.php # make(): SelectFilter
├── Actions/
│   ├── EmailCustomerAction.php       # extends Action
│   └── UpdateCustomerCountryBulkAction.php
└── RelationManagers/
    └── OrdersRelationManager.php
```

### How to build the extracted classes

The Resource only **wires** these classes (`form()`, `table()`, `infolist()`, `getRelations()`, `getPages()`). The `configure()` / `make()` class shapes and extraction rules live with the code they govern — read the matching file when you build that class, **not** this one:

| Building… | Read |
| --------- | ---- |
| a form or infolist (`*Form`, `*Infolist`), its `Components/`, layout, reactivity | `app/Filament/Resources/Schemas/CLAUDE.md` |
| a table (`*Table`), its `Columns/` + `Filters/`, empty state | `app/Filament/Resources/Tables/CLAUDE.md` |
| an extracted Action (reusable across header / row / bulk surfaces) | `app/Filament/Actions/CLAUDE.md` |
| a relation manager | `app/Filament/Resources/RelationManagers/CLAUDE.md` |

- **MUST NOT** inline a form, table, or infolist definition in the Resource — it's a wiring manifest only. The "where to read" table above is the contract: definitions live in their own classes, governed by their own rules.

## Eager loading — `getEloquentQuery()`

Override `getEloquentQuery()` to eager-load relations the table/infolist will touch. This is the single best perf lever in a Filament panel:

```php
public static function getEloquentQuery(): Builder
{
    return parent::getEloquentQuery()
        ->with(['customer', 'items.product'])
        ->withCount('items');
}
```

- **MUST** eager-load every relation referenced in table columns (`->state(fn ($record) => $record->customer->name)`).
- **MUST NOT** rely on lazy loading inside a table — Filament renders 25+ rows per page; N+1 is immediate.

## Global search

- **MUST** define `getGloballySearchableAttributes()` when global search is enabled, or it falls back to only the `$recordTitleAttribute`:

```php
public static function getGloballySearchableAttributes(): array
{
    return ['reference', 'customer.name', 'customer.email'];
}

public static function getGlobalSearchResultDetails(Model $record): array
{
    return [
        'Customer' => $record->customer->name,
        'Status'   => $record->status->label(),
    ];
}
```

- **MUST** eager-load relations used in search via `getGlobalSearchEloquentQuery()` — same N+1 risk as the index table.

## Navigation badges

```php
public static function getNavigationBadge(): ?string
{
    return Cache::remember('orders:navigation_badge_pending_count', now()->addMinute(), function (): string {
        return (string) Order::query()->where('status', 'pending')->count();
    });
}

public static function getNavigationBadgeColor(): ?string
{
    return 'warning';
}
```

- **MUST** cache navigation badge queries when they hit a large table — they run on every panel page load for every navigation item. Use `Cache::remember()` with a short TTL, a shared cache-key constant, or a precomputed counter column; invalidate from the model observer when the underlying count changes.

## Authorization

Resource methods call the model's policy automatically (`viewAny`, `view`, `create`, `update`, `delete`, `restore`, `forceDelete`). **MUST** define the policy for any resource — don't `shouldRegisterNavigation()` your way around missing auth.

For panel-level visibility:

```php
public static function shouldRegisterNavigation(): bool
{
    return auth()->user()?->can('viewAny', Order::class) ?? false;
}
```

### Static `can*` overrides

When a check depends on Resource-level context (not just the model), override the static `can*` methods instead of pushing the logic into the policy:

```php
public static function canCreate(): bool
{
    return Feature::active('new-orders') && auth()->user()?->can('create', Order::class);
}

public static function canEdit(Model $record): bool
{
    return ! $record->isLocked() && auth()->user()?->can('update', $record);
}
```

- **MUST** still call the policy from inside these overrides — keep the policy as the single source of truth for per-record rules.
- **PREFER** putting time-window or feature-flag checks here rather than in the policy (the policy stays pure record-vs-user).

### `Response::deny()` with a reason

Returning a string-reason from a policy surfaces it in Filament's denial UI:

```php
public function update(User $user, Order $order): bool|Response
{
    if ($order->isLocked()) {
        return Response::deny('Order is locked while payment is pending.');
    }

    return $user->id === $order->owner_id || $user->isAdmin();
}
```

- **SHOULD** use `Response::deny('...')` over a silent `false` whenever the admin can plausibly fix the situation — "locked", "out of date range", "missing approval" all benefit from being visible.

### Field/column visibility

Hide sensitive fields from non-privileged admins inside the schema, not via a separate policy file:

```php
TextInput::make('internal_notes')
    ->visible(fn () => auth()->user()->can('view-internal-notes'));

TextColumn::make('cost_cents')
    ->money()
    ->toggleable(isToggledHiddenByDefault: ! auth()->user()->isFinance());
```

- **MUST** also call `->dehydrated(fn () => ...)` on sensitive form fields you hide — otherwise a crafted Livewire request can still set the value.

## Cluster membership

To group multiple resources under a cluster:

```php
protected static ?string $cluster = Commerce::class;
```

See `app/Filament/Clusters/CLAUDE.md`.

## Tenancy

If the panel uses tenancy, **MUST** declare the tenant relationship and ownership:

```php
public static function getEloquentQuery(): Builder
{
    return parent::getEloquentQuery()->whereBelongsTo(Filament::getTenant());
}
```

…or rely on the global scope set by `Panel::tenant(Team::class)` if the model is tenant-scoped.
