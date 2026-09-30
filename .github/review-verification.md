# Multi-model findings verification

Verification uses the checked-out repository plus official Filament 5.x source at
[`6bd832e`](https://github.com/filamentphp/filament/tree/6bd832e6c92636bc6bbe152eeefe150d698242f9)
and apply-agent-rules at
[`6344e33`](https://github.com/leek/apply-agent-rules/tree/6344e33efbb724b66d6de51dd19b17c374b0ee31).
Source paths below are relative to those repositories. This is a maintenance
record, not downstream agent guidance. Each tier is verified before its commit.
Released-source cross-check: Filament
[`v5.9.0`](https://github.com/filamentphp/filament/tree/v5.9.0), commit
`222ece3031c5e3d93f215bf82daff261b358061d`. Current-source changes to the queried
transaction, validation, tenancy, filter-test, and import-dispatch files were
compared to the release before adopting a supported baseline.

## Tier 1

| Finding | Verdict and evidence | Resolution |
| --- | --- | --- |
| Navigation declarations | Confirmed. `packages/panels/src/Resources/Resource/Concerns/HasNavigation.php` and `Pages/Page.php` declare BackedEnum/UnitEnum unions; Cluster extends Page. | Match inherited union types. |
| Static Page/Widget view | Confirmed. `Pages/BasePage.php` and `packages/widgets/src/Widget.php` declare an instance string property. | Use instance properties; remove dashboard skill's duplicate example. |
| Widget sort/polling | Confirmed. `Widget.php` declares static nullable int sort; `Concerns/CanPoll.php` declares instance pollingInterval, used by stats/chart widgets. | Match parent declarations. |
| Directory rule inheritance | Confirmed by actual skeleton paths: `Resources/Tables` is not an ancestor of `Resources/Orders/Tables`. Existing Resources pointers do not reach clustered resources automatically. | Mandatory hub routing for every class type; disclose agent-dependent loading in README. |
| Path gaps/custom pages | Confirmed by frontmatter: single-level schema/table patterns miss extracted children; unrestricted Pages patterns match standalone pages. | Recursive schema/table patterns; resource ancestor required for page patterns; routing coverage lint. |
| Cents formatting | Confirmed. Both `CanFormatState::money()` implementations divide only when divideBy is supplied. **Rejected subclaim:** currency is required; its argument defaults to null and uses configured defaults. | Explicit USD/divideBy:100 examples, adaptable to the project currency. |
| Notification Undo | Confirmed. `packages/actions/src/Action.php::toArray()/fromArray()` preserve event/URL data, not PHP callbacks; notification docs use unified Action. **Qualification:** Action has an action() method, but the callback does not survive serialization. | Dispatch to a mounted, scoped, authorized listener. |
| Theme overrides/build | Confirmed by `docs/08-styling/01-overview.md` and theme generator: Vite input/viteTheme/import/source scanning are required. No filesystem override mapping exists. | Replace mapping/build guidance with the actual theme pipeline. |
| Modal breakpoints | Confirmed by `packages/schemas/docs/02-layouts.md` and grid CSS: plain breakpoints use viewport width; gridContainer plus @ breakpoints uses container width. | Correct explanation and give a container example. |
| Cluster moves/discovery | Confirmed by `docs/06-navigation/04-clusters.md`: moving files is recommended, not required; cluster membership sets URL behavior and clusters can be discovered. | Distinguish membership, organization, and registration. Generator naming is handled in Tier 2. |
| Extraction conflicts | Confirmed by contradictory repository text, not a framework requirement. | Preserve the existing day-one resource policy; shared UI actions extract at two surfaces. |
| Missing lint | Confirmed: scripts absent and /scripts/ ignored. | Restore tracked shell/Node lint and CI; checks links, frontmatter, routing, property declarations, money and upload examples. |
| ActionSize | Confirmed by `packages/actions/src/Concerns/HasSize.php` and `packages/support/src/Enums/Size.php`. | Use the current Size enum. |
| Page polling/tabs | Polling claim confirmed: Page lacks CanPoll. **Rejected subclaim:** an application-defined tab array is inherently invalid; a custom Page may define one, but needs rendering. | Name custom tab method explicitly; provide Blade rendering and fallback; poll markup or widgets. |
| Cursor output | Confirmed by installer `src/agents.js`: .cursorrules. | Correct README and docs router. |
| Release pin | Confirmed by live remote tags: v0.15.1 is newest; v0.14.0 predates paths fixes. | Update pin; clarify pins do not include subsequent unreleased changes. |

Validation: `./scripts/lint-rules.sh`, `git diff --check`, source inspection,
installer routing checks, and negative lint fixtures. This repository has no
Laravel application or Composer test suite; examples are documentation.

## Tier 2

| Finding | Verdict and evidence | Resolution |
| --- | --- | --- |
| Embedded transition authorization | Confirmed: public method has no check. Official security docs require authorization for custom components; a parent page does not supply it. | Re-resolve through TicketResource's scoped query; authorize mutation and refresh listener. |
| Partial transaction commit | Confirmed by `actions/src/Concerns/InteractsWithActions.php`: normal completion commits; Halt/Cancel only roll back when their flag is set. | Transactional example calls halt with explicit rollback; document catch-outside-transaction alternative. |
| Shared cached counts | Confirmed: literal cache keys omit tenant identity, irrespective of whether the query is scoped. | Panel/tenant/user keys and scoped query; require permission-context invalidation where applicable. |
| Conflicting tenancy instructions | Confirmed. `Resource/Concerns/BelongsToTenant.php` registers contextual global scopes for tenant-aware resource models. Official tenancy docs describe timing, panel, and model limits. | Align hub/resources/providers/custom pages; related-model selects may already be scoped. |
| scopedExists arguments | Confirmed by `forms/.../CanBeValidated.php`: model first, column second; executes model::query(). | Category::class/id plus required model scoping. |
| Cluster authorization | Confirmed by `Clusters/Cluster.php`: canAccessClusteredComponents participates in main navigation registration, not child policy enforcement. | Require child authorization for section permissions. |
| Production panel access | Confirmed by `Http/Middleware/Authenticate.php`: a user without FilamentUser is denied outside local. | Correct the reversed explanation. |
| Schema Split | Confirmed: schemas contain Flex, no Split; Flex accepts a child schema array. **Rejected extension:** table Layout Split remains valid, including the old table skill example. | Replace schema-only references; preserve table Split. |
| Action secondary/outlined | Qualified. Default registered colors omit secondary, but a project may register custom colors. outlined() exists as a modifier. | List default colors; distinguish view method from modifier. |
| Action generator | Confirmed absent from current package commands. | Remove command; keep manual class shape. |
| Delete page hooks | Confirmed absent from resource page classes. Action before/after hooks exist. | Replace hook-table entry. |
| Relation query override | Confirmed absent from relation-manager/table classes. | Table modifyQueryUsing with eager loading. |
| Cluster generated path | Confirmed by MakeClusterCommand tests: Commerce/CommerceCluster.php structure. | Align tree, naming, example class and membership references. |
| Widget resource=null | Confirmed by MakeWidgetCommand: nonempty resource option enters resource selection. | Omit option for standalone widget and answer resource prompt accordingly. |
| Import behavior/setup | Confirmed by ImportDispatcher and import/export docs: batches and migrations required, no default email. **Qualification:** sync imports send persistent session notifications; async imports send database notifications. | Accurate queue/notification behavior and prerequisite migrations. |
| Relationship repeater order | Confirmed by repeater docs/source: persisted order needs orderColumn and a real model column. | Add sort orderColumn and column prerequisite. |
| authorize record argument | Confirmed: snippet's record is undefined; CanBeAuthorized::parseAuthorizationArguments prepends bound record. | authorize('refund'); distinguish visibility from authorization. |
| Notification badge query | Confirmed: Notifications Notification is not an Eloquent model. | Query authenticated user's unreadNotifications relationship. |
| Relationship search columns | Confirmed by InteractsWithTableQuery::applySearchConstraint: relationship context is supplied already. | Related columns name/iso_code. |
| Create placement | Confirmed contradictory text; List page generator uses page header Create. Table headers remain valid for relation managers. | Resource Create in page header; table-specific operations in table header. |
| Deferred filters | Confirmed by TestsFilters::filterTable and HasFilters: helper sets state; applyTableFilters applies deferred state. | Apply before asserting in worked example. |
| Standalone page generator | Confirmed: --resource generates under resource Pages. | Standalone command without resource flag. |
| Enum examples | Confirmed repository mismatch: supplied enum uses getLabel and model enum cast; infolist string callback and string status assertion disagree. | Use getLabel, inferred badge presentation, enum assertion; include the Approved case used by action examples. |
| Claude skill installation | Reproduced with installer walk/plan: directory links omitted, .agents skill files copied. | Document individual post-install links; preserve source symlinks. |
| Local meta-file leak | Reproduced: walk includes root gitignored CLAUDE.md. | Document root-only exclusion for local checkout; exclude maintenance scripts from installs. |
| Skill code duplication | Confirmed copied PHP/Blade in dashboard/actions/forms/infolists/tables/docs and parallel testing helper table. | Route to canonical examples and helper reference; lint prevents code duplication. |
| Version floor | Confirmed missing supported baseline. Callout/gridContainer exist at v5.2.0, but later security helpers are not there. | Use released v5.9.0 as verified supported baseline rather than promising unverified earlier minor compatibility. |

Validation: source/released-source comparison, lint and whitespace checks,
disposable installation for all six agent mappings, post-install Claude links,
and assertions that maintenance scripts/meta rules do not ship with documented
exclusions. No external installer repository was modified.

## Tier 3

| Finding | Verdict and evidence | Resolution |
| --- | --- | --- |
| Get/Set imports | Confirmed omission: callbacks use bare utility names without an import guide. Current classes are in `packages/schemas/src/Components/Utilities`. | Add namespace guidance and lint old namespaces. |
| Lazy-loading prevention | Confirmed missing setup despite checklist dependency. Laravel Model exposes preventLazyLoading/preventsLazyLoading; official relationship docs describe the guard. | Test-bootstrap setup plus query-count caveat; renderability alone is not N+1 proof. |
| Panel/tenant test context | Confirmed absent. `docs/10-testing/02-testing-resources.md` requires setCurrentPanel and illustrates setTenant/bootCurrentPanel for tenancy. | Explicit panel setup, tenant membership/context/boot example, cross-tenant coverage and context reset requirements. |
| TestAction helpers | Valid modernization request, **not broken legacy APIs**: TestsActions/TestsBulkActions still expose callTableAction/callTableBulkAction. Official action-testing docs recommend TestAction table/bulk context. | Modernize row/header/bulk examples; retain valid string callAction for page actions. |
| Cluster routing | Confirmed missing row in filament-docs task table. | Add cluster and clustered-child routing. |
| Widget examples contradict rules | Confirmed: first chart assembled its own data; table widget lacked explicit eager loading despite its own mandate. A missing with() alone does not prove an actual N+1 because Filament can eager-load. | Delegate aggregation to named business Action receiving a scoped Builder; eager-load customer explicitly. Tab fallback was completed in Tier 1. |
| Filter form/schema style | form() is a deprecated alias, **not a nonexistent API**, in Filters/Concerns/HasSchema.php. | Use current schema() consistently. |
| Icons/action names | Confirmed style mismatch, **not invalid string icons**. All replacement enum cases checked in support Icons Heroicon. Business-action example names omitted the prescribed Action suffix. | Prefer verified enum icons in PHP/Blade examples; align business Action names and distinguish them from UI classes. |
| CSS vocabulary | Confirmed repository style gap. | Completed with the Tier 1 theme rewrite using MUST/PREFER vocabulary. |
| Pivot attachment form | Confirmed by `docs/03-resources/07-managing-relationships.md` and AttachAction: getRecordSelect plus pivot fields belongs in action schema; recordId is not an ordinary related-model attribute. | AttachAction schema and withPivot requirements on both relationship directions. |
| Nullable slug state | Confirmed by schema HasState::getRawState(): blank non-array state becomes null before callbacks; required validation does not prevent editing callbacks. | Nullable callback and empty-string fallback, lint non-null state pattern. |
| Static cancel call | Confirmed by actions Action::cancel: public non-static method. | Inject/use the action instance; explain rollback flag; lint static call. |

Validation: lint, whitespace checks, source signature/enum-case checks, a PHP
null-state reproduction, and regression fixtures for the added guards. The
canonical rule and skill links remain intact. No runtime Filament app exists in
this repository, so these checks do not claim an application test suite ran.

## Completion audit

All supplied findings have a verdict above, including subordinate claims and the
three initially unchecked Claude observations. Confirmed defects were corrected;
valid/deprecated APIs and contextual behavior were qualified rather than treated
as hallucinated framework removals. The ignored local maintenance CLAUDE.md was
also corrected for routing, Cursor output, skill links, and filesystem installation;
it remains untracked as required. Git ignore comments now describe the actual
local-install boundary. Final checks run against a Git archive of the committed
distribution, so ignored local files cannot conceal missing tracked lint assets.
