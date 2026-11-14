# Custom Panel Pages

**Purpose:** standalone pages inside a panel that aren't tied to a single Resource — dashboards, settings, wizards, reports, import/export workflows.

> Resource-bound pages live under `app/Filament/Resources/{Models}/Pages/`; their rules are in `app/Filament/Resources/Pages/CLAUDE.md`.

## Where they live

```
app/Filament/Pages/
├── Dashboard.php
├── Settings.php
└── ImportProducts.php
```

## Naming

- **MUST** name after the action or subject, **no suffix** (`Settings`, `Dashboard`, `ImportProducts`, `SalesReport`).

## Create

```bash
php artisan make:filament-page Settings
php artisan make:filament-page ImportProducts
```

## Class shape

```php
use Filament\Forms\Components\{TextInput, Toggle};
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Schema;

final class Settings extends Page
{
    protected static string|\BackedEnum|null $navigationIcon = \Filament\Support\Icons\Heroicon::OutlinedCog6Tooth;

    protected static string|\UnitEnum|null $navigationGroup = 'Admin';

    protected string $view = 'filament.pages.settings';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill(SettingsStore::all());
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('site_name')->required(),
                Toggle::make('maintenance_mode'),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $this->authorize('update-settings');
        SettingsStore::update($this->form->getState());
        Notification::make()->success()->title('Saved')->send();
    }
}
```

## Rules

- **MUST** override `canAccess()` for any page that isn't tied to a model — Filament has no policy to consult.

  ```php
  public static function canAccess(): bool
  {
      return auth()->user()?->can('manage-settings') ?? false;
  }
  ```

- **MUST** delegate non-trivial logic to an `app/Actions/` class. The page is the Livewire boundary; the Action is the logic.
- **MUST** declare `$navigationIcon` and `$navigationGroup` when the page appears in the sidebar — naked entries look broken.
- **SHOULD** skip navigation with `protected static bool $shouldRegisterNavigation = false;` for pages reached only via a button (e.g. import wizards).

## Form inside a page

Pages host forms as a `Schema` on the page — same `form(Schema $schema): Schema` shape as Resources:

```php
use App\Actions\ImportProductsAction;
use App\Models\Product;
use Filament\Forms\Components\{FileUpload, Toggle};
use Filament\Pages\Page;
use Filament\Schemas\Schema;

final class ImportProducts extends Page
{
    protected string $view = 'filament.pages.import-products';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill();
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                FileUpload::make('file')
                    ->required()
                    ->acceptedFileTypes(['text/csv', 'text/plain'])
                    ->maxSize(10240)
                    ->disk('local')
                    ->visibility('private'),
                Toggle::make('dry_run')->default(true),
            ])
            ->statePath('data');
    }

    public function submit(): void
    {
        $this->authorize('import', Product::class);
        $data = $this->form->getState();
        app(ImportProductsAction::class)->handle($data['file'], dryRun: $data['dry_run']);
    }
}
```

- **MUST** authorize mutation methods (`save`, `submit`, custom actions) even when `canAccess()` already gates the page — page access and “may run this import” are often different abilities.

## View

`protected string $view = 'filament.pages.settings';` — the Blade view lives at `resources/views/filament/pages/settings.blade.php`. **MUST** use Filament's page wrapper:

```blade
<x-filament-panels::page>
    <form wire:submit="save">
        {{ $this->form }}
        <x-filament::button type="submit">Save</x-filament::button>
    </form>
</x-filament-panels::page>
```

- **MUST** keep the page Blade thin — render `{{ $this->form }}`, a schema, or `<x-filament-widgets::widgets />`, not bespoke markup. Build the page body from a Schema of built-in **components + prime components** (`Text`/`Icon`/`Image`/`UnorderedList`) rather than hand-written HTML. See the hub's "Prefer built-in components over custom Blade" ladder.
- **SHOULD** reserve custom Blade in the page body for non-Filament layouts; even then, wrap content in `<x-filament::section>` so it stays themed.
- **PREFER**, for a custom *interactive* piece, embedding it as its own Livewire component — `@livewire(MyWidget::class, [...])` in the page Blade, or `Livewire::make(MyWidget::class)` inside a page schema — over hand-coding the whole page's interactivity. As on resource pages, build only the custom piece: see `app/Filament/Resources/Pages/CLAUDE.md` → "Custom page content" and the hub → "Prefer embedding a Livewire component over a custom page".
- **MUST** give a Livewire component embedded inside the page's `<form>` a `<div>` root, not a `<form>`. The HTML parser drops a nested form tag, and the component's `wire:id` goes with it.
- **MUST** add `x-on:keydown.enter.prevent` to a plain text or search input rendered inside the page's `<form>` (a custom Blade field, a picker's filter box). Without it, Enter in that input submits the whole form.

## Header / footer actions

```php
protected function getHeaderActions(): array
{
    return [
        Action::make('reload')
            ->action(fn () => $this->mount()),
        Action::make('purgeCache')
            ->authorize('purge-cache')
            ->requiresConfirmation()
            ->action(fn () => app(PurgeCacheAction::class)->handle()),
    ];
}
```

- **MUST** call `->authorize(...)` on every header action that changes or exposes data. A standalone page has no policy and gives its actions no default check, so `canAccess()` is the only gate unless the action carries its own. See `app/Filament/Actions/CLAUDE.md` → "Authorization".
- Filament re-runs `canAccess()` on every Livewire request. A record-level check you add in `mount()` runs once: repeat it in `hydrate()`. See `app/Filament/Resources/Pages/CLAUDE.md` → "Authorize every request, not only `mount()`".

## Tenancy

If the panel uses tenancy, its URL establishes tenant context; it does not scope every model queried by a custom page. **MUST** verify the model's tenant scope inside data fetches and use `Filament::getTenant()` for explicit constraints. See `app/Providers/Filament/CLAUDE.md` → "Tenancy".

## Polling / live updates

**PREFER** polling the individual stats/chart widgets that need fresh data; see `app/Filament/Widgets/CLAUDE.md`. A Page has no built-in `$pollingInterval` setting. For page content that must refresh, add Livewire polling to the relevant Blade wrapper:

```blade
<div wire:poll.30s>
    {{ $this->form }}
</div>
```

- **MUST NOT** poll faster than 10s on production dashboards; each poll re-runs the page's full data fetch.

## Tabbed dashboard pattern

For dashboard-style pages that swap widget sets without leaving the URL, use an application-defined `getDashboardTabs()` array and a Livewire-bound `$activeTab`. This is a custom Page pattern, not the Resource List page's built-in `getTabs()` API:

```php
final class Analytics extends Page
{
    protected string $view = 'filament.admin.pages.analytics';

    public string $activeTab = 'overview';

    /**
     * @return array<int, array{
     *   key: string,
     *   title: string,
     *   icon?: string|\BackedEnum,
     *   widgets?: array<int, class-string<Widget>>,
     * }>
     */
    public function getDashboardTabs(): array
    {
        return [
            [
                'key'     => 'overview',
                'title'   => 'Overview',
                'icon'    => \Filament\Support\Icons\Heroicon::OutlinedHome,
                'widgets' => [OrdersOverview::class, RevenueChart::class],
            ],
            [
                'key'     => 'revenue',
                'title'   => 'Revenue',
                'icon'    => \Filament\Support\Icons\Heroicon::OutlinedCurrencyDollar,
                'widgets' => [RevenueBreakdown::class, TopProducts::class],
            ],
        ];
    }

    public function getActiveTabData(): array
    {
        $tabs = $this->getDashboardTabs();

        return collect($tabs)->firstWhere('key', $this->activeTab) ?? $tabs[0];
    }
}
```

Render the tab controls and widgets in `resources/views/filament/admin/pages/analytics.blade.php`:

```blade
<x-filament-panels::page>
    @php($active = $this->getActiveTabData())

    <x-filament::tabs>
        @foreach ($this->getDashboardTabs() as $tab)
            <x-filament::tabs.item
                :active="$active['key'] === $tab['key']"
                :icon="$tab['icon'] ?? null"
                wire:click="$set('activeTab', '{{ $tab['key'] }}')"
            >
                {{ $tab['title'] }}
            </x-filament::tabs.item>
        @endforeach
    </x-filament::tabs>

    <x-filament-widgets::widgets :widgets="$active['widgets'] ?? []" />
</x-filament-panels::page>
```

- **MUST** return at least one tab from `getDashboardTabs()`.
- **MUST** fall back to the first tab when `$activeTab` doesn't match any key — otherwise a stale tab key from a session/URL leaves the page blank.
- **MUST** reference widgets as `::class` strings inside `getDashboardTabs()`.
- **SHOULD** keep tab keys in snake_case and treat them as part of the URL surface — they leak into Livewire query strings.
- **PREFER** this pattern over multiple sibling `Page` classes when the only difference between "views" is which widgets render — one class, one route, swap widget arrays.

## A HasTable page that never renders its table needs the modals container

The page layout renders `<x-filament-actions::modals />` only when the page is **not** a `HasTable`; table pages rely on the table view to render it. A page that implements `HasTable` / `InteractsWithTable` but draws a custom view without `{{ $this->table }}` has no modal container: header and page actions mount server-side (the request returns 200, nothing is logged) and no modal ever appears. **MUST** add `<x-filament-actions::modals />` inside such a page's view; it is guarded by `hasActionsModalRendered`, so it is safe.
