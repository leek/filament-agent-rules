---
description: Resource page classes (ListRecords / CreateRecord / EditRecord / ViewRecord) and lifecycle hooks
paths:
  - app/Filament/**/Pages/*.php
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

## Custom page content — embed a Livewire component, don't rebuild the page

When an Edit/View/Create page needs something Filament can't express out of the box — a real-time status sidebar, a bespoke chart, a custom approval widget — the instinct is to throw the page away and hand-build a fully custom Livewire page. **Don't.** Almost always only **one or two pieces** are genuinely custom. Keep the standard Filament page — its form, relation managers, save pipeline, validation, notifications, and authorization — and slot the custom piece in as an embedded Livewire component via the page's `content()` schema. (Cross-cutting rule: hub → "Prefer embedding a Livewire component over a custom page".)

### Override `content()` to lay out the page

Every resource page builds its body from `content(Schema $schema): Schema`. The default returns the form + relation managers; override it to place them on a grid alongside your own components. **Keep the defaults via their helper components** so you don't lose any wiring:

| Helper | Returns |
| ------ | ------- |
| `$this->getFormContentComponent()` | the page's form |
| `$this->getRelationManagersContentComponent()` | the relation managers block |

```php
use App\Livewire\TicketSidebar;
use Filament\Schemas\Components\{Grid, Group, Livewire};
use Filament\Schemas\Schema;

final class EditTicket extends EditRecord
{
    protected static string $resource = TicketResource::class;

    public function content(Schema $schema): Schema
    {
        return $schema->components([
            Grid::make(['default' => 1, 'lg' => 3])->schema([
                Group::make([
                    $this->getFormContentComponent(),               // standard Filament form
                    $this->getRelationManagersContentComponent(),   // standard relation managers
                ])->columnSpan(['default' => 1, 'lg' => 2]),

                Livewire::make(TicketSidebar::class, ['record' => $this->getRecord()])
                    ->columnSpan(1),                                 // the one genuinely-custom piece
            ]),
        ]);
    }

    protected function afterSave(): void
    {
        $this->dispatch('ticket-sidebar-refresh');   // tell the embedded component to re-read
    }
}
```

- **MUST** keep the standard pieces via `getFormContentComponent()` / `getRelationManagersContentComponent()` rather than re-deriving them — you retain validation, the save pipeline, dirty-state tracking, and the save notification for free.
- **MUST** reach for `Livewire::make(...)` (`Filament\Schemas\Components\Livewire`) for the custom piece **before** converting the whole page to a bespoke Livewire/Blade page. One custom component inside a standard page beats a custom page that reimplements the form.

### The embedded Livewire component

`Livewire::make(SomeComponent::class, [...])` embeds any Livewire component into the schema. Pass props as the second arg — on an Edit/View page `$this->getRecord()` is loaded by the time `content()` runs (on Create it's `null`, so guard with `->hidden(fn (?Model $record) => $record === null)` if the component needs the record).

```php
use App\Actions\TransitionTicketStatus;
use Filament\Notifications\Notification;
use Livewire\Attributes\On;
use Livewire\Component;

final class TicketSidebar extends Component
{
    public ?Ticket $record = null;

    public function transitionTo(string $status): void
    {
        $next = TicketStatus::from($status);

        if (! in_array($next, $this->record->status->nextAllowedStatuses(), strict: true)) {
            Notification::make()->danger()->title('Invalid transition')->send();

            return;
        }

        app(TransitionTicketStatus::class)->run($this->record, $next);   // audit write, timestamps, persist
        $this->record->refresh();

        Notification::make()->success()->title("Status updated to {$next->getLabel()}")->send();
    }

    #[On('ticket-sidebar-refresh')]
    public function refreshRecord(): void
    {
        $this->record->refresh();
    }
}
```

- **MUST** pass the record as a prop (`['record' => $this->getRecord()]`) — Livewire serializes the model reference and rehydrates it each request. Only serializable data crosses into an embedded component; it can't reach the parent page's live form state.
- **MUST** delegate the actual mutation to an `app/Actions/` class (`TransitionTicketStatus`) — the Livewire component is a UI boundary, exactly like a Filament Action. Transition rules, audit-trail writes, and `resolved_at`/`closed_at` stamping belong in the Action, not the component.
- **SHOULD** refresh via a dispatched event + `#[On(...)]` listener so the embedded component re-reads after the form saves (`afterSave()` → `$this->dispatch('ticket-sidebar-refresh')`).
- **MUST** back status/badge rendering with `HasColor`/`HasLabel` enums so the sidebar and the resource table share one source of truth (hub → "Enums for status / type / category").
- **SHOULD** add `->key('...')` when embedding multiple instances of the same component, and `->lazy()` for an expensive component so the page paints first.
- The component's own Blade view is still subject to the hub's Blade ladder — use `<x-filament::section>`, `<x-filament::button>`, and Filament/Tailwind classes (with `dark:` variants) so it matches the panel; reserve hand-rolled markup for the genuinely bespoke part.

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
