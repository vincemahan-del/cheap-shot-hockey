#!/usr/bin/env bash
# Nightly full regression against prod. Every enabled `type-rt` test (minus
# `exhibit`) runs locally on the CI runner via the mabl CLI (0 credits). Local
# failures are re-run once in the mabl cloud as one deployment event, where
# mabl's failure analysis and categorization apply.
#
# Env: APP_ID ENV_ID PROD_URL CREDENTIALS_ID; optional ADMIN_CREDENTIALS_ID (for
# tests labelled creds-admin), CLOUD_GATE (disabled = no cloud re-run),
# SLACK_WEBHOOK_URL (posts the outcome).
set -uo pipefail

CAP=10
SUMMARY=${GITHUB_STEP_SUMMARY:-/dev/null}
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"

# Posting is best-effort: a Slack outage never changes the nightly's result.
notify() {
  [[ -n "${SLACK_WEBHOOK_URL:-}" ]] || return 0
  local text=":waning_crescent_moon: $1"$'\n'"$RUN_URL"
  curl -fsS -m 10 -H 'Content-Type: application/json' \
    --data "$(jq -n --arg t "$text" '{text: $t}')" "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 \
    || echo "Slack post failed." >> "$SUMMARY"
}

mabl tests list --labels type-rt -o json -l 500 > suite.json
mapfile -t suite < <(jq -r '.[] | select(.enabled) | .id' suite.json)
mapfile -t exhibits < <(mabl tests list --labels exhibit -o json -l 500 | jq -r '.[].id')
# The CLI exposes no per-test credential, so tests that sign in as the admin
# user carry the creds-admin label; everything else signs in as the demo customer.
mapfile -t admins < <(mabl tests list --labels creds-admin -o json -l 500 | jq -r '.[].id')

creds_for() {
  if [[ -n "${ADMIN_CREDENTIALS_ID:-}" && " ${admins[*]} " == *" $1 "* ]]; then
    echo "$ADMIN_CREDENTIALS_ID"
  else
    echo "$CREDENTIALS_ID"
  fi
}

failed=()
ran=0
for id in "${suite[@]}"; do
  [[ " ${exhibits[*]} " == *" $id "* ]] && continue
  ran=$((ran + 1))
  if ! mabl tests run --id "$id" --headless \
      -a "$APP_ID" -e "$ENV_ID" --url "$PROD_URL" \
      --credentials-id "$(creds_for "$id")" \
      --allow-billable-features --reporter mabl; then
    failed+=("$id")
  fi
done

echo "### Nightly regression: $ran run locally, ${#failed[@]} failed" >> "$SUMMARY"
if [[ $ran -eq 0 ]]; then
  notify "Nightly regression FAILED: no type-rt tests found to run."
  exit 1
fi
if [[ ${#failed[@]} -eq 0 ]]; then
  notify "Nightly regression passed: $ran tests against production."
  exit 0
fi
printf -- '- `%s`\n' "${failed[@]}" >> "$SUMMARY"
names=$(for id in "${failed[@]}"; do jq -r --arg id "$id" '.[] | select(.id == $id) | "• \(.name)"' suite.json; done)

if [[ "${CLOUD_GATE:-enabled}" == "disabled" ]]; then
  echo "Cloud re-run skipped (MABL_CLOUD_GATE=disabled)." >> "$SUMMARY"
  notify "Nightly regression FAILED: ${#failed[@]} of $ran failed locally; not re-run in the cloud (cloud runs paused)."$'\n'"$names"
  exit 1
fi
if [[ ${#failed[@]} -gt $CAP ]]; then
  echo "More than $CAP local failures: likely systemic (prod down, login broken). Not re-running in the cloud." >> "$SUMMARY"
  notify "Nightly regression FAILED: ${#failed[@]} of $ran failed locally, likely systemic (production down or login broken); not re-run in the cloud."
  exit 1
fi

pairs=()
for id in "${failed[@]}"; do pairs+=("$id=$(creds_for "$id")"); done

mabl deployments create -a "$APP_ID" -e "$ENV_ID" \
  --test-ids "${failed[@]}" \
  --test-credentials "${pairs[@]}" \
  --selection-name "Nightly re-run of local failures" \
  --retry-failed-tests \
  --app-url "$PROD_URL" --api-url "$PROD_URL/api" \
  --await-completion -o json > rerun.json
cloud_failed=$(jq -r '.execution_results.plan_execution_metrics.failed // empty' rerun.json 2>/dev/null)
href=$(jq -r '.href // empty' rerun.json 2>/dev/null)

# A rejected or unfinished re-run leaves no failure count; that is not a pass.
if [[ ! "$cloud_failed" =~ ^[0-9]+$ ]]; then
  echo "Cloud re-run did not report a result (see the job log); the local failures stand." >> "$SUMMARY"
  notify "Nightly regression FAILED: ${#failed[@]} of $ran failed locally; the cloud re-run did not report a result."$'\n'"$names"
  exit 1
fi
if [[ "$cloud_failed" -eq 0 ]]; then
  echo "Cloud re-run passed: local failures were flaky or runner-specific. [deployment]($href)" >> "$SUMMARY"
  notify "Nightly regression passed: $ran tests against production; ${#failed[@]} local failure(s) passed on the cloud re-run."$'\n'"$names"$'\n'"$href"
  exit 0
fi
echo "Cloud re-run failed too: real failure. mabl's analysis and category are on the [deployment]($href)." >> "$SUMMARY"
notify "Nightly regression FAILED: ${#failed[@]} of $ran failed locally and on the cloud re-run. mabl's analysis is on the deployment."$'\n'"$names"$'\n'"$href"
exit 1
