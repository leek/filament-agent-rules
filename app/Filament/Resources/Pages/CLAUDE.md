---
description: Resource page classes (ListRecords / CreateRecord / EditRecord / ViewRecord) and lifecycle hooks
globs:
  - app/Filament/Resources/**/Pages/*.php
alwaysApply: false
---

# Resource Pages

**Purpose:** the actual Livewire pages backing each Resource route (`index`, `create`, `view`, `edit`, plus any custom pages).

## Where they live

Each Resource owns its pages under `app/Filament/Resources/{Models}/Pages/`:

```
app/Filament/Resources/Orders/
├── OrderResource.php
└── Pages/
    ├── ListOrders.php       extends ListRecords
    ├── CreateOrder.php      extends CreateRecord
    ├── ViewOrder.php        extends ViewRecord
    └── EditOrder.php        extends EditRecord
```

## Naming

- **List page** — plural model: `ListOrders`
- **Create page** — `Create{Model}`: `CreateOrder`
- **View page** — `View{Model}`: `ViewOrder`
- **Edit page** — `Edit{Model}`: `EditOrder`
- Custom resource page — verb-noun: `ApproveOrder`, `RefundOrder`

## Rules

- **MUST** keep page classes thin. They wire actions, lifecycle hooks, and redirects — nothing else.
- **MUST** delegate non-trivial work to an `app/Actions/` class.
- **SHOULD** override `getHeaderActions()` to add row-less actions on List pages and per-record actions on View/Edit pages.

## Lifecycle hooks (Create / Edit)

Run logic at well-defined points in the save pipeline. Use these instead of model events when the logic is panel-specific (e.g. attaching the current admin user as `created_by_id`):

```php
protected function mutateFormDataBeforeCreate(array $data): array
{
    $data['created_by_id'] = auth()->id();
    return $data;
}

protected function mutateFormDataBeforeSave(array $data): array
{
    return $data;
}

protected function afterCreate(): void
{
    app(NotifyCustomerOrderCreated::class)->run($this->record);
}

protected function afterSave(): void
{
    // ...
}
```

Hook map:

| Hook                              | When                                     |
| --------------------------------- | ---------------------------------------- |
| `mutateFormDataBeforeFill()`      | Edit: before form is populated from DB   |
| `mutateFormDataBeforeCreate()`    | Create: before `Model::create()`         |
| `mutateFormDataBeforeSave()`      | Edit: before `$record->update()`         |
| `handleRecordCreation($data)`     | Create: replace the persist call entirely|
| `handleRecordUpdate($record, $data)` | Edit: replace the persist call entirely|
| `beforeCreate()` / `afterCreate()`| Create: side effects                     |
| `beforeSave()` / `afterSave()`    | Edit: side effects                       |
| `beforeDelete()` / `afterDelete()`| Edit/View: side effects                  |

- **MUST** wrap multi-step work inside `handleRecordCreation` / `handleRecordUpdate` in a DB transaction.
- **SHOULD** prefer `afterCreate()` / `afterSave()` for "fire-and-forget" side effects (notifications, queued jobs).
- **MUST** call `->afterCommit()` on any job dispatched from inside `handleRecordCreation` (transaction safety).

## Redirect after save

```php
protected function getRedirectUrl(): string
{
    return $this->getResource()::getUrl('index');
}
```

- **SHOULD** override on Create to land on the Edit or View page rather than the List, when admins typically continue editing.

## Saved-notification customization

```php
protected function getSavedNotification(): ?Notification
{
    return Notification::make()
        ->success()
        ->title('Order updated')
        ->body($this->record->reference);
}

// Suppress entirely:
protected function getSavedNotification(): ?Notification
{
    return null;
}
```

## Header actions on ListRecords

```php
protected function getHeaderActions(): array
{
    return [
        Actions\CreateAction::make(),
        Actions\Action::make('export')
            ->action(fn () => app(ExportOrdersAction::class)->run())
            ->color('gray'),
    ];
}
```

## Tabs on ListRecords

For filtered-views (e.g. "All / Pending / Paid / Cancelled"):

```php
public function getTabs(): array
{
    return [
        'all'     => Tab::make(),
        'pending' => Tab::make()->modifyQueryUsing(fn (Builder $q) => $q->where('status', 'pending')),
        'paid'    => Tab::make()->modifyQueryUsing(fn (Builder $q) => $q->where('status', 'paid')),
    ];
}
```

- **MUST** add an index covering the column referenced in each tab — these queries run on every page load.

## Authorization on pages

Filament checks the policy method matching the page kind (`view`, `update`, etc.). For pages with no model (custom panel pages under `app/Filament/Pages/`), override `canAccess()`:

```php
public static function canAccess(): bool
{
    return auth()->user()?->can('view-reports') ?? false;
}
```
