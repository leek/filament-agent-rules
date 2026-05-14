# Filament Tests

**Purpose:** Pest + Livewire feature tests for Filament Resources, Pages, Widgets, and Relation Managers.

Targets **Filament v4 + v5**. v5 has no test-API breaks; Pest + `livewire()` helper work identically.

## Where they live

Mirror the panel tree:

```
tests/Feature/Filament/
├── Resources/
│   ├── OrderResourceTest.php
│   └── UserResourceTest.php
├── Pages/
│   └── SettingsTest.php
├── Widgets/
│   └── OrdersOverviewTest.php
└── RelationManagers/
    └── ItemsRelationManagerTest.php
```

## Naming

- **MUST** match the class under test + `Test` suffix.
- One test file per Resource page (`List{Models}Test`, `Create{Model}Test`, `Edit{Model}Test`) **or** one per Resource. Pick one and be consistent across the repo.

## Setup

- **MUST** use `RefreshDatabase` (or `LazilyRefreshDatabase`) — Filament tests assert against DB state after `->call('save')`.
- **MUST** authenticate as a user that passes `canAccessPanel()` in `beforeEach` — Filament's auth middleware runs on every Livewire request.

```php
use App\Models\User;
use function Pest\Livewire\livewire;

uses(Tests\TestCase::class, Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    $this->actingAs(User::factory()->admin()->create());
});
```

## Page rendering

`livewire(PageClass::class)->assertSuccessful()` — the lowest-cost smoke test. **MUST** ship one per resource page; it catches schema typos, missing imports, and policy regressions in one assertion.

```php
it('renders the list page', function () {
    livewire(\App\Filament\Resources\OrderResource\Pages\ListOrders::class)
        ->assertSuccessful();
});
```

## Table assertions

```php
it('lists orders', function () {
    $orders = Order::factory()->count(5)->create();

    livewire(ListOrders::class)
        ->assertCanSeeTableRecords($orders);
});

it('searches by reference', function () {
    $match = Order::factory()->create(['reference' => 'INV-001']);
    $miss  = Order::factory()->create(['reference' => 'INV-999']);

    livewire(ListOrders::class)
        ->searchTable('INV-001')
        ->assertCanSeeTableRecords([$match])
        ->assertCanNotSeeTableRecords([$miss]);
});

it('sorts by created_at desc by default', function () {
    $orders = Order::factory()->count(3)->create();

    livewire(ListOrders::class)
        ->assertCanSeeTableRecords($orders->sortByDesc('created_at'), inOrder: true);
});

it('filters by status', function () {
    $pending = Order::factory()->create(['status' => 'pending']);
    $paid    = Order::factory()->create(['status' => 'paid']);

    livewire(ListOrders::class)
        ->filterTable('status', 'pending')
        ->assertCanSeeTableRecords([$pending])
        ->assertCanNotSeeTableRecords([$paid]);
});

it('renders columns', function () {
    Order::factory()->create();

    livewire(ListOrders::class)
        ->assertCanRenderTableColumn('reference')
        ->assertCanRenderTableColumn('customer.name')
        ->assertCanRenderTableColumn('total_cents');
});
```

- **MUST** call `assertCanRenderTableColumn(...)` on every column that uses dot-notation (`customer.name`) — catches missing eager-loads that throw under `Model::preventLazyLoading()` in tests.

## Form assertions (Create / Edit)

```php
it('creates an order', function () {
    $customer = Customer::factory()->create();

    livewire(CreateOrder::class)
        ->fillForm([
            'customer_id' => $customer->id,
            'reference'   => 'INV-100',
        ])
        ->call('create')
        ->assertHasNoFormErrors();

    $this->assertDatabaseHas(Order::class, ['reference' => 'INV-100']);
});

it('validates required fields', function () {
    livewire(CreateOrder::class)
        ->fillForm(['reference' => ''])
        ->call('create')
        ->assertHasFormErrors(['reference' => 'required']);
});

it('hydrates the edit form from the record', function () {
    $order = Order::factory()->create(['reference' => 'INV-007']);

    livewire(EditOrder::class, ['record' => $order->getRouteKey()])
        ->assertFormSet(['reference' => 'INV-007']);
});

it('updates an order', function () {
    $order = Order::factory()->create();

    livewire(EditOrder::class, ['record' => $order->getRouteKey()])
        ->fillForm(['reference' => 'INV-NEW'])
        ->call('save')
        ->assertHasNoFormErrors();

    expect($order->refresh()->reference)->toBe('INV-NEW');
});
```

- **MUST** assert `assertHasNoFormErrors()` on every successful save — without it, validation failures hide as silent no-ops.
- **MUST** test `unique` rules with `ignoreRecord: true` on Edit pages — easy regression when developers forget the flag.

## Action assertions

| Helper                                | Asserts                                       |
| ------------------------------------- | --------------------------------------------- |
| `callAction('name')`                  | Run a header/footer action                    |
| `callAction('name', data: [...])`     | Run an action with modal form data            |
| `callTableAction(Class, $record)`     | Run a row action on a specific record         |
| `callTableBulkAction(Class, $records)`| Run a bulk action on a collection             |
| `assertActionVisible('name')` / `assertActionHidden('name')` | Visibility           |
| `assertHasNoActionErrors()` / `assertHasActionErrors([...])` | Modal-form validation |

```php
it('publishes a draft', function () {
    $order = Order::factory()->create(['status' => 'pending']);

    livewire(EditOrder::class, ['record' => $order->getRouteKey()])
        ->callAction('approve');

    expect($order->refresh()->status)->toBe('approved');
});

it('hides approve action for already-approved orders', function () {
    $order = Order::factory()->create(['status' => 'approved']);

    livewire(EditOrder::class, ['record' => $order->getRouteKey()])
        ->assertActionHidden('approve');
});

it('validates the reject reason', function () {
    $order = Order::factory()->create();

    livewire(EditOrder::class, ['record' => $order->getRouteKey()])
        ->callAction('reject', data: ['reason' => ''])
        ->assertHasActionErrors(['reason' => 'required']);
});

it('bulk-archives selected orders', function () {
    $orders = Order::factory()->count(3)->create();

    livewire(ListOrders::class)
        ->callTableBulkAction('archive', $orders);

    foreach ($orders as $order) {
        expect($order->refresh()->archived_at)->not->toBeNull();
    }
});
```

## Authorization

Two test shapes — **MUST** cover both:

```php
it('forbids non-admins from the list page', function () {
    $this->actingAs(User::factory()->create()); // non-admin

    livewire(ListOrders::class)->assertForbidden();
});

it('hides the destroy action when policy denies', function () {
    $order = Order::factory()->create();
    $this->actingAs(User::factory()->reader()->create());

    livewire(EditOrder::class, ['record' => $order->getRouteKey()])
        ->assertActionHidden('delete');
});
```

- **MUST** test page-level forbid with `assertForbidden()` (not 403 status — Filament returns the page with a forbidden Livewire response).
- **MUST** test action-level visibility with `assertActionHidden()` rather than only the underlying policy — visibility wiring is a frequent regression.

## Widget tests

```php
it('renders the orders overview', function () {
    Order::factory()->count(5)->create(['status' => 'pending']);

    livewire(OrdersOverview::class)
        ->assertSuccessful()
        ->assertSee('5');
});

it('renders the latest orders table widget', function () {
    $orders = Order::factory()->count(10)->create();

    livewire(LatestOrders::class)
        ->assertCanSeeTableRecords($orders->take(10));
});
```

## Relation Manager tests

```php
it('lists items on the order', function () {
    $order = Order::factory()->has(Item::factory()->count(3), 'items')->create();

    livewire(ItemsRelationManager::class, [
        'ownerRecord' => $order,
        'pageClass'   => EditOrder::class,
    ])
        ->assertCanSeeTableRecords($order->items);
});

it('creates a related item', function () {
    $order = Order::factory()->create();

    livewire(ItemsRelationManager::class, [
        'ownerRecord' => $order,
        'pageClass'   => EditOrder::class,
    ])
        ->callTableAction('create', data: ['name' => 'Widget', 'quantity' => 1, 'price_cents' => 999]);

    expect($order->items)->toHaveCount(1);
});
```

- **MUST** pass both `ownerRecord` and `pageClass` — omitting `pageClass` triggers a confusing internal Filament error rather than a clean test failure.

## Coverage checklist

For every Resource, **MUST** cover:

- [ ] List page renders
- [ ] List page lists factory-created records
- [ ] Every dot-notation column renders without N+1
- [ ] Search / sort / filter on at least one column each
- [ ] Create with valid data persists
- [ ] Create with invalid data surfaces form errors
- [ ] Edit hydrates from record
- [ ] Edit save persists
- [ ] Every custom action (visibility + happy path)
- [ ] Page-level forbid for unauthorized user

## Rules

- **MUST** use Pest's `it(...)` form, not `test(...)` — keeps assertions readable as English sentences.
- **MUST** factory-create test data — never insert via raw `Model::create([...])` in tests.
- **AVOID** asserting on rendered HTML strings except for known-stable text (`assertSee('Total')`); markup is volatile across Filament minor versions.
- **PREFER** asserting on DB state (`assertDatabaseHas`, `expect($record->refresh()->...)`) over Livewire `assertSet(...)`.
- **MUST** test the form's `->live()` dependent fields by `->set('data.parent_id', $id)` then `->assertSet('data.child_field', ...)` — these break silently when relationships change.

## v5+ notes

- Livewire v4 inside Filament v5 changes property access from `set('foo')` to `set('foo')` (unchanged), but `assertSet` on hydrated form state now uses `assertFormSet([...])` — already shown above.
- v5.2+ deferred filters: tests **MUST** call `->filterTable(...)` then `->call('applyTableFilters')` before asserting, otherwise the filter hasn't applied yet.
