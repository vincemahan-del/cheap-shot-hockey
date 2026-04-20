#!/usr/bin/env bash
#
# Flip the live demo mode by hitting any page with ?demo=<mode>. Useful
# for driving the "production incident" moment of the SDLC demo.
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
echo "🎛  flipping $TARGET_URL to demo mode: $MODE"
curl -sS -o /dev/null -w "status=%{http_code}\n" "$TARGET_URL/?demo=$MODE"
echo "   (mode persists for 60 min via csh_demo cookie)"
