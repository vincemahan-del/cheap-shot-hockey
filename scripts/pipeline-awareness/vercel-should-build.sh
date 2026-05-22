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

# Compare current commit against its parent. Vercel runs this from the
# repo root with full git history available, so HEAD~1 is the previous
# tip of the branch we're considering deploying.
RESULTS=$("$SCRIPT_DIR/detect-changes.sh" HEAD~1 HEAD 2>&1 || true)

echo "$RESULTS"
echo ""

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
