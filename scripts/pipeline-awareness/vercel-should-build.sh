#!/usr/bin/env bash
#
# vercel-should-build.sh — Vercel "Ignored Build Step" wrapper.
#
# Set this script as the "Ignored Build Step" in Vercel project settings
# (Build & Development Settings → Ignored Build Step). Vercel calls it
# before every potential build to decide whether to actually run.
#
# Vercel uses INVERTED exit codes:
#   exit 0 = "ignore this build" — Vercel SKIPS the deploy
#   exit 1 = "do not ignore" — Vercel PROCEEDS with the deploy
#
# Decision logic: skip the build when no app-affecting files changed
# in the most recent commit. Saves Vercel build minutes on docs-only /
# workflow-only / config-only merges.
#
# Spec: TAMD-132.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Compare current commit against its parent (HEAD~1). Vercel's clone is often
# SHALLOW, so HEAD~1 may not exist — in which case the diff comes back empty,
# every change flag reads false, and we'd wrongly conclude "no app changes"
# and skip a real deploy (TAMD-174: this silently stranded prod on an old
# commit and is why earlier tickets needed manual "re-trigger deploy" commits).
#
# An ignore-build gate must FAIL OPEN: only skip on a POSITIVE "no app changes"
# result from a successfully computed diff. If we can't resolve the parent
# (even after trying to deepen the clone), build.
if ! git rev-parse --verify --quiet "HEAD~1^{commit}" >/dev/null 2>&1; then
  echo "HEAD~1 not present (shallow clone) — attempting to deepen…"
  git fetch --deepen=1 --quiet 2>/dev/null || true
fi
if ! git rev-parse --verify --quiet "HEAD~1^{commit}" >/dev/null 2>&1; then
  echo "⚠ Cannot resolve HEAD~1 — failing open (building) rather than skip."
  exit 1
fi

RESULTS=$("$SCRIPT_DIR/detect-changes.sh" HEAD~1 HEAD 2>&1 || true)

echo "$RESULTS"
echo ""

# Defensive: if detect-changes produced no parseable flag at all, fail open.
if ! echo "$RESULTS" | grep -qE "^has_app_changes=(true|false)$"; then
  echo "⚠ No determinate change result — failing open (building)."
  exit 1
fi

if echo "$RESULTS" | grep -qE "^has_app_changes=true$"; then
  echo "✓ App-affecting paths changed — proceeding with Vercel build."
  exit 1
else
  echo "✗ No app changes — skipping Vercel build to save minutes."
  echo "  (Set 'VERCEL_FORCE_BUILD=1' env var on the Vercel project to override.)"

  # Escape hatch: env var override
  if [ "${VERCEL_FORCE_BUILD:-0}" = "1" ]; then
    echo "  VERCEL_FORCE_BUILD=1 set — forcing build anyway."
    exit 1
  fi

  exit 0
fi
