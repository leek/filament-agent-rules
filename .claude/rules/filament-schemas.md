---
description: Reusable Form and Infolist schema classes (declarative component trees, state callbacks)
globs:
  - app/Filament/Resources/**/Schemas/*.php
alwaysApply: false
---

# Schemas (Forms + Infolists)

**Purpose:** declarative component trees for editing (Form) and viewing (Infolist) records. Both share the same `Schema` base class in Filament v4+.

## Where they live

Per-resource, under `app/Filament/Resources/{Model}Resource/Schemas/`:

```
app/Filament/Resources/OrderResource/Schemas/
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

## Rules

- **MUST** extract schemas to their own classes once a resource has >2 sections or >10 fields. Inline schemas inside the Resource bloat the file fast.
- **MUST** mark every required column from the model as `->required()` on the form — Filament does not infer this from the migration.
- **MUST** mirror `$casts` in form/infolist component choice: enum cast → `Select::make(...)->options(Status::class)`, datetime cast → `DateTimePicker::make(...)`, JSON cast → `KeyValue::make(...)` or `Repeater::make(...)`.
- **MUST** use `->dehydrated(false)` on display-only fields that must NOT be saved.
- **SHOULD** group related fields into `Section::make('...')` blocks — sections collapse on mobile and improve scanability.

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

## Reusable schema fragments

Share field clusters across multiple resources without inheritance — return an array from a static method and spread it:

```php
final class ContactFields
{
    public static function make(): array
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
    Section::make('Contact')->schema([...ContactFields::make()]),
]);
```

- **MUST** keep fragments stateless — no `$this`, no constructor args that vary by record. If the fragment needs record context, accept it as a parameter (`make(?Model $record = null)`).
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
    ->afterStateUpdated(fn (string $state, Set $set) => $set('slug', Str::slug($state)));

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

## Conditional visibility

```php
TextInput::make('tax_id')
    ->visible(fn (Get $get) => $get('type') === 'company')
    ->required(fn (Get $get) => $get('type') === 'company'),
```

- **MUST** also add `->dehydrated(fn (Get $get) => $get('type') === 'company')` if hidden fields shouldn't be persisted at all.

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

## v5+ notes

- **Callout** component (v5.2+) — highlight info inside forms:

  ```php
  Callout::make('warning')->title('This will be visible to customers.');
  ```
- v5 form components support Livewire 4's `#[Locked]` on backing properties without extra config.
