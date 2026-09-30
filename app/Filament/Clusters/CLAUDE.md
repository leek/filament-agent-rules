# Clusters

**Purpose:** group multiple related Resources (and optionally Pages) under one sidebar item with its own sub-navigation. Use when a panel has 10+ resources and the sidebar starts to crowd.

> **Filament's domain axis.** A cluster adds business-domain grouping (`Commerce/`, `Billing/`) to the per-model resource layout. **PREFER** organizing its children under `Clusters/{Domain}/Resources/...`. **MUST** reuse the same domain name the rest of the app uses; the file move itself is optional.

## Where they live

```
app/Filament/Clusters/
└── Commerce/
    ├── CommerceCluster.php           cluster definition
    ├── Resources/
    │   ├── Orders/
    │   │   ├── OrderResource.php
    │   │   ├── Pages/
    │   │   ├── Schemas/
    │   │   └── Tables/
    │   ├── Products/
    │   │   └── ProductResource.php
    │   └── Customers/
    │       └── CustomerResource.php
    └── Pages/
        └── SalesReport.php
```

## Naming

- **MUST** name the generated class `{Domain}Cluster` (`CommerceCluster`, `BillingCluster`) under `Clusters/{Domain}/`. Reuse the application's domain noun for the enclosing directory.

## Create

```bash
php artisan make:filament-cluster Commerce
```

The current generator creates `app/Filament/Clusters/Commerce/CommerceCluster.php` (plus a view when requested). Child resource/page directories are added as those classes are generated.

## Class shape

```php
final class CommerceCluster extends Cluster
{
    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-shopping-bag';

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
    protected static ?string $cluster = CommerceCluster::class;
    // ...
}
```

- **PREFER** organizing related resources under `app/Filament/Clusters/Commerce/Resources/`. The move is organizational; `$cluster` controls membership and the URL prefix regardless of the file's location.
- **MUST** configure `->discoverClusters(...)`, which also discovers child Resources/Pages in that directory. Children kept elsewhere need resource/page discovery or explicit registration. After moving files, update namespaces and discovery paths; see `app/Providers/Filament/CLAUDE.md`.
- The cluster URL becomes a prefix: `/admin/commerce/orders` instead of `/admin/orders`.

## Adding pages to the cluster

```php
final class SalesReport extends Page
{
    protected static ?string $cluster = CommerceCluster::class;
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

This controls whether the cluster registers its main navigation item. It does not authorize direct access to child pages/resources or replace their policies. **MUST** enforce section permissions in each child's authorization as well. **PREFER** retaining the default check that at least one child is accessible when overriding navigation visibility.

## When NOT to use a cluster

- **PREFER** `$navigationGroup` (a string label on each Resource) when you just want sidebar grouping without a URL prefix or its own landing page. Clusters add a `/cluster-slug/` URL segment to every child route — that's a breaking change for any saved deep-link.
