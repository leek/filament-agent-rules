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

## v5+ notes

- **Stacked action modals** (v5.2+) — multiple modals can stack, useful for confirm-then-form-then-confirm flows.
