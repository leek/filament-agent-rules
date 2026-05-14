# PanelProvider

**Purpose:** boot a Filament panel — discovery paths, theme, middleware, plugins, tenancy, auth, navigation.

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

```php
final class RegisterTeam extends RegisterTenant
{
    public static function getLabel(): string { return 'Register team'; }

    public function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('name')->required()->maxLength(255),
            TextInput::make('slug')->required()->unique('teams', 'slug')->maxLength(255),
        ]);
    }

    protected function handleRegistration(array $data): Team
    {
        $team = Team::create($data);
        $team->members()->attach(auth()->user(), ['role' => 'owner']);
        return $team;
    }
}
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

// Subdomain: {tenant}.example.com/admin/orders
->tenant(Team::class, slugAttribute: 'slug')
->tenantDomain('{tenant:slug}.example.com')
```

- **MUST** add a wildcard subdomain DNS record + Apache/Nginx config before shipping subdomain tenancy.
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

> v5+ requires **Tailwind v4** for custom themes. Default theme works on either.

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

## Login screen layout

Filament v4+ uses a centered split layout by default. Override via the PanelProvider:

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

## Panel-level safety + UX options (v5)

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

## v5+ notes

- v5 uses **Livewire v4** internally. Existing Filament classes work unchanged; Livewire 4 attributes (`#[Locked]`, `#[Computed]`, `#[On]`, etc.) become available inside pages/widgets.
- v5 custom themes **require Tailwind v4**. Upgrade your `tailwind.config.js` before bumping to v5.
- v5 ships an upgrade script (`vendor/bin/filament-v5`) — run it before manually editing anything.
- v5 **renames** common APIs. See `app/Filament/CLAUDE.md` for the consolidated import map; key deltas:
  - All action classes import from `Filament\Actions\*` (not `Filament\Tables\Actions\*` or `Filament\Forms\Actions\*`).
  - Layout components (`Section`, `Grid`, `Tabs`, `Wizard`) live under `Filament\Schemas\Components\*`.
  - `BadgeColumn` is removed — use `TextColumn::make(...)->badge()`.
  - Action modal forms use `->schema([...])`, not `->form([...])`.
  - Tables use `->recordActions(...)` / `->toolbarActions(...)` instead of `->actions(...)` / `->bulkActions(...)`.
  - Icons accept the `Heroicon` enum (`Filament\Support\Icons\Heroicon::PencilSquare`) or the legacy string form (`'heroicon-o-pencil-square'`).
  - The `Operation` enum (`Filament\Support\Enums\Operation::Create`) replaces string comparisons like `$operation === 'create'`.
