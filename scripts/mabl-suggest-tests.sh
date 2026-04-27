#!/usr/bin/env bash
#
# Queries mabl for tests relevant to a set of changed files and prints
# suggestions. Called by the pre-push git hook and the GHA test-impact job.
#
# Two modes:
#   1. mabl API mode — when MABL_API_TOKEN + MABL_WORKSPACE_ID are set.
#      Pulls live test names from the workspace and matches by keyword.
#   2. Heuristic fallback — when those env vars aren't available
#      (typical on a developer laptop). Uses a static path → test
#      mapping. Less precise but always available.
#
# Usage: pipe changed file paths via stdin, or pass as first argument
#   echo "src/components/Footer.tsx" | ./scripts/mabl-suggest-tests.sh
#   git diff --name-only main | ./scripts/mabl-suggest-tests.sh
#
# Optional env: MABL_API_TOKEN, MABL_WORKSPACE_ID, MABL_APPLICATION_ID,
#               MABL_API_BASE

set -uo pipefail

API_BASE="${MABL_API_BASE:-https://api.mabl.com}"

# Fallback heuristic: map common path patterns to known mabl tests in
# this workspace. Update alongside docs/MABL-API-TESTS.md and
# docs/MABL-UI-TESTS.md as the test catalog grows.
heuristic_suggest() {
  local path="$1"
  case "$path" in
    src/app/page.tsx|src/app/layout.tsx|src/components/Nav.tsx|src/components/Footer.tsx|src/components/PromoStrip.tsx)
      echo "CSH-CHP-CHECKOUT-UI-CustomerPlacesOrderEndToEnd"
      echo "CSH-SMK-HEALTH-API-ReturnsOkStatus"
      ;;
    src/app/cart/*|src/lib/cart-cookie.ts|src/lib/store.ts)
      echo "CSH-CHP-CHECKOUT-UI-CustomerPlacesOrderEndToEnd"
      echo "CSH-CHP-CHECKOUT-API-CustomerPlacesOrderEndToEnd"
      ;;
    src/app/checkout/*|src/app/api/orders/*|src/lib/order-cookie.ts|src/lib/guest-orders.ts)
      echo "CSH-CHP-CHECKOUT-UI-CustomerPlacesOrderEndToEnd"
      echo "CSH-CHP-CHECKOUT-API-CustomerPlacesOrderEndToEnd"
      ;;
    src/app/products/*|src/app/api/products/*|src/components/ProductCard.tsx|src/components/ProductThumb.tsx|src/components/CategoryTile.tsx)
      echo "CSH-CHP-CHECKOUT-UI-CustomerPlacesOrderEndToEnd"
      echo "CSH-CHP-CHECKOUT-API-CustomerPlacesOrderEndToEnd"
      ;;
    src/app/login/*|src/app/api/auth/*|src/lib/auth*|src/lib/session.ts|src/middleware.ts)
      echo "CSH-CHP-CHECKOUT-UI-CustomerPlacesOrderEndToEnd"
      echo "CSH-CHP-CHECKOUT-API-CustomerPlacesOrderEndToEnd"
      ;;
    src/app/api/health/*|src/app/api/build-info/*)
      echo "CSH-SMK-HEALTH-API-ReturnsOkStatus"
      echo "CSH-SMK-BUILD-API-BuildInfoReflectsCommit"
      ;;
    src/app/api/*)
      echo "CSH-SMK-HEALTH-API-ReturnsOkStatus"
      echo "CSH-CHP-CHECKOUT-API-CustomerPlacesOrderEndToEnd"
      ;;
    src/lib/seed.ts|src/lib/types.ts|src/lib/api.ts|src/lib/format.ts|src/lib/brand.ts)
      echo "CSH-CHP-CHECKOUT-UI-CustomerPlacesOrderEndToEnd"
      echo "CSH-CHP-CHECKOUT-API-CustomerPlacesOrderEndToEnd"
      ;;
    src/components/*)
      echo "CSH-CHP-CHECKOUT-UI-CustomerPlacesOrderEndToEnd"
      ;;
    .github/workflows/*|Jenkinsfile|scripts/mabl-deployment.sh|scripts/ci-notify.sh|scripts/mabl-local-gate.sh|mabl/postman/*.json|vitest.config.ts|next.config.*)
      echo "CSH-SMK-HEALTH-API-ReturnsOkStatus"
      echo "CSH-SMK-BUILD-API-BuildInfoReflectsCommit"
      echo "CSH-CHP-CHECKOUT-API-CustomerPlacesOrderEndToEnd"
      echo "CSH-CHP-CHECKOUT-UI-CustomerPlacesOrderEndToEnd"
      ;;
  esac
}

# Decide which mode to run in
USE_API=0
if [[ -n "${MABL_API_TOKEN:-}" && -n "${MABL_WORKSPACE_ID:-}" ]]; then
  USE_API=1
  AUTH_HEADER="Authorization: Basic $(printf ':%s' "$MABL_API_TOKEN" | base64)"
  APP_PARAM="${MABL_APPLICATION_ID:+&application_id=${MABL_APPLICATION_ID}}"
fi

# Accept file list from first arg or stdin
if [[ $# -gt 0 ]]; then
  changed_files="$1"
else
  changed_files=$(cat)
fi

[[ -z "$changed_files" ]] && exit 0

# Plain-array dedupe — works on bash 3.2 (macOS default).
# Append all suggestions, then sort -u at print time.
suggestions=""
mode_label="heuristic mapping"

if [[ "$USE_API" -eq 1 ]]; then
  # Extract keywords from file paths (base name + meaningful parent dir)
  keywords=""
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    base=$(basename "$f" | sed 's/\.[^.]*$//')
    parent=$(dirname "$f" | xargs basename 2>/dev/null || true)
    [[ -n "$base" && "$base" != "." ]] && keywords+="${base}"$'\n'
    case "${parent:-}" in
      .|src|app|lib|components|api|''|pages|hooks|utils) ;;
      *) keywords+="${parent}"$'\n' ;;
    esac
  done <<< "$changed_files"

  if [[ -n "$keywords" ]]; then
    all_tests=$(
      curl -fsS "${API_BASE}/testing/runsets?workspace_id=${MABL_WORKSPACE_ID}${APP_PARAM}" \
        -H "$AUTH_HEADER" 2>/dev/null
    ) || all_tests=""

    if [[ -n "$all_tests" ]] && echo "$all_tests" | jq -e '.runsets // empty' >/dev/null 2>&1; then
      mode_label="live mabl API"
      while IFS= read -r kw; do
        [[ -z "$kw" ]] && continue
        matches=$(echo "$all_tests" | jq -r --arg kw "$kw" \
          '.runsets[]? | select(.name | ascii_downcase | contains($kw | ascii_downcase)) | .name' \
          2>/dev/null || true)
        [[ -n "$matches" ]] && suggestions+="${matches}"$'\n'
      done <<< "$keywords"
    fi
  fi
fi

# Heuristic fallback if API mode produced nothing (or was skipped)
if [[ -z "$suggestions" ]]; then
  mode_label="heuristic mapping"
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    h=$(heuristic_suggest "$f")
    [[ -n "$h" ]] && suggestions+="${h}"$'\n'
  done <<< "$changed_files"
fi

# Dedupe + filter blank lines
unique=$(printf '%s' "$suggestions" | sort -u | grep -v '^$' || true)

if [[ -z "$unique" ]]; then
  echo "  (no specific mabl tests mapped to your changes — CSH-SMOKE-PR plan still covers the smoke surface)"
  exit 0
fi

echo "  These mabl tests may be affected by your changes (source: $mode_label):"
echo ""
while IFS= read -r t; do
  echo "    • $t"
done <<< "$unique"
echo ""
echo "  Run locally: npm run test:mabl:local"
echo "  Cloud gate (CSH-SMOKE-PR) runs automatically on PR push."
