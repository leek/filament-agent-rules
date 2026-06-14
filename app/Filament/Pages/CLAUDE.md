# Custom Panel Pages

**Purpose:** standalone pages inside a panel that aren't tied to a single Resource — dashboards, settings, wizards, reports, import/export workflows.

> Resource-bound pages live under `app/Filament/Resources/{Models}/Pages/`. See that directory's CLAUDE.md.

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
php artisan make:filament-page ImportProducts --resource=ProductResource --type=custom
```

## Class shape

```php
final class Settings extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-cog-6-tooth';

    protected static ?string $navigationGroup = 'Admin';

    protected static string $view = 'filament.pages.settings';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill(SettingsStore::all());
    }

    protected function getFormSchema(): array
    {
        return [
            TextInput::make('site_name')->required(),
            Toggle::make('maintenance_mode'),
        ];
    }

    protected function getFormStatePath(): string
    {
        return 'data';
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
- **SHOULD** skip navigation entirely with `protected static bool $shouldRegisterNavigation = false;` for pages reached only via a button (e.g. import wizards).

## Form inside a page

Filament pages can host one or more forms via the `HasForms` trait. Pattern:

```php
final class ImportProducts extends Page implements HasForms
{
    use InteractsWithForms;

    public ?array $data = [];

    public function mount(): void { $this->form->fill(); }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                FileUpload::make('file')->required()->acceptedFileTypes(['text/csv']),
                Toggle::make('dry_run')->default(true),
            ])
            ->statePath('data');
    }

    public function submit(): void
    {
        $data = $this->form->getState();
        app(ImportProductsAction::class)->run($data['file'], dryRun: $data['dry_run']);
    }
}
```

## View

`protected static string $view = 'filament.pages.settings';` — the Blade view lives at `resources/views/filament/pages/settings.blade.php`. **MUST** use Filament's page wrapper:

```blade
<x-filament-panels::page>
    <form wire:submit="save">
        {{ $this->form }}
        <x-filament::button type="submit">Save</x-filament::button>
    </form>
</x-filament-panels::page>
```

- **MUST** keep the page Blade thin — render `{{ $this->form }}`, a schema, or `<x-filament-widgets::widgets />`, not bespoke markup. Build the page body from a Schema of built-in **components + prime components** (`Text`/`Icon`/`Image`/`UnorderedList`) rather than hand-written HTML. See the hub's "Prefer built-in components over custom Blade" ladder.
- **SHOULD** reserve custom Blade in the page body for genuinely non-Filament layouts; even then, wrap content in `<x-filament::section>` so it stays themed.

## Header / footer actions

```php
protected function getHeaderActions(): array
{
    return [
        Action::make('reload')
            ->action(fn () => $this->mount()),
    ];
}
```

## Tenancy

If the panel uses tenancy, the page is automatically scoped to the current tenant via the URL. **MUST** verify `Filament::getTenant()` inside any data fetch — never read `auth()->user()->team` directly when a tenant context exists.

## Polling / live updates

For dashboards that need fresh numbers:

```php
protected ?string $pollingInterval = '30s';
```

- **MUST NOT** poll faster than 10s on production dashboards; each poll re-runs the page's full data fetch.

## Tabbed dashboard pattern

For dashboard-style pages that swap widget sets without leaving the URL, drive everything from a single `getTabs()` array and a Livewire-bound `$activeTab`:

```php
final class Analytics extends Page
{
    protected static string $view = 'filament.admin.pages.analytics';

    public string $activeTab = 'overview';

    /**
     * @return array<int, array{
     *   key: string,
     *   title: string,
     *   icon?: string,
     *   widgets?: array<int, class-string<Widget>>,
     * }>
     */
    public function getTabs(): array
    {
        return [
            [
                'key'     => 'overview',
                'title'   => 'Overview',
                'icon'    => 'heroicon-o-home',
                'widgets' => [OrdersOverview::class, RevenueChart::class],
            ],
            [
                'key'     => 'revenue',
                'title'   => 'Revenue',
                'icon'    => 'heroicon-o-currency-dollar',
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

Blade:

```blade
<x-filament-panels::page>
    @php
        $tabs   = $this->getTabs();
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

- **MUST** fall back to the first tab in the Blade when `$activeTab` doesn't match any key — otherwise a stale tab key from a session/URL leaves the page blank.
- **MUST** reference widgets as `::class` strings inside `getTabs()` so Livewire can serialise the array between requests.
- **SHOULD** keep tab keys in snake_case and treat them as part of the URL surface — they leak into Livewire query strings.
- **PREFER** this pattern over multiple sibling `Page` classes when the only difference between "views" is which widgets render — one class, one route, swap widget arrays.
