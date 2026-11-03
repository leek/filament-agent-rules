# Panel Theme CSS

**Purpose:** compile and register a custom Filament panel theme through Vite.

## Create and register

```bash
php artisan make:filament-theme admin
```

The generator creates `resources/css/filament/admin/theme.css` and attempts to configure Vite and the panel provider. **MUST** verify both registrations:

- The theme CSS path is in the Laravel Vite plugin's `input` array in `vite.config.js`.
- The matching PanelProvider calls `->viteTheme('resources/css/filament/admin/theme.css')`.

See `app/Providers/Filament/CLAUDE.md` for panel registration.

## Entry point and sources

**MUST** keep the generated Filament theme import. Add `@source` directives for every directory that contains classes used by the panel; paths are relative to the stylesheet:

```css
@import '../../../../vendor/filament/filament/resources/css/theme.css';

@source '../../../../app/Filament/**/*';
@source '../../../../resources/views/filament/**/*';
```

- **MUST** include any additional Livewire, Blade component, or domain directory used by the panel in the source scan.
- **PREFER** built-in component configuration before CSS overrides. Use documented CSS hooks for changes that need CSS.
- **PREFER** shared theme variables for repeated design values; define a token before referring to it across components.
- **MUST** import any split CSS files from the theme entry point. Mirroring a vendor directory does not load or override its CSS automatically.

## Build

```bash
npm run build
```

**MUST** compile the theme after CSS changes using the project's configured build command, or use its Vite development server while developing. `php artisan filament:assets` publishes registered package assets; it does not compile the Vite theme and is not a required step after a theme CSS edit.

## Keep table wrappers stacking-neutral

Filament renders a table's column-manager and filter modals **inside** `.fi-ta-header-ctn`. **MUST NOT** give `.fi-ta`, `.fi-ta-ctn` or `.fi-ta-header-ctn` a stacking context (`position` + `z-index`, `isolation`, `transform`, `filter`): it traps those modals under the sidebar and topbar and shrinks their backdrop to the table card. To contain z-index ladders inside the table body (sticky headers, pinned cells), put `isolation: isolate` on `.fi-ta-content-ctn`, which holds no modals. Check plugin CSS for the same properties on those wrappers.
