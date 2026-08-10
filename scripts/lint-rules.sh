#!/usr/bin/env zsh
# lint-rules.sh — cheap structural checks for filament-agent-rules examples.
# No PHP/network required. Exit 0 on clean; non-zero with a violation list.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
errors=()

err() {
  errors+=("$1")
  fail=1
}

echo "== lint-rules: $ROOT =="

# 1) Rule and skill symlinks must resolve
echo "-- symlinks"
while IFS= read -r link; do
  if [[ ! -e "$link" ]]; then
    err "broken symlink: $link -> $(readlink "$link" 2>/dev/null || echo '?')"
  fi
done < <(find .claude/rules .claude/skills -type l 2>/dev/null | sort)

rule_count=$(find .claude/rules -type l 2>/dev/null | wc -l | tr -d ' ')
skill_count=$(find .claude/skills -type l 2>/dev/null | wc -l | tr -d ' ')
if [[ "$rule_count" -ne 8 ]]; then
  err "expected 8 .claude/rules symlinks, found $rule_count"
fi
if [[ "$skill_count" -lt 1 ]]; then
  err "expected at least one .claude/skills symlink, found $skill_count"
fi

# 2) Path-scoped canonical files: frontmatter uses paths:, not globs:
echo "-- frontmatter"
path_scoped=(
  app/Filament/Actions/CLAUDE.md
  app/Filament/Resources/CLAUDE.md
  app/Filament/Resources/Pages/CLAUDE.md
  app/Filament/Resources/RelationManagers/CLAUDE.md
  app/Filament/Resources/Schemas/CLAUDE.md
  app/Filament/Resources/Tables/CLAUDE.md
  app/Filament/Widgets/CLAUDE.md
  app/Providers/Filament/CLAUDE.md
)

for f in "${path_scoped[@]}"; do
  if [[ ! -f "$f" ]]; then
    err "missing path-scoped rule file: $f"
    continue
  fi
  # Only inspect the leading YAML frontmatter block (first --- ... ---)
  block=$(awk 'BEGIN{n=0} /^---[[:space:]]*$/{n++; if(n==2) exit} n>=1{print}' "$f")
  if [[ -z "$block" ]]; then
    err "missing frontmatter block: $f"
    continue
  fi
  if print -r -- "$block" | grep -qE '^globs:'; then
    err "frontmatter uses globs: (expected paths:): $f"
  fi
  if ! print -r -- "$block" | grep -qE '^paths:'; then
    err "frontmatter missing paths: key: $f"
  fi
done

# README must document paths: (not globs:) for the path-scoped surface
if grep -nE '^\s*globs:' README.md >/dev/null 2>&1; then
  # Only fail if the Claude path-scoped section still shows a globs: example
  if awk '/Path-scoped rules|Claude glob-based rules/,/^## /' README.md | grep -qE '^\s*globs:'; then
    err "README path-scoped section still documents globs: — use paths:"
  fi
fi

# 3) Every FileUpload::make(...) teaching example must include ->maxSize(
echo "-- FileUpload maxSize"
# Walk markdown under app/, resources/, tests/; for each FileUpload::make,
# require maxSize in THAT statement only (lines until the first ';' that ends
# the fluent chain, or a non-continuation line that starts a sibling).
while IFS= read -r hit; do
  file="${hit%%:*}"
  line="${hit#*:}"
  line="${line%%:*}"
  if ! awk -v start="$line" '
    NR < start { next }
    {
      # Accumulate this statement only
      stmt = stmt $0 "\n"
      # Fluent chains continue with "->"-prefixed lines or the opening make line
      if (NR == start) {
        if ($0 ~ /;[[:space:]]*$/) { done=1 }
      } else if ($0 ~ /^[[:space:]]*->/) {
        if ($0 ~ /;[[:space:]]*$/ || $0 ~ /,[[:space:]]*$/) { done=1 }
      } else {
        # Sibling field / closing array / blank / prose — statement ended without ;
        done=1
      }
      if (done) {
        if (stmt ~ /maxSize\(/) exit 0
        exit 1
      }
    }
    END {
      if (stmt ~ /maxSize\(/) exit 0
      exit 1
    }
  ' "$file"; then
    err "FileUpload::make without maxSize within its statement: $file:$line"
  fi
done < <(rg -n 'FileUpload::make\s*\(' app resources tests --glob '*.md' 2>/dev/null || true)

# 4) Legacy Form APIs must not reappear in custom Pages guidance
echo "-- Pages API currency"
if rg -n 'getFormSchema\s*\(|implements HasForms|InteractsWithForms|form\s*\(\s*Form\s+\$form' app/Filament/Pages/CLAUDE.md >/dev/null 2>&1; then
  err "app/Filament/Pages/CLAUDE.md still references legacy Form/HasForms/getFormSchema APIs"
fi
if ! rg -n 'form\s*\(\s*Schema\s+\$schema\s*\)\s*:\s*Schema' app/Filament/Pages/CLAUDE.md >/dev/null 2>&1; then
  err "app/Filament/Pages/CLAUDE.md missing form(Schema \$schema): Schema examples"
fi

# 5) Primary bulk-action teaching blocks should authorize
echo "-- bulk authorize"
# Actions primary BulkAction::make('archive') should include authorizeIndividualRecords nearby
if ! awk '
  /BulkAction::make\('\''archive'\''\)/ { inb=1; start=NR }
  inb && /authorizeIndividualRecords/ { found=1 }
  inb && /;[[:space:]]*$/ && NR>start { if (!found) exit 1; inb=0; found=0 }
  END { if (inb && !found) exit 1 }
' app/Filament/Actions/CLAUDE.md; then
  err "app/Filament/Actions/CLAUDE.md BulkAction archive example missing authorizeIndividualRecords"
fi

if [[ $fail -ne 0 ]]; then
  echo
  echo "FAILURES ($(( ${#errors[@]} ))):"
  for e in "${errors[@]}"; do
    echo "  - $e"
  done
  exit 1
fi

echo
echo "OK — all checks passed (rules=$rule_count skills=$skill_count)"
exit 0
