# Clusters

**Purpose:** group multiple related Resources (and optionally Pages) under one sidebar item with its own sub-navigation. Use when a panel has 10+ resources and the sidebar starts to crowd.

> **Filament's domain axis.** A cluster is the Filament equivalent of the **domain sub-namespacing** in `laravel-agent-rules` (`app/CLAUDE.md`): on top of the per-model resource layout it adds a business-domain grouping (`Commerce/`, `Billing/`), and the child resources physically move into `Clusters/{Domain}/Resources/...`. **MUST** reuse the **same domain name** the rest of the app already uses — `Billing/` in Models/Jobs/Policies → a `Billing` cluster here.

## Where they live

```
app/Filament/Clusters/
├── Commerce.php                      cluster definition
├── Commerce/
│   ├── Resources/
│   │   ├── Orders/
│   │   │   ├── OrderResource.php
│   │   │   ├── Pages/
│   │   │   ├── Schemas/
│   │   │   └── Tables/
│   │   ├── Products/
│   │   │   └── ProductResource.php
│   │   └── Customers/
│   │       └── CustomerResource.php
│   └── Pages/
│       └── SalesReport.php
```

## Naming

- **MUST** name after the domain noun, **no suffix** (`Commerce`, `Settings`, `Reports`, `Billing`).

## Create

```bash
php artisan make:filament-cluster Commerce
```

This creates `app/Filament/Clusters/Commerce.php` and the empty `Commerce/Resources/` + `Commerce/Pages/` subdirectories.

## Class shape

```php
final class Commerce extends Cluster
{
    protected static ?string $navigationIcon = 'heroicon-o-shopping-bag';

    protected static ?string $navigationLabel = 'Commerce';

    protected static ?int $navigationSort = 10;

    protected static ?string $clusterBreadcrumb = 'Commerce';
}
```

## Adding resources to the cluster

On each child Resource, declare cluster membership:

```php
final class OrderResource extends Resource
{
    protected static ?string $cluster = Commerce::class;
    // ...
}
```

- **MUST** also physically move the Resource file into `app/Filament/Clusters/Commerce/Resources/` so panel discovery picks it up automatically. Without the move, discovery still finds the class but the URL prefix won't match.
- The cluster URL becomes a prefix: `/admin/commerce/orders` instead of `/admin/orders`.

## Adding pages to the cluster

```php
final class SalesReport extends Page
{
    protected static ?string $cluster = Commerce::class;
    // ...
}
```

## Rules

- **MUST** only cluster resources that are genuinely related — don't cluster for the sake of it.
- **MUST** keep cluster files thin; navigation labels and icons only. Heavy logic belongs in the constituent Resources/Pages.
- **AVOID** nested clusters — Filament doesn't support them and trying to fake it with prefixes will break breadcrumbs.

## Authorization

```php
public static function canAccessClusteredComponents(): bool
{
    return auth()->user()?->can('access-commerce') ?? false;
}
```

When this returns `false`, none of the cluster's resources/pages appear in navigation, regardless of their own per-resource checks. Useful for role-gated sections.

## When NOT to use a cluster

- **PREFER** `$navigationGroup` (a string label on each Resource) when you just want sidebar grouping without a URL prefix or its own landing page. Clusters add a `/cluster-slug/` URL segment to every child route — that's a breaking change for any saved deep-link.
