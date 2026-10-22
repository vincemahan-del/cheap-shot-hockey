#!/usr/bin/env bash
#
# Demo mode is per browser, not global: ?demo=<mode> sets a csh_demo cookie
# on the browser that sent it, and only that browser sees the mode. This
# script cannot flip production for anyone else, including mabl runners.
#
# What it does: prints the URL that puts a browser (yours, or a mabl test
# whose start URL carries the query) into the mode, and checks the API
# answers as expected for a request carrying that mode.
#
# For a failure that mabl's plans actually catch, ship a real regression
# on a branch instead (see docs/SDLC-DEMO.md, Act 5).
#
# Usage:  ./scripts/demo-toggle.sh slow|flaky|broken|normal
# Env:    TARGET_URL (default https://cheap-shot-hockey.vercel.app)

set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" != "slow" && "$MODE" != "flaky" && "$MODE" != "broken" && "$MODE" != "normal" ]]; then
  echo "usage: $0 {slow|flaky|broken|normal}" >&2
  exit 2
fi

TARGET_URL="${TARGET_URL:-https://cheap-shot-hockey.vercel.app}"

echo "Demo mode is per browser. Nothing global changes."
echo "Open this in the browser that should see '$MODE':"
echo "  $TARGET_URL/?demo=$MODE"
echo
echo "API check with mode '$MODE':"
curl -sS -o /dev/null -w "  GET /api/products -> status=%{http_code} time=%{time_total}s\n" \
  "$TARGET_URL/api/products?demo=$MODE"
