# Multi-model findings verification

Verification uses the checked-out repository plus official Filament 5.x source at
[`6bd832e`](https://github.com/filamentphp/filament/tree/6bd832e6c92636bc6bbe152eeefe150d698242f9)
and apply-agent-rules at
[`6344e33`](https://github.com/leek/apply-agent-rules/tree/6344e33efbb724b66d6de51dd19b17c374b0ee31).
Source paths below are relative to those repositories. This is a maintenance
record, not downstream agent guidance. Each tier is verified before its commit.

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
