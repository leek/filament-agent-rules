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

Read-only view of a record. Same `Schema` base, different component palette (`TextEntry`, `IconEntry`, `ImageEntry`, `KeyValueEntry`, `RepeatableEntry`, `ColorEntry`, `Section`, `Split`, `Grid`).

```php
final class OrderInfolist
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Summary')->schema([
                TextEntry::make('reference'),
                TextEntry::make('customer.name')->label('Customer'),
                TextEntry::make('status')->badge(),
                TextEntry::make('total_cents')->money(),
            ])->columns(2),
        ]);
    }
}
```

- **MUST** eager-load relations referenced via dot-notation (`customer.name`) on the Resource's `getEloquentQuery()`.

## v5+ notes

- **Callout** component (v5.2+) — highlight info inside forms:

  ```php
  Callout::make('warning')->title('This will be visible to customers.');
  ```
- v5 form components support Livewire 4's `#[Locked]` on backing properties without extra config.
