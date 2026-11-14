# Filament Tests

**Purpose:** Pest + Livewire feature tests for Filament Resources, Pages, Widgets, and Relation Managers, using the current Filament panel builder APIs.

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
- One test file per Resource page (`List{Models}Test`, `Create{Model}Test`, `Edit{Model}Test`) **or** one per Resource. Pick one repo-wide.

## Setup

- **MUST** use `RefreshDatabase` (or `LazilyRefreshDatabase`) — Filament tests assert against DB state after `->call('save')`.
- **MUST** authenticate as a user that passes `canAccessPanel()` in `beforeEach` — Filament's auth middleware runs on every Livewire request.

```php
use App\Models\User;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Illuminate\Database\Eloquent\Model;
use function Pest\Livewire\livewire;

uses(Tests\TestCase::class, Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    Filament::setTenant(null);
    Filament::setCurrentPanel('admin'); // use the registered panel ID under test
    $this->actingAs(User::factory()->admin()->create());
});
```

### Panel, tenant, and lazy-loading context

- **MUST** select the panel explicitly for direct Livewire tests when the target is not the default panel. Verify the panel ID in its provider.
- **MUST** enable `Model::preventLazyLoading()` in the test bootstrap (or the application's testing configuration) for the N+1 checks below. If enabled for a single test, restore the previous setting afterward.

  ```php
  // tests/Pest.php, with the Eloquent Model imported:
  Model::preventLazyLoading();
  ```
- **MUST** set the tenant before `Filament::bootCurrentPanel()` for tenant-aware tests so resource scopes and model creation listeners are registered. Create a user who belongs to that tenant and passes `canAccessTenant()`.

```php
// Inside the tenant suite's beforeEach, after authenticating a tenant member:
$team = Team::factory()->create();
auth()->user()->teams()->attach($team); // use the app's actual membership relationship
Filament::setCurrentPanel('admin');
Filament::setTenant($team);
Filament::bootCurrentPanel();
```

- **MUST** reset tenant context between tests and cover another tenant's records being inaccessible. Assert tenant ownership after create, not just that a row exists.
- **SHOULD** inspect query counts as well: Filament may eager-load relationships automatically, so a missing explicit `with()` does not prove an N+1. Use more than one row in lazy-loading regression tests.

## Page rendering

`livewire(PageClass::class)->assertSuccessful()` — the lowest-cost smoke test. **MUST** ship one per resource page; one assertion catches schema typos, missing imports, and policy regressions.

```php
it('renders the list page', function () {
    livewire(\App\Filament\Resources\Orders\Pages\ListOrders::class)
        ->assertSuccessful();
});
```

## Table assertions

```php
it('lists, sorts, searches, filters, and renders columns', function () {
    $match = Order::factory()->create(['reference' => 'INV-001', 'status' => 'pending']);
    $miss = Order::factory()->create(['reference' => 'INV-999', 'status' => 'paid']);

    livewire(ListOrders::class)
        ->assertCanSeeTableRecords([$match, $miss])
        ->sortTable('reference', 'desc')
        ->assertCanSeeTableRecords([$miss, $match], inOrder: true)
        ->searchTable('INV-001')
        ->assertCanSeeTableRecords([$match])
        ->assertCanNotSeeTableRecords([$miss])
        ->searchTable('')
        ->filterTable('status', 'pending')
        ->call('applyTableFilters')
        ->assertCanSeeTableRecords([$match])
        ->assertCanNotSeeTableRecords([$miss])
        ->assertCanRenderTableColumn('reference')
        ->assertCanRenderTableColumn('customer.name')
        ->assertCanRenderTableColumn('total_cents');
});
```

- **MUST** call `assertCanRenderTableColumn(...)` on columns that use dot-notation (`customer.name`) to check renderability. Combine render checks with lazy-loading prevention and query-count assertions where N+1 risk exists; renderability alone does not prove query efficiency.

Column visibility:

```php
livewire(ListOrders::class)
    ->assertTableColumnVisible('reference')
    ->assertTableColumnHidden('internal_cost');

livewire(ListOrders::class)
    ->assertCanNotRenderTableColumn('deleted_at');
```

Bulk action flow:

```php
livewire(ListOrders::class)
    ->selectTableRecords($orders->modelKeys())
    ->callAction(TestAction::make('updateStatus')->table()->bulk(), data: ['status' => 'paid'])
    ->assertHasNoActionErrors();
```

Row-action redirect:

```php
livewire(ListOrders::class)
    ->callAction(TestAction::make('edit')->table($order))
    ->assertRedirect(OrderResource::getUrl('edit', ['record' => $order]));
```

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
- **MUST** verify edit-page `unique` validation with a test that saves the current record unchanged and rejects a duplicate from another record. Only add `ignoreRecord: true` in the schema when the field is not already model-bound in a way Filament can infer.
- **MUST**, for every Select or CheckboxList whose options are filtered (active only, same tenant, eligible role), test an edit where the stored value is no longer offered: save an unrelated field and assert no errors. Then assert the ineligible record cannot be newly chosen on another record.

  ```php
  it('saves an order whose plan was retired', function () {
      $order = Order::factory()->for(Plan::factory()->retired())->create();

      livewire(EditOrder::class, ['record' => $order->getRouteKey()])
          ->fillForm(['reference' => 'INV-NEW'])
          ->call('save')
          ->assertHasNoFormErrors();
  });
  ```

## Action assertions

```php
it('approves a pending order', function () {
    $order = Order::factory()->create(['status' => 'pending']);

    livewire(EditOrder::class, ['record' => $order->getRouteKey()])
        ->callAction('approve');

    expect($order->refresh()->status)->toBe(OrderStatus::Approved);
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
        ->selectTableRecords($orders->modelKeys())
        ->callAction(TestAction::make('archive')->table()->bulk())
        ->assertHasNoActionErrors();

    foreach ($orders as $order) {
        expect($order->refresh()->archived_at)->not->toBeNull();
    }
});
```

## Notification assertions

```php
livewire(EditOrder::class, ['record' => $order->getRouteKey()])
    ->callAction('approve')
    ->assertNotified('Order approved');

livewire(EditOrder::class, ['record' => $order->getRouteKey()])
    ->callAction('reject', data: ['reason' => 'Invalid PO'])
    ->assertNotified(
        Notification::make()->title('Order rejected')->danger()
    );
```

- **MUST** assert notifications on any action whose only success signal is a toast — otherwise a regression that drops the notification looks green.
- **AVOID** asserting on notification body text — bodies often include interpolated record state and break across factory seeds.

## Authorization

Three test shapes — **MUST** cover all three:

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

it('refuses a refund from a user who may not refund', function () {
    $order = Order::factory()->paid()->create();
    $this->actingAs(User::factory()->reader()->create());

    livewire(EditOrder::class, ['record' => $order->getRouteKey()])
        ->mountAction('refund')          // what a crafted request does; skips the visibility assertion
        ->assertActionNotMounted();

    expect($order->refresh()->refunded_at)->toBeNull();
});
```

- **MUST** test page-level forbid with `assertForbidden()` (not 403 status — Filament returns the page with a forbidden Livewire response).
- **MUST** test action-level visibility with `assertActionHidden()` rather than only the underlying policy — visibility wiring is a frequent regression.
- **MUST** also test that every custom action is **refused**, not merely hidden, for a user who lacks the ability and for a record in a state that forbids it. `callAction()` asserts the action is visible first, so it cannot prove this: use `mountAction()` (with `TestAction::make('refund')->table($order)` for a row action), then assert nothing mounted and the database is unchanged. For a custom Livewire method, call it directly with `->call('method')` and `assertForbidden()`. A test that only asserts "hidden" passes when the button is hidden in Blade and the action is wide open.
- **MUST** run the refusal test on **each** page or relation manager that mounts a shared action class, as the weakest persona that can open that page.

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
        ->callAction(TestAction::make('create')->table(), data: ['name' => 'Widget', 'quantity' => 1, 'price_cents' => 999])
        ->assertHasNoActionErrors();

    expect($order->fresh()->items)->toHaveCount(1);
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
- [ ] Every custom action (visibility + happy path + refused without the ability)
- [ ] Every filtered Select / CheckboxList: edit saves with a stored value that is no longer offered
- [ ] Page-level forbid for unauthorized user

## Rules

- **MUST** use Pest's `it(...)` form, not `test(...)` — keeps assertions readable as English sentences.
- **MUST** factory-create test data — never insert via raw `Model::create([...])`.
- **AVOID** asserting on rendered HTML strings except for known-stable text (`assertSee('Total')`); markup is volatile across Filament minor versions.
- **PREFER** asserting on DB state (`assertDatabaseHas`, `expect($record->refresh()->...)`) over Livewire `assertSet(...)`.
- **MUST** test the form's `->live()` dependent fields by `->set('data.parent_id', $id)` then `->assertSet('data.child_field', ...)` — these break silently when relationships change.
- **MUST** call `->filterTable(...)` then `->call('applyTableFilters')` before asserting deferred filters.
