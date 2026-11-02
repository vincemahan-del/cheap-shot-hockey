#!/usr/bin/env bash
# Local developer loop: run mabl tests against `npm run dev` on this machine
# (0 credits). Uses the mabl branch named after the current git branch when one
# is open, so tests edited for this change run at their new version.
#
#   scripts/mabl-local.sh smoke                  the PR smoke set (label exec-pr)
#   scripts/mabl-local.sh impact "<the change>"  test impact analysis, then run what it picks
#   scripts/mabl-local.sh run <test-id>...       specific tests
#
# Env: MABL_LOCAL_URL (default http://localhost:3000); MABL_LOCAL_AI=1 allows
# AI and visual assertions (--allow-billable-features); MABL_LOCAL_REPORT=1
# publishes results to mabl (--reporter mabl).

WS=pXXgThbNi4HfQOpiZptHfw-w
APP=OZqmshBkUfVSesWy49g1eQ-a
ENV_LOCAL=DmlIvADtF8jPDm9J7Bpshw-e
DEMO_CUSTOMER=JxWK20l5gOOFOtWjaJHfOg-c
URL=${MABL_LOCAL_URL:-http://localhost:3000}
CAP=10
GUIDANCE="Every test this change could affect: tests that exercise the changed behavior first, then blast-radius tests that should still pass, especially ones asserting totals, layout or API responses in the changed areas."

usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }

if ! curl -fsS -m 5 "$URL/api/health" >/dev/null 2>&1; then
  echo "Nothing answering at $URL/api/health. Start the app first: npm run dev" >&2
  exit 1
fi

branch_args=""
git_branch=$(git branch --show-current 2>/dev/null)
if [ -n "$git_branch" ] && [ "$git_branch" != main ] &&
   mabl branches list -s open -l 100 -o json -w "$WS" 2>/dev/null |
     jq -e --arg b "$git_branch" 'any(.[]; .name == $b)' >/dev/null; then
  branch_args="--mabl-branch $git_branch"
  echo "mabl branch: $git_branch"
else
  echo "mabl branch: master"
fi

# The Local environment's deployments already point at localhost:3000 (web) and
# localhost:3000/api (API); --url would override both with one value.
extra=""
[ "$URL" != http://localhost:3000 ] && extra="--url $URL"
[ "${MABL_LOCAL_AI:-}" = 1 ] && extra="$extra --allow-billable-features"
[ "${MABL_LOCAL_REPORT:-}" = 1 ] && extra="$extra --reporter mabl"

logs=$(mktemp -d)
results="$logs/results.tsv"
: > "$results"

# Runs one test serially (the local runner holds a fixed port) and records the outcome.
run_one() {
  id=$1; creds=${2:-$DEMO_CUSTOMER}
  # shellcheck disable=SC2086
  mabl tests run --id "$id" -w "$WS" -a "$APP" -e "$ENV_LOCAL" \
    --credentials-id "$creds" --headless $branch_args $extra > "$logs/$id.log" 2>&1
  rc=$?
  name=$(grep -m1 -oE 'Running test: +.* - ' "$logs/$id.log" | sed -E 's/Running test: +//; s/ - $//')
  if [ $rc -eq 0 ]; then outcome=passed
  elif grep -q 'AI assertions are not available' "$logs/$id.log"; then outcome="not run: needs MABL_LOCAL_AI=1"
  else outcome="FAILED: $(grep -m1 -E '\[ERROR\]|\[FAILED\]' "$logs/$id.log" | sed -E 's/^[0-9: APM]+- +//' | cut -c1-120)"
  fi
  printf '%s\t%s\t%s\n' "${name:-$id}" "$id" "$outcome" >> "$results"
  printf '  %-60s %s\n' "${name:-$id}" "$outcome"
}

summary() {
  failed=$(grep -c $'\tFAILED' "$results")
  echo
  echo "$(wc -l < "$results" | tr -d ' ') run, $failed failed. Logs: $logs"
  [ "$failed" -eq 0 ]
}

cmd=${1:-}; [ $# -gt 0 ] && shift
case "$cmd" in
  smoke)
    ids=$(mabl tests list --labels exec-pr -o json -l 100 -w "$WS" | jq -r '.[] | select(.enabled) | .id')
    [ -n "$ids" ] || { echo "No enabled exec-pr tests found." >&2; exit 1; }
    echo "PR smoke set against $URL:"
    for id in $ids; do run_one "$id"; done
    summary
    ;;
  impact)
    [ $# -ge 1 ] || usage
    printf '%s\n' "$*" > "$logs/change.md"
    echo "Running test impact analysis (takes a few minutes)..."
    # shellcheck disable=SC2086
    mabl tests impact -a "$APP" --change-description-file "$logs/change.md" \
      --guidance "$GUIDANCE" $branch_args -o json > "$logs/impact.json" || { echo "Analysis failed." >&2; exit 1; }
    jq -r '.summary' "$logs/impact.json"
    # Same screen as CI; seed-db tests write through mabl's production DB connection.
    jq -c '[.tests[] | select(.run_context.enabled != false)
      | select((.run_context.labels // []) | (index("exhibit") or index("seed-db")) | not)]' \
      "$logs/impact.json" > "$logs/eligible.json"
    jq -r '.tests[] | select((.run_context.labels // []) | index("seed-db")) | "  skipped (seed-db): \(.test_name)"' \
      "$logs/impact.json"
    echo
    echo "Coverage gaps:"
    jq -r '.coverage_gaps[]? | "  - " + (if type == "string" then . else (.description // tostring) end)' "$logs/impact.json"
    echo
    echo "Impacted tests against $URL (up to $CAP):"
    jq -r --argjson cap "$CAP" '.[:$cap][] | "\(.test_invariant_id)\t\(.run_context.plan_credentials_id // "")"' \
      "$logs/eligible.json" > "$logs/selected.tsv"
    while IFS=$'\t' read -r id creds; do run_one "$id" "$creds"; done < "$logs/selected.tsv"
    summary
    ;;
  run)
    [ $# -ge 1 ] || usage
    for id in "$@"; do run_one "$id"; done
    summary
    ;;
  *) usage ;;
esac
