---
description: Filament UI Actions — extracted action classes and inline action usage (modals, bulk, wizard, Importer/Exporter, notifications)
paths:
  - app/Filament/**/Actions/*.php
---

# Filament Actions

**Purpose:** UI Actions — buttons, table row actions, header actions, bulk actions, modals. Configured via fluent builder, rendered as buttons that may open a modal, run a callback, or redirect.

> Do **NOT** confuse with `app/Actions/` (business-logic classes — see `laravel-agent-rules`). A Filament Action **calls** a business Action; it doesn't replace it.

## Where they live

Filament Actions may remain inline when used once and small. **MUST** extract shared behavior when the same action appears in ≥2 surfaces; see "Reusable across surfaces".

When extracted:

```
app/Filament/Actions/
├── ApproveAction.php
└── ExportAction.php
```

## Naming

- **MUST** be `{Verb}Action` when extracted (`ApproveAction`, `ExportAction`, `MergeAction`).
- Inline action names use the verb in `Action::make('approve')`.

## Inline shape

```php
Action::make('approve')
    ->label('Approve')
    ->icon(\Filament\Support\Icons\Heroicon::OutlinedCheck)
    ->color('success')
    ->authorize('approve')
    ->visible(fn (Order $record) => $record->status === OrderStatus::Pending)
    ->requiresConfirmation()
    ->modalHeading('Approve order?')
    ->modalDescription(fn (Order $record) => "Approve order #{$record->reference}?")
    ->modalIcon(Heroicon::OutlinedCheckCircle)
    ->modalIconColor('success')
    ->action(fn (Order $record) => app(ApproveOrderAction::class)->handle($record))
    ->after(fn () => Notification::make()->success()->title('Approved')->send());
```

## Rules

- **MUST** call `->requiresConfirmation()` on any destructive or irreversible action.
- **MUST** set `->modalIcon(...)` + `->modalIconColor(...)` on modal/slide-over actions unless the project already does this globally via `configureUsing`. Use intent colors: `danger`, `success`, `warning`, `primary`.
- **MUST** delegate work via `->action(fn ($record) => app(SomeAction::class)->handle($record))` — never write the business logic inline. Filament Actions are presentational glue.
- **MUST** authorize custom actions with `->authorize('ability')` or an authorization callback. Visibility controls presentation; it does not replace an execution-time authorization check. Filament supplies a record-bound action's record to the policy automatically.
- **SHOULD** pair every long-running action with a `Notification` in `->after(...)` so the admin gets explicit success/failure feedback.
- **AVOID** chaining `->action()` AND `->schema()` AND `->after()` with heavy logic — extract to a dedicated class once you cross ~15 lines.
- **SHOULD** write every action/button `->label(...)` in **Title Case** — capitalize each major word ("Request Documents", "Mark Verified", "Convert to Client"); lowercase only interior articles / short conjunctions / short prepositions (a, an, the, and, or, but, of, to, in, for). Applies to row, header, and bulk actions and any clickable label. When the panel is localized, pass `__('...')` instead and apply Title Case to the translation value — see `app/Filament/CLAUDE.md` → "Labels & localization".

## Authorization

```php
Action::make('refund')
    ->authorize('refund')
    ->action(...);
```

Additional presentation-only visibility:

```php
->visible(fn (Order $record) => auth()->user()?->can('refund', $record) ?? false)
```

## Form inside an action (modal form)

When the action needs input:

```php
Action::make('reject')
    ->schema([
        Textarea::make('reason')->required()->minLength(10),
    ])
    ->action(function (Order $record, array $data): void {
        app(RejectOrderAction::class)->handle($record, reason: $data['reason']);
    });
```

- **MUST** validate via the `->schema([...])` definition rather than re-validating inside `->action(...)`. Filament rejects the modal submit on validation failure.
- **MUST** configure modal input with `->schema([...])`, not `->form([...])`.
- **MUST** add `x-on:keydown.enter.prevent` to a plain text or search input rendered inside the modal (a custom Blade field, a picker's filter box). The modal is one `<form>`, so Enter in that input runs the modal's submit action: a search keystroke sends the email. See `app/Filament/Pages/CLAUDE.md` for the same trap in a page form.

## Bulk actions

```php
BulkAction::make('archive')
    ->requiresConfirmation()
    ->authorizeIndividualRecords('archive')
    ->deselectRecordsAfterCompletion()
    ->action(function (Collection $records): void {
        $records->each(fn (Order $order) => app(ArchiveOrderAction::class)->handle($order));
    });
```

- **MUST** chunk the iteration for >1k rows. Dispatch a job per chunk instead of looping in the request.
- **MUST** authorize bulk actions — policies are **not** auto-checked on bulk actions. Use `->authorizeIndividualRecords('ability')` when each selected record needs an individual policy check.
- **SHOULD** call `->deselectRecordsAfterCompletion()` so the table doesn't keep the (now-mutated) rows selected.

## Reusable action class

When the same action appears in ≥2 surfaces, extract it. Create the class with this shape:

```php
final class ApproveAction extends Action
{
    public static function getDefaultName(): ?string
    {
        return 'approve';
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this
            ->label('Approve')
            ->icon(\Filament\Support\Icons\Heroicon::OutlinedCheck)
            ->color('success')
            ->requiresConfirmation()
            ->action(fn (Order $record) => app(ApproveOrderAction::class)->handle($record));
    }
}
```

Usage stays one line at the call site:

```php
ApproveAction::make()
```

### Reusable across surfaces

Use one extracted class for shared behavior; keep bulk variants as `BulkAction` classes.

```php
protected function getHeaderActions(): array
{
    return [
        EmailAction::make(),
    ];
}

// On the resource table (per row)
$table->recordActions([
    EmailAction::make(),
]);
```

- **MUST** extract the moment an action appears in ≥2 surfaces. Inline duplication drifts — the row-action `->visible(...)` and the header-action `->visible(...)` will diverge silently.
- **MUST** keep `setUp()` free of surface-specific assumptions (e.g. don't assume `$record` exists — header actions don't have one). Branch on `$this->getRecord()` if behaviour must vary.
- **SHOULD** ship a separate bulk variant (`EmailAction` + `EmailBulkAction`) when bulk is meaningful.

## Halting / cancelling

Inside an `->action(...)` callback, inject the Action instance and bail out with `$action->halt()` (keep modal open) or `$action->cancel()` (close it). If writes must be rolled back, pass `shouldRollBackDatabaseTransaction: true`; see the hub's "Inside an Action" example:

```php
->action(function (Order $record, Action $action): void {
    if ($record->isLocked()) {
        Notification::make()->danger()->title('Order is locked')->send();
        $action->halt();
    }
    app(ApproveOrderAction::class)->handle($record);
});
```

`halt()` keeps the modal open; without it the modal closes on every callback completion (even failures), which hides the error.

## Slide-overs vs modals

```php
->slideOver()      // right-side panel instead of centered modal
->modalWidth('xl') // 'sm' | 'md' | 'lg' | 'xl' | '2xl' | ... | '7xl' | 'screen'
```

- **PREFER** `->slideOver()` for forms with >5 fields — feels less cramped on wide screens.

## Modal icon + color

```php
DeleteAction::make()
    ->modalIcon(Heroicon::OutlinedTrash)
    ->modalIconColor('danger');

Action::make('approve')
    ->modalIcon(Heroicon::OutlinedCheckCircle)
    ->modalIconColor('success')
    ->modalHeading('Approve order?');

Action::make('export')
    ->modalIcon(Heroicon::OutlinedArrowDownTray)
    ->modalIconColor('primary');
```

| Intent                         | `modalIconColor` |
| ------------------------------ | ---------------- |
| Destructive (delete, detach)   | `danger`         |
| Confirm-positive (approve, publish) | `success`   |
| Risky / reversible-with-effort | `warning`        |
| Neutral (edit, export, view)   | `primary`        |

- **MUST** match `modalIconColor` to intent, not to the trigger button's color — a `gray` "More" button can still open a `danger` delete confirmation.
- **SHOULD** reuse the model's icon for create/edit modals (e.g. an Order modal uses the same icon as the Order resource nav) so the modal reads as "an Order thing."
- **MUST NOT** repeat these per-action if `FilamentServiceProvider` sets them globally.

## Wizard (multi-step) action

For long input flows, use `->steps([...])` instead of a single `->schema(...)`:

```php
Action::make('createOrder')
    ->icon(\Filament\Support\Icons\Heroicon::OutlinedShoppingCart)
    ->steps([
        Wizard\Step::make('Customer')->schema([
            Select::make('customer_id')->relationship('customer', 'name')->required(),
        ]),
        Wizard\Step::make('Items')->schema([
            Repeater::make('items')->schema([
                Select::make('product_id')->relationship('product', 'name')->required(),
                TextInput::make('quantity')->numeric()->required(),
            ]),
        ]),
        Wizard\Step::make('Shipping')->schema([
            Select::make('shipping_method')->options(['standard' => 'Standard', 'express' => 'Express']),
        ]),
    ])
    ->action(fn (array $data) => app(CreateOrderAction::class)->handle($data));
```

- **MUST** validate inside each `Wizard\Step` — Filament blocks "Next" until the step's fields pass.
- **PREFER** wizard over a single long modal once you cross 3 logical sections; users abandon long single-page modals.

## Action chrome

```php
Action::make('publish')
    ->label('Publish')
    ->icon(\Filament\Support\Icons\Heroicon::OutlinedPaperAirplane)
    ->iconPosition(IconPosition::After)
    ->color('success')                  // primary | success | warning | danger | info | gray
    ->size(\Filament\Support\Enums\Size::Large) // xs | sm | md | lg | xl
    ->button()                          // button | iconButton | link
    ->outlined()                        // modifier for button presentation
    ->keyBindings(['mod+s'])
    ->badge(fn () => (string) (auth()->user()?->unreadNotifications()->count() ?? 0))
    ->badgeColor('danger')
    ->tooltip('Publish to all subscribers');
```

- **MUST** use `->iconButton()` for row-level repetitive actions; full-button labels in every row wreck table density.
- **AVOID** `->keyBindings([...])` outside power-user surfaces — keyboard shortcuts on customer-facing panels conflict with browser/OS bindings.
- **MUST NOT** give the same `->keyBindings()` shortcut to two actions that can be in the DOM together (two tabs, two embedded Livewire components). Shortcuts are bound page-wide, not per tab, so the hidden tab's action fires too.

## Notification with follow-up action

For a reversible mutation, use `Filament\Actions\Action` for notification buttons. Notifications serialize their actions; PHP `->action()` callbacks are not preserved. Dispatch to a mounted Livewire listener instead:

```php
->action(function (Order $record): void {
    app(ArchiveOrderAction::class)->handle($record);

    Notification::make()
        ->title('Order archived')
        ->success()
        ->actions([
            Action::make('undo')
                ->color('gray')
                ->dispatch('restore-order', ['orderId' => $record->getKey()])
                ->close(),
        ])
        ->send();
});
```

On the mounted page/component that owns the action:

```php
#[\Livewire\Attributes\On('restore-order')]
public function restoreOrder(int $orderId): void
{
    $order = OrderResource::getEloquentQuery()->withTrashed()->findOrFail($orderId);
    $this->authorize('restore', $order);
    app(RestoreOrderAction::class)->handle($order);
}
```

- **MUST** resolve the record through the tenant-scoped query and authorize inside the listener; event payloads are user input. If archive uses soft deletion, explicitly include trashed records in that scoped query.
- **MUST** keep the receiving component mounted for the notification's lifetime and offer undo only while the mutation remains reversible.

## Header actions vs row actions vs page actions

| Surface | Where | Use for |
| ------- | ----- | ------- |
| `getHeaderActions()` on List page | top of the table | global ops (Create, Import, Export) |
| `->headerActions([...])` on the table | table header strip | table-scoped non-bulk ops (Create on a relation manager, refresh) |
| `->recordActions([...])` on the table | per row | per-record ops (View, Edit, Approve) |
| `->toolbarActions([...])` on the table | toolbar / bulk strip | bulk operations, usually wrapped in `BulkActionGroup` |
| `->groupedBulkActions([...])` | toolbar | shorthand when every bulk action fits one group |
| `getHeaderActions()` on View/Edit page | top of the page | per-record ops outside the table context |

## Imports — `Filament\Actions\*`

Use `Filament\Actions\*` for all current action classes (`Action`, `BulkAction`, `CreateAction`, `EditAction`, `DeleteAction`, `ImportAction`, `ExportAction`, groups, restore/force-delete variants). Do not import old table/form scoped action namespaces.

## Notifications inside actions

```php
->successNotificationTitle('Order approved')
->failureNotificationTitle('Failed to approve')
```

Or for fully custom:

```php
->action(function (Order $record): void {
    try {
        app(ApproveOrderAction::class)->handle($record);
        Notification::make()->success()->title('Approved')->send();
    } catch (DomainException $e) {
        Notification::make()->danger()->title('Failed')->body($e->getMessage())->send();
    }
});
```

## Import / Export actions

Filament ships first-class import/export plumbing — don't roll your own Maatwebsite/Excel pipeline unless you already depend on it.

```bash
php artisan make:filament-exporter OrderExporter --model=Order
php artisan make:filament-importer OrderImporter --model=Order
```

```php
// Exporter columns
public static function getColumns(): array
{
    return [
        ExportColumn::make('reference'),
        ExportColumn::make('customer.name'),
        ExportColumn::make('total_cents')->formatStateUsing(fn ($state) => $state / 100),
        ExportColumn::make('created_at')->formatStateUsing(fn ($state) => $state?->toIso8601String()),
    ];
}

// Importer columns + rules
public static function getColumns(): array
{
    return [
        ImportColumn::make('reference')->requiredMapping()->rules(['required', 'string', 'max:50']),
        ImportColumn::make('total_cents')->numeric()->rules(['required', 'integer', 'min:0']),
        ImportColumn::make('customer_email')->requiredMapping()->rules(['required', 'email']),
    ];
}

public function resolveRecord(): ?Order
{
    return Order::firstOrNew(['reference' => $this->data['reference']]);
}
```

Wire into the table:

```php
->headerActions([
    ImportAction::make()->importer(OrderImporter::class),
    ExportAction::make()->exporter(OrderExporter::class),
])
```

- Filament imports use job batches for all sizes. Asynchronous completion sends a database notification; sync imports send a persistent session notification. Email is not the default. **MUST** configure a queue worker for asynchronous processing; a sync queue connection runs jobs synchronously.
- **MUST** install the job-batch, database-notification, and Filament action tables before imports/exports. If these migrations are not already present, generate/publish them and review them before migrating:

  ```bash
  php artisan make:queue-batches-table
  php artisan make:notifications-table
  php artisan vendor:publish --tag=filament-actions-migrations
  php artisan migrate
  ```

- **MUST** match notification morph columns to the User key type (for example UUIDs), and use the documented PostgreSQL-compatible notification data column where applicable.
- **SHOULD** enable panel database notifications so the initiating user can see completion feedback. The setup applies to exports too.
- **MUST** put `resolveRecord()` logic in the Importer, not in `beforeFill` — Filament uses it to decide insert-vs-update per row.
- **AVOID** wide CSV imports (>30 columns); split into multiple importers per concern (order header vs items vs payments).

## Page actions that resolve their record from arguments

An action hosted on a page (not a table row) that resolves `->record(fn (array $arguments) => Model::find($arguments['id']))` **MUST** also call `->model(Model::class)`. Without it, when the id no longer resolves (deleted, or no longer visible to the user) Filament falls back to the page's own record: a typed `authorize(fn (Invoice $record) ...)` closure throws a `TypeError`, and a stale delete confirmation can delete the page record itself.

With the model pinned the record becomes `null`, so every closure that runs at render or hydrate (`visible`, `hidden`, `disabled`, `authorize`, `tooltip`, headings, `schema`, field `default` / `options`) **MUST** accept a nullable record. An open slide-over rebuilds its schema on every request, polls included. Hidden or disabled actions are never called, so `action()`, `mountUsing()` and `fillForm()` may stay non-nullable. A stock `DeleteAction`'s trashed `hidden()` closure is typed `Model`, so override it on the host: `->hidden(fn (?Invoice $record): bool => $record === null || $record->trashed())`.
