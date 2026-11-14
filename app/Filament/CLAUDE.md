# Filament Agent Rules

Cross-cutting conventions for the Filament admin layer. **MUST** read the matching class-type rules below before editing a Filament file. These skeleton directories are often siblings of real code, so directory inheritance alone does not load them.

## Rule routing

Resolve these paths from the project root. Use the installed agent filename (`AGENTS.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, or `.clinerules`) in place of `CLAUDE.md` when applicable. Follow this table for stock, multi-panel, domain-grouped, and clustered layouts alike; classify pages by their base class.

| Editing | Read |
| ------- | ---- |
| A Resource, including one inside a cluster | `app/Filament/Resources/CLAUDE.md` |
| A resource-bound page (`ListRecords`, `CreateRecord`, `EditRecord`, `ViewRecord`, or custom resource Page) | `app/Filament/Resources/Pages/CLAUDE.md` |
| A relation manager | `app/Filament/Resources/RelationManagers/CLAUDE.md` |
| Forms, infolists, or extracted schema components | `app/Filament/Resources/Schemas/CLAUDE.md` |
| Tables, extracted columns, or filters | `app/Filament/Resources/Tables/CLAUDE.md` |
| UI actions | `app/Filament/Actions/CLAUDE.md` |
| A standalone panel Page or Dashboard | `app/Filament/Pages/CLAUDE.md` |
| Widgets | `app/Filament/Widgets/CLAUDE.md` |
| Clusters | `app/Filament/Clusters/CLAUDE.md` |
| Panel providers | `app/Providers/Filament/CLAUDE.md` |
| Theme CSS | `resources/css/filament/CLAUDE.md` |
| Filament tests | `tests/Feature/Filament/CLAUDE.md` |

Targets Filament 5.9.0 or later in 5.x, verified against that released baseline and current official source. **MUST** check installed versions before applying these examples. APIs include extracted resource `Schemas/` and `Tables/` classes, `Filament\Actions\*`, table `recordActions()` / `toolbarActions()`, action modal `schema()`, `TextColumn::badge()`, and layout components under `Filament\Schemas\Components\*`.

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
| Cluster               | `app/Filament/Clusters/{Domain}/`                  | `{Domain}Cluster`                   |
| Custom Page           | `app/Filament/Pages/`                              | `{Name}` (no suffix)                |
| Widget                | `app/Filament/Widgets/`                            | `{Name}Widget` / `{Name}Chart` / `{Name}Overview` / `Latest{Models}` (table widgets) |
| PanelProvider         | `app/Providers/Filament/`                          | `{PanelId}PanelProvider`            |

> The directory wrapping each resource is **plural** (e.g. `Orders/`), the class file inside it is **singular + Resource suffix** (`OrderResource.php`). This is the layout emitted by `php artisan make:filament-resource`; the older flat layout (`app/Filament/Resources/OrderResource.php` + `OrderResource/` sibling directory) no longer applies.

## Discovery

Filament auto-discovers Resources/Pages/Widgets configured on the panel via `->discoverResources(...)`, `->discoverPages(...)`, `->discoverWidgets(...)` in the `PanelProvider`.

- **MUST** keep classes inside the configured discovery paths — orphan classes silently fail to register.
- **MUST** configure `->discoverClusters(...)` and declare membership on each child Resource/Page via `protected static ?string $cluster = MyCluster::class;`. Cluster discovery also discovers child Resources/Pages under its directory. Children kept elsewhere need their own resource/page discovery or explicit registration.

## Filament Actions vs app/Actions

These are different concepts. Don't conflate them:

- **`app/Actions/{Verb}{Noun}Action.php`** — business-logic Actions (from `laravel-agent-rules`). Pure PHP class with one `handle()` method.
- **`Filament\Actions\Action`** — UI Action that renders a button/modal in a Resource/Page/Widget. Configured via fluent builder.

A Filament Action should **delegate** to a business Action for any non-trivial work:

```php
Action::make('approve')
    ->action(fn (Order $record) => app(ApproveOrderAction::class)->handle($record));
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
| **Layout** | `Filament\Schemas\Components\*` | structure / arrange other components | `Section`, `Grid`, `Tabs`, `Wizard`, `Fieldset`, `Flex` |
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

- **MUST** mind the API seam: the top-level **`Schema`** takes **`->components([...])`**; a **layout component** nests its children via **`->schema([...])`**. `Flex`, `Group`, and `Wizard` accept their children as a constructor array. Calling `->components()` on a `Section` or `->schema()` on the top-level schema is a common mistake.
- **MUST** choose a component's namespace by category, not by guess: a field is `Filament\Forms\Components\TextInput`, an entry is `Filament\Infolists\Components\TextEntry`, but the `Section`/`Grid`/`Tabs` wrapping either is `Filament\Schemas\Components\*`.
- **PREFER** expressing any "custom layout" as nested layout + prime components in a schema before reaching for Blade — this component tree is the structural backing for the "Prefer built-in components over custom Blade" ladder below.

## Prefer built-in components over custom Blade

Custom Blade skips Filament theming, dark mode, spacing, and state handling. Before writing `->view(...)`, a `ViewField`/`ViewEntry`, a custom-view schema component, or a Blade-backed `Widget`, walk this ladder:

1. **A built-in field / column / entry** — `TextInput`, `Select`, `TextColumn`, `TextEntry`, `IconColumn`, `ImageEntry`, … for record data.
2. **A prime component** — `Text`, `Icon`, `Image`, `UnorderedList` (`Filament\Schemas\Components\*`) for *arbitrary* content (headings, notes, computed text, logos, bullet lists) in any schema. See `app/Filament/Resources/Schemas/CLAUDE.md` → "Prime components".
3. **A `Callout`** — for an info / warning / error block (Schemas → "Callout").
4. **A composition of the above** inside `Section` / `Grid` / `Fieldset` / `Flex` — most "custom" layouts are just built-ins on a grid.
5. **A custom component class** that returns a configured built-in (the `make()` pattern) — for reusable heavy config.
6. **Custom Blade** (`->view(...)`, `ViewField`, `ViewEntry`, `ViewColumn`, a `Widget` view) — only when the markup is genuinely bespoke (a third-party embed, a hand-built chart, a non-Filament layout). For table cells specifically, `ViewColumn` and full custom column classes are the sanctioned hatch — see `app/Filament/Resources/Tables/CLAUDE.md` → "Custom columns".

- **MUST** exhaust rungs 1–5 before dropping to Blade.
- **MUST**, when you do reach rung 6, wrap the markup in Filament's wrappers (`<x-filament::section>`, `<x-filament-widgets::widget>`, `<x-filament-panels::page>`) so theming and dark mode still apply.
- **PREFER** extracting a reusable custom **component class** (rung 5) over copying a Blade partial — it composes with a schema like any other component.

### When you do write Blade

- **MUST** put `wire:click` / `x-on:click` / `@click` on a `<button type="button">` (or `<x-filament::button>`, or an `<a href>` for navigation). A `<div>`, `<span>` or `<tr>` takes no keyboard focus, so the control is mouse-only. If the element truly cannot be a button, it needs all three of `role="button"`, `tabindex="0"` and a key handler (`x-on:keydown.enter` + `x-on:keydown.space.prevent`).
- **MUST NOT** read `$loop` in a partial that opens its own `@foreach` to mean the including loop: inside the inner loop `$loop->index` is the inner index. Capture the outer value first and pass it in.

  ```blade
  @foreach ($steps as $step)
      @include('filament.partials.step-menu', ['position' => $loop->index])
  @endforeach
  ```

- **MUST** give every `x-sortable-item` an `x-sortable-handle`, on the item itself or on an element inside it. Filament's `x-sortable` directive starts a drag only from `[x-sortable-handle]`, so a list without one cannot be reordered at all. When the row holds buttons, links or inputs, put the handle on a dedicated grip rather than the row, or every click on a control starts a drag.
- **MUST NOT** put `@js(...)` or any other Blade directive inside a component tag's attribute (`<x-filament::button wire:click="tick(@js($key))">`). Blade does not compile directives there: the browser receives the literal `@js($key)` and the click throws `Livewire Expression Error`. Write `wire:click="tick({{ Js::from($key) }})"` (`Illuminate\Support\Js`); `@js` works only on a plain HTML element. A test that calls the method directly still passes, so assert the rendered attribute or click the control in a browser.
- **MUST** give a hand-built scrolling table's `overflow-x-auto` wrapper `relative`. Screen-reader-only text (`sr-only`) is absolutely positioned, so inside a non-positioned scroll box it escapes the box and the whole page scrolls sideways on a phone.
- **MUST** make a link or button repeated per row or per cell say which row it acts on in its accessible name ("Open March 2026 for Dana Lee", by `aria-label` or `sr-only` text), and mark the grid up as a real `<table>` with `<th scope>` row and column headers. Twenty links all named "Open" cannot be told apart by a screen reader.
- A hand-built upload control must honour the form contract in `app/Filament/Resources/Schemas/CLAUDE.md` → "Custom upload fields".

## Prefer embedding a Livewire component over a custom page

The ladder above is about a single component. The same instinct applies one level up, at the **page**: when a page needs something Filament can't build out of the box, the wrong move is to throw away the standard Resource page and hand-build a fully custom Livewire page. Almost always **only one or two pieces are actually custom** — a real-time sidebar, a bespoke chart, a non-standard widget. Build *those* as Livewire components and embed them; keep everything else (form, table, relation managers, save pipeline, validation, authorization, notifications) that Filament gives you.

- **MUST** prefer embedding `Filament\Schemas\Components\Livewire::make(Component::class, [...])` into a page's `content()` schema (or any form/infolist schema) over converting the page to bespoke Blade/Livewire. A custom component in a standard page beats a custom page reimplementing the form.
- **MUST** still delegate the embedded component's business logic to an `app/Actions/` class — it's a UI boundary, like a Filament Action.
- See `app/Filament/Resources/Pages/CLAUDE.md` → "Custom page content" for the `content()` + `Livewire::make()` mechanics, and `app/Filament/Pages/CLAUDE.md` for standalone pages.

## Enums for status / type / category

**PREFER** `Filament\Support\Icons\Heroicon` enum cases for PHP icon configuration, matching the examples. String icon identifiers remain valid for custom icon sets; verify each identifier against the installed package. Use `{Verb}{Noun}Action` names for business Actions, distinct from UI Action class names.

Back every status, type, or category column with a PHP enum that implements the Filament presentation contracts. One enum drives the form select, the table badge, the infolist entry, and the policy guard — no parallel `match` blocks to keep in sync.

```php
use Filament\Support\Contracts\{HasColor, HasIcon, HasLabel};
use Filament\Support\Icons\Heroicon;

enum OrderStatus: string implements HasLabel, HasColor, HasIcon
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Cancelled = 'cancelled';

    public function getLabel(): string
    {
        return ucfirst($this->value);
    }

    public function getColor(): string
    {
        return match ($this) {
            self::Pending => 'warning',
            self::Paid => 'success',
            self::Cancelled => 'danger',
        };
    }

    public function getIcon(): string|Heroicon
    {
        return match ($this) {
            self::Pending => Heroicon::Clock,
            self::Paid => Heroicon::CheckCircle,
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
- **MUST** override `get{View,Edit,Delete,…}AuthorizationResponse()` (returning `Response::allow()` / `Response::deny()`) when a Resource decides an ability itself instead of through the policy. Overriding only `canView()` / `canEdit()` changes what the UI offers, but the View and Edit pages and the built-in actions authorize through the `…AuthorizationResponse()` method, so the route still answers 403. The stock `can*()` methods already delegate to it, so one override covers both.

## Security

Filament ships a dedicated security guide (`filamentphp.com/docs/5.x/advanced/security`). The load-bearing rules, consolidated — per-surface specifics are cross-linked, not restated.

### The schema is the write allowlist (mass assignment)

Filament does **not** lean on Eloquent's `$fillable`/`$guarded` for the form save — **only attributes with a matching component in the form schema are writable.** An attribute absent from the schema can't be written, even via a hand-crafted Livewire request: "only attributes with corresponding form fields are actually editable — this is not a mass assignment vulnerability."

- **MUST** keep privileged attributes (`is_admin`, `role`, `credits`, `*_verified_at`) out of the editable schema. To keep them off the client entirely, add them to the model's `$hidden`, or strip them in `mutateFormDataBeforeFill()`.
- **MUST** gate `->dehydrated(fn () => ...)` (PHP) on any conditionally-hidden field that must not persist — client visibility is presentational, **not** a write boundary. See `app/Filament/Resources/Schemas/CLAUDE.md` → "Conditional visibility".

### Authorize everything custom

Filament auto-checks model policies only for **standard CRUD**. Anything you add — custom actions, custom pages, custom Livewire components, inline-editable columns, API endpoints — **is not authorized automatically.**

- **MUST** authorize custom surfaces yourself: `->authorize(...)` on an action, `canAccess()` on a page, an explicit policy call in a Livewire method — they are never applied for you. See "Authorization" above, plus the per-surface notes (Tables → bulk actions + inline columns, Actions → `authorize`, Pages → `canAccess`).
- **Hidden is not authorized.** A condition hides or blocks only the object it is declared on. Hiding the trigger (a Blade `@if`, a sibling action, another page's button) leaves the action, Livewire method or route callable by anyone who can load the component. **MUST** put the permission **and** any state precondition ("only while the order is open") on the thing that executes. See `app/Filament/Actions/CLAUDE.md` → "Authorization".
- **MUST** gate a link or redirect to another record or page on the **target's** own check, and render plain text (or redirect elsewhere) when it fails. Access to the current page says nothing about the target, so the link 403s. Use `OrderResource::canView($order)` / `canEdit($order)`, a resource page's `EditOrder::canAccess(['record' => $order])`, a standalone page's `canAccess()`, or a relation manager's `canViewForRecord($ownerRecord, $pageClass)` before linking to `?relation=...`.

  ```php
  ->url(fn (Invoice $record): ?string => OrderResource::canView($record->order)
      ? OrderResource::getUrl('view', ['record' => $record->order])
      : null)
  ```

- **MUST** run authorization **before** side effects. Don't do work that shouldn't happen for an unauthorized user in `boot()` or per-property hydrate hooks — those can fire *before* the policy abort. Put the side effect inside the authorized action/method.
- **MUST** authorize a plain Livewire component, and any record-level check a page adds itself, on every request, not only in `mount()`, which runs once. A Filament page's static `canAccess()` already re-runs on every request: do not add a `hydrate()` that repeats it. See `app/Filament/Resources/Pages/CLAUDE.md` → "Authorize every request, not only `mount()`".
- Inline columns (`ToggleColumn`/`SelectColumn`/`TextInputColumn`) check only `->disabled()`, never the policy — `->disabled(fn ($record) => ! auth()->user()->can('update', $record))` (already required in Tables).

### One record, every surface

- **MUST** gate a read-only export, download or preview on a read ability (`view`, `export`), never on `create` / `update` / `import`. A user or tenant limited to read access must still be able to export, and a write ability hands the data to people who were only meant to edit it.
- **MUST** apply a masking, redaction or row-visibility rule in one shared query or DTO builder that every view of the data consumes: table, infolist, calendar, preview, CSV/PDF export, notification. A rule added to the table alone leaks through the sibling. When you add one, list every surface that renders the same record and cover each with a test as the restricted viewer.

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
- **Multi-tenancy:** Filament registers tenant global scopes for models with tenant-aware resources in the active panel after tenant identification. **MUST** verify scoping for custom queries, actions, pages, widgets, and related models; add explicit tenant constraints or middleware scopes when automatic scoping does not apply. Jobs and queries outside that panel context need their own tenant context. See `app/Providers/Filament/CLAUDE.md` → "Tenancy".
- **SHOULD** verify, with tests, that authorization holds at **every** entry point — resource pages, custom pages, actions, bulk actions, inline columns. See `tests/Feature/Filament/CLAUDE.md`.

## Controls that depend on setup

A control whose effect depends on setup the user may not have done yet (business hours, a connected integration, a default assignee) **MUST** stay disabled while the prerequisite is missing, refuse the same write server-side, and name the prerequisite with a link to where it is fixed. See `app/Filament/Resources/Schemas/CLAUDE.md` → "Controls that depend on setup".

## Labels & localization

Filament labels — component `->label()`, modal headings, `Notification` titles, enum `getLabel()` — are written **inline** throughout these rules. This is the **one sanctioned exception** to the app-wide "never inline user-facing strings" rule in `laravel-agent-rules` (`app/CLAUDE.md` → "Constants & strings").

- **SHOULD** keep labels inline for an English-only internal panel — wrapping every `->label()` in `__()` buys nothing there.
- **MUST**, when the panel is localized, pass `__('...')` (or call `->translateLabel()`) and lift it to a **global** default rather than sprinkling `__()` at every call site — e.g. `Field::configureUsing(fn (Field $field) => $field->translateLabel())`. See `app/Providers/Filament/CLAUDE.md` → "Global defaults via `configureUsing`".
- The **Title Case** convention (`app/Filament/Actions/CLAUDE.md`) governs the *rendered* text — apply it to the translation value when localized.

## Notifications

`Filament\Notifications\Notification` is the feedback surface for pages, actions, widgets and queued jobs. **MUST** call `->send()`: without it the notification is built and discarded silently. See `app/Filament/Actions/CLAUDE.md` → "Notifications" for the rules and the transactional example, and `app/Providers/Filament/CLAUDE.md` → "Notification center" for database notifications.
