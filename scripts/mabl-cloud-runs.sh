#!/usr/bin/env bash
# mabl-cloud-runs.sh — best-effort capture of the *count* of mabl cloud
# plan runs in a given time window, for inclusion in the cost +
# cycle-time receipt (cycle-time-receipt.sh).
#
# Why count, not minutes: mabl pricing varies by tier (per-run, per-min,
# bundled credits, overage rates that change). Hardcoding `runs × $X`
# goes stale within a quarter. The durable signal is **how many cloud
# plan runs this PR triggered**; whoever reads the receipt multiplies
# by their current rate.
#
# Local CLI runs (`mabl tests run --headless …`) don't post deployment
# events to mabl cloud — they're free and already excluded by this
# query. This counts cloud-billable runs only.
#
# Strategy: query mabl's REST API for plan-run / deployment events in
# the window, count them, output single-line "MABL_CLOUD_RUNS=<value>"
# for the receipt to source.
#
# Strictly deterministic — no LLM calls. Falls back to "n/a" with a
# diagnostic stderr message if the endpoint isn't available or
# returns no data, so the receipt itself never breaks.
#
# Usage:
#   ./scripts/mabl-cloud-runs.sh <start-iso> [end-iso]
#
# Required env:
#   MABL_API_TOKEN        — same token used by mabl-deployment.sh
#   MABL_APPLICATION_ID   — scope the query to this application
# Optional env:
#   MABL_API_BASE         — defaults to https://api.mabl.com
#
# Output (stdout, single line):
#   MABL_CLOUD_RUNS=<count>
#
# v1.1 NOTE: the exact mabl REST list-endpoint shape varies by tier
# and API version. The endpoint guess below is based on the patterns
# in scripts/mabl-deployment.sh (which uses /events/deployment for
# create + /execution/result/event/<id> for per-event results). If
# your mabl plan tier exposes a different list endpoint, swap the
# URL in MABL_LIST_ENDPOINT below — the rest of the parsing handles
# common response shapes.

set -uo pipefail

start_iso="${1:-}"
end_iso="${2:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"

API_BASE="${MABL_API_BASE:-https://api.mabl.com}"

emit_na() {
  echo "MABL_CLOUD_RUNS=n/a"
  echo "  mabl-cloud-runs: $1" >&2
  exit 0
}

[ -z "${MABL_API_TOKEN:-}" ] && emit_na "MABL_API_TOKEN not set"
[ -z "${MABL_APPLICATION_ID:-}" ] && emit_na "MABL_APPLICATION_ID not set"
[ -z "$start_iso" ] && emit_na "missing start_iso argument"

auth_header="Authorization: Basic $(printf ':%s' "$MABL_API_TOKEN" | base64)"

# v1.1 endpoint guess — verify against your mabl tier and adjust if
# response is empty or 404.
MABL_LIST_ENDPOINT="${MABL_API_BASE}/events/deployment?application_id=${MABL_APPLICATION_ID}&from=${start_iso}&to=${end_iso}"

response=$(curl -sS -H "$auth_header" "$MABL_LIST_ENDPOINT" 2>&1) || \
  emit_na "curl failed: $(echo "$response" | head -1)"

# Fast-fail on obvious non-JSON / error pages
if ! echo "$response" | jq -e . >/dev/null 2>&1; then
  emit_na "endpoint returned non-JSON (possible 404 or auth issue) — verify MABL_LIST_ENDPOINT"
fi

# Count plan runs across common response shapes
run_count=$(echo "$response" | jq -r '
  if type == "array" then length
  elif .events then (.events | length)
  elif .results then (.results | length)
  elif .data then (.data | length)
  else 0 end
' 2>/dev/null)

if [ -z "$run_count" ] || [ "$run_count" = "null" ]; then
  emit_na "could not parse run count from response"
fi

if [ "$run_count" = "0" ]; then
  echo "MABL_CLOUD_RUNS=0 (no cloud runs in window)"
  exit 0
fi

# Singular vs plural
if [ "$run_count" = "1" ]; then
  echo "MABL_CLOUD_RUNS=1 cloud run"
else
  echo "MABL_CLOUD_RUNS=${run_count} cloud runs"
fi
