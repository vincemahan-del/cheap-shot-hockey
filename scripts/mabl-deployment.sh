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
# Grace period for plan runs to be scheduled (mabl typically takes 10-60s).
# If still 0 plans matched the labels after this, FAIL: a deployment event
# that runs nothing must not report green. MABL_ALLOW_NO_PLANS=1 restores
# the old no-op behaviour for bootstrap phases.
NO_PLAN_GRACE="${MABL_NO_PLAN_GRACE:-120}"
no_plan_deadline=$(( $(date +%s) + NO_PLAN_GRACE ))
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

  # Response shape (GET /execution/result/event/{id}): plan_execution_metrics
  # {total,passed,failed,...} and executions[] with lowercase status values
  # (queued, scheduling, scheduled, succeeded, failed, cancelled, terminated,
  # completed). Fail if any plan failed, pass when every plan is terminal and
  # none failed, keep waiting otherwise.
  total=$(printf '%s' "$status_json" | jq '.plan_execution_metrics.total // (.executions | length) // 0')
  finished=$(printf '%s' "$status_json" | jq '[.executions[]? | select(.status=="succeeded" or .status=="failed" or .status=="cancelled" or .status=="terminated" or .status=="completed")] | length')
  failed=$(printf '%s' "$status_json" | jq '[.executions[]? | select(.status=="failed" or .status=="terminated" or .status=="cancelled" or .success==false)] | length')

  printf "  progress: %s/%s finished, %s failed\n" "$finished" "$total" "$failed"

  if [[ "$failed" != "0" ]]; then
    echo "$status_json" | jq '.executions[] | select(.status!="succeeded") | {plan: .plan.name, status, link: .plan_execution.app_href}'
    echo "❌ mabl runs failed"
    exit 1
  fi

  if [[ "$finished" == "$total" && "$total" != "0" ]]; then
    echo "$status_json" | jq '.executions[] | {plan: .plan.name, status}'
    echo "✅ all mabl runs passed"
    exit 0
  fi

  if [[ "$total" == "0" && "$now" -ge "$no_plan_deadline" ]]; then
    echo "⚠ no mabl plans matched label(s) '$LABELS' (event $event_id) after ${NO_PLAN_GRACE}s."
    if [[ "${MABL_ALLOW_NO_PLANS:-0}" == "1" ]]; then
      echo "  MABL_ALLOW_NO_PLANS=1 — treating as a no-op event and exiting 0."
      exit 0
    fi
    echo "  A gate that runs zero tests is not a passing gate. Enable the plan(s)" >&2
    echo "  carrying these labels in mabl, or set MABL_ALLOW_NO_PLANS=1 to opt out." >&2
    exit 1
  fi

  sleep 10
done
