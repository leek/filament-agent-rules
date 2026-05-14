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

## v5+ notes

- v5 uses **Livewire v4** internally. Existing Filament classes work unchanged; Livewire 4 attributes (`#[Locked]`, `#[Computed]`, `#[On]`, etc.) become available inside pages/widgets.
- v5 custom themes **require Tailwind v4**. Upgrade your `tailwind.config.js` before bumping to v5.
- v5 ships an upgrade script (`php artisan filament:upgrade`) — run it before manually editing anything.
