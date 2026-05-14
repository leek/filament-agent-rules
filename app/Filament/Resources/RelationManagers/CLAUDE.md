# Relation Managers

**Purpose:** manage a model's related records (HasMany, BelongsToMany, MorphMany) from inside the parent's Edit/View page, without leaving for the related Resource.

## Where they live

Per-resource, under `app/Filament/Resources/{Parents}/RelationManagers/`:

```
app/Filament/Resources/Orders/
├── OrderResource.php
└── RelationManagers/
    ├── ItemsRelationManager.php
    └── PaymentsRelationManager.php
```

## Naming

- **MUST** be `{Relation}RelationManager` — `Relation` matches the parent model's relation method name in **StudlyCase** (`items()` → `ItemsRelationManager`, `paymentMethods()` → `PaymentMethodsRelationManager`).

## Create

```bash
php artisan make:filament-relation-manager OrderResource items Item
# arg 1: parent resource
# arg 2: relation method name on parent
# arg 3: related-model title attribute
```

## Class shape

```php
final class ItemsRelationManager extends RelationManager
{
    protected static string $relationship = 'items';

    protected static ?string $recordTitleAttribute = 'name';

    public function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('name')->required(),
            TextInput::make('quantity')->numeric()->required(),
            TextInput::make('price_cents')->numeric()->required(),
        ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name'),
                TextColumn::make('quantity'),
                TextColumn::make('price_cents')->money(),
            ])
            ->headerActions([CreateAction::make()])
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
```

## Registration

Register on the parent Resource:

```php
public static function getRelations(): array
{
    return [
        ItemsRelationManager::class,
    ];
}
```

## Rules

- **MUST** declare `$relationship` matching the parent's relation method exactly — a typo silently shows an empty table.
- **MUST** declare `$recordTitleAttribute` so action modals and notifications can label rows.
- **MUST** scope queries via the relation, not a global `Model::query()` — Filament handles this automatically when you set `$relationship`. Do NOT override `getEloquentQuery()` to bypass.
- **SHOULD** eager-load nested relations the table touches via `modifyQueryUsing()` on the table or `getTableEloquentQuery()` override.
- **PREFER** a **ManageRelatedRecords** page (full-page relation manager) over a relation manager inside Edit when the related table is large or has its own complex workflow.

## Read-only relation manager

```php
public function isReadOnly(): bool
{
    return true;
}
```

Removes all create/edit/delete actions. Use for audit-log-style relations.

## Conditional visibility

```php
public static function canViewForRecord(Model $ownerRecord, string $pageClass): bool
{
    return $ownerRecord->status !== 'draft';
}
```

## BelongsToMany — attach vs create

For pivot relations, **MUST** decide explicitly:

- **`AttachAction` / `DetachAction`** — select existing related rows.
- **`CreateAction`** — create a new related row AND attach it.
- **`AssociateAction` / `DissociateAction`** — for HasMany when the FK is nullable.

Pivot fields:

```php
public function form(Schema $schema): Schema
{
    return $schema->components([
        Select::make('recordId')
            ->relationship('roles', 'name'),
        TextInput::make('expires_at')   // pivot column
            ->type('date'),
    ]);
}
```

## ManageRelatedRecords page (full-page variant)

For relations heavy enough to warrant their own page:

```bash
php artisan make:filament-page ManageOrderItems --resource=OrderResource --type=ManageRelatedRecords
```

Register on the parent Resource via `getPages()`:

```php
'items' => Pages\ManageOrderItems::route('/{record}/items'),
```
