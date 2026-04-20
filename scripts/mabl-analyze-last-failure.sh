#!/usr/bin/env bash
#
# Pulls the most recent failed plan execution and emits a Claude-ready
# summary. In a real pipeline this would POST a PR/Slack comment; here
# we just print to stdout so the demo driver can grab it.
#
# Requires: MABL_API_TOKEN, MABL_WORKSPACE_ID env vars.

set -euo pipefail

if [[ -z "${MABL_API_TOKEN:-}" || -z "${MABL_WORKSPACE_ID:-}" ]]; then
  echo "(skipping failure analysis — MABL_API_TOKEN/MABL_WORKSPACE_ID not set)"
  exit 0
fi

API_BASE="${MABL_API_BASE:-https://api.mabl.com}"
AUTH_HEADER="Authorization: Basic $(printf ':%s' "$MABL_API_TOKEN" | base64)"

# Newest plan executions, filtered to failures, take the top one.
latest_failed=$(
  curl -sS "$API_BASE/execution/result?organization_id=$MABL_WORKSPACE_ID&status=FAILED&limit=1" \
    -H "$AUTH_HEADER" \
    | jq -r '.items[0] // empty'
)

if [[ -z "$latest_failed" ]]; then
  echo "(no recent failures found)"
  exit 0
fi

plan_name=$(printf '%s' "$latest_failed" | jq -r '.plan_name // "(unknown)"')
test_name=$(printf '%s' "$latest_failed" | jq -r '.journey_executions[0].journey_name // "(unknown)"')
link=$(printf '%s' "$latest_failed" | jq -r '.app_url // .summary.link // "(no link)"')
failure_message=$(printf '%s' "$latest_failed" | jq -r '.journey_executions[0].failure_details.message // "(no message)"')

cat <<EOF
==== mabl failure analysis ====
plan:     $plan_name
journey:  $test_name
link:     $link
message:  $failure_message

Next: open the link, or pipe into an LLM with the mabl MCP analyze_failure tool
for a root-cause triage.
EOF
