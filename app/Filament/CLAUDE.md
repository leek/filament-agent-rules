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
| Blade views for the panel | `resources/views/filament/CLAUDE.md` |
| Filament tests | `tests/Feature/Filament/CLAUDE.md` |

Each routed file opens with a **Checklist** of its load-bearing rules, each naming its section. Read the checklist first, then the sections your task touches.

Targets Filament 5.9.0 or later in 5.x, verified against that released baseline and current official source. **MUST** check installed versions before applying these examples. APIs include extracted resource `Schemas/` and `Tables/` classes, `Filament\Actions\*`, table `recordActions()` / `toolbarActions()`, action modal `schema()`, `TextColumn::badge()`, and layout components under `Filament\Schemas\Components\*`.

All rules below are **MUST** unless tagged **SHOULD** / **PREFER** / **AVOID**.

## Global defaults — never assume stock Filament behavior

Projects often override Filament's defaults **globally** via `configureUsing()` — usually in `app/Providers/FilamentServiceProvider.php`, sometimes a `PanelProvider` or `AppServiceProvider::boot()`. The overrides change *every* component: e.g. all action modals open as `->slideOver()`, every `Select` is `->native(false)->searchable()`, tables paginate at 25, dates render in a house format, labels are translated.

- **MUST** read the project's global Filament configuration **before building or reviewing any component**. Open the `FilamentServiceProvider` (and the active `PanelProvider`) and note every `configureUsing` block. Assuming stock defaults produces code that fights the house style.
- **MUST NOT** re-declare a value the project already sets globally — redundant at best, drift at worst (the local copy and the global default silently diverge). If `DeleteAction` is globally `->slideOver()->modalIconColor('danger')`, don't repeat it per action.
- **SHOULD** lift any setting repeated across ≥3 components into a `configureUsing` block instead of copying it.
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

Different concepts; don't conflate them:

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

Forms, infolists, page bodies, action modals, and wizard steps all compose a `Filament\Schemas\Schema` component tree; keep custom layout inside it. Pick the namespace by category:

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

- **MUST** mind this API seam: the top-level **`Schema`** takes **`->components([...])`**; a **layout component** nests its children via **`->schema([...])`**. `Flex`, `Group`, and `Wizard` take their children as a constructor array. `->components()` on a `Section` or `->schema()` on the top-level schema is a common mistake.
- **MUST** choose a component's namespace by category, not by guess: a field is `Filament\Forms\Components\TextInput`, an entry is `Filament\Infolists\Components\TextEntry`, but the `Section`/`Grid`/`Tabs` wrapping either is `Filament\Schemas\Components\*`.

## Prefer built-in components over custom Blade

Custom Blade skips Filament theming, dark mode, spacing, and state handling. **MUST** reach for, in order: a built-in field / column / entry; a prime component (`Text`, `Icon`, `Image`, `UnorderedList`); a `Callout`; a composition of those inside `Section` / `Grid` / `Flex`; a custom component class returning a configured built-in. Only then write Blade, and before writing any `.blade.php` for the panel **MUST** read `resources/views/filament/CLAUDE.md`.

At the page level the same holds: embed a `Filament\Schemas\Components\Livewire` component in a standard page's `content()` instead of rebuilding the page. See `app/Filament/Resources/Pages/CLAUDE.md` → "Custom page content".

## Enums for status / type / category

**MUST** back every status, type, or category column with a PHP enum that implements the Filament presentation contracts in `Filament\Support\Contracts\*`: `HasLabel` (option and badge labels), `HasColor` (badge colour, semantic names only: `success` / `warning` / `danger` / `info` / `primary` / `gray`), `HasIcon` (badge and icon columns, PREFER `Heroicon` cases), `HasDescription` (radio / checkbox option text). Cast the column to the enum; Filament then renders the select options, table badge and infolist entry from it with no `->options([...])`, `->color(fn ...)` or `->formatStateUsing()`:

```php
enum OrderStatus: string implements HasLabel, HasColor
{
    case Pending = 'pending';
    case Paid = 'paid';

    public function getLabel(): string { return ucfirst($this->value); }

    public function getColor(): string
    {
        return match ($this) { self::Pending => 'warning', self::Paid => 'success' };
    }
}

Select::make('status')->options(OrderStatus::class);   // form
TextColumn::make('status')->badge();                   // table: colour and label inferred
```

- **MUST** keep enum case names PascalCase and backed values snake_case: backed values are stored in the database.
- **PREFER** an enum over a `string` column the moment a state machine appears (more than 2 values, or any forbidden transition). Put transition checks on the enum or model, and call them from the business action.
- **PREFER** `Filament\Support\Icons\Heroicon` cases for PHP icon configuration; verify string icon identifiers against the installed package. Name business Actions `{Verb}{Noun}Action`, distinct from UI Action classes.

## Authorization

- **MUST** rely on Laravel Policies for record-level authorization. Filament auto-resolves `{Model}Policy` for `viewAny`, `view`, `create`, `update`, `delete`, `restore`, `forceDelete`.
- **MUST NOT** inline `auth()->user()->isAdmin()` checks inside Resource methods — funnel through the policy.
- For panel-level access, implement `FilamentUser::canAccessPanel(Panel $panel)` on the `User` model.
- **MUST** override `get{View,Edit,Delete,…}AuthorizationResponse()` (returning `Response::allow()` / `Response::deny()`) when a Resource decides an ability itself instead of through the policy. Overriding only `canView()` / `canEdit()` changes what the UI offers, but the View and Edit pages and the built-in actions authorize through the `…AuthorizationResponse()` method, so the route still answers 403. The stock `can*()` methods already delegate to it, so one override covers both.

## Security

Filament ships a dedicated security guide (`filamentphp.com/docs/5.x/advanced/security`). The load-bearing rules, consolidated — per-surface specifics are cross-linked, not restated.

### The schema is the write allowlist (mass assignment)

Filament does **not** lean on Eloquent's `$fillable`/`$guarded` for the form save — **only attributes with a matching component in the form schema are writable.** An attribute absent from the schema can't be written, even via a hand-crafted Livewire request ("this is not a mass assignment vulnerability").

- **MUST** keep privileged attributes (`is_admin`, `role`, `credits`, `*_verified_at`) out of the editable schema. To keep them off the client entirely, add them to the model's `$hidden`, or strip them in `mutateFormDataBeforeFill()`.
- **MUST** gate `->dehydrated(fn () => ...)` (PHP) on any conditionally-hidden field that must not persist — client visibility is presentational, **not** a write boundary. See `app/Filament/Resources/Schemas/CLAUDE.md` → "Conditional visibility".

### Authorize everything custom

Filament auto-checks model policies only for **standard CRUD**. Anything you add — custom actions, custom pages, custom Livewire components, inline-editable columns, API endpoints — **is not authorized automatically.**

- **MUST** authorize custom surfaces yourself: `->authorize(...)` on an action, `canAccess()` on a page, an explicit policy call in a Livewire method. See "Authorization" above, plus the per-surface notes (Tables → bulk actions + inline columns, Actions → `authorize`, Pages → `canAccess`).
- **Hidden is not authorized.** A condition hides or blocks only the object it is declared on. Hiding the trigger (a Blade `@if`, a sibling action, another page's button) leaves the action, Livewire method or route callable by anyone who can load the component. **MUST** put the permission on the thing that executes (`->authorize()` on the action, `canAccess()` on the page), and enforce any state precondition ("only while the order is open") inside the business action it calls, re-read under its lock. `->visible()` decides what is offered, not what is allowed. See `app/Filament/Actions/CLAUDE.md` → "Authorization".
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

Custom columns, custom entries, `ViewColumn`/`ViewEntry`, and any `->view(...)` Blade become XSS vectors when user-controlled data flows through them. Treat the following as hostile by default:

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
