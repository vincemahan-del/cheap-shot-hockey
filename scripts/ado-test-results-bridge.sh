#!/usr/bin/env bash
# ado-test-results-bridge.sh — bridge mabl test results into Azure DevOps
# Test Plans, giving customers the same Test Case traceability that
# code-bound frameworks (Selenium / NUnit / Playwright) get natively.
#
# Why this exists: mabl doesn't ship a native ADO Test Plans connector
# today. Customers integrating mabl with Azure DevOps and using ADO Test
# Plans for traceability need a pipeline-side bridge that:
#   1. Reads each mabl test's labels to find an ADO Test Case ID
#      (convention: a label of the form `ado-tc-<id>`, e.g. `ado-tc-1234`)
#   2. Polls mabl REST `/execution/result/event/<id>` for per-test
#      pass/fail outcomes
#   3. Creates an ADO Test Run + posts results, mapping each mabl test
#      back to its `ado-tc-<id>` Test Case
#
# Strictly deterministic — no LLM calls. Runs as a final stage in the
# Azure Pipeline after `mabl-deployment.sh` has completed and produced
# a deployment event id.
#
# Usage:
#   ./scripts/ado-test-results-bridge.sh
#
# Required env (must be set by the pipeline):
#   MABL_API_TOKEN            — same token used by mabl-deployment.sh
#   MABL_DEPLOYMENT_EVENT_ID  — output from mabl-deployment.sh (the
#                               deployment event whose results we want)
#   ADO_ORG_URL               — e.g. https://dev.azure.com/myorg
#   ADO_PROJECT               — Azure DevOps project name (URL-encoded if
#                               contains spaces)
#   ADO_PAT                   — Azure DevOps Personal Access Token with
#                               "Test Management (Read & Write)" scope
#
# Optional env:
#   MABL_API_BASE             — defaults to https://api.mabl.com
#   ADO_API_VERSION           — defaults to 7.1 (lock this against drift)
#   ADO_TEST_RUN_NAME         — defaults to "mabl run <event-id-prefix>"
#   ADO_TEST_PLAN_ID          — optional, links the run to an ADO Test
#                               Plan (otherwise the run is unattached)
#
# Exit codes:
#   0 — bridge completed (results posted, OR no ado-tc-* labels found)
#   1 — fatal misconfiguration (missing required env)
#   2 — mabl API call failed
#   3 — ADO API call failed
#
# Customer adoption notes:
#   - Tag your mabl tests with a label like `ado-tc-1234` where 1234 is
#     the ADO Test Case ID. Tests without an `ado-tc-*` label are
#     skipped (not an error — they just don't have ADO traceability).
#   - The ADO PAT needs Test Management read+write. Vso PATs are
#     org-scoped; create one per project if you want least-privilege.
#   - Lock `ADO_API_VERSION=7.1` (or whatever the script was tested
#     against) so a future ADO REST API breaking change doesn't silently
#     drift your bridge.

set -uo pipefail

# ──────────────────────────────────────────────────────────────────
# 0. Validate required env
# ──────────────────────────────────────────────────────────────────
require_env() {
  local var="$1"
  if [ -z "${!var:-}" ]; then
    echo "ado-test-results-bridge: missing required env: $var" >&2
    exit 1
  fi
}

require_env MABL_API_TOKEN
require_env MABL_DEPLOYMENT_EVENT_ID
require_env ADO_ORG_URL
require_env ADO_PROJECT
require_env ADO_PAT

MABL_API_BASE="${MABL_API_BASE:-https://api.mabl.com}"
ADO_API_VERSION="${ADO_API_VERSION:-7.1}"
ADO_TEST_RUN_NAME="${ADO_TEST_RUN_NAME:-mabl run ${MABL_DEPLOYMENT_EVENT_ID:0:8}}"

mabl_auth_header="Authorization: Basic $(printf ':%s' "$MABL_API_TOKEN" | base64)"
ado_auth_header="Authorization: Basic $(printf ':%s' "$ADO_PAT" | base64)"

# Strip trailing slash off ADO_ORG_URL if present, for clean URL composition
ADO_ORG_URL="${ADO_ORG_URL%/}"
ADO_BASE="${ADO_ORG_URL}/${ADO_PROJECT}/_apis/test"

# ──────────────────────────────────────────────────────────────────
# 1. Pull mabl per-test results for the deployment event
# ──────────────────────────────────────────────────────────────────
echo "ado-bridge: fetching mabl results for event ${MABL_DEPLOYMENT_EVENT_ID}…"

mabl_response=$(curl -sS -H "$mabl_auth_header" \
  "${MABL_API_BASE}/execution/result/event/${MABL_DEPLOYMENT_EVENT_ID}" 2>&1) || {
  echo "ado-bridge: mabl API call failed: $mabl_response" >&2
  exit 2
}

if ! echo "$mabl_response" | jq -e . >/dev/null 2>&1; then
  echo "ado-bridge: mabl returned non-JSON (auth or 404 likely):" >&2
  echo "$mabl_response" | head -5 >&2
  exit 2
fi

# ──────────────────────────────────────────────────────────────────
# 2. Extract per-test outcomes + ADO Test Case IDs from labels
#
# mabl response shape varies slightly by API version; we handle the
# two most common shapes (executions[] and journey_executions[]). Each
# test result needs:
#   - status (PASSED / FAILED / SKIPPED-equivalent)
#   - labels[] containing an `ado-tc-<id>` entry
# ──────────────────────────────────────────────────────────────────
test_results=$(echo "$mabl_response" | jq -r '
  def collect:
    (.executions // .journey_executions // .plan_executions // []) ;
  collect
  | map({
      mabl_test_id: (.id // .journey_id // .test_id // ""),
      mabl_test_name: (.name // .journey_name // .test_name // "unnamed"),
      status: ((.status // .last_execution_status // .result // "UNKNOWN") | ascii_upcase),
      labels: (.labels // [])
    })
  | map(. + { ado_tc_id: (.labels | map(select(startswith("ado-tc-"))) | .[0] // "" | ltrimstr("ado-tc-")) })
  | map(select(.ado_tc_id != ""))
')

result_count=$(echo "$test_results" | jq -r 'length')

if [ "$result_count" = "0" ] || [ -z "$result_count" ]; then
  echo "ado-bridge: no mabl tests with ado-tc-* labels found in event ${MABL_DEPLOYMENT_EVENT_ID:0:8}"
  echo "ado-bridge: tag mabl tests with a label like 'ado-tc-1234' to enable ADO Test Case traceability"
  exit 0
fi

echo "ado-bridge: found ${result_count} mabl tests with ADO Test Case mappings"

# ──────────────────────────────────────────────────────────────────
# 3. Create an ADO Test Run
#
# POST /test/Runs?api-version=7.1
#   { "name": "...", "automated": true, "plan": { "id": "<plan-id>" } }
# Returns: { "id": <runId>, ... }
# ──────────────────────────────────────────────────────────────────
run_payload=$(jq -n \
  --arg name "$ADO_TEST_RUN_NAME" \
  --arg plan_id "${ADO_TEST_PLAN_ID:-}" \
  '{
    name: $name,
    automated: true
  } + (if $plan_id != "" then { plan: { id: $plan_id } } else {} end)')

create_run_response=$(curl -sS -X POST \
  -H "$ado_auth_header" \
  -H "Content-Type: application/json" \
  -d "$run_payload" \
  "${ADO_BASE}/Runs?api-version=${ADO_API_VERSION}" 2>&1) || {
  echo "ado-bridge: ADO create-run failed: $create_run_response" >&2
  exit 3
}

run_id=$(echo "$create_run_response" | jq -r '.id // empty')

if [ -z "$run_id" ]; then
  echo "ado-bridge: ADO did not return a run id; raw response:" >&2
  echo "$create_run_response" | head -10 >&2
  exit 3
fi

echo "ado-bridge: created ADO Test Run ${run_id}"

# ──────────────────────────────────────────────────────────────────
# 4. POST per-test results
#
# POST /test/Runs/{runId}/results?api-version=7.1
#   [ { "testCase": { "id": <tcId> }, "outcome": "Passed|Failed|...",
#       "state": "Completed", "automatedTestName": "..." }, ... ]
# Outcome must be one of: Unspecified, None, Passed, Failed, Inconclusive,
# Timeout, Aborted, Blocked, NotExecuted, Warning, Error, NotApplicable, Paused
# ──────────────────────────────────────────────────────────────────
results_payload=$(echo "$test_results" | jq -c '
  def map_outcome(s):
    if s == "PASSED" or s == "PASS" then "Passed"
    elif s == "FAILED" or s == "FAIL" then "Failed"
    elif s == "SKIPPED" or s == "SKIP" then "NotExecuted"
    elif s == "TIMEOUT" then "Timeout"
    elif s == "ABORTED" or s == "CANCELLED" then "Aborted"
    elif s == "ERROR" then "Error"
    else "Inconclusive"
    end ;
  map({
    testCase: { id: (.ado_tc_id | tonumber? // .ado_tc_id) },
    outcome: map_outcome(.status),
    state: "Completed",
    automatedTestName: .mabl_test_name,
    automatedTestId: .mabl_test_id,
    comment: ("mabl test \(.mabl_test_id) — \(.status)")
  })
')

post_results_response=$(curl -sS -X POST \
  -H "$ado_auth_header" \
  -H "Content-Type: application/json" \
  -d "$results_payload" \
  "${ADO_BASE}/Runs/${run_id}/results?api-version=${ADO_API_VERSION}" 2>&1) || {
  echo "ado-bridge: ADO post-results failed: $post_results_response" >&2
  # Try to close the run before exiting so we don't leave it in InProgress
  curl -sS -X PATCH \
    -H "$ado_auth_header" \
    -H "Content-Type: application/json" \
    -d '{"state":"Aborted"}' \
    "${ADO_BASE}/Runs/${run_id}?api-version=${ADO_API_VERSION}" >/dev/null 2>&1
  exit 3
}

# ──────────────────────────────────────────────────────────────────
# 5. Mark the run Completed
#
# PATCH /test/Runs/{runId}?api-version=7.1
#   { "state": "Completed" }
# ──────────────────────────────────────────────────────────────────
curl -sS -X PATCH \
  -H "$ado_auth_header" \
  -H "Content-Type: application/json" \
  -d '{"state":"Completed"}' \
  "${ADO_BASE}/Runs/${run_id}?api-version=${ADO_API_VERSION}" >/dev/null 2>&1 || {
  echo "ado-bridge: warning — failed to mark run Completed (results posted OK)" >&2
}

# ──────────────────────────────────────────────────────────────────
# 6. Summary line for pipeline log
# ──────────────────────────────────────────────────────────────────
passed=$(echo "$test_results" | jq -r '[.[] | select(.status=="PASSED" or .status=="PASS")] | length')
failed=$(echo "$test_results" | jq -r '[.[] | select(.status=="FAILED" or .status=="FAIL")] | length')
other=$((result_count - passed - failed))

echo "ado-bridge: posted ${result_count} results to ADO Test Run ${run_id}"
echo "ado-bridge:   ${passed} passed, ${failed} failed, ${other} other"
echo "ado-bridge:   run URL: ${ADO_ORG_URL}/${ADO_PROJECT}/_testManagement/runs?runId=${run_id}&_a=runCharts"
