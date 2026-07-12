---
description: Filament providers — PanelProvider bootstrapping (discovery, theme, middleware, plugins, tenancy, auth) and app-wide component defaults via configureUsing in the FilamentServiceProvider
paths:
  - app/Providers/Filament/*.php
  - app/Providers/FilamentServiceProvider.php
---

# Filament Providers — Panels & Global Configuration

**Purpose:** two distinct providers, both covered here.
- **`{PanelId}PanelProvider`** (`app/Providers/Filament/`) — boots a panel: discovery paths, theme, middleware, plugins, tenancy, auth, navigation.
- **`FilamentServiceProvider`** (`app/Providers/FilamentServiceProvider.php`) — registers **app-wide component defaults** via `configureUsing()`.

## Global defaults via `configureUsing`

Filament components ship with stock defaults. A project overrides them **once, globally** — not per call site — by calling `Component::configureUsing()` in a service provider's `boot()`, conventionally a dedicated `app/Providers/FilamentServiceProvider.php` (registered in `bootstrap/providers.php`).

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

`configureUsing` runs for **every** instance created afterwards. Set a value here and you never repeat it at a call site — and an agent that doesn't know it's set will either duplicate it or be surprised by behavior that isn't in the schema/table/action file.

### Common global defaults to scan for

Treat these as a **map of what to look for**, not a spec to copy:

- action presentation: `slideOver`, icons, `modalIcon`, `modalIconColor`, `createAnother(false)`
- fields: `Select` native/searchable/preload, `TextInput::trim()`, `Textarea` rows, date/time picker precision
- uploads: disk, visibility, directory, `moveFiles`, accepted types
- tables: pagination options, default page size, filters/sort persistence, striping
- schemas: date/time display formats, translated labels, Repeater/Builder delete confirmation

### Rules

- **MUST** read this provider before building or reviewing any Filament component — see the hub rule in `app/Filament/CLAUDE.md`. The schema/table/action file you're editing is only half the behavior; the other half lives here.
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
- **MUST** keep one PanelProvider per panel. Don't try to multiplex panels in one provider.
- **MUST NOT** put business logic in the PanelProvider. It's wiring only.

## Discovery paths

`->discoverResources(in: ..., for: ...)` — every Resource under `in:` is registered. The `for:` namespace must match the directory's PSR-4 root.

For multi-panel apps, **MUST** scope discovery so panels don't accidentally share resources:

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

The panel runs `FilamentUser::canAccessPanel(Panel $panel)` if the User model implements it. **MUST** implement this on production deployments — otherwise any authenticated user can access the panel.

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

- **MUST** scope tenant-aware models via a global scope or `whereBelongsTo(Filament::getTenant())` — Filament doesn't auto-scope queries unless the model declares the tenant relationship.
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

- **MUST** attach the registering user to the new tenant inside `handleRegistration()` — Filament won't do this for you.

### Validation: tenant-scoped uniqueness

When the same column needs to be unique *per tenant* (not globally), use the scoped variants:

```php
TextInput::make('slug')
    ->required()
    ->scopedUnique(ignoreRecord: true);   // unique within current tenant

Select::make('category_id')
    ->scopedExists('id', 'categories');    // must exist *within current tenant*
```

- **MUST** use `->scopedUnique()` / `->scopedExists()` (not plain `->unique()` / `->exists()`) for any tenant-scoped column — plain Laravel rules ignore the tenant context and either falsely reject or falsely accept.

### Form selects are NOT auto-scoped

`->tenant(Team::class)` scopes resource queries but does **not** filter the options of relationship selects. Scope them manually:

```php
Select::make('customer_id')
    ->relationship(
        name: 'customer',
        titleAttribute: 'name',
        modifyQueryUsing: fn (Builder $query) => $query->whereBelongsTo(Filament::getTenant()),
    )
    ->required();
```

- **MUST** add `modifyQueryUsing` to every relationship select on a tenant-scoped resource — without it, admins can pick records from other tenants and silently break isolation.

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

```php
->databaseNotifications()
->databaseNotificationsPolling('60s')
```

Run `php artisan notifications:table && php artisan migrate` before enabling — see `app/Filament/CLAUDE.md`.

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
- **MUST** register any middleware that establishes **auth / permission / tenant context** (e.g. setting the active team for `spatie/laravel-permission`, resolving the current tenant) as **persistent** — `->middleware([...], isPersistent: true)`, `->tenantMiddleware([...], isPersistent: true)`, or `->persistentMiddleware([...])`. Panel `middleware()` / `authMiddleware()` run **only on full-page loads**; Livewire's `/livewire/update` routes bypass them. A non-persistent context middleware therefore leaves the context unset on every action click, so policies resolve empty and Filament **silently** drops the now-unauthorized action — the classic symptom is a button that renders on page load then vanishes the instant it's clicked, with nothing logged.

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

- **MUST** call `->databaseTransactions()` on any panel with multi-step actions (Approve-then-Notify, Import, etc.). Without it, a failure halfway through an action leaves the DB in a half-written state.
- **SHOULD** enable `->unsavedChangesAlerts()` on admin panels — it prevents the most common "I lost my work" support ticket.
- **AVOID** `->spa()` on panels that embed external iframes or render large file uploads — SPA mode keeps the old page in memory and can leak DOM nodes.

## Production deploy

```bash
php artisan optimize
php artisan filament:optimize
```

- **MUST** run `filament:optimize` in the production deploy pipeline — it caches component discovery and shaves hundreds of ms off the first page-load query.
- **MUST NOT** run `filament:optimize` in local dev — newly added resources/widgets won't be discovered until the cache is cleared.
- Pair with `php artisan filament:clear-cached-components` in a `post-update-cmd` Composer hook so devs don't get stuck after pulling new resources.
