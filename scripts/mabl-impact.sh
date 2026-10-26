#!/usr/bin/env bash
# PR test impact gate: mabl test impact analysis picks the existing tests this
# change reaches, then runs exactly those on the PR preview as one deployment
# event linked to the analysis. The analysis selects; this script dispatches and
# decides pass/fail from mabl's results.
#
# Env: WORKSPACE_ID APP_ID ENV_ID PREVIEW_URL HEAD_SHA HEAD_REF REPO PR_NUMBER PR_URL
#      PR_TITLE PR_BODY GH_TOKEN; optional CLOUD_GATE (disabled = skip).
set -euo pipefail

CAP=10
EXEMPT_LABEL=test-impact-gate-exempt
MARKER='<!-- mabl-impact -->'
SUMMARY=${GITHUB_STEP_SUMMARY:-/dev/null}

comment() {
  local body="$MARKER"$'\n'"$1"
  local id
  id=$(gh api "repos/$REPO/issues/$PR_NUMBER/comments" --paginate \
    --jq "[.[] | select(.body | startswith(\"$MARKER\"))][0].id // empty")
  if [[ -n "$id" ]]; then
    gh api -X PATCH "repos/$REPO/issues/comments/$id" -f body="$body" >/dev/null
  else
    gh api "repos/$REPO/issues/$PR_NUMBER/comments" -f body="$body" >/dev/null
  fi
  printf '%s\n' "$1" >> "$SUMMARY"
}

# Use the PR's mabl branch (named after the git branch) when one exists.
branch_args=()
if mabl branches describe "$HEAD_REF" --name -w "$WORKSPACE_ID" >/dev/null 2>&1; then
  branch_args=(--mabl-branch "$HEAD_REF")
  echo "mabl branch: $HEAD_REF" | tee -a "$SUMMARY"
else
  echo "mabl branch: master ($HEAD_REF not found)" | tee -a "$SUMMARY"
fi

# Labels are read live (not from the event payload) so re-running the job
# after adding the exempt label picks it up.
labels=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json labels --jq '[.labels[].name] | join(" ")')
if [[ " $labels " == *" $EXEMPT_LABEL "* ]]; then
  comment "### mabl test impact — exempt
\`$EXEMPT_LABEL\` is applied, so impacted tests were not run."
  exit 0
fi

if [[ "${CLOUD_GATE:-enabled}" == "disabled" ]]; then
  comment "### mabl test impact — paused
Cloud runs are paused (\`MABL_CLOUD_GATE=disabled\`). No analysis or runs."
  exit 0
fi

# Change description: the PR body's "## Change description" section (written
# by /ship), else the PR title plus changed paths.
section=$(printf '%s\n' "$PR_BODY" | awk '/^## Change description/{f=1;next} /^## /{f=0} f')
if [[ -n "${section//[[:space:]]/}" ]]; then
  printf '%s\n' "$section" > change.md
else
  { printf '%s\n\nFiles changed:\n' "$PR_TITLE"; gh pr diff "$PR_NUMBER" --repo "$REPO" --name-only; } > change.md
fi

mabl tests impact -a "$APP_ID" \
  --change-description-file change.md \
  --guidance "just the top-priority handful" \
  --reference "$PR_URL" \
  --revision "$HEAD_SHA" \
  --include-plans \
  "${branch_args[@]}" \
  -o json > impact.json

session=$(jq -r '.session_id' impact.json)
jq -c "[.tests[] | select(.run_context.enabled != false)
  | select((.run_context.labels // []) | index(\"exhibit\") | not)] | .[:$CAP]" impact.json > selected.json
count=$(jq 'length' selected.json)
gaps=$(jq -r '.coverage_gaps[]? | "- " + (if type == "string" then . else (.description // .area // tostring) end)' impact.json)

if [[ "$count" -eq 0 ]]; then
  comment "### mabl test impact — no impacted tests
$(jq -r '.summary' impact.json)
${gaps:+
**Coverage gaps**
$gaps}"
  exit 0
fi

mapfile -t ids < <(jq -r '.[].test_invariant_id' selected.json)
# Each test logs in with its plan's credentials; tests in no enabled plan fall
# back to the default demo customer.
mapfile -t creds < <(jq -r --arg d "${DEFAULT_CREDENTIALS_ID:-}" '.[]
  | (.run_context.plan_credentials_id // $d) as $c | select($c != "")
  | "\(.test_invariant_id)=\($c)"' selected.json)
cred_args=()
[[ ${#creds[@]} -gt 0 ]] && cred_args=(--test-credentials "${creds[@]}")

status=0
mabl deployments create -a "$APP_ID" -e "$ENV_ID" \
  --test-ids "${ids[@]}" \
  --impact-session-id "$session" \
  --selection-name "PR #$PR_NUMBER impacted tests" \
  --retry-failed-tests \
  "${cred_args[@]}" \
  --app-url "$PREVIEW_URL" --api-url "$PREVIEW_URL/api" \
  --revision "$HEAD_SHA" \
  --repository-url "https://github.com/$REPO" \
  "${branch_args[@]}" \
  --await-completion -o json > deployment.json || status=$?

failed=$(jq '.execution_results.plan_execution_metrics.failed // 0' deployment.json)
href=$(jq -r '.href // empty' deployment.json)
rows=$(jq -r --slurpfile d deployment.json '.[] as $t
  | ([$d[0].execution_results.executions[]?.journey_executions[]?
      | select((.test_id | split(":")[0]) == $t.test_invariant_id) | .success] | last) as $ok
  | "| \($t.test_name) | \($t.expected_outcome) | \(if $ok == true then "passed" elif $ok == false then "**failed**" else "not run" end) |"' selected.json)

verdict="passed"
[[ "$status" -ne 0 || "$failed" -ne 0 ]] && verdict="failed"

comment "### mabl test impact — $verdict
$(jq -r '.summary' impact.json)

| Test | Expected | Result |
|---|---|---|
$rows
${gaps:+
**Coverage gaps**
$gaps}

[mabl deployment]($href) · a test expected to fail by design should be updated on the mabl branch \`$HEAD_REF\`; to waive this gate apply \`$EXEMPT_LABEL\` and re-run the job."

[[ "$verdict" == "passed" ]]
