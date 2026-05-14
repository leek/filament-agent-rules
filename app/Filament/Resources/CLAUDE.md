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

## Class shape (v4+)

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

- **MUST** extract form, table, and infolist definitions into separate **Schema classes** under `app/Filament/Resources/{Model}Resource/Schemas/` and `.../Tables/` — Resource file stays thin. Inline builders are acceptable only for trivial resources (<3 fields).
- **MUST** declare `$recordTitleAttribute` for global search and breadcrumb labels.
- **SHOULD** group resources via `$navigationGroup` once you have more than ~5 resources.
- **MUST NOT** put business logic in the Resource — funnel through `app/Actions/`.

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
    return (string) Order::query()->where('status', 'pending')->count();
}

public static function getNavigationBadgeColor(): ?string
{
    return 'warning';
}
```

- **MUST** cache navigation badge queries when they hit a large table — they run on every panel page load. Use `Cache::remember()` with a short TTL or compute via a daily-refreshed counter column.

## Authorization

Resource methods call the model's policy automatically (`viewAny`, `view`, `create`, `update`, `delete`, `restore`, `forceDelete`). **MUST** define the policy for any resource — don't `shouldRegisterNavigation()` your way around missing auth.

For panel-level visibility:

```php
public static function shouldRegisterNavigation(): bool
{
    return auth()->user()?->can('viewAny', Order::class) ?? false;
}
```

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
