#!/usr/bin/env bash
# mabl-local-gate.sh — T1 pre-push gate.
#
# Runs the API smoke suite locally via newman against localhost:3000.
# Exits non-zero on any assertion failure — suitable as a git pre-push hook,
# a `make` target, or an explicit `npm run test:mabl:local` step.
#
# The collection mirrors the mabl cloud CSH-SMOKE-API plan so what passes
# locally is what runs against Preview (T2) and Prod (T3) in the cloud.
#
# Usage:
#   ./scripts/mabl-local-gate.sh                 # default: localhost:3000
#   ./scripts/mabl-local-gate.sh --base <url>    # override base URL
#   ./scripts/mabl-local-gate.sh --collection <f>  # override collection file
set -euo pipefail

BASE_URL="http://localhost:3000/api"
COLLECTION="mabl/postman/csh-api-smoke.postman_collection.json"
REPORTERS="cli"

while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE_URL="$2"; shift 2 ;;
    --collection) COLLECTION="$2"; shift 2 ;;
    --reporters) REPORTERS="$2"; shift 2 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

# Resolve repo root so this works whether invoked from root or from a hook.
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if ! command -v newman >/dev/null 2>&1; then
  # Try npx as a fallback (no global install required).
  if command -v npx >/dev/null 2>&1; then
    NEWMAN_CMD="npx --yes newman"
  else
    echo "❌ newman not found and npx unavailable." >&2
    echo "   Install: npm i -g newman  (or add as devDep and run via npx)" >&2
    exit 127
  fi
else
  NEWMAN_CMD="newman"
fi

if [ ! -f "$COLLECTION" ]; then
  echo "❌ collection not found: $COLLECTION" >&2
  exit 2
fi

# Health preflight: is the dev server actually reachable?
# Prevents the whole newman run from failing with confusing ECONNREFUSED noise.
if ! curl -fsS -m 3 "$BASE_URL/health" >/dev/null 2>&1; then
  echo "❌ dev server unreachable at $BASE_URL/health" >&2
  echo "   Start it: npm run dev" >&2
  exit 3
fi

echo "🏒 T1 mabl local gate — running against $BASE_URL"
echo "   collection: $COLLECTION"
echo

$NEWMAN_CMD run "$COLLECTION" \
  --env-var "baseUrl=$BASE_URL" \
  --reporters "$REPORTERS" \
  --color on \
  --timeout-request 5000

# newman exits non-zero on any assertion failure — pass it through so the hook
# (or CI) knows to block the push.
