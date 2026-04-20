#!/usr/bin/env bash
#
# Trigger a mabl deployment event and optionally wait for the run to finish.
#
# Usage:
#   ./scripts/mabl-deployment.sh \
#     --environment <env_id> \
#     --application <app_id> \
#     --labels <label> \
#     [--url <deploy_url>] \
#     [--commit <sha>] \
#     [--branch <name>] \
#     [--wait] [--timeout 1200]
#
# Requires MABL_API_TOKEN env var. Mabl's API uses HTTP Basic with a blank
# username and the API token as the password — see
# https://help.mabl.com/hc/en-us/articles/360039473792
#
# The deployment event endpoint is the standard CI hook used by every
# mabl customer. It kicks off any plans whose labels match.

set -euo pipefail

LABELS=""
APPLICATION_ID=""
ENVIRONMENT_ID=""
URL=""
COMMIT="${GIT_COMMIT_SHORT:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}"
BRANCH="${GIT_BRANCH_NAME:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)}"
WAIT=0
TIMEOUT=1200

while [[ $# -gt 0 ]]; do
  case "$1" in
    --environment)  ENVIRONMENT_ID="$2"; shift 2 ;;
    --application)  APPLICATION_ID="$2"; shift 2 ;;
    --labels)       LABELS="$2";         shift 2 ;;
    --url)          URL="$2";            shift 2 ;;
    --commit)       COMMIT="$2";         shift 2 ;;
    --branch)       BRANCH="$2";         shift 2 ;;
    --wait)         WAIT=1;              shift   ;;
    --timeout)      TIMEOUT="$2";        shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "${MABL_API_TOKEN:-}" ]]; then
  echo "error: MABL_API_TOKEN env var is required" >&2
  exit 2
fi
if [[ -z "$ENVIRONMENT_ID" && -z "$APPLICATION_ID" ]]; then
  echo "error: --environment or --application (or both) required" >&2
  exit 2
fi

API_BASE="${MABL_API_BASE:-https://api.mabl.com}"
AUTH_HEADER="Authorization: Basic $(printf ':%s' "$MABL_API_TOKEN" | base64)"

payload=$(
  jq -nc \
    --arg env  "$ENVIRONMENT_ID" \
    --arg app  "$APPLICATION_ID" \
    --arg rev  "$COMMIT" \
    --arg br   "$BRANCH" \
    --arg url  "$URL" \
    --argjson labels "$(printf '%s' "$LABELS" | jq -R 'split(",")')" \
    '{
      environment_id: ($env | select(length>0)),
      application_id: ($app | select(length>0)),
      plan_labels:    ($labels | map(select(length>0))),
      revision:       $rev,
      properties: {
        app_version: $rev,
        branch:      $br,
        deploy_url:  $url
      }
    } | del(..|nulls)'
)

echo "▶ triggering mabl deployment event"
echo "  labels=$LABELS env=$ENVIRONMENT_ID app=$APPLICATION_ID url=$URL commit=$COMMIT branch=$BRANCH"

response=$(
  curl -sS -X POST "$API_BASE/events/deployment" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    --data "$payload"
)

event_id=$(printf '%s' "$response" | jq -r '.id // .event_id // empty')
if [[ -z "$event_id" ]]; then
  echo "error: no event id in response:" >&2
  echo "$response" >&2
  exit 1
fi

echo "✓ mabl deployment event: $event_id"

if [[ "$WAIT" != "1" ]]; then
  echo "$event_id"
  exit 0
fi

echo "⏳ polling for plan execution completion…"
deadline=$(( $(date +%s) + TIMEOUT ))
# Short grace period for plans to appear if any match. If still 0 plans
# matched the labels after this, we exit cleanly — that's a no-op
# deployment event, not a failure. (Avoids infinite wait when labels
# haven't been attached to plans yet.)
no_plan_deadline=$(( $(date +%s) + 60 ))
while :; do
  now=$(date +%s)
  if (( now >= deadline )); then
    echo "error: timed out after ${TIMEOUT}s waiting for mabl runs" >&2
    exit 1
  fi

  status_json=$(
    curl -sS "$API_BASE/execution/result/event/$event_id" \
      -H "$AUTH_HEADER"
  )

  # The response has an array of plan executions. We fail if any failed,
  # pass if they're all passing, and keep waiting otherwise.
  total=$(printf '%s' "$status_json" | jq '.plan_execution_count // (.plan_executions | length // 0)')
  finished=$(printf '%s' "$status_json" | jq '[.plan_executions[]? | select(.status=="PASSED" or .status=="FAILED" or .status=="CANCELLED" or .status=="SKIPPED")] | length')
  failed=$(printf '%s' "$status_json" | jq '[.plan_executions[]? | select(.status=="FAILED")] | length')

  printf "  progress: %s/%s finished, %s failed\n" "$finished" "$total" "$failed"

  if [[ "$failed" != "0" ]]; then
    echo "$status_json" | jq '.plan_executions[] | select(.status=="FAILED") | {plan_name, status, app_url: .application_url, link: .summary.link}'
    echo "❌ mabl runs failed"
    exit 1
  fi

  if [[ "$finished" == "$total" && "$total" != "0" ]]; then
    echo "$status_json" | jq '.plan_executions[] | {plan_name, status}'
    echo "✅ all mabl runs passed"
    exit 0
  fi

  if [[ "$total" == "0" && "$now" -ge "$no_plan_deadline" ]]; then
    echo "⚠ no mabl plans matched label(s) '$LABELS' (event $event_id)."
    echo "  Pipeline exiting successfully — the deployment event was accepted,"
    echo "  but no plans are configured for this label yet. Create plans in"
    echo "  the mabl UI and attach the label to enable gating."
    exit 0
  fi

  sleep 10
done
