#!/bin/sh
# Maintenance check for this ruleset. Lives under .github/ because the
# apply-agent-rules installer never copies that directory into a project.
set -eu
repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
exec node "$repo_dir/.github/scripts/lint-rules.mjs" "$@"
