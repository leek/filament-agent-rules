# Filament Agent Rules

Cross-cutting conventions for the Filament admin layer. Per-class-type rules live in the matching directory's `CLAUDE.md` — read both when editing a file.

Targets **Filament v4 + v5**. v5 introduced no public-API breaks over v4 (Livewire 4 compat bump). Rules call out the few deltas inline with "v5+:" markers.

All rules below are **MUST** unless tagged **SHOULD** / **PREFER** / **AVOID**.

## Where things live

| Class type            | Directory                                          | Naming                              |
| --------------------- | -------------------------------------------------- | ----------------------------------- |
| Resource              | `app/Filament/Resources/`                          | `{Model}Resource`                   |
| Resource Pages        | `app/Filament/Resources/{Model}Resource/Pages/`    | `List{Models}`, `Create{Model}`, `Edit{Model}`, `View{Model}` |
| Relation Managers     | `app/Filament/Resources/{Model}Resource/RelationManagers/` | `{Relation}RelationManager` |
| Schemas (Form/Infolist) | `app/Filament/Resources/{Model}Resource/Schemas/` | `{Model}Form`, `{Model}Infolist`    |
| Table definitions     | `app/Filament/Resources/{Model}Resource/Tables/`   | `{Models}Table`                     |
| Cluster               | `app/Filament/Clusters/`                           | `{Name}` (no suffix)                |
| Custom Page           | `app/Filament/Pages/`                              | `{Name}` (no suffix)                |
| Widget                | `app/Filament/Widgets/`                            | `{Name}Widget` / `{Name}Chart` / `{Name}Overview` |
| PanelProvider         | `app/Providers/Filament/`                          | `{PanelId}PanelProvider`            |

## Discovery

Filament auto-discovers Resources/Pages/Widgets configured on the panel via `->discoverResources(...)`, `->discoverPages(...)`, `->discoverWidgets(...)` in the `PanelProvider`.

- **MUST** keep classes inside the configured discovery paths — orphan classes silently fail to register.
- **MUST NOT** rely on auto-discovery for classes inside `Clusters/` — register the cluster on the resource via `protected static ?string $cluster = MyCluster::class;`.

## Filament Actions vs app/Actions

These are different concepts. Don't conflate them:

- **`app/Actions/{Verb}{Noun}Action.php`** — business-logic Actions (from `laravel-agent-rules`). Pure PHP class with one `run()` method.
- **`Filament\Actions\Action`** — UI Action that renders a button/modal in a Resource/Page/Widget. Configured via fluent builder.

A Filament Action should **delegate** to a business Action for any non-trivial work:

```php
Action::make('approve')
    ->action(fn (Order $record) => app(ApproveOrderAction::class)->run($record));
```

## Configuration over inheritance

Filament leans heavily on fluent builders inside static methods (`form(Schema $schema)`, `table(Table $table)`, `infolist(Schema $schema)`). Override the builder method on the Resource/Page/Widget — don't subclass framework classes.

## Authorization

- **MUST** rely on Laravel Policies for record-level authorization. Filament auto-resolves `{Model}Policy` for `viewAny`, `view`, `create`, `update`, `delete`, `restore`, `forceDelete`.
- **MUST NOT** inline `auth()->user()->isAdmin()` checks inside Resource methods — funnel through the policy.
- For panel-level access, implement `FilamentUser::canAccessPanel(Panel $panel)` on the `User` model.

## Notifications (cross-cutting)

`Filament\Notifications\Notification` is the canonical way to surface feedback from any panel surface — Resource pages, Actions, Widgets, custom Pages, queued Jobs.

```php
use Filament\Notifications\Notification;

Notification::make()
    ->title('Order approved')
    ->body("Reference #{$order->reference}")
    ->success()
    ->send();
```

| Method        | When                                              |
| ------------- | ------------------------------------------------- |
| `->success()` | Operation completed                               |
| `->danger()`  | Operation failed / hard error                     |
| `->warning()` | Risky-but-not-failed state, expiring data         |
| `->info()`    | Neutral info, "new version available", etc.       |

Rules:

- **MUST** call `->send()` — without it the notification is built and discarded silently. Easiest bug to ship.
- **MUST** use `->title(...)` (short) + `->body(...)` (detail). One-line titles read better in stacked toasts.
- **MUST** mark recoverable-error notifications `->persistent()` — auto-dismiss hides the actual problem.
- **PREFER** `->send()` (toast) for ephemeral feedback; **PREFER** `->sendToDatabase($user)` for events the admin should find later (new comment, mention, export ready).
- **AVOID** "Saved!" notifications on routine CRUD; Filament already ships a default save notification — duplicating it just adds noise. Override `getSavedNotification()` on the page if you need to customise.

### Database (notification center)

Enable on the `PanelProvider`:

```php
->databaseNotifications()
->databaseNotificationsPolling('60s') // or null to disable polling
```

Send to specific user(s):

```php
Notification::make()
    ->title('New comment on your post')
    ->actions([NotificationAction::make('view')->url(route('posts.show', $post))])
    ->sendToDatabase($user);

Notification::make()->title('Maintenance tonight')->sendToDatabase($admins);
```

- **MUST NOT** poll the notification center faster than 30s in production — every poll runs a query per logged-in admin.
- **MUST** run `php artisan notifications:table` and migrate before enabling `->databaseNotifications()` — without the table the panel throws on every page load.

### Inside an Action

```php
->action(function (Order $record): void {
    try {
        app(ApproveOrderAction::class)->run($record);
        Notification::make()->title('Approved')->success()->send();
    } catch (DomainException $e) {
        Notification::make()
            ->title('Approval failed')
            ->body($e->getMessage())
            ->danger()
            ->persistent()
            ->send();
    }
});
```

- **MUST** wrap fallible actions in try/catch and emit a `danger` notification — uncaught exceptions bubble to Livewire and render as a generic 500.

## v5+ notes

- Filament v5 requires **Tailwind v4** for custom themes. Default theme works unchanged.
- v5 uses **Livewire v4** internally. Component patterns from v4 still work, but Livewire 4 attributes (`#[Locked]`, `#[Computed]`, etc.) are now available inside Filament pages/widgets.
