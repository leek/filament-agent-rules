# Filament Agent Rules

Cross-cutting conventions for the Filament admin layer. Per-class-type rules live in the matching directory's `CLAUDE.md` — read both when editing a file.

Targets the current Filament panel builder APIs: extracted resource `Schemas/` and `Tables/` classes, `Filament\Actions\*`, table `recordActions()` / `toolbarActions()`, action modal `schema()`, `TextColumn::badge()`, and layout components under `Filament\Schemas\Components\*`.

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

> The directory wrapping each resource is **plural** (e.g. `Orders/`), the class file inside it is **singular + Resource suffix** (`OrderResource.php`). This is the layout emitted by `php artisan make:filament-resource`; the older flat layout (`app/Filament/Resources/OrderResource.php` + `OrderResource/` sibling directory) no longer applies.

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

## How schemas work — the component tree

Forms, infolists, page bodies, action modals, and wizard steps all compose a `Filament\Schemas\Schema` component tree. Most "custom layout" work should stay inside that tree.

Use the right component category:

| Category | Namespace | Role | Examples |
| -------- | --------- | ---- | -------- |
| **Fields** | `Filament\Forms\Components\*` | accept input (with validation) | `TextInput`, `Select`, `Repeater`, `FileUpload` |
| **Entries** | `Filament\Infolists\Components\*` | display a record attribute, read-only | `TextEntry`, `IconEntry`, `ImageEntry` |
| **Layout** | `Filament\Schemas\Components\*` | structure / arrange other components | `Section`, `Grid`, `Tabs`, `Wizard`, `Fieldset`, `Split` |
| **Prime** | `Filament\Schemas\Components\*` | render static / computed content | `Text`, `Icon`, `Image`, `UnorderedList` |

Top-level schema uses `->components([...])`; layout children use `->schema([...])`:

```php
$schema->components([                      // top-level Schema → ->components()
    Section::make('Account')->schema([     // layout component nests a child schema → ->schema()
        Grid::make(2)->schema([
            TextInput::make('name'),
            TextInput::make('email'),
        ]),
    ]),
]);
```

- **MUST** mind the API seam: the top-level **`Schema`** takes **`->components([...])`**; a **layout component** nests its children via **`->schema([...])`**. (A few — `Split`, `Stack`, `Group`, `Wizard` — take their children as a constructor array instead, since their first argument isn't a label.) Calling `->components()` on a `Section` or `->schema()` on the top-level schema is a common mistake.
- **MUST** choose a component's namespace by category, not by guess: a field is `Filament\Forms\Components\TextInput`, an entry is `Filament\Infolists\Components\TextEntry`, but the `Section`/`Grid`/`Tabs` wrapping either is `Filament\Schemas\Components\*`.
- **PREFER** expressing any "custom layout" as nested layout + prime components in a schema before reaching for Blade — this component tree is the structural backing for the "Prefer built-in components over custom Blade" ladder below.

## Prefer built-in components over custom Blade

Custom Blade skips Filament theming, dark mode, spacing, and state handling. Before writing `->view(...)`, a `ViewField`/`ViewEntry`, a custom-view schema component, or a Blade-backed `Widget`, walk this ladder:

1. **A built-in field / column / entry** — `TextInput`, `Select`, `TextColumn`, `TextEntry`, `IconColumn`, `ImageEntry`, … for record data.
2. **A prime component** — `Text`, `Icon`, `Image`, `UnorderedList` (`Filament\Schemas\Components\*`) for *arbitrary* content (headings, notes, computed text, logos, bullet lists) in any schema. See `app/Filament/Resources/Schemas/CLAUDE.md` → "Prime components".
3. **A `Callout`** — for an info / warning / error block (Schemas → "Callout").
4. **A composition of the above** inside `Section` / `Grid` / `Fieldset` / `Split` — most "custom" layouts are just built-ins on a grid.
5. **A custom component class** that returns a configured built-in (the `make()` pattern) — for reusable heavy config.
6. **Custom Blade** (`->view(...)`, `ViewField`, `ViewEntry`, `ViewColumn`, a `Widget` view) — only when the markup is genuinely bespoke (a third-party embed, a hand-built chart, a non-Filament layout). For table cells specifically, `ViewColumn` and full custom column classes are the sanctioned hatch — see `app/Filament/Resources/Tables/CLAUDE.md` → "Custom columns".

- **MUST** exhaust rungs 1–5 before dropping to Blade.
- **MUST**, when you do reach rung 6, wrap the markup in Filament's wrappers (`<x-filament::section>`, `<x-filament-widgets::widget>`, `<x-filament-panels::page>`) so theming and dark mode still apply.
- **PREFER** extracting a reusable custom **component class** (rung 5) over copying a Blade partial — it composes with a schema like any other component.

## Prefer embedding a Livewire component over a custom page

The ladder above is about a single component. The same instinct applies one level up, at the **page**: when a page needs something Filament can't build out of the box, the wrong move is to throw away the standard Resource page and hand-build a fully custom Livewire page. Almost always **only one or two pieces are actually custom** — a real-time sidebar, a bespoke chart, a non-standard widget. Build *those* as Livewire components and embed them; keep everything else (form, table, relation managers, save pipeline, validation, authorization, notifications) that Filament gives you.

- **MUST** prefer embedding `Filament\Schemas\Components\Livewire::make(Component::class, [...])` into a page's `content()` schema (or any form/infolist schema) over converting the page to bespoke Blade/Livewire. A custom component in a standard page beats a custom page reimplementing the form.
- **MUST** still delegate the embedded component's business logic to an `app/Actions/` class — it's a UI boundary, like a Filament Action.
- See `app/Filament/Resources/Pages/CLAUDE.md` → "Custom page content" for the `content()` + `Livewire::make()` mechanics, and `app/Filament/Pages/CLAUDE.md` for standalone pages.

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

### The four presentation contracts

All live in `Filament\Support\Contracts\*`. Implement only the ones an enum needs and combine them in one `implements` list. Filament reads them **automatically** wherever the enum is a field/column/entry's value — no `->options([...])` array, `->color(fn ...)`, `->icon(fn ...)`, or `->formatStateUsing()` required.

| Contract | Method (interface return type) | Auto-renders in |
| -------- | ------------------------------ | --------------- |
| `HasLabel` | `getLabel(): string\|Htmlable\|null` | `Select` / `Radio` / `CheckboxList` / `ToggleButtons` option labels; `TextColumn` / `SelectColumn` / `SelectFilter` + table group titles; `TextEntry` |
| `HasColor` | `getColor(): string\|array\|null` | `TextColumn` / `TextEntry` (best with `->badge()`); `ToggleButtons` |
| `HasIcon` | `getIcon(): string\|BackedEnum\|Htmlable\|null` | `TextColumn` / `TextEntry` (with `->badge()`); `IconColumn` / `IconEntry`; `ToggleButtons` |
| `HasDescription` | `getDescription(): string\|Htmlable\|null` | `Radio` / `CheckboxList` option descriptions |

- **SHOULD** implement `HasDescription` when `Radio` / `CheckboxList` enum options need explanatory text; `Radio::make('visibility')->options(Visibility::class)` renders labels and descriptions automatically.
- **MUST** keep enum case names PascalCase and backed values snake_case — backed values become DB column values; casing matters for migrations and search.
- **MUST** use semantic colors (`success`/`warning`/`danger`/`info`/`primary`/`gray`) — Filament maps them through the theme, so palette changes propagate without touching enums.
- **PREFER** an enum over a `string` column the moment a state machine appears (more than 2 values, or any forbidden transition).

## Authorization

- **MUST** rely on Laravel Policies for record-level authorization. Filament auto-resolves `{Model}Policy` for `viewAny`, `view`, `create`, `update`, `delete`, `restore`, `forceDelete`.
- **MUST NOT** inline `auth()->user()->isAdmin()` checks inside Resource methods — funnel through the policy.
- For panel-level access, implement `FilamentUser::canAccessPanel(Panel $panel)` on the `User` model.

## Security

Filament ships a dedicated security guide (`filamentphp.com/docs/5.x/advanced/security`). The load-bearing rules, consolidated — per-surface specifics are cross-linked, not restated.

### The schema is the write allowlist (mass assignment)

Filament does **not** lean on Eloquent's `$fillable`/`$guarded` for the form save — **only attributes with a matching component in the form schema are writable.** An attribute absent from the schema can't be written, even via a hand-crafted Livewire request: "only attributes with corresponding form fields are actually editable — this is not a mass assignment vulnerability."

- **MUST** keep privileged attributes (`is_admin`, `role`, `credits`, `*_verified_at`) out of the editable schema. To keep them off the client entirely, add them to the model's `$hidden`, or strip them in `mutateFormDataBeforeFill()`.
- **MUST** gate `->dehydrated(fn () => ...)` (PHP) on any conditionally-hidden field that must not persist — client visibility is presentational, **not** a write boundary. See `app/Filament/Resources/Schemas/CLAUDE.md` → "Conditional visibility".

### Authorize everything custom

Filament auto-checks model policies only for **standard CRUD**. Anything you add — custom actions, custom pages, custom Livewire components, inline-editable columns, API endpoints — **is not authorized automatically.**

- **MUST** authorize custom surfaces yourself with `->authorize(...)` / `->visible(...)` / `->hidden(...)`, page `canAccess()`, or an explicit policy call — they are never applied for you. See "Authorization" above, plus the per-surface notes (Tables → bulk actions + inline columns, Actions → `authorize`, Pages → `canAccess`).
- **MUST** run authorization **before** side effects. Don't do work that shouldn't happen for an unauthorized user in `boot()` or per-property hydrate hooks — those can fire *before* the policy abort. Put the side effect inside the authorized action/method.
- Inline columns (`ToggleColumn`/`SelectColumn`/`TextInputColumn`) check only `->disabled()`, never the policy — `->disabled(fn ($record) => ! auth()->user()->can('update', $record))` (already required in Tables).

### Never render unsanitized user content (XSS)

Custom columns, custom entries, `ViewColumn`/`ViewEntry`, and any `->view(...)` Blade become XSS vectors the moment user-controlled data flows through them. Treat the following as hostile-by-default:

- **MUST NOT** print user content with raw `{!! $value !!}`. Sanitize: `{!! str($record->content)->sanitizeHtml() !!}` (Markdown: `{!! str($record->content)->markdown()->sanitizeHtml() !!}`).
- **`extraAttributes()` / `extraInputAttributes()` / every `extra*Attributes()` render their values UN-escaped.** Safe with literals (`['class' => 'rounded-md']`); **MUST NOT** pass user-controlled attribute names/values — an attacker breaks out of the attribute and injects markup.
- **`->url($value)`** renders `<a href="...">` verbatim — a value like `javascript:alert(document.cookie)` executes. **MUST** run user-sourced URLs through `Str::sanitizeUrl()` first.
- **`->html()` / `->markdown()`** auto-sanitize via Symfony's `HtmlSanitizerConfig`, **but the `style` attribute is allowed by default** — `position: fixed`, `background: url(...)` etc. survive. Don't treat them as fully safe for hostile input.
- **MUST** validate user-controlled **icon names** against an allowlist — an invalid `Heroicon`/icon string throws a render error.

### Custom FileUpload & custom queries

- A **custom Livewire component** hosting a `FileUpload` (e.g. the embedded-component pattern in `app/Filament/Resources/Pages/CLAUDE.md`) **MUST** use the `RestrictsFileUploadsToSchemaComponents` trait. Without it, a crafted Livewire request can upload to **arbitrary property paths** on any component using `InteractsWithSchemas`. Filament's own resource pages already include it; your custom ones don't. (A conditionally-hidden `FileUpload` is not a valid upload target — uploads to it are rejected.)
- **MUST** constrain every upload (`->acceptedFileTypes()`, `->maxSize()`, `->disk()`, `->visibility()`) — see `app/Filament/Resources/Schemas/CLAUDE.md` → "FileUpload".
- **Multi-tenancy:** Filament scopes **resource** queries to the tenant automatically; **custom queries, actions, pages, and widgets MUST scope to `Filament::getTenant()` themselves** — one forgotten scope leaks another tenant's data. See `app/Providers/Filament/CLAUDE.md` → "Tenancy".
- **SHOULD** verify, with tests, that authorization holds at **every** entry point — resource pages, custom pages, actions, bulk actions, inline columns. See `tests/Feature/Filament/CLAUDE.md`.

## Notifications (cross-cutting)

`Filament\Notifications\Notification` is the canonical feedback surface for Resource pages, Actions, Widgets, custom Pages, and queued Jobs.

```php
use Filament\Notifications\Notification;

Notification::make()
    ->title('Order approved')
    ->body("Reference #{$order->reference}")
    ->success()
    ->send();
```

Rules:

- **MUST** call `->send()` — without it the notification is built and discarded silently. Easiest bug to ship.
- **MUST** use `->title(...)` (short) + `->body(...)` (detail). One-line titles read better in stacked toasts.
- **MUST** mark recoverable-error notifications `->persistent()` — auto-dismiss hides the actual problem.
- **PREFER** `->send()` (toast) for ephemeral feedback; **PREFER** `->sendToDatabase($user)` for events the admin should find later (new comment, mention, export ready).
- **AVOID** "Saved!" notifications on routine CRUD; Filament already ships a default save notification — duplicating it just adds noise. Override `getSavedNotification()` on the page if you need to customise.

### Database notification center

Enable on the `PanelProvider`:

```php
->databaseNotifications()
->databaseNotificationsPolling('60s') // or null to disable polling
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
