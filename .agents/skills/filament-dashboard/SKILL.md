---
name: filament-dashboard
description: Use this skill whenever creating, editing, reviewing, or debugging a Filament dashboard or custom panel page that composes widgets, schemas, tabs, callouts, embedded Livewire components, navigation, or page-specific actions.
---

# Filament Dashboard And Page Workflow

Use this skill for dashboards and custom panel pages. Prefer composing existing
Filament widgets, schema components, and embedded Livewire components before
building bespoke Blade-heavy pages.

## Read First

Resolve paths from the current project root:

1. `app/Filament/CLAUDE.md`
2. `app/Filament/Pages/CLAUDE.md`
3. `app/Filament/Widgets/CLAUDE.md`
4. `app/Providers/Filament/CLAUDE.md`
5. `app/Filament/Actions/CLAUDE.md` when the page has actions
6. `tests/Feature/Filament/CLAUDE.md` when tests are expected

Inspect existing panel pages, dashboard widgets, navigation groups, panel
discovery paths, and global defaults.

## Build Flow

1. Decide whether the request is really a dashboard page. If the standard panel
   dashboard plus widgets is enough, register widgets instead of creating a
   page.
2. If a custom page is needed, keep standard Filament page behavior and compose
   custom content through schema components, widgets, or embedded Livewire.
3. Use tabs, sections, grids, callouts, and prime components for layout and
   explanatory content.
4. Keep expensive metrics in widgets or query objects with clear caching,
   polling, and lazy-loading behavior.
5. Use page header actions for page-level commands and delegate domain work.
6. Register navigation metadata consistently with nearby pages and clusters.
7. Add render tests and targeted assertions for critical widgets/actions.

## Avoid

- Reimplementing a resource page as a custom page when only one area is custom.
- Large Blade views that bypass Filament theming and authorization.
- Dashboard queries that run expensive aggregates on every request without
  caching, filters, or lazy loading.

## Deep Pattern: Tabbed Dashboard Pages

When a dashboard swaps widget sets without leaving the route, drive the tabs
from a single array and keep widget references as class strings so Livewire can
serialize state between requests.

```php
final class Analytics extends Page
{
    protected static string $view = 'filament.admin.pages.analytics';

    public string $activeTab = 'overview';

    public function getTabs(): array
    {
        return [
            [
                'key' => 'overview',
                'title' => 'Overview',
                'icon' => 'heroicon-o-home',
                'widgets' => [OrdersOverview::class, RevenueChart::class],
            ],
            [
                'key' => 'revenue',
                'title' => 'Revenue',
                'icon' => 'heroicon-o-currency-dollar',
                'widgets' => [RevenueBreakdown::class, TopProducts::class],
            ],
        ];
    }

    public function getActiveTabData(): ?array
    {
        return collect($this->getTabs())->firstWhere('key', $this->activeTab);
    }
}
```

Render inside the Filament page wrapper and fall back to the first tab when the
active key is stale:

```blade
<x-filament-panels::page>
    @php
        $tabs = $this->getTabs();
        $active = $this->getActiveTabData() ?? $tabs[0];
    @endphp

    <nav class="-mb-px flex gap-x-8 border-b border-gray-200 dark:border-gray-700">
        @foreach ($tabs as $tab)
            <button
                type="button"
                wire:click="$set('activeTab', '{{ $tab['key'] }}')"
                @class([
                    'flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium',
                    'border-primary-500 text-primary-600' => $activeTab === $tab['key'],
                    'border-transparent text-gray-500 hover:text-gray-700' => $activeTab !== $tab['key'],
                ])
            >
                @isset($tab['icon'])
                    <x-filament::icon :icon="$tab['icon']" class="h-5 w-5" />
                @endisset

                {{ $tab['title'] }}
            </button>
        @endforeach
    </nav>

    @if (! empty($active['widgets']))
        <x-filament-widgets::widgets :widgets="$active['widgets']" class="mt-6" />
    @endif
</x-filament-panels::page>
```

Prefer this over multiple sibling pages when the only difference is which
widgets render.
