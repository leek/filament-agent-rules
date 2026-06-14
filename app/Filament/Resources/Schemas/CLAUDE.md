---
description: Reusable Form and Infolist schema classes (declarative component trees, state callbacks)
globs:
  - app/Filament/**/Schemas/*.php
alwaysApply: false
---

# Schemas (Forms + Infolists)

**Purpose:** declarative component trees for editing (Form) and viewing (Infolist) records. Both share the same `Schema` base class in Filament v4+.

## Where they live

Per-resource, under `app/Filament/Resources/{Models}/Schemas/`:

```
app/Filament/Resources/Orders/
├── OrderResource.php
└── Schemas/
    ├── OrderForm.php
    └── OrderInfolist.php
```

## Naming

- **Form** — `{Model}Form` (singular): `OrderForm`, `UserForm`
- **Infolist** — `{Model}Infolist`: `OrderInfolist`

## Shape

```php
final class OrderForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Customer')
                ->schema([
                    Select::make('customer_id')
                        ->relationship('customer', 'name')
                        ->searchable()
                        ->preload()
                        ->required(),
                ])
                ->columns(2),

            Section::make('Items')
                ->schema([
                    Repeater::make('items')
                        ->relationship()
                        ->schema([
                            TextInput::make('name')->required(),
                            TextInput::make('quantity')->numeric()->required(),
                        ])
                        ->reorderable(),
                ]),
        ]);
    }
}
```

Resource wires it:

```php
public static function form(Schema $schema): Schema
{
    return OrderForm::configure($schema);
}
```

- **MUST** make `configure()` `static` and return the `$schema`.
- **MUST NOT** extend a parent class or interface on `*Form` / `*Infolist` classes — Filament deliberately leaves them open so `configure()` can accept extra context args (`configure(Schema $schema, ?Customer $forCustomer = null)`) for reuse across panels / pages. Compose, don't inherit.

## Rules

- **MUST** extract schemas to their own classes once a resource has >2 sections or >10 fields. Inline schemas inside the Resource bloat the file fast.
- **MUST** mark every required column from the model as `->required()` on the form — Filament does not infer this from the migration.
- **MUST** mirror `$casts` in form/infolist component choice: enum cast → `Select::make(...)->options(Status::class)`, datetime cast → `DateTimePicker::make(...)`, JSON cast → `KeyValue::make(...)` or `Repeater::make(...)`.
- **MUST** use `->dehydrated(false)` on display-only fields that must NOT be saved.
- **SHOULD** group related fields into `Section::make('...')` blocks and lay them out on a grid — see "Layout" below. A flat list of full-width fields is a failed layout.

## Layout — size to content, group into rows

Filament stacks components vertically by default — one full-width field per row. That is almost never the best layout. Treat layout as first-class: size each field to its content and group related fields onto shared rows.

### The 12-column grid

Give a `Section` (or `Grid`) `->columns(12)` and size each child with `->columnSpan(n)`. Twelve divides cleanly into halves (6), thirds (4), quarters (3), sixths (2) — enough granularity to size anything.

```php
Section::make('Patient')
    ->columns(12)
    ->schema([
        TextInput::make('given_name')->columnSpan(6),
        TextInput::make('family_name')->columnSpan(6),

        // A 5-char field has no business being full width.
        TextInput::make('postal_code')->label('ZIP')->columnSpan(2),
        TextInput::make('city')->columnSpan(6),
        Select::make('state')->columnSpan(4),

        // Three name parts share one row.
        TextInput::make('first_name')->columnSpan(4),
        TextInput::make('middle_name')->columnSpan(4),
        TextInput::make('last_name')->columnSpan(4),
    ]),
```

- **MUST** size every field to its content, not to the full row. A ZIP (5 chars), quantity, state, or unit selector belongs in a narrow span (2–4); a free-text name or email in ~6; only genuinely long values (descriptions, URLs) go full width.
- **MUST** group fields read or entered together onto one row — first/middle/last name, city/state/ZIP, value/unit pairs. Stacking them wastes vertical space and breaks the visual relationship.
- **PREFER** a 12-column grid (`->columns(12)`) with explicit `->columnSpan(n)` over smaller column counts — consistent math, resizes without re-thinking.
- **MUST** use `->columnSpanFull()` for a genuinely full-width field, **not** `->columnSpan(12)` or `->columnSpan('full')`. `columnSpanFull()` is full width on *every* breakpoint; `columnSpan(12)`/`('full')` only fill the row at `lg`+ and behave differently below it.

A pair that lives *outside* a 12-column section can carry its own `Grid::make(2)` — the relationship reads at a glance and the two validate together:

```php
Grid::make(2)->schema([
    DateTimePicker::make('starts_at')->seconds(false)->required(),
    DateTimePicker::make('ends_at')->seconds(false)->required()->after('starts_at'),
]);
```

### Responsiveness is automatic at `lg` — but only there

Integer `->columns(n)` and `->columnSpan(n)` apply at the `lg` breakpoint and up; **below `lg` everything collapses to a single column** automatically. So a plain `->columns(12)` form already stacks cleanly on phones with no extra work.

For control between mobile and desktop, pass a responsive array:

```php
Grid::make(['default' => 1, 'md' => 2, 'xl' => 12])
    ->schema([
        TextInput::make('email')->columnSpan(['xl' => 6]),
        TextInput::make('phone')->columnSpan(['xl' => 3]),
        TextInput::make('ext')->label('Ext.')->columnSpan(['xl' => 3]),
    ]);
```

### Sections, and side-by-side sections

A form should read as a few labeled groups, not one long list. Put fields directly in a `Section` with its own `->columns(12)`; reach for an outer `Grid::make(12)` only when you want **sections side by side**:

```php
$schema->components([
    Grid::make(12)->schema([
        Section::make('Account')->columnSpan(8)->columns(12)->schema([...]),
        Section::make('Meta')->columnSpan(4)->schema([...]),   // narrow sidebar
    ]),
]);
```

- **MUST** group by **domain meaning, not data type or creation order** — each `Section` is one concept the admin reasons about as a unit ("Identity", "Specifications", "Billing"), not a bucket of same-typed inputs. `name` next to `engine_hp` next to `color` forces a context-switch on every field.
- **SHOULD** make a form "look its best": labeled `Section`s per logical group, fields sized to content, related fields paired on rows. A wall of stacked full-width inputs is a failed layout even if every field works.
- **PREFER** (house polish) `->compact()` sections with an `->icon(...)->iconColor('primary')` header — tighter and more scannable than the default. Match whatever the project's existing sections already do.
- **SHOULD** keep a `Section`'s own `->columns()` at 12 to match the page grid, so a `columnSpan(6)` means the same thing everywhere.

#### Balance side-by-side section heights

When sections share a row, a tall one (a `RichEditor`, 6+ fields) next to a short one (2–3 fields) leaves a lopsided gap. Stack the short sections in a nested `Grid` opposite the tall one so both columns end near the same height (count a `RichEditor`/`Textarea` as ~3–4 short fields):

```php
Grid::make(12)->schema([
    Section::make('Overview')->columnSpan(8)->schema([
        TextInput::make('name')->required(),
        RichEditor::make('description')->columnSpanFull(),
    ]),

    // Short sections stacked to fill the same height as the tall one.
    Grid::make(1)->columnSpan(4)->schema([
        Section::make('Status')->schema([Select::make('status')->options(Status::class)]),
        Section::make('Schedule')->schema([
            DatePicker::make('starts_at'),
            DatePicker::make('ends_at'),
        ]),
    ]),
]);
```

- **SHOULD** balance adjacent section heights — equal *visual* height matters more than equal field counts.
- If the project ships a `match-height` utility class (some do), `->extraAttributes(['class' => 'match-height'])` on the wrapping `Grid` equalizes column heights without restructuring — but that's project CSS, so confirm it exists first (don't assume defaults).

## Common components

| Component       | Use for                                                  |
| --------------- | -------------------------------------------------------- |
| `TextInput`     | strings, numbers, emails, URLs                           |
| `Textarea`      | medium-length free text                                  |
| `RichEditor`    | HTML content (TipTap-backed in v4+)                      |
| `MarkdownEditor`| markdown content                                         |
| `Select`        | one-of-N; supports `->relationship()`, `->searchable()`, `->preload()` |
| `CheckboxList` / `Toggle` / `Checkbox` | booleans / multi-select          |
| `Radio`         | small enums (≤5 options)                                 |
| `DatePicker` / `DateTimePicker` / `TimePicker` | temporal fields           |
| `FileUpload`    | uploads to a disk                                        |
| `Repeater`      | array of sub-records (often via `->relationship()`)      |
| `Builder`       | heterogeneous blocks (CMS-like content)                  |
| `KeyValue`      | flat string→string map                                   |
| `TagsInput`     | array of strings                                         |
| `ColorPicker`   | hex color                                                |
| `Hidden`        | non-editable but submitted                               |
| `Placeholder`   | non-editable, non-submitted display                      |

## Field affordances — make every field self-explanatory

A field that *works* isn't a field that's *done*. Communicate the expected format, units, constraints, and meaning so admins don't guess — every guess is an inconsistent row or a support ticket.

### Right component for the data

Beyond mirroring `$casts` (see Rules), pick the component that makes invalid input *impossible*, not just one that stores the value:

- **MUST NOT** use a `TextInput` for a value from a finite set — a year, country, currency, status, or any enum. A free-text "year" accepts `20025`; a `Select` can't.
  ```php
  Select::make('year')
      ->options(array_combine(range(now()->year + 1, 1990), range(now()->year + 1, 1990)))
      ->searchable();
  Select::make('country_id')->relationship('country', 'name')->searchable();
  ```
- **MUST** use `DatePicker` / `DateTimePicker` (not `TextInput`) for temporal values, and `Toggle` / `Checkbox` for booleans.
- **MUST** use `Textarea` (not `TextInput`) for multi-line content — descriptions, bios, notes, reasons, excerpts. A single-line input for a paragraph hides what the admin typed.
- **MUST** add `->columnSpanFull()` to every `Textarea` and `RichEditor` — squeezed into a half-width grid column they're unusable (see "Layout").

### Guidance text — only where it earns its place

- **SHOULD** add `->helperText('e.g. ACCA, ACA, CIMA')` to fields whose label doesn't pin down the expected values (`qualifications`, `specialties`, vague `type`/`code` fields).
- **MUST** add `->helperText(...)` to a `->nullable()` field whose empty state carries meaning — "Leave empty if no deposit required" vs an admin who simply forgot. Null and zero are not the same; say which you mean.
- **PREFER** `->placeholder('+1 555 123 4567')` only when a concrete example removes format ambiguity. A placeholder *supports* a label; it never replaces the label or helper text.

### Units and length

- **MUST** mark numeric units with `->prefix('$')` / `->suffix('/hr')` / `->suffix('kg')` — `Rate: 50` is ambiguous; `$50 /hr` isn't. Use both prefix and suffix for a rate.
- **SHOULD** set `->maxLength(n)` on short-string fields (postcode, code, plate, PIN) — it caps input, surfaces a live character counter, and prevents silent DB truncation. Pair with a `->placeholder` showing the format.

### Field-level validation — stop bad data at entry

Validation *rules* (not just messages — see "Custom validation messages") prevent invalid input before submit:

- **MUST** constrain dates that have a valid direction: `->minDate(now())` for expiries/bookings, `->maxDate(now())` for birth dates / historical records. Add `->seconds(false)` on `DateTimePicker` unless seconds matter.
- **MUST** validate cross-field ranges on paired fields — `->after('starts_at')` on an end date, min/max relationships. A start and end that are each individually valid can still form a backwards range.
  ```php
  DateTimePicker::make('ends_at')->after('starts_at')->seconds(false);
  ```
- **SHOULD** add `->url()` to `*_url` / `website` / `link` fields (plus `->suffixIcon(Heroicon::OutlinedLink)` or `->prefix('https://')`) — otherwise "not a url" sails through and breaks the frontend.

### FileUpload — always constrain

- **MUST** set `->acceptedFileTypes([...])` and `->maxSize(kb)` on every `FileUpload` — unconstrained uploads are a performance and security hole.
- **MUST** treat disk visibility explicitly: Filament uploads are **private** by default. Use `->visibility('public')` only when the file is genuinely public, and scope the disk (`->disk('s3')`).
- **SHOULD** queue expensive image processing / conversions rather than doing them in the request path.
  ```php
  FileUpload::make('attachment')
      ->acceptedFileTypes(['application/pdf', 'image/jpeg', 'image/png'])
      ->maxSize(5120)
      ->disk('s3');
  ```

### Consistency for codes and toggles

- **SHOULD** enforce casing on codes that are uppercase by convention (VIN, currency code, plate): `->dehydrateStateUsing(fn ($s) => strtoupper($s))` for storage, plus `->extraInputAttributes(['style' => 'text-transform:uppercase'])` for live feedback.
- **PREFER** explicit `->onColor('success')` / `->offColor('danger')` on a `Toggle` **only** in toggle-dense forms where state must be scanned fast — semantic colors on every lone boolean overstate the meaning.
- **PREFER** `->autofocus()` on the first field of high-frequency *create* flows only; skip it in modals, on mobile, and on edit forms, where it yanks the viewport.

## Relationship-aware components

- **`Select::make('user_id')->relationship('user', 'name')`** — auto-loads options from related model, persists FK.
- **`Select::make(...)->createOptionForm([...])`** — quick-create related record from inside the select.
- **`Repeater::make('items')->relationship()`** — HasMany editor; saves on parent save.
- **`CheckboxList::make('tags')->relationship('tags', 'name')`** — BelongsToMany pivot.

**MUST** pass the search column to `->searchable()` when the displayed column differs from the search target:

```php
Select::make('customer_id')
    ->relationship('customer', 'name')
    ->searchable(['name', 'email']);
```

**MUST** call `->preload()` only on small relations (<200 rows). For larger sets, leave the async search behavior.

## Per-component extraction — `Schemas/Components/`

For a single heavily-configured field, extract into its own class with a static `make()` returning one component. Lives under `Schemas/Components/` per resource.

```php
// app/Filament/Resources/Customers/Schemas/Components/CustomerNameInput.php
final class CustomerNameInput
{
    public static function make(): TextInput
    {
        return TextInput::make('name')
            ->label('Full name')
            ->required()
            ->maxLength(255)
            ->rules(['regex:/^[\pL\s\-\.]+$/u'])
            ->validationMessages(['regex' => 'Letters, spaces, hyphens, and periods only.']);
    }
}

// app/Filament/Resources/Customers/Schemas/Components/CustomerCountrySelect.php
final class CustomerCountrySelect
{
    public static function make(): Select
    {
        return Select::make('country_id')
            ->relationship('country', 'name')
            ->searchable(['name', 'iso_code'])
            ->preload()
            ->required();
    }
}
```

Used in the form:

```php
$schema->components([
    CustomerNameInput::make(),
    CustomerCountrySelect::make(),
]);
```

- **MUST** return one component from `make()` (`TextInput`, `Select`, etc.). For a cluster of fields, use the fragment pattern below — different shape, different purpose.
- **MUST NOT** extend `TextInput` / `Select` / etc. Wrap, don't subclass — Filament component classes use static factories.
- **PREFER** a dedicated component class (one that returns a configured Filament component) over a generic `Support/` or `Helpers/` class for building UI — keep Filament construction in Filament-shaped classes, where the next reader expects it. This is Filament's own documented "component classes" pattern.
- **SHOULD** extract when a field has >5 chained modifiers, custom rules, conditional visibility, or appears in ≥2 schemas.
- **PREFER** parameterising over duplicating: `CustomerNameInput::make(label: 'Billing contact')` for one-off labels.

### Component vs fragment — pick by return type, named by method

| Pattern              | Method → returns        | Use when                                                  |
| -------------------- | ----------------------- | --------------------------------------------------------- |
| Component (`Components/`) | `make(): TextInput`/`Select`/… — one component | single field, heavy config, reused or scannability win |
| Fragment (below)     | `get(): array` — cluster of components | logical cluster (contact info, address, audit metadata) |

**MUST** name by return type: `make()` returns **one** Filament component (mirrors Filament's own `Component::make()`); `get()` returns an **array** of components. Never use `make()` for an array — `ContactFields::make()` reads like it returns one component but actually spreads a cluster. That ambiguity is the footgun this split removes.

## Reusable schema fragments

Share field clusters across multiple resources without inheritance — return an array from a static `get()` and spread it:

```php
final class ContactFields
{
    public static function get(): array
    {
        return [
            TextInput::make('email')->email()->required(),
            TextInput::make('phone')->tel(),
            TextInput::make('website')->url()->prefix('https://'),
        ];
    }
}

// Resource:
$schema->components([
    Section::make('Contact')->schema([...ContactFields::get()]),
]);
```

- **MUST** name the array-returning method `get()`, not `make()` — reserve `make()` for classes that return a single component (see the table above).
- **MUST** keep fragments stateless — no `$this`, no constructor args that vary by record. If the fragment needs record context, accept it as a parameter (`get(?Model $record = null)`).
- **PREFER** this over a base class that defines `getSharedFields()` — composition reads better than inheritance for schemas.

## State callbacks

| Callback                   | Runs when                                                      |
| -------------------------- | -------------------------------------------------------------- |
| `->afterStateHydrated(fn)` | After form is filled from the model (Edit page)                |
| `->afterStateUpdated(fn)`  | After the field's state changes (requires `->live()`)          |
| `->formatStateUsing(fn)`   | Before display — transform DB value into form value            |
| `->dehydrateStateUsing(fn)`| Before save — transform form value into DB value               |
| `->dehydrated(false)`      | Skip persistence entirely (display-only fields)                |

Slug-from-title pattern:

```php
TextInput::make('title')
    ->required()
    ->live(onBlur: true)
    ->afterStateUpdated(fn (string $state, Set $set) => $set('slug', Str::slug($state)))
    ->partiallyRenderComponentsAfterStateUpdated(['slug']);   // re-render ONLY slug, not the whole form

TextInput::make('slug')
    ->required()
    ->unique(ignoreRecord: true);
```

Computed total (display-only):

```php
TextInput::make('subtotal_cents')
    ->numeric()
    ->dehydrated(false)
    ->afterStateHydrated(fn ($state, $record, Set $set) => $set('subtotal_cents', $record?->subtotal_cents))
    ->formatStateUsing(fn (Get $get) => collect($get('items'))->sum(fn ($i) => $i['quantity'] * $i['price_cents']));
```

- **MUST** call `->live(onBlur: true)` on the trigger field (not `->live()`) for text inputs — every keystroke otherwise round-trips to the server.
- **AVOID** chaining `->formatStateUsing()` + `->dehydrateStateUsing()` to silently transform values — admins editing a record see one value, save a different one. Use it for unit conversion (cents ↔ dollars) only when documented.

## Reactivity & rendering — keep `live()` cheap

`->live()` makes a field reactive, but **by default every `live()` update re-renders the entire schema** over the network. On a large form that's visible lag on every keystroke/blur. Scope the work, and prefer the client when no server logic is involved.

### Narrow what re-renders

| Method | Re-renders | Use when |
| ------ | ---------- | -------- |
| `->live()` (alone) | the whole schema | last resort; small forms only |
| `->partiallyRenderComponentsAfterStateUpdated(['a', 'b'])` | only the named fields | the update touches a few known fields (slug, a dependent select) |
| `->partiallyRenderAfterStateUpdated()` | only this field | the field updates its own affixes/helper text |
| `->skipRenderAfterStateUpdated()` | nothing | the `afterStateUpdated` callback only runs side-effect logic, changes nothing visible |

```php
Select::make('product_variant_id')
    ->live()
    ->afterStateUpdated(fn (Set $set) => $set('price_cents', null))
    ->partiallyRenderComponentsAfterStateUpdated(['price_cents']);
```

- **MUST** narrow `live()` re-renders with one of the partial-render methods on any form longer than a couple of fields. A bare `->live()` re-rendering a 30-field form on every change is the most common Filament performance complaint.
- **MUST** still call `->live()` — the partial-render methods modify *what* re-renders after an update; they don't make a field reactive on their own.

### Do it on the client with `*Js` when no PHP is needed

If the reaction depends only on form state (not the database, auth, or PHP enums/casts), use the JS variants — they run **entirely in the browser, no network round-trip**, and `$get()` works **without** marking the dependency `->live()`.

```php
// Clear a dependent select the instant the parent changes — no server hop.
Select::make('insurance_provider_id')
    ->afterStateUpdatedJs(<<<'JS'
        $set('insurance_plan_id', null)
        JS);

// Show/hide based on another field's value, client-side.
TextInput::make('other_reason')->visibleJs("\$get('reason') === 'other'");
Toggle::make('is_staff')->hiddenJs("\$get('role') !== 'staff'");
```

Inside a `*Js` expression: `$get('field')` reads state, `$set('field', value)` mutates it, `$state` is the current field's value — all client-side.

**Limits — when you MUST fall back to the PHP version:**
- **No PHP runs client-side.** Anything needing the database (`->options(fn () => Model::query()...)`), authorization, relationship lookups, or PHP enum/cast logic must use `->live()` + `->afterStateUpdated(fn ...)` / `->visible(fn ...)`. `$get()` in JS sees only what's already on the page.
- **It's literally JavaScript, not PHP** — `===`, `!==`, `&&`, `.toLowerCase()`. The PHP-looking syntax is deceptive.
- **XSS:** never concatenate user input into the JS string. Reading values via `$get()`/`$state` as *string values* is safe; injecting them as code is not.
- `hiddenJs()` + `visibleJs()` on the same field must **both** resolve to visible for it to show.
- For dynamic labels/content use `JsContent::make(<<<'JS' ... JS)` on `->label(...)` etc.

- **PREFER** `visibleJs()` / `hiddenJs()` over `->visible(fn ...)` / `->hidden(fn ...)`, and `afterStateUpdatedJs()` over `afterStateUpdated()`, **whenever the condition is pure form state** — it removes a round-trip and the `->live()` requirement on the dependency.

## Custom validation messages

```php
TextInput::make('email')
    ->email()
    ->required()
    ->validationMessages([
        'email'    => 'That doesn\'t look like a valid email.',
        'required' => 'We need an email to reach you.',
    ]);
```

- **PREFER** validation messages over generic Laravel defaults on customer-visible fields. Don't bother on staff-only admin fields.

## Dependent fields — `live()` + `->options(fn ...)`

When one field's options depend on another's value, **MUST** mark the parent `->live()`:

```php
Select::make('country_id')
    ->relationship('country', 'name')
    ->live(),

Select::make('state_id')
    ->options(fn (Get $get) => State::query()
        ->where('country_id', $get('country_id'))
        ->pluck('name', 'id'))
    ->required(fn (Get $get) => filled($get('country_id'))),
```

`->live(onBlur: true)` defers the network request until the field loses focus — preferred for `TextInput` to avoid one request per keystroke.

- **MUST** keep `->live()` here: the options come from the database, so a server round-trip is unavoidable. Scope the re-render with `->partiallyRenderComponentsAfterStateUpdated(['state_id'])` so only the dependent select refreshes. If the dependency merely toggles visibility or copies a value (no DB), use the `*Js` variants instead — no `live()` needed. See "Reactivity & rendering".

## Conditional visibility

Prefer the client-side `visibleJs()` / `hiddenJs()` for show/hide driven by form state (see "Reactivity & rendering") — no round-trip, no `->live()` on the dependency. Keep validation and persistence as PHP closures, since they run on the server:

```php
TextInput::make('tax_id')
    ->visibleJs("\$get('type') === 'company'")
    ->required(fn (Get $get) => $get('type') === 'company')          // validation runs server-side
    ->dehydrated(fn (Get $get) => $get('type') === 'company'),       // don't persist when hidden
```

- **MUST** also gate `->dehydrated(fn ...)` (PHP) when a hidden field must not be persisted — a crafted Livewire request can still submit a value the UI hid. Client-side visibility is presentational, **not** a security boundary.
- Reach for the PHP `->visible(fn (Get $get) => ...)` instead only when the condition needs the server (a DB lookup, auth, a PHP enum) — then mark the dependency `->live()`.

## Wizards

For long forms, break into steps:

```php
$schema->components([
    Wizard::make([
        Wizard\Step::make('Customer')->schema([...]),
        Wizard\Step::make('Items')->schema([...]),
        Wizard\Step::make('Confirm')->schema([...]),
    ]),
]);
```

Use on `CreateRecord` pages; on Edit pages, prefer Tabs.

## Prime components — arbitrary content without Blade

Prime components render *arbitrary* content directly in a schema (form, infolist, or page) — no Blade view required. Reach for these before hand-writing markup. They live in `Filament\Schemas\Components\*`.

| Prime | Renders | Key methods |
| ----- | ------- | ----------- |
| `Text` | a string, `HtmlString`, or inline Markdown | `->color()`, `->badge()`, `->size(TextSize::…)`, `->weight(FontWeight::…)`, `->fontFamily(FontFamily::…)`, `->tooltip()`, `->js()` |
| `Icon` | a `Heroicon` (or icon string) | `->color()`, `->size(IconSize::…)`, `->tooltip()` |
| `Image` | an image by URL | `->imageWidth()` / `->imageHeight()` / `->imageSize()`, `->alignCenter()`, `->tooltip()` |
| `UnorderedList` | a bullet list of strings or `Text` items | `->size(TextSize::…)` |

```php
use Filament\Schemas\Components\{Text, Icon, Image, UnorderedList};
use Filament\Support\Enums\{TextSize, FontWeight};
use Filament\Support\Icons\Heroicon;
use Illuminate\Support\HtmlString;

Section::make('Permissions')->schema([
    Text::make('Modifying these permissions may expose sensitive data.')
        ->color('warning')
        ->weight(FontWeight::Bold),

    Text::make(new HtmlString('Read the <a href="/docs" class="underline">policy guide</a> first.')),

    UnorderedList::make([
        'Admins can edit every record.',
        'Editors can edit their own.',
        'Viewers are read-only.',
    ]),

    Image::make(url: asset('images/permissions-matrix.png'), alt: 'Permission matrix')
        ->imageWidth('20rem'),

    Icon::make(Heroicon::ShieldCheck)->color('success')->tooltip('Audited'),
]),
```

- **MUST** use a prime over a custom Blade view or a `Placeholder` with raw HTML for static or computed display content. Primes are themed, dark-mode-aware, and support utility injection (`->color(fn ($record) => ...)`).
- **MUST NOT** confuse a prime with an infolist **entry**: entries (`TextEntry`, `IconEntry`, …) render a labeled *field of the record* (a `<dl>` row); primes render free content not tied to a model attribute. Use a `TextEntry` for "Customer: Acme", a `Text` for "These changes are irreversible."
- **PREFER** `Text::make(<<<'JS' ... JS)->js()` for content that depends on live form state but needs no PHP — it updates client-side, like the other `*Js` methods (see "Reactivity & rendering").
- For inline HTML wrap the string in `HtmlString`; for Markdown use `str(...)->inlineMarkdown()->toHtmlString()`. Both still go through `Text`, never a Blade partial.

## Callout — inline info / warning blocks

Reach for the `Callout` schema component for any inline info, tip, warning, or error block inside a form or infolist. **MUST NOT** hand-roll this with a custom Blade view, a `Placeholder`, or raw HTML — `Callout` already handles status colors, icons, dark mode, and footer actions.

```php
use Filament\Schemas\Components\Callout;

Callout::make('This order is locked')          // first arg is the HEADING
    ->description('Unlock it from the payments tab before editing line items.')
    ->warning()                                 // success() | warning() | danger() | info()
    ->icon(Heroicon::OutlinedLockClosed)        // optional; the status sets a sensible default
    ->columnSpanFull();
```

- `make($heading)` takes the **heading**; `->description(...)` is the body. (It's not `->title()`.)
- Status methods `->success()` / `->warning()` / `->danger()` / `->info()` set color + default icon in one call; use `->color('primary')` / `->color(null)` for finer control.
- **SHOULD** add `->columnSpanFull()` so the callout spans the form width instead of sitting in one grid column.
- **MAY** attach `->actions([Action::make('fix')->button()])` for a follow-up, and gate the whole callout with `->visible(fn ($record) => ...)` to show it only when relevant.
- To extract a reusable, record-aware callout, return a configured `Callout` from a component class's `make(): Callout` (closures for heading/visibility) — same wrap-don't-subclass rule as other components.

## Infolist

Read-only view of a record. Same `Schema` base, different component palette.

| Entry             | Use for                                                  |
| ----------------- | -------------------------------------------------------- |
| `TextEntry`       | strings, money, dates, dot-notation relations, markdown via `->markdown()` |
| `IconEntry`       | boolean (`->boolean()`) or enum → icon                   |
| `ImageEntry`      | single or stacked images (`->circular()`, `->stacked()`) |
| `ColorEntry`      | display a hex color swatch                               |
| `KeyValueEntry`   | flat key/value map                                       |
| `RepeatableEntry` | HasMany list rendered with a nested schema               |

```php
final class OrderInfolist
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Summary')->schema([
                TextEntry::make('reference')->copyable(),
                TextEntry::make('customer.name')->label('Customer')->icon('heroicon-o-user'),
                TextEntry::make('status')->badge()->color(fn (string $s) => match ($s) {
                    'pending' => 'warning',
                    'paid'    => 'success',
                    default   => 'gray',
                }),
                TextEntry::make('total_cents')->money(),
            ])->columns(2),

            Section::make('Items')->schema([
                RepeatableEntry::make('items')
                    ->schema([
                        TextEntry::make('name'),
                        TextEntry::make('quantity'),
                        TextEntry::make('price_cents')->money(),
                    ])
                    ->columns(3),
            ]),
        ]);
    }
}
```

- **MUST** eager-load relations referenced via dot-notation (`customer.name`) or by `RepeatableEntry::make('items')` on the Resource's `getEloquentQuery()` — same N+1 risk as table columns.
- **SHOULD** use `Split::make([...])` with a main `Group` + sidebar `Group` for view pages that mix long-form content (description, comments) with metadata (status, dates).
- **PREFER** `TextEntry::make(...)->badge()` over `IconEntry` for enum status — badges include the label text, which is more scannable than an icon alone.
- **SHOULD** use a **prime component** (`Text`/`Icon`/`Image`/`UnorderedList`) for content not bound to a record attribute — section intros, instructions, computed notes. Entries are for record fields; don't abuse a `TextEntry` with a hardcoded string. See "Prime components".

## v5+ notes

- See "Callout" above for the inline info/warning component (v5.2+).
- v5 form components support Livewire 4's `#[Locked]` on backing properties without extra config.
