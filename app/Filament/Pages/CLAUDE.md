# Custom Panel Pages

**Purpose:** standalone pages inside a panel that aren't tied to a single Resource — dashboards, settings, wizards, reports, import/export workflows.

> Resource-bound pages live under `app/Filament/Resources/{Model}Resource/Pages/`. See that directory's CLAUDE.md.

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
