---
description: Filament UI Actions — extracted action classes and inline action usage (modals, bulk, wizard, Importer/Exporter, notifications)
globs:
  - app/Filament/**/Actions/*.php
alwaysApply: false
---

# Filament Actions

**Purpose:** UI Actions — buttons, table row actions, header actions, bulk actions, modals. Configured via fluent builder, rendered as buttons that may open a modal, run a callback, or redirect.

> Do **NOT** confuse with `app/Actions/` (business-logic classes — see `laravel-agent-rules`). A Filament Action **calls** a business Action; it doesn't replace it.

## Where they live

Filament Actions are usually inline inside the Resource/Page/Widget that uses them. Extract to a reusable class only when the same action ships in 3+ places.

When extracted:

```
app/Filament/Actions/
├── ApproveAction.php
└── ExportCsvAction.php
```

## Naming

- **MUST** be `{Verb}Action` when extracted (`ApproveAction`, `ExportCsvAction`, `MergeAction`).
- Inline action names use the verb in `Action::make('approve')`.

## Inline shape

```php
Action::make('approve')
    ->label('Approve')
    ->icon('heroicon-o-check')
    ->color('success')
    ->visible(fn (Order $record) => $record->status === 'pending')
    ->requiresConfirmation()
    ->modalHeading('Approve order?')
    ->modalDescription(fn (Order $record) => "Approve order #{$record->reference}?")
    ->action(fn (Order $record) => app(ApproveOrderAction::class)->run($record))
    ->after(fn () => Notification::make()->success()->title('Approved')->send());
```

## Rules

- **MUST** call `->requiresConfirmation()` on any destructive or irreversible action.
- **MUST** delegate work via `->action(fn ($record) => app(SomeAction::class)->run($record))` — never write the business logic inline. Filament Actions are presentational glue.
- **MUST** use `->visible(...)` / `->hidden(...)` (or `->authorize('ability', $record)`) to hide actions the policy denies. Showing-but-failing creates a confused admin.
- **SHOULD** pair every long-running action with a `Notification` in `->after(...)` so the admin gets explicit success/failure feedback.
- **AVOID** chaining `->action()` AND `->form()` AND `->after()` with heavy logic — extract to a dedicated class once you cross ~15 lines.

## Authorization

```php
Action::make('refund')
    ->authorize('refund', $record)
    ->action(...);
```

Or visibility-driven:

```php
->visible(fn (Order $record) => auth()->user()?->can('refund', $record) ?? false)
```

## Form inside an action (modal form)

When the action needs input:

```php
Action::make('reject')
    ->form([
        Textarea::make('reason')->required()->minLength(10),
    ])
    ->action(function (Order $record, array $data): void {
        app(RejectOrderAction::class)->run($record, reason: $data['reason']);
    });
```

- **MUST** validate via the `->form([...])` definition rather than re-validating inside `->action(...)`. Filament rejects the modal submit on validation failure.

## Bulk actions

```php
BulkAction::make('archive')
    ->requiresConfirmation()
    ->deselectRecordsAfterCompletion()
    ->action(function (Collection $records): void {
        $records->each(fn (Order $order) => app(ArchiveOrderAction::class)->run($order));
    });
```

- **MUST** chunk the iteration for >1k rows. Dispatch a job per chunk instead of looping in the request.
- **MUST** authorize bulk actions — policies are **not** auto-checked on bulk actions.
- **SHOULD** call `->deselectRecordsAfterCompletion()` so the table doesn't keep the (now-mutated) rows selected.

## Reusable action class

When the same action appears in 3+ places, extract it. Filament generates the scaffolding:

```bash
php artisan make:filament-action ApproveAction
```

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
            ->icon('heroicon-o-check')
            ->color('success')
            ->requiresConfirmation()
            ->action(fn (Order $record) => app(ApproveOrderAction::class)->run($record));
    }
}
```

Usage stays one line at the call site:

```php
ApproveAction::make()
```

## Halting / cancelling

Inside an `->action(...)` callback, bail out cleanly with `$action->halt()` or `Action::cancel()`:

```php
->action(function (Order $record, Action $action): void {
    if ($record->isLocked()) {
        Notification::make()->danger()->title('Order is locked')->send();
        $action->halt();
        return;
    }
    app(ApproveOrderAction::class)->run($record);
});
```

`halt()` keeps the modal open; without it the modal closes on every callback completion (even failures), which hides the error.

## Slide-overs vs modals

```php
->slideOver()      // right-side panel instead of centered modal
->modalWidth('xl') // 'sm' | 'md' | 'lg' | 'xl' | '2xl' | ... | '7xl' | 'screen'
```

- **PREFER** `->slideOver()` for forms with >5 fields — feels less cramped on wide screens.

## Wizard (multi-step) action

For long input flows, use `->steps([...])` instead of a single `->form(...)`:

```php
Action::make('createOrder')
    ->icon('heroicon-o-shopping-cart')
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
    ->action(fn (array $data) => app(CreateOrderAction::class)->run($data));
```

- **MUST** validate inside each `Wizard\Step` — Filament blocks "Next" until the step's fields pass.
- **PREFER** wizard over a single long modal once you cross 3 logical sections; users abandon long single-page modals.

## Styling reference

```php
Action::make('publish')
    ->label('Publish')
    ->icon('heroicon-o-paper-airplane')
    ->iconPosition(IconPosition::After)
    ->color('success')                  // primary | secondary | success | warning | danger | info | gray
    ->size(ActionSize::Large)           // small | medium | large
    ->button()                          // button | iconButton | link | outlined
    ->keyBindings(['mod+s'])
    ->badge(fn () => Notification::query()->unread()->count())
    ->badgeColor('danger')
    ->tooltip('Publish to all subscribers');
```

- **MUST** use `->iconButton()` for row-level repetitive actions; full-button labels in every row wreck table density.
- **AVOID** `->keyBindings([...])` outside power-user surfaces — keyboard shortcuts on customer-facing panels conflict with browser/OS bindings.

## Notification with follow-up action

Pair a destructive action with an undo button via `Notification::actions`:

```php
->action(function (Order $record): void {
    $original = $record->replicate();
    app(ArchiveOrderAction::class)->run($record);

    Notification::make()
        ->title('Order archived')
        ->success()
        ->actions([
            NotificationAction::make('undo')
                ->color('gray')
                ->action(fn () => app(RestoreOrderAction::class)->run($record)),
        ])
        ->send();
});
```

- **MUST** keep the undo window honest — only offer undo when the underlying mutation is genuinely reversible. A fake undo button is worse than no undo.

## Header actions vs row actions vs page actions (v5 surface)

| Surface | Where | Use for |
| ------- | ----- | ------- |
| `getHeaderActions()` on List page | top of the table | global ops (Create, Import, Export) |
| `->headerActions([...])` on the table | table header strip | table-scoped non-bulk ops (Create on a relation manager, refresh) |
| `->recordActions([...])` on the table *(v5; v4 was `->actions()`)* | per row | per-record ops (View, Edit, Approve) |
| `->toolbarActions([...])` on the table *(v5; v4 was `->bulkActions()`)* | toolbar / bulk strip | bulk operations, usually wrapped in `BulkActionGroup` |
| `->groupedBulkActions([...])` | toolbar | shorthand when every bulk action fits one group |
| `getHeaderActions()` on View/Edit page | top of the page | per-record ops outside the table context |

## Modal forms — `->schema()` not `->form()`

```php
EditAction::make()
    ->schema([
        TextInput::make('title')->required(),
        Textarea::make('notes'),
    ])
    ->action(function (array $data, Order $record) { /* ... */ });
```

- v5 actions configure their modal via `->schema([...])`. The v4-style `->form([...])` no longer works on Action / BulkAction / EditAction / etc.
- The submitted state arrives in the callback as `$data` (same as v4).

## Imports — `Filament\Actions\*`

```php
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Actions\BulkAction;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\CreateAction;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Actions\ForceDeleteAction;
use Filament\Actions\ForceDeleteBulkAction;
use Filament\Actions\ReplicateAction;
use Filament\Actions\RestoreAction;
use Filament\Actions\RestoreBulkAction;
use Filament\Actions\ViewAction;
```

- v5 unified every action class under `Filament\Actions\*`. The v4-era `Filament\Tables\Actions\*` and `Filament\Forms\Actions\*` namespaces **do not exist** — referencing them throws a fatal class-not-found.

## Notifications inside actions

```php
->successNotificationTitle('Order approved')
->failureNotificationTitle('Failed to approve')
```

Or for fully custom:

```php
->action(function (Order $record): void {
    try {
        app(ApproveOrderAction::class)->run($record);
        Notification::make()->success()->title('Approved')->send();
    } catch (DomainException $e) {
        Notification::make()->danger()->title('Failed')->body($e->getMessage())->send();
    }
});
```

## Import / Export actions (v5)

Filament v5 ships first-class import/export plumbing — don't roll your own Maatwebsite/Excel pipeline unless you already depend on it.

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

- **MUST** queue imports of >1k rows — the action returns immediately and emails the admin when done.
- **MUST** put `resolveRecord()` logic in the Importer, not in `beforeFill` — Filament uses it to decide insert-vs-update per row.
- **AVOID** wide CSV imports (>30 columns); split into multiple importers per concern (order header vs items vs payments).

## v5+ notes

- **Stacked action modals** (v5.2+) — multiple modals can stack, useful for confirm-then-form-then-confirm flows.
