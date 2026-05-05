#!/usr/bin/env bash
# mabl-cloud-minutes.sh — best-effort capture of mabl cloud minutes
# consumed in a given time window, for inclusion in the cost +
# cycle-time receipt (cycle-time-receipt.sh).
#
# Strategy: query mabl's REST API for plan runs (deployment events)
# in the window, sum their execution durations, output single-line
# "MABL_CLOUD_MINUTES=<value>" for the receipt to source.
#
# Strictly deterministic — no LLM calls. Falls back to "n/a" with a
# diagnostic stderr message if the endpoint isn't available or
# returns no data, so the receipt itself never breaks.
#
# Usage:
#   ./scripts/mabl-cloud-minutes.sh <start-iso> [end-iso]
#
# Required env:
#   MABL_API_TOKEN        — same token used by mabl-deployment.sh
#   MABL_APPLICATION_ID   — scope the query to this application
# Optional env:
#   MABL_API_BASE         — defaults to https://api.mabl.com
#
# Output (stdout, single line):
#   MABL_CLOUD_MINUTES=<human-readable>
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
  echo "MABL_CLOUD_MINUTES=n/a"
  echo "  mabl-cloud-minutes: $1" >&2
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

# Sum executionDuration / duration_ms across common response shapes
total_ms=$(echo "$response" | jq -r '
  def sumDurations(arr): [arr[] | (.executionDuration // .duration_ms // 0)] | add // 0;
  if type == "array" then sumDurations(.)
  elif .events then sumDurations(.events)
  elif .results then sumDurations(.results)
  elif .data then sumDurations(.data)
  else 0 end
' 2>/dev/null)

run_count=$(echo "$response" | jq -r '
  if type == "array" then length
  elif .events then (.events | length)
  elif .results then (.results | length)
  elif .data then (.data | length)
  else 0 end
' 2>/dev/null)

if [ -z "$total_ms" ] || [ "$total_ms" = "null" ] || [ "$total_ms" = "0" ]; then
  echo "MABL_CLOUD_MINUTES=0m (no runs in window)"
  exit 0
fi

total_seconds=$((total_ms / 1000))
if [ "$total_seconds" -lt 60 ]; then
  human="${total_seconds}s"
else
  mins=$((total_seconds / 60))
  secs=$((total_seconds % 60))
  human="${mins}m ${secs}s"
fi

echo "MABL_CLOUD_MINUTES=${human} across ${run_count} runs"
