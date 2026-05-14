# Filament Agent Rules

Cross-cutting conventions for the Filament admin layer. Per-class-type rules live in the matching directory's `CLAUDE.md` — read both when editing a file.

Targets **Filament v4 + v5**. v5 introduced no public-API breaks over v4 (Livewire 4 compat bump). Rules call out the few deltas inline with "v5+:" markers.

All rules below are **MUST** unless tagged **SHOULD** / **PREFER** / **AVOID**.

## Where things live

| Class type            | Directory                                          | Naming                              |
| --------------------- | -------------------------------------------------- | ----------------------------------- |
| Resource              | `app/Filament/Resources/`                          | `{Model}Resource`                   |
| Resource Pages        | `app/Filament/Resources/{Model}Resource/Pages/`    | `List{Models}`, `Create{Model}`, `Edit{Model}`, `View{Model}` |
| Relation Managers     | `app/Filament/Resources/{Model}Resource/RelationManagers/` | `{Relation}RelationManager` |
| Schemas (Form/Infolist) | `app/Filament/Resources/{Model}Resource/Schemas/` | `{Model}Form`, `{Model}Infolist`    |
| Table definitions     | `app/Filament/Resources/{Model}Resource/Tables/`   | `{Models}Table`                     |
| Cluster               | `app/Filament/Clusters/`                           | `{Name}` (no suffix)                |
| Custom Page           | `app/Filament/Pages/`                              | `{Name}` (no suffix)                |
| Widget                | `app/Filament/Widgets/`                            | `{Name}Widget` / `{Name}Chart` / `{Name}Overview` |
| PanelProvider         | `app/Providers/Filament/`                          | `{PanelId}PanelProvider`            |

## Discovery

Filament auto-discovers Resources/Pages/Widgets configured on the panel via `->discoverResources(...)`, `->discoverPages(...)`, `->discoverWidgets(...)` in the `PanelProvider`.

- **MUST** keep classes inside the configured discovery paths — orphan classes silently fail to register.
- **MUST NOT** rely on auto-discovery for classes inside `Clusters/` — register the cluster on the resource via `protected static ?string $cluster = MyCluster::class;`.

## Filament Actions vs app/Actions

These are different concepts. Don't conflate them:

- **`app/Actions/{Verb}{Noun}Action.php`** — business-logic Actions (from `laravel-agent-rules`). Pure PHP class with one `run()` method.
- **`Filament\Actions\Action`** — UI Action that renders a button/modal in a Resource/Page/Widget. Configured via fluent builder.

A Filament Action should **delegate** to a business Action for any non-trivial work:

```php
Action::make('approve')
    ->action(fn (Order $record) => app(ApproveOrderAction::class)->run($record));
```

## Configuration over inheritance

Filament leans heavily on fluent builders inside static methods (`form(Schema $schema)`, `table(Table $table)`, `infolist(Schema $schema)`). Override the builder method on the Resource/Page/Widget — don't subclass framework classes.

## Authorization

- **MUST** rely on Laravel Policies for record-level authorization. Filament auto-resolves `{Model}Policy` for `viewAny`, `view`, `create`, `update`, `delete`, `restore`, `forceDelete`.
- **MUST NOT** inline `auth()->user()->isAdmin()` checks inside Resource methods — funnel through the policy.
- For panel-level access, implement `FilamentUser::canAccessPanel(Panel $panel)` on the `User` model.

## v5+ notes

- Filament v5 requires **Tailwind v4** for custom themes. Default theme works unchanged.
- v5 uses **Livewire v4** internally. Component patterns from v4 still work, but Livewire 4 attributes (`#[Locked]`, `#[Computed]`, etc.) are now available inside Filament pages/widgets.
