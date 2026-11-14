---
description: Resource page classes (ListRecords / CreateRecord / EditRecord / ViewRecord) and lifecycle hooks
paths:
  - app/Filament/**/Resources/**/Pages/*.php
---

# Resource Pages

**Purpose:** the Livewire pages backing each Resource route (`index`, `create`, `view`, `edit`, plus any custom pages).

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

- **MUST** keep page classes thin: they wire actions, lifecycle hooks, and redirects only.
- **MUST** delegate non-trivial work to an `app/Actions/` class.
- **SHOULD** override `getHeaderActions()` to add row-less actions on List pages and per-record actions on View/Edit pages.

## Lifecycle hooks (Create / Edit)

Hooks run at fixed points in the save pipeline. Use them instead of model events when the logic is panel-specific (e.g. attaching the current admin user as `created_by_id`):

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
    app(NotifyCustomerOrderCreatedAction::class)->handle($this->record);
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
| `DeleteAction::make()->before(...) / ->after(...)` | Delete action lifecycle callbacks |

- **MUST** wrap multi-step work inside `handleRecordCreation` / `handleRecordUpdate` in a DB transaction.
- **SHOULD** prefer `afterCreate()` / `afterSave()` for "fire-and-forget" side effects (notifications, queued jobs).
- **MUST** call `->afterCommit()` on any job dispatched from inside `handleRecordCreation` (transaction safety).

## Custom page content — embed a Livewire component, don't rebuild the page

When an Edit/View/Create page needs something Filament can't express out of the box (a real-time status sidebar, a bespoke chart, a custom approval widget), **don't** hand-build a fully custom Livewire page: almost always only **one or two pieces** are custom. Keep the standard Filament page — its form, relation managers, save pipeline, validation, notifications, and authorization — and embed the custom piece as a Livewire component via the page's `content()` schema. (Cross-cutting rule: hub → "Prefer embedding a Livewire component over a custom page".)

### Override `content()` to lay out the page

Every resource page builds its body from `content(Schema $schema): Schema`. The default returns the form + relation managers; override it to place them on a grid alongside your own components. **Keep the defaults via their helper components**:

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

- **MUST** keep the standard pieces via `getFormContentComponent()` / `getRelationManagersContentComponent()` rather than re-deriving them — you retain validation, the save pipeline, dirty-state tracking, and the save notification.
- **MUST** use `Livewire::make(...)` (`Filament\Schemas\Components\Livewire`) for the custom piece **before** converting the whole page to a bespoke Livewire/Blade page. One custom component inside a standard page beats a custom page that reimplements the form.

### The embedded Livewire component

`Livewire::make(SomeComponent::class, [...])` embeds any Livewire component into the schema. Pass props as the second arg — on an Edit/View page `$this->getRecord()` is loaded by the time `content()` runs (on Create it's `null`, so guard with `->hidden(fn (?Model $record) => $record === null)` if the component needs the record).

```php
use App\Actions\TransitionTicketStatusAction;
use Filament\Notifications\Notification;
use Livewire\Attributes\On;
use Livewire\Component;

final class TicketSidebar extends Component
{
    public ?Ticket $record = null;

    public function transitionTo(string $status): void
    {
        $record = TicketResource::getEloquentQuery()->findOrFail($this->record?->getKey());
        \Illuminate\Support\Facades\Gate::authorize('update', $record);
        $next = TicketStatus::from($status);

        if (! in_array($next, $record->status->nextAllowedStatuses(), strict: true)) {
            Notification::make()->danger()->title('Invalid transition')->send();

            return;
        }

        app(TransitionTicketStatusAction::class)->handle($record, $next);   // audit write, timestamps, persist
        $this->record = $record->refresh();

        Notification::make()->success()->title("Status updated to {$next->getLabel()}")->send();
    }

    #[On('ticket-sidebar-refresh')]
    public function refreshRecord(): void
    {
        $record = TicketResource::getEloquentQuery()->findOrFail($this->record?->getKey());
        \Illuminate\Support\Facades\Gate::authorize('view', $record);
        $this->record = $record;
    }
}
```

- **MUST** pass the record as a prop (`['record' => $this->getRecord()]`) — Livewire serializes the model reference and rehydrates it each request. Only serializable data crosses into an embedded component; it can't reach the parent page's live form state.
- **MUST** re-resolve records through the tenant-scoped Resource query and authorize inside every callable mutation/listener. Parent-page access does not authorize an embedded component's operations; use the application's specific transition ability when it differs from `update`.
- **MUST** apply the same rule to a standalone Livewire component rendered in a panel (`@livewire(...)` in a page view, a modal's content, a widget's child). See "Authorize every request, not only `mount()`" below.
- **MUST** delegate the mutation to an `app/Actions/` class (`TransitionTicketStatusAction`) — the Livewire component is a UI boundary, like a Filament Action. Transition rules, audit-trail writes, and `resolved_at`/`closed_at` stamping belong in the Action, not the component.
- **SHOULD** refresh via a dispatched event + `#[On(...)]` listener so the embedded component re-reads after the form saves (`afterSave()` → `$this->dispatch('ticket-sidebar-refresh')`).
- **MUST** back status/badge rendering with `HasColor`/`HasLabel` enums so the sidebar and the resource table share one source of truth (hub → "Enums for status / type / category").
- **SHOULD** add `->key('...')` when embedding multiple instances of the same component, and `->lazyLoaded()` for an expensive component so the page paints first.
- The component's Blade view still follows the hub's Blade ladder — use `<x-filament::section>`, `<x-filament::button>`, and Filament/Tailwind classes (with `dark:` variants) so it matches the panel; reserve hand-rolled markup for the bespoke part.

### Authorize every request, not only `mount()`

Livewire runs `mount()` once, on the first render. Every later request (a `wire:click`, `$refresh`, a poll, an event listener, a property update) skips it and runs `hydrate()` instead. A check only in `mount()` therefore protects the first paint and nothing after: a user whose access is revoked, or whose record is archived, keeps reading and acting through the open component. Filament's own `EditRecord` / `ViewRecord` call `authorizeAccess()` from both `mount()` and `hydrate()`; do the same for every check you add yourself.

Filament already repeats one check: a panel page's static `canAccess()` runs on every Livewire request (`hydrateCanAuthorizeAccess()`), so a page gated only by `canAccess()` needs no `hydrate()` of its own, and a test for one passes with the method deleted. Write `hydrate()` for what `canAccess()` cannot see: a check on the page's record or route parameters, and any plain Livewire component, which gets nothing.

```php
public function mount(Ticket $record): void
{
    $this->record = $record;
    $this->authorizeAccess();
}

public function hydrate(): void
{
    $this->authorizeAccess();
}

protected function authorizeAccess(): void
{
    Gate::authorize('view', $this->record);
}
```

- **MUST** authorize a record-level or component-level read check in `mount()` **and** `hydrate()`, and again inside each mutating method with the ability that mutation needs.
- **MUST** treat every public property as client-writable. Mark identifiers and scope keys `#[Locked]` (`Livewire\Attributes\Locked`), or re-resolve them through the scoped query and authorize the result. A `#[Computed]` method that queries by `$this->orderId` returns whatever id the browser sent.
- **MUST** read a `#[Computed]` as a property (`$this->rows`, `$this->canTick`), in PHP and in Blade. Calling it as a method (`$this->rows()`) bypasses the per-request cache and reruns the body, queries included, at every call site: once per row when the view calls it in a loop.
- `unset($this->rows)` clears a `#[Computed]` cache, but a computed that derives from a stored public property rebuilds the same stale value. When a refresh event replaces the underlying record, reset the stored property as well.
- **MUST NOT** make an embedded component's `mount()` stricter than the page that embeds it, or an otherwise authorized page 403s as a whole. Render the component conditionally instead (`->visible(...)` on `Livewire::make()`, or `@if` in the view).

## Redirect after save

```php
protected function getRedirectUrl(): string
{
    return $this->getResource()::getUrl('index');
}
```

- **MUST** redirect only to a page the resource registers; see `app/Filament/Resources/CLAUDE.md` → "A page URL needs a registered page".

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
            ->authorize('export', Order::class)   // a read ability, not create/update
            ->action(fn () => app(ExportOrdersAction::class)->handle())
            ->color('gray'),
    ];
}
```

- **MUST** call `->authorize(...)` on every custom header action. The page's own gate (`viewAny`, `update`) is not the action's ability, and only the stock CRUD action classes get a policy check for free. See `app/Filament/Actions/CLAUDE.md` → "Authorization".

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

## Deleting a related record must not redirect to the index

`InteractsWithRecord` redirects after **every** `DeleteAction` via `getDefaultActionSuccessRedirectUrl()`, including one that deleted a related row (a child, an attachment) from a header or section action. **MUST** override it on the page to return `null` for those actions.

**MUST NOT** decide the redirect by inspecting `$action->getRecord()` after the delete: a `->record(fn ...)` closure re-queries, misses the now-trashed row, and falls back to the page record, so the page thinks its own record was deleted. Table `DeleteAction`s on `ManageRelatedRecords` already skip the redirect because the action has a table.
