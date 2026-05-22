#!/usr/bin/env bash
# mabl-local-cli.sh — local browser-layer gate via the mabl CLI.
#
# Complements `mabl-local-gate.sh` (which is API-only newman/Postman).
# This script wraps `mabl tests run` headlessly so the local DoD pass
# fires real browser tests — particularly important when the
# MABL_CLOUD_GATE repo variable is set to `disabled`, which short-
# circuits the cloud plan and leaves CI without any browser-layer
# coverage for PRs that don't touch a tier-4 area pattern.
#
# Passes `--allow-billable-features` so GenAI assertions in mabl tests
# actually execute (mabl CLI gates them by default — see TAMD-126 catalog
# test failure as an example).
#
# Usage:
#   ./scripts/mabl-local-cli.sh                          # all type-rt tests
#                                                        # against localhost:3000
#   ./scripts/mabl-local-cli.sh --url <url>              # override target
#   ./scripts/mabl-local-cli.sh --id <test-id>           # run single test by id
#   ./scripts/mabl-local-cli.sh --labels type-rt,area-X  # custom labels
#   ./scripts/mabl-local-cli.sh --plan-id <plan-id>      # run all tests from a plan
#
# Any additional flags pass through to `mabl tests run`.
#
# Required:
#   - mabl CLI installed (`brew install mablhq/tap/mabl` or `npm i -g mabl-cli`)
#   - mabl authenticated (`mabl auth login` or `mabl auth activate-key <key>`)
#
# Optional env:
#   MABL_APPLICATION_ID — defaults to the documented Cheap Shot Hockey app
#                         (OZqmshBkUfVSesWy49g1eQ-a per CLAUDE.md)
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
APPLICATION_ID="${MABL_APPLICATION_ID:-OZqmshBkUfVSesWy49g1eQ-a}"

# Parse our flags vs passthrough. We consume --url here so callers can
# point at preview/prod URLs; everything else passes straight to mabl.
PASSTHROUGH=()
HAS_TEST_SELECTOR=0
while [ $# -gt 0 ]; do
  case "$1" in
    --url|-u)
      BASE_URL="$2"; shift 2 ;;
    --id|--from-plan-id|--labels)
      HAS_TEST_SELECTOR=1
      PASSTHROUGH+=("$1" "$2"); shift 2 ;;
    *)
      PASSTHROUGH+=("$1"); shift ;;
  esac
done

# Default test selector: all regression-tier tests if caller didn't pick.
if [ "$HAS_TEST_SELECTOR" -eq 0 ]; then
  PASSTHROUGH+=("--labels" "type-rt")
fi

# Preflight: mabl CLI present.
if ! command -v mabl >/dev/null 2>&1; then
  echo "❌ mabl CLI not found." >&2
  echo "   Install: brew install mablhq/tap/mabl  (or: npm i -g mabl-cli)" >&2
  exit 127
fi

# Preflight: mabl authenticated.
if ! mabl auth info >/dev/null 2>&1; then
  echo "❌ mabl CLI not authenticated." >&2
  echo "   Run: mabl auth login  (or: mabl auth activate-key <api-key>)" >&2
  exit 4
fi

# Preflight: target URL reachable. Skip the health check when running
# against prod since the health endpoint shape may differ — the mabl
# runner itself will report load failures clearly.
if [[ "$BASE_URL" == *localhost* ]] || [[ "$BASE_URL" == *127.0.0.1* ]]; then
  if ! curl -fsS -m 3 "$BASE_URL" >/dev/null 2>&1; then
    echo "❌ target unreachable at $BASE_URL" >&2
    echo "   Start the dev server: npm run dev" >&2
    exit 3
  fi
fi

echo "🏒 T2 mabl local CLI gate — running browser tests against $BASE_URL"
echo "   selector: ${PASSTHROUGH[*]}"
echo "   billable features: enabled (GenAI assertions will execute)"
echo

# Pass through all flags after our consumed ones.
exec mabl tests run \
  --headless \
  --reporter mabl \
  --allow-billable-features \
  --application-id "$APPLICATION_ID" \
  --url "$BASE_URL" \
  "${PASSTHROUGH[@]}"
