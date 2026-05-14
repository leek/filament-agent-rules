# Frontend Build

**Always run `npm run build` after editing any CSS or JS file.** No exceptions.

# CSS Theme

- `theme.css` = entry point — see `vite.config.js`
- Located in `resources/css/filament/*`, each folder = different theme
- Themes named by panel (e.g. `app` theme for app panel)

## Global Style Rule

When making global style changes, reach for theme CSS variables (defined in `theme.css` `@theme` block) instead of hardcoded values. Maintains cohesive design system. Add new token to `@theme` first, then reference via `var(--token)` or Tailwind utility.

## Override Mapping

CSS files match vendor component paths:

- `resources/css/filament/app/forms/components/field.css` overrides `vendor/filament/forms/resources/css/components/field.css`
- `resources/css/filament/app/support/components/section.css` overrides `vendor/filament/support/resources/css/components/section.css`

Directories (`forms/`, `support/`, `tables/`) mirror respective vendor directories.
