# Filament Agent Rules

Cross-cutting conventions for the Filament admin layer. Per-class-type rules live in the matching directory's `CLAUDE.md` — read both when editing a file.

Targets **Filament v4 + v5**. v5 (Livewire 4 bump, Jan 2026) renames several public APIs — table action methods, the `Filament\Actions\*` namespace consolidation, action modal `->schema()` over `->form()`, removed `BadgeColumn`, layout components under `Filament\Schemas\Components\*`. Examples below show v5 names; v4 equivalents flagged inline where they differ.

All rules below are **MUST** unless tagged **SHOULD** / **PREFER** / **AVOID**.

## Global defaults — never assume stock Filament behavior

A project frequently overrides Filament's defaults **globally** via `configureUsing()` — usually in `app/Providers/FilamentServiceProvider.php`, sometimes a `PanelProvider` or `AppServiceProvider::boot()`. These overrides change how *every* component behaves: e.g. all action modals open as `->slideOver()`, every `Select` is `->native(false)->searchable()`, tables paginate at 25, dates render in a house format, labels are translated.

- **MUST** read the project's global Filament configuration **before building or reviewing any component**. Open the `FilamentServiceProvider` (and the active `PanelProvider`) and note every `configureUsing` block. Assuming stock defaults produces code that fights the house style.
- **MUST NOT** re-declare a value the project already sets globally — redundant at best, drift at worst (the local copy and the global default silently diverge). If `DeleteAction` is globally `->slideOver()->modalIconColor('danger')`, don't repeat it per action.
- **SHOULD** lift any setting you find yourself repeating across ≥3 components UP into a `configureUsing` block instead of copying it.
- See `app/Providers/Filament/CLAUDE.md` → "Global defaults via `configureUsing`" for the catalog of what's commonly configured and how to write these blocks.

## Where things live

| Class type            | Directory                                          | Naming                              |
| --------------------- | -------------------------------------------------- | ----------------------------------- |
| Resource              | `app/Filament/Resources/{Models}/`                 | `{Model}Resource`                   |
| Resource Pages        | `app/Filament/Resources/{Models}/Pages/`           | `List{Models}`, `Create{Model}`, `Edit{Model}`, `View{Model}` |
| Relation Managers     | `app/Filament/Resources/{Models}/RelationManagers/` | `{Relation}RelationManager`         |
| Schemas (Form/Infolist) | `app/Filament/Resources/{Models}/Schemas/`       | `{Model}Form`, `{Model}Infolist`    |
| Schema components     | `app/Filament/Resources/{Models}/Schemas/Components/` | `{Model}{Field}Input` / `{Model}{Field}Select` (e.g. `CustomerNameInput`) |
| Table definitions     | `app/Filament/Resources/{Models}/Tables/`          | `{Models}Table`                     |
| Table columns         | `app/Filament/Resources/{Models}/Tables/Columns/`  | `{Model}{Field}Column` (e.g. `CustomerCountryColumn`) |
| Table filters         | `app/Filament/Resources/{Models}/Tables/Filters/`  | `{Model}{Field}Filter` (e.g. `CustomerStatusFilter`) |
| Cluster               | `app/Filament/Clusters/`                           | `{Name}` (no suffix)                |
| Custom Page           | `app/Filament/Pages/`                              | `{Name}` (no suffix)                |
| Widget                | `app/Filament/Widgets/`                            | `{Name}Widget` / `{Name}Chart` / `{Name}Overview` / `Latest{Models}` (table widgets) |
| PanelProvider         | `app/Providers/Filament/`                          | `{PanelId}PanelProvider`            |

> The directory wrapping each resource is **plural** (e.g. `Orders/`), the class file inside it is **singular + Resource suffix** (`OrderResource.php`). This is the v4/v5 convention emitted by `php artisan make:filament-resource`. The pre-v4 flat layout (`app/Filament/Resources/OrderResource.php` + `OrderResource/` sibling directory) no longer applies.

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

## Enums for status / type / category

Back every status, type, or category column with a PHP enum that implements the Filament presentation contracts. One enum drives the form select, the table badge, the infolist entry, and the policy guard — no parallel `match` blocks to keep in sync.

```php
use Filament\Support\Contracts\{HasColor, HasIcon, HasLabel};
use Filament\Support\Icons\Heroicon;

enum OrderStatus: string implements HasLabel, HasColor, HasIcon
{
    case Pending = 'pending';
    case Paid    = 'paid';
    case Shipped = 'shipped';
    case Cancelled = 'cancelled';

    public function getLabel(): string
    {
        return match ($this) {
            self::Pending   => 'Pending',
            self::Paid      => 'Paid',
            self::Shipped   => 'Shipped',
            self::Cancelled => 'Cancelled',
        };
    }

    public function getColor(): string
    {
        return match ($this) {
            self::Pending   => 'warning',
            self::Paid      => 'success',
            self::Shipped   => 'info',
            self::Cancelled => 'danger',
        };
    }

    public function getIcon(): string|Heroicon
    {
        return match ($this) {
            self::Pending   => Heroicon::Clock,
            self::Paid      => Heroicon::CheckCircle,
            self::Shipped   => Heroicon::Truck,
            self::Cancelled => Heroicon::XCircle,
        };
    }
}
```

Then on the Eloquent model:

```php
protected $casts = ['status' => OrderStatus::class];
```

Resource surfaces auto-pick up the labels/colors/icons:

```php
Select::make('status')->options(OrderStatus::class);                 // form
TextColumn::make('status')->badge();                                  // table — colour/icon inferred
IconEntry::make('status');                                            // infolist
```

- **MUST** keep enum case names PascalCase and backed values snake_case — backed values become DB column values; casing matters for migrations and search.
- **MUST** use semantic colors (`success`/`warning`/`danger`/`info`/`primary`/`gray`) — Filament maps them through the theme, so palette changes propagate without touching enums.
- **PREFER** an enum over a `string` column the moment a state machine appears (more than 2 values, or any forbidden transition).

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
