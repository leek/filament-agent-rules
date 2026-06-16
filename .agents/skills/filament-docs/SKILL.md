---
name: filament-docs
description: Use this skill whenever you need Filament implementation guidance, need to locate the right local Filament rule files, need official Filament docs, or are unsure which Filament-specific rule applies. This skill is the router for Filament resources, schemas, tables, actions, widgets, panel providers, CSS, and tests.
---

# Filament Docs And Rule Routing

This repository's canonical product is the directory-scoped rule set. Use this
skill to find the smallest relevant slice of that rule set before writing,
reviewing, or debugging Filament code.

## Resolve The Project Root

Find the current project root from the workspace or nearest Laravel project
marker (`artisan`, `composer.json`, or `.git`). Do not use absolute user home
paths. Resolve every path below from that project root.

When working in a project that has installed these rules for a specific agent,
read the same scoped path using the active agent filename if present:

- Codex: `AGENTS.md`
- Claude: `CLAUDE.md`
- Gemini: `GEMINI.md`
- Cursor: `.cursor/rules/*.mdc`

If several exist, prefer the file for the agent currently doing the work, then
fall back to `CLAUDE.md` because that is the canonical authoring filename in
this repo.

## Local Rules First

Read only the files relevant to the task:

| Task | Rule files |
| ---- | ---------- |
| Cross-cutting Filament conventions | `app/Filament/CLAUDE.md` |
| Resources | `app/Filament/Resources/CLAUDE.md` |
| Resource pages | `app/Filament/Resources/Pages/CLAUDE.md` |
| Relation managers | `app/Filament/Resources/RelationManagers/CLAUDE.md` |
| Forms and infolists | `app/Filament/Resources/Schemas/CLAUDE.md` |
| Tables | `app/Filament/Resources/Tables/CLAUDE.md` |
| Actions | `app/Filament/Actions/CLAUDE.md` |
| Custom pages and dashboards | `app/Filament/Pages/CLAUDE.md` |
| Widgets | `app/Filament/Widgets/CLAUDE.md` |
| Panel providers and discovery | `app/Providers/Filament/CLAUDE.md` |
| Theme CSS | `resources/css/filament/CLAUDE.md` |
| Tests | `tests/Feature/Filament/CLAUDE.md` |

Always read the hub (`app/Filament/CLAUDE.md`) for non-trivial work. It
contains cross-cutting rules such as global defaults, schema composition,
authorization, and the custom Blade escape ladder.

## Official Docs

If local rules do not answer a method signature or edge case, consult current
official Filament docs. Prefer official documentation over generated or vendored
snapshots. When you use external docs, keep the answer grounded in the project
rules first and mention any docs-derived assumption.

## Version Stance

Use the current Filament panel builder API consistently. Do not branch examples
by Filament major version unless the user explicitly asks for a migration note.
