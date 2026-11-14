---
description: Filament providers — PanelProvider bootstrapping (discovery, theme, middleware, plugins, tenancy, auth) and app-wide component defaults via configureUsing in the FilamentServiceProvider
paths:
  - app/Providers/Filament/*.php
  - app/Providers/FilamentServiceProvider.php
---

# Filament Providers — Panels & Global Configuration

**Purpose:** two providers.
- **`{PanelId}PanelProvider`** (`app/Providers/Filament/`) — boots a panel: discovery paths, theme, middleware, plugins, tenancy, auth, navigation.
- **`FilamentServiceProvider`** (`app/Providers/FilamentServiceProvider.php`) — registers **app-wide component defaults** via `configureUsing()`.

## Global defaults via `configureUsing`

A project overrides Filament's stock component defaults **once, globally** — not per call site — with `Component::configureUsing()` in a service provider's `boot()`, conventionally a dedicated `app/Providers/FilamentServiceProvider.php` (registered in `bootstrap/providers.php`).

```php
public function boot(): void
{
    // Every Select across the app: non-native, searchable when it's a relationship.
    Select::configureUsing(function (Select $select): void {
        $select
            ->native(false)
            ->searchable(fn (Select $c) => $c->hasRelationship())
            ->preload(fn (Select $c) => $c->isSearchable());
    });

    // Every Table: striped, 25/page, persist UI state.
    Table::configureUsing(function (Table $table): void {
        $table
            ->striped()
            ->defaultPaginationPageOption(25)
            ->paginated([25, 50, 100])
            ->persistFiltersInSession()
            ->persistSortInSession();
    });
}
```

`configureUsing` runs for **every** instance created afterwards, so a value set here is never repeated at a call site. An agent unaware of it will duplicate it or be surprised by behavior absent from the schema/table/action file.

### Common global defaults to scan for

A **map of what to look for**, not a spec to copy:

- action presentation: `slideOver`, icons, `modalIcon`, `modalIconColor`, `createAnother(false)`
- fields: `Select` native/searchable/preload, `TextInput::trim()`, `Textarea` rows, date/time picker precision
- uploads: disk, visibility, directory, `moveFiles`, accepted types
- tables: pagination options, default page size, filters/sort persistence, striping
- schemas: date/time display formats, translated labels, Repeater/Builder delete confirmation

### Rules

- **MUST** read this provider before building or reviewing any Filament component — see the hub rule in `app/Filament/CLAUDE.md`. The schema/table/action file you're editing is only half the behavior; the rest lives here.
- **MUST** establish an app-wide default **once** here rather than copying it onto every component. One `Select::configureUsing(...)` beats 50 `->native(false)` calls.
- **PREFER** `bootUsing(...)` inside `configureUsing` for defaults that depend on the component's own state (e.g. "slide over unless it's a confirmation") — it runs after setup, so `isConfirmationRequired()` etc. are reliable.
- **MUST NOT** put per-record or per-user logic in `configureUsing` — it runs for every instance with no record context. Record-aware defaults belong at the call site (closures) or in the schema class.
- **AVOID** `configureUsing` for a one-off — if only one `Textarea` needs 8 rows, set it on that field, not globally.

## Where they live

```
app/Providers/Filament/
├── AdminPanelProvider.php       /admin
└── CustomerPanelProvider.php    /portal
```

## Naming

- **MUST** be `{PanelId}PanelProvider` (e.g. `AdminPanelProvider`, `BillingPanelProvider`).
- The `$panel->id(...)` value drives the URL and config keys — keep it kebab-case (`admin`, `customer-portal`).

## Class shape

```php
final class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->id('admin')
            ->path('admin')
            ->default()
            ->login()
            ->colors(['primary' => Color::Amber])
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\\Filament\\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\\Filament\\Pages')
            ->discoverWidgets(in: app_path('Filament/Widgets'), for: 'App\\Filament\\Widgets')
            ->discoverClusters(in: app_path('Filament/Clusters'), for: 'App\\Filament\\Clusters')
            ->pages([Dashboard::class])
            ->widgets([
                Widgets\AccountWidget::class,
                Widgets\FilamentInfoWidget::class,
            ])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                VerifyCsrfToken::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([Authenticate::class]);
    }
}
```

## Rules

- **MUST** register every panel in `bootstrap/providers.php` (L11+) — `$panel->default()` only chooses which panel handles the `/` redirect; it doesn't auto-register.
- **MUST** keep one PanelProvider per panel; don't multiplex panels in one provider.
- **MUST NOT** put business logic in the PanelProvider — it's wiring only.

## Discovery paths

`->discoverResources(in: ..., for: ...)` — every Resource under `in:` is registered. The `for:` namespace must match the directory's PSR-4 root.

For multi-panel apps, **MUST** scope discovery so panels don't share resources:

```php
// Admin panel
->discoverResources(in: app_path('Filament/Admin/Resources'), for: 'App\\Filament\\Admin\\Resources')

// Customer panel
->discoverResources(in: app_path('Filament/Customer/Resources'), for: 'App\\Filament\\Customer\\Resources')
```

## Authentication

- **`->login()`** — default email/password login page.
- **`->registration()`** — public sign-up.
- **`->passwordReset()`** — forgot-password flow.
- **`->emailVerification()`** — pin to `MustVerifyEmail`.
- **`->profile()`** — current-user profile page.

For custom authentication (SSO, two-factor, magic links), pass a class:

```php
->login(\App\Filament\Pages\Auth\Login::class)
```

## Authorization gate

The panel runs `FilamentUser::canAccessPanel(Panel $panel)` if the User model implements it. **MUST** implement this for production access. Without the contract, Filament allows authenticated access only in the `local` environment and denies it elsewhere.

```php
final class User extends Authenticatable implements FilamentUser
{
    public function canAccessPanel(Panel $panel): bool
    {
        return match ($panel->getId()) {
            'admin' => $this->is_admin,
            'customer-portal' => true,
            default => false,
        };
    }
}
```

## Tenancy

```php
->tenant(Team::class)
->tenantRegistration(RegisterTeam::class)
->tenantProfile(EditTeamProfile::class)
->tenantMiddleware([ApplyTenantScopes::class], isPersistent: true)
```

- Filament registers a tenant global scope for models with tenant-aware resources in the active panel, once the tenant is identified. **MUST** define the ownership relationship those resources use. Models without a tenant-aware resource in that panel need an additional middleware scope or explicit `whereBelongsTo(Filament::getTenant())` constraints.
- **MUST** supply tenant context and scope explicitly in jobs, outside the tenant panel, and before tenant identification. Removing global scopes can remove tenancy protection too.
- **MUST** authorize tenant access via `canAccessTenant(Model $tenant)` on the User model:

  ```php
  public function canAccessTenant(Model $tenant): bool
  {
      return $this->teams()->whereKey($tenant->getKey())->exists();
  }
  ```

### User model contracts

Implement all three on the User model for full tenancy support:

```php
final class User extends Authenticatable implements FilamentUser, HasTenants, HasDefaultTenant
{
    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class)->withPivot('role')->withTimestamps();
    }

    public function getTenants(Panel $panel): Collection
    {
        return $this->teams;
    }

    public function canAccessTenant(Model $tenant): bool
    {
        return $this->teams()->whereKey($tenant->getKey())->exists();
    }

    public function getDefaultTenant(Panel $panel): ?Model
    {
        return $this->latestTeam ?? $this->teams->first();
    }
}
```

- **MUST** implement `HasTenants` once the panel ships — without it the tenant picker shows nothing and admins get stuck.
- **SHOULD** implement `HasDefaultTenant` so returning users land on their last-used tenant instead of being forced to pick.

### Registration / profile pages

```bash
php artisan make:filament-page Tenancy/RegisterTeam --type=tenant-registration
php artisan make:filament-page Tenancy/EditTeamProfile --type=tenant-profile
```

- **MUST** attach the registering user to the new tenant inside `handleRegistration()` — Filament doesn't.

### Validation: tenant-scoped uniqueness

For a column unique *per tenant* (not globally), use the scoped variants:

```php
TextInput::make('slug')
    ->required()
    ->scopedUnique(ignoreRecord: true);   // unique within current tenant

Select::make('category_id')
    ->scopedExists(\App\Models\Category::class, 'id');
```

- **MUST** use `->scopedUnique()` / `->scopedExists()` (not plain `->unique()` / `->exists()`) for any tenant-scoped column — plain Laravel rules ignore the tenant context and either falsely reject or falsely accept.
- **MUST** ensure the queried model has a tenant global scope in this context, or supply a tenant constraint through `modifyQueryUsing`. Scoped validation applies existing Eloquent scopes; it does not invent tenant ownership. The example requires `Category` to be scoped through a tenant-aware resource or middleware.

### Relationship selects — verify the related model's scope

Relationship selects retain the related model's global scopes. A tenant-aware resource for that model in the active panel can therefore scope its options automatically. When no such scope applies, add a tenant constraint:

```php
Select::make('customer_id')
    ->relationship(
        name: 'customer',
        titleAttribute: 'name',
        modifyQueryUsing: fn (Builder $query) => $query->whereBelongsTo(Filament::getTenant()),
    )
    ->required();
```

- **MUST** verify both selectable options and submitted IDs stay within the tenant. Add `modifyQueryUsing` when automatic related-model scoping is absent; validate submitted IDs with a scoped query as well.

### Routing modes

```php
// Path-based: /admin/{tenant}/orders
->tenant(Team::class, slugAttribute: 'slug')

// Add for subdomain tenancy: {tenant}.example.com/admin/orders
->tenantDomain('{tenant:slug}.example.com')
```

- **MUST** add wildcard DNS and web-server config before shipping subdomain tenancy.
- **AVOID** mixing subdomain and path tenancy on different panels in the same app — session/cookie scope gets confusing.

### Notification center

Enable on the `PanelProvider`:

```php
->databaseNotifications()
->databaseNotificationsPolling('60s') // or null to disable polling
```

- **MUST NOT** poll the notification center faster than 30s in production — every poll runs a query per logged-in admin.
- **MUST** provide the database notifications table before enabling `->databaseNotifications()`. If its migration is absent, generate it with `php artisan make:notifications-table`, review it, and migrate.

## Theme + colors

```php
->colors([
    'primary' => Color::Amber,
    'gray'    => Color::Slate,
])
->font('Inter')
->brandName('Acme Admin')
->brandLogo(asset('images/logo.svg'))
->favicon(asset('favicon.ico'))
->darkMode()
->maxContentWidth('full')
```

Custom CSS — register a theme:

```bash
php artisan make:filament-theme admin
```

```php
->viteTheme('resources/css/filament/admin/theme.css')
```

> Custom themes require the Tailwind version supported by the installed Filament release. Default themes work without a custom build.

## Plugins

```php
->plugins([
    FilamentSpatieRolesPermissionsPlugin::make(),
    FilamentShieldPlugin::make(),
])
```

## Middleware

- **MUST** include the standard middleware stack shown above. Removing `AuthenticateSession` or `VerifyCsrfToken` breaks the panel in subtle ways.
- **SHOULD** add custom middleware via `->middleware([...], isPersistent: true)` rather than wedging it into the default group.
- **MUST** register any middleware that establishes **auth / permission / tenant context** (e.g. setting the active team for `spatie/laravel-permission`, resolving the current tenant) as **persistent** — `->middleware([...], isPersistent: true)`, `->tenantMiddleware([...], isPersistent: true)`, or `->persistentMiddleware([...])`. Panel `middleware()` / `authMiddleware()` run **only on full-page loads**; Livewire's `/livewire/update` routes bypass them. A non-persistent context middleware therefore leaves the context unset on every action click, so policies resolve empty and Filament **silently** drops the now-unauthorized action. Symptom: a button renders on page load then vanishes when clicked, with nothing logged.

## Login screen layout

Filament uses a centered split layout by default. Override via the PanelProvider:

```php
->login(\App\Filament\Pages\Auth\Login::class)
->renderHook(PanelsRenderHook::AUTH_LOGIN_FORM_AFTER, fn () => view('auth.sso-buttons'))
```

## Render hooks

Insert custom Blade at well-defined slots:

```php
->renderHook(
    PanelsRenderHook::USER_MENU_BEFORE,
    fn () => view('admin.impersonation-banner'),
);
```

Useful slots: `BODY_START`, `BODY_END`, `HEAD_END`, `TOPBAR_END`, `SIDEBAR_NAV_START`, `SIDEBAR_NAV_END`, `USER_MENU_BEFORE`, `USER_MENU_AFTER`, `AUTH_LOGIN_FORM_AFTER`.

## Panel-level safety + UX options

```php
->spa()                            // single-page-app navigation; preserves Livewire state across links
->unsavedChangesAlerts()           // browser prompt when leaving a dirty form
->databaseTransactions()           // wrap every action callback in a DB transaction automatically
```

- **MUST** call `->databaseTransactions()` on any panel with multi-step actions (Approve-then-Notify, Import, etc.). Without it, a failure mid-action leaves the DB half-written.
- **SHOULD** enable `->unsavedChangesAlerts()` on admin panels — it prevents the most common "I lost my work" support ticket.
- **AVOID** `->spa()` on panels that embed external iframes or render large file uploads — SPA mode keeps the old page in memory and can leak DOM nodes.

### SPA mode reaches past the panel

`->spa()` adds `wire:navigate` to **every** Filament-rendered URL on the app's host, not only panel routes. That includes action and notification `->url()`s, auth-page links, and a notification URL that falls back to `url('/')`. A soft navigation keeps the panel's Livewire, Alpine and `document` listeners alive. Landing on a page that ships its own Alpine bundle (a marketing site, a standalone tool) swaps in a second `window.Alpine` without the persist plugin. Its `start()` then fires Filament's `alpine:init` store setup: `window.Alpine.$persist is not a function`, and the sidebar store is gone when the user returns to the panel.

- **MUST** list same-origin URLs outside the panel's Livewire stack in `->spaUrlExceptions()`: public site pages, OAuth redirects, streamed downloads. Patterns are matched with `Str::is()` against the full URL. `*` is the only wildcard, and there is no negation.

```php
->spa()
->spaUrlExceptions([
    url('/'),
    url('/request-invite'),
    url('/blog*'),
    url('/oauth/*'),
    url('/documents/*/download'),
])
```

- **SHOULD** also guard a standalone page's Alpine entry point, because an exception list never covers every URL. Livewire is only present after a soft navigation from a Livewire page, so reload into a clean document instead of booting:

```js
import Alpine from 'alpinejs'

const arrivedFromLivewirePage = Boolean(window.Livewire)

if (! arrivedFromLivewirePage) {
    window.Alpine = Alpine
    // Alpine.data(...) registrations
}

if (arrivedFromLivewirePage) {
    window.location.reload()
} else {
    Alpine.start()
}
```

The guard is only safe on pages that do not load Livewire themselves; otherwise it reloads forever.

## Production deploy

```bash
php artisan optimize
php artisan filament:optimize
```

- **MUST** run `filament:optimize` in the production deploy pipeline — it caches component discovery and shaves hundreds of ms off the first page-load query.
- **MUST NOT** run `filament:optimize` in local dev — newly added resources/widgets won't be discovered until the cache is cleared.
- Pair with `php artisan filament:clear-cached-components` in a `post-update-cmd` Composer hook so devs aren't stuck after pulling new resources.

## Response contracts are bound globally, not per panel

Filament's auth responses (`Filament\Auth\Http\Responses\Contracts\*Response`, such as `LoginResponse` or `EmailChangeVerificationResponse`) are container bindings shared by every panel. A binding that redirects into a page only one panel registers 500s on every other panel, often after the change has already been saved.

- **MUST** branch on the current panel inside one response class (`filament()->getCurrentPanel()?->getId()`) and fall back to Filament's default, rather than binding a panel-specific class globally.
- **MUST** check whether a package installed for one panel binds a `*Response` contract globally before adding it to a multi-panel app.
