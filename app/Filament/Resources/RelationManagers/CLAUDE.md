---
description: Relation managers attached to a parent Resource (HasMany, BelongsToMany, MorphMany)
paths:
  - app/Filament/**/RelationManagers/*.php
---

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
- **MAY** name the class after the display concept rather than the literal relation method when the concept reads clearer to an admin. Filament binds to `$relationship` (**not** the class name), which **MUST** still name the parent relation method exactly.

## Create

```bash
php artisan make:filament-relation-manager OrderResource items Item
# arg 1: parent resource
# arg 2: relation method name on parent
# arg 3: related-model title attribute
```

- **`--no-interaction` does NOT suppress the related-resource prompt:** `make:filament-relation-manager … --no-interaction` still asks "Which related resource?" and dies with `Laravel\Prompts\Exceptions\NonInteractiveValidationException: … Required` — the three positional args are not enough. Run it interactively, pass the related-resource option the prompt expects, or hand-create the manager by copying a sibling `*RelationManager` and editing `$relationship` / `$recordTitleAttribute`.

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
                TextColumn::make('price_cents')->money('USD', divideBy: 100),
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
- **SHOULD** eager-load nested relations the table touches via `->modifyQueryUsing(fn (Builder $query) => $query->with([...]))` on the table, preserving the relationship query.
- **MUST** call `->authorize(...)` on every custom action in the manager's table. The manager checks the related model's policy only for the stock CRUD classes; a plain `Action::make('approve')` runs for anyone who can open the owner record, and `AttachAction` / `DetachAction` / `AssociateAction` / `DissociateAction` check only `isReadOnly()`, never a policy. See `app/Filament/Actions/CLAUDE.md` → "Authorization".
- **MUST** gate a link that deep-links to this manager (`?relation=...`) on its `canViewForRecord($ownerRecord, $pageClass)`, not only on a create or update permission; otherwise the tab the link targets is not rendered.
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

To attach an existing record with pivot fields, customize the Attach action's schema in the table's header actions:

```php
AttachAction::make()
    ->schema(fn (AttachAction $action): array => [
        $action->getRecordSelect(),
        DatePicker::make('expires_at'), // pivot column
    ]);
```

- **MUST** expose pivot fields with `withPivot('expires_at')` on both sides of the relationship. Attachment uses the action's record selector; the relation manager's ordinary form describes creating/editing the related model.

## ManageRelatedRecords page (full-page variant)

For relations heavy enough to warrant their own page:

```bash
php artisan make:filament-page ManageOrderItems --resource=OrderResource --type=ManageRelatedRecords
```

Register on the parent Resource via `getPages()`:

```php
'items' => Pages\ManageOrderItems::route('/{record}/items'),
```
