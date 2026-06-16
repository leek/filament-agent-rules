---
description: Dashboard widgets (stats, charts, table widgets, custom Blade widgets)
globs:
  - app/Filament/**/Widgets/*.php
alwaysApply: false
---

# Widgets

**Purpose:** dashboard cards — stats, charts, recent-records tables. Appear on the panel Dashboard and (optionally) on Resource list pages.

## Where they live

```
app/Filament/Widgets/
├── OrdersOverview.php       extends StatsOverviewWidget
├── RevenueChart.php         extends ChartWidget
└── LatestOrders.php         extends TableWidget
```

## Naming

- **Stats widget** — `{Subject}Overview` or `{Subject}Stats`: `OrdersOverview`, `RevenueStats`.
- **Chart widget** — `{Subject}Chart`: `RevenueChart`, `SignupsChart`.
- **Table widget** — `Latest{Models}` / `{Adjective}{Models}`: `LatestOrders`, `PendingApprovals`.
- **Custom widget** — `{Subject}Widget`: `WeatherWidget`.

## Create

```bash
php artisan make:filament-widget OrdersOverview --stats-overview
php artisan make:filament-widget RevenueChart   --chart
php artisan make:filament-widget LatestOrders   --table
php artisan make:filament-widget WeatherWidget  --resource=null
```

## Stats overview

```php
final class OrdersOverview extends StatsOverviewWidget
{
    protected ?string $heading = 'Orders';

    protected function getStats(): array
    {
        return [
            Stat::make('Pending', Order::query()->where('status', 'pending')->count())
                ->description('Awaiting approval')
                ->descriptionIcon('heroicon-m-clock')
                ->color('warning'),

            Stat::make('Today', Order::query()->whereDate('created_at', today())->count())
                ->chart([4, 7, 3, 9, 5, 8, 12])
                ->color('success'),
        ];
    }
}
```

- **MUST** cache stat queries that hit large tables. Stats run on **every** dashboard load.
- **SHOULD** use `Cache::remember('orders:pending:count', 60, fn () => ...)` for counts on tables >100k rows.

## Chart widget

```php
final class RevenueChart extends ChartWidget
{
    protected ?string $heading = 'Revenue (last 30 days)';

    protected function getData(): array
    {
        $data = Trend::model(Order::class)
            ->between(start: now()->subDays(30), end: now())
            ->perDay()
            ->sum('total_cents');

        return [
            'datasets' => [['label' => 'Revenue', 'data' => $data->map(fn ($v) => $v->aggregate / 100)]],
            'labels'   => $data->map(fn ($v) => $v->date),
        ];
    }

    protected function getType(): string
    {
        return 'line';
    }
}
```

- **MUST** use `flowframe/laravel-trend` (or equivalent) for time-series aggregations — never loop dates in PHP.
- **SHOULD** add `protected static ?string $pollingInterval = '60s';` only on charts that need live data. Otherwise `null` to disable polling.

### Filterable chart widget

For charts that need a user-driven time window, declare `$filter` + `getFilters()` and branch in `getData()`:

```php
final class RevenueChart extends ChartWidget
{
    public ?string $filter = 'week';

    protected function getFilters(): ?array
    {
        return [
            'today' => 'Today',
            'week'  => 'Last 7 days',
            'month' => 'This month',
            'year'  => 'This year',
        ];
    }

    protected function getData(): array
    {
        return app(BuildRevenueChartData::class)->run($this->filter);
    }

    protected function getType(): string
    {
        return 'line';
    }
}
```

- **MUST** delegate data assembly to an `app/Actions/` class — keep the widget a thin filter→data adapter.
- **SHOULD** ship sensible defaults: `'week'` is the right default for most dashboards; `'today'` is misleading on slow-traffic days.

## Custom widget (Blade view)

A Blade-backed widget is the **last** resort — see the hub's "Prefer built-in components over custom Blade" ladder. First confirm a stats / chart / table widget can't do it, and that the content isn't just `Text`/`Icon`/`Image`/`UnorderedList` primes or a `Callout` rendered through a schema. Only when the markup is genuinely bespoke, drop to a plain `Widget` with a Blade view:

```php
final class TasksWidget extends Widget
{
    protected static string $view = 'filament.widgets.tasks-widget';

    protected int|string|array $columnSpan = 1;

    public function getViewData(): array
    {
        return [
            'tasks' => Task::query()
                ->where('user_id', auth()->id())
                ->whereNull('completed_at')
                ->orderBy('due_date')
                ->limit(5)
                ->get(),
        ];
    }
}
```

```blade
{{-- resources/views/filament/widgets/tasks-widget.blade.php --}}
<x-filament-widgets::widget>
    <x-filament::section>
        <x-slot name="heading">My Tasks</x-slot>

        @forelse ($tasks as $task)
            <div class="py-2">{{ $task->title }}</div>
        @empty
            <p class="text-sm text-gray-500">Nothing pending.</p>
        @endforelse
    </x-filament::section>
</x-filament-widgets::widget>
```

- **MUST** wrap custom markup in `<x-filament-widgets::widget>` so background, border, and dark-mode styling stay consistent with stock widgets.
- **MUST** return data from `getViewData()` rather than computing in the view — keeps the widget testable via `livewire(TasksWidget::class)->assertSuccessful()`.

## Table widget

```php
final class LatestOrders extends TableWidget
{
    protected int|string|array $columnSpan = 'full';

    public function table(Table $table): Table
    {
        return $table
            ->query(Order::query()->latest()->limit(10))
            ->columns([
                TextColumn::make('reference'),
                TextColumn::make('customer.name'),
                TextColumn::make('total_cents')->money(),
                TextColumn::make('created_at')->since(),
            ])
            ->paginated(false);
    }
}
```

- **MUST** eager-load relations referenced by columns — same N+1 risk as full-page tables.
- **SHOULD** call `->paginated(false)` on widget tables; the row count is fixed via `->limit()`.

## Registration

Auto-discovered by the PanelProvider's `->discoverWidgets(...)`. To attach a widget to a **Resource's** List page instead of (or in addition to) the dashboard:

```php
public static function getWidgets(): array
{
    return [
        OrdersOverview::class,
    ];
}

// On the List page:
protected function getHeaderWidgets(): array
{
    return $this->getResource()::getWidgets();
}
```

## Layout

| Property                            | Effect                                                            |
| ----------------------------------- | ----------------------------------------------------------------- |
| `protected int $columnSpan = 1;`    | Grid columns to occupy (1–12 or `'full'`)                         |
| `protected int $sort = 1;`          | Display order                                                     |
| `protected static bool $isLazy = true;` | Defer load until visible — **MUST** use for any widget that runs an expensive query |

## Polling

```php
protected static ?string $pollingInterval = '30s';   // or null to disable
```

- **MUST NOT** poll faster than 10s in production. Each poll re-runs the widget's data fetch across all logged-in admin sessions.

## Authorization

```php
public static function canView(): bool
{
    return auth()->user()?->can('viewAny', Order::class) ?? false;
}
```

## Rules

- **MUST** delegate non-trivial calculation to an `app/Actions/` class — widgets are presentational.
- **MUST** cache or pre-compute any aggregate that scans >10k rows.
- **SHOULD** use `$isLazy = true` for any widget that hits the DB; the dashboard renders the skeleton immediately and loads each widget independently.
- **AVOID** raw SQL in widgets — wrap a query object or trend helper instead.

## Additional notes

- Deferred filters on chart widgets keep slow aggregate filters from auto-firing until the user clicks Apply.
