#!/usr/bin/env bash
#
# detect-changes.sh — single source of truth for "what kind of changes
# are in this diff?"
#
# Emits boolean flags to $GITHUB_OUTPUT (in GHA) and stdout (locally).
# Used by:
#   - .github/workflows/mabl-sdlc.yml change-detector job
#   - scripts/pipeline-awareness/vercel-should-build.sh
#   - Local CLI: ./detect-changes.sh main HEAD
#
# Spec: TAMD-132. See docs/REFERENCE-ARCHITECTURE.md for the path-
# awareness layer overview.
#
# Flags emitted (true | false):
#   has_app_changes        src/**, public/**, package*.json, next.config,
#                          tsconfig.json, postcss.config, eslint.config,
#                          tailwind.config
#   has_lib_changes        src/lib/**, vitest.config.ts
#   has_api_changes        src/app/api/**, src/lib/**, mabl/postman/**
#   has_deps_changes       package*.json
#   has_workflows_changes  .github/workflows/**
#
# Usage:
#   ./detect-changes.sh [base-ref] [head-ref]
#
# Defaults:
#   base-ref: $GITHUB_BASE_REF (in PR context) or "main"
#   head-ref: HEAD

set -euo pipefail

BASE_REF="${1:-}"
HEAD_REF="${2:-HEAD}"

if [ -z "$BASE_REF" ]; then
  if [ -n "${GITHUB_BASE_REF:-}" ]; then
    BASE_REF="origin/${GITHUB_BASE_REF}"
  else
    BASE_REF="main"
  fi
fi

# ─── Get the diff ─────────────────────────────────────────────────────
# Use triple-dot (BASE...HEAD) to get changes UNIQUE to head — same
# semantics as a PR's "Files changed" view.
CHANGED=$(git diff --name-only "${BASE_REF}...${HEAD_REF}" 2>/dev/null || echo "")

if [ -z "$CHANGED" ]; then
  # Fallback: maybe we're on a detached HEAD or against an unrelated
  # base. Try double-dot which compares HEAD against BASE_REF directly.
  CHANGED=$(git diff --name-only "${BASE_REF}" "${HEAD_REF}" 2>/dev/null || echo "")
fi

# ─── Path patterns ────────────────────────────────────────────────────
APP_PATHS='^(src/|public/|package(-lock)?\.json|next\.config|tsconfig\.json|postcss\.config|eslint\.config|tailwind\.config)'
LIB_PATHS='^(src/lib/|vitest\.config\.ts)'
API_PATHS='^(src/app/api/|src/lib/|mabl/postman/)'
DEPS_PATHS='^package(-lock)?\.json$'
WORKFLOWS_PATHS='^\.github/workflows/'

# ─── Match each pattern ───────────────────────────────────────────────
match() {
  local pattern="$1"
  if echo "$CHANGED" | grep -qE "$pattern"; then
    echo "true"
  else
    echo "false"
  fi
}

has_app=$(match "$APP_PATHS")
has_lib=$(match "$LIB_PATHS")
has_api=$(match "$API_PATHS")
has_deps=$(match "$DEPS_PATHS")
has_workflows=$(match "$WORKFLOWS_PATHS")

# ─── Emit to GITHUB_OUTPUT (CI) and stdout (always) ───────────────────
emit() {
  local key="$1"
  local val="$2"
  echo "${key}=${val}"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "${key}=${val}" >> "$GITHUB_OUTPUT"
  fi
}

# Header for human readability
echo "# detect-changes.sh — base=$BASE_REF head=$HEAD_REF"
echo "# changed files ($(echo "$CHANGED" | wc -l | tr -d ' ')):"
if [ -n "$CHANGED" ]; then
  echo "$CHANGED" | sed 's/^/#   /'
fi
echo "# flags:"

emit "has_app_changes"       "$has_app"
emit "has_lib_changes"       "$has_lib"
emit "has_api_changes"       "$has_api"
emit "has_deps_changes"      "$has_deps"
emit "has_workflows_changes" "$has_workflows"

# Always succeed — this script reports state, never blocks.
exit 0
