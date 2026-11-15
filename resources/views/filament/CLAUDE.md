---
description: Blade views for Filament (custom fields, entries, columns, widget and page views) and the ladder to walk before writing one
paths:
  - resources/views/filament/**/*.blade.php
---

# Filament Blade views

**Purpose:** hand-written Blade inside a Filament panel: `->view(...)`, `ViewField` / `ViewEntry` / `ViewColumn` templates, widget and custom page views, embedded Livewire component views.

## Checklist

- **MUST** walk the ladder below and exhaust built-in, prime and composed components before writing Blade.
- **MUST** wrap bespoke markup in Filament's wrappers (`<x-filament::section>`, `<x-filament-widgets::widget>`, `<x-filament-panels::page>`).
- **MUST** put click handlers on a real `<button type="button">`, `<x-filament::button>` or `<a href>`.
- **MUST NOT** put Blade directives (`@js`) inside a component tag's attribute.
- **MUST NOT** print user content with `{!! !!}` unsanitized; see `app/Filament/CLAUDE.md` → "Security".

## Prefer built-in components over custom Blade

Custom Blade skips Filament theming, dark mode, spacing, and state handling. Before writing `->view(...)`, a `ViewField`/`ViewEntry`, a custom-view schema component, or a Blade-backed `Widget`, walk this ladder:

1. **A built-in field / column / entry** — `TextInput`, `Select`, `TextColumn`, `TextEntry`, `IconColumn`, `ImageEntry`, … for record data.
2. **A prime component** — `Text`, `Icon`, `Image`, `UnorderedList` (`Filament\Schemas\Components\*`) for *arbitrary* content (headings, notes, computed text, logos, bullet lists) in any schema. See `app/Filament/Resources/Schemas/CLAUDE.md` → "Prime components".
3. **A `Callout`** — for an info / warning / error block (Schemas → "Callout").
4. **A composition of the above** inside `Section` / `Grid` / `Fieldset` / `Flex` — most "custom" layouts are just built-ins on a grid.
5. **A custom component class** that returns a configured built-in (the `make()` pattern) — for reusable heavy config.
6. **Custom Blade** (`->view(...)`, `ViewField`, `ViewEntry`, `ViewColumn`, a `Widget` view) — only when the markup is bespoke (a third-party embed, a hand-built chart, a non-Filament layout). For table cells, `ViewColumn` and full custom column classes are the sanctioned hatch — see `app/Filament/Resources/Tables/CLAUDE.md` → "Custom columns".

- **MUST** exhaust rungs 1–5 before dropping to Blade.
- **MUST**, at rung 6, wrap the markup in Filament's wrappers (`<x-filament::section>`, `<x-filament-widgets::widget>`, `<x-filament-panels::page>`) so theming and dark mode still apply.
- **PREFER** extracting a reusable custom **component class** (rung 5) over copying a Blade partial — it composes with a schema like any other component.

## When you do write Blade

- **MUST** put `wire:click` / `x-on:click` / `@click` on a `<button type="button">` (or `<x-filament::button>`, or an `<a href>` for navigation). A `<div>`, `<span>` or `<tr>` takes no keyboard focus, so the control is mouse-only. If the element cannot be a button, it needs all three of `role="button"`, `tabindex="0"` and a key handler (`x-on:keydown.enter` + `x-on:keydown.space.prevent`).
- **MUST NOT** read `$loop` in a partial that opens its own `@foreach` to mean the including loop: inside the inner loop `$loop->index` is the inner index. Capture the outer value first and pass it in.

  ```blade
  @foreach ($steps as $step)
      @include('filament.partials.step-menu', ['position' => $loop->index])
  @endforeach
  ```

- **MUST** give every `x-sortable-item` an `x-sortable-handle`, on the item itself or on an element inside it. Filament's `x-sortable` directive starts a drag only from `[x-sortable-handle]`, so a list without one cannot be reordered. When the row holds buttons, links or inputs, put the handle on a dedicated grip rather than the row, or every click on a control starts a drag.
- **MUST NOT** put `@js(...)` or any other Blade directive inside a component tag's attribute (`<x-filament::button wire:click="tick(@js($key))">`). Blade does not compile directives there: the browser receives the literal `@js($key)` and the click throws `Livewire Expression Error`. Write `wire:click="tick({{ Js::from($key) }})"` (`Illuminate\Support\Js`); `@js` works only on a plain HTML element. A test that calls the method directly still passes, so assert the rendered attribute or click the control in a browser.
- **MUST** give a hand-built scrolling table's `overflow-x-auto` wrapper `relative`. Screen-reader-only text (`sr-only`) is absolutely positioned, so inside a non-positioned scroll box it escapes the box and the whole page scrolls sideways on a phone.
- **MUST** make a link or button repeated per row or per cell say which row it acts on in its accessible name ("Open March 2026 for Dana Lee", by `aria-label` or `sr-only` text), and mark the grid up as a real `<table>` with `<th scope>` row and column headers. Twenty links all named "Open" cannot be told apart by a screen reader.
- A hand-built upload control must honour the form contract in `app/Filament/Resources/Schemas/CLAUDE.md` → "Custom upload fields".
