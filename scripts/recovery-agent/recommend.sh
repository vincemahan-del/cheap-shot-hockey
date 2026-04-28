#!/usr/bin/env bash
# Reads recovery-result.json (produced by index.js) and posts the
# recommendation to Slack + Jira via the existing ci-notify.sh.
#
# Strictly deterministic — no LLM calls, no PR creation, no Jira
# transitions. The agent diagnoses; humans act on the recommendation.
#
# Usage:
#   recommend.sh [path-to-result-json]    (default: ./recovery-result.json)

set -euo pipefail

result_file="${1:-./recovery-result.json}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"

if [ ! -f "$result_file" ]; then
  echo "recommend.sh: result file not found at $result_file" >&2
  bash "${repo_root}/scripts/ci-notify.sh" fail "Recovery agent" \
    "Diagnosis agent did not produce a result file (\`${result_file}\`). A human should investigate the failed run directly."
  exit 0
fi

decision=$(jq -r '.decision // "page-human"' "$result_file")
confidence=$(jq -r '.confidence // "low"' "$result_file")
reasoning=$(jq -r '.reasoning // "no reasoning provided"' "$result_file")
flake=$(jq -r '.looks_like_flake // false' "$result_file")
demo_toggle=$(jq -r '.looks_like_demo_toggle // false' "$result_file")

# Compose a single human-readable extra block. Slack mrkdwn (single * for bold).
case "$decision" in
  revert)
    revert_sha=$(jq -r '.suggested_revert_sha // ""' "$result_file")
    extra=":robot_face: *Recovery agent recommendation: revert*  (confidence: ${confidence})"$'\n\n'
    extra+="${reasoning}"$'\n\n'
    if [ -n "$revert_sha" ] && [ "$revert_sha" != "null" ]; then
      extra+="*Suggested revert sha:* \`${revert_sha}\`"$'\n'
    fi
    extra+="*Next:* a human should review the diagnosis, then \`git revert <sha>\` and open a PR. Recovery agent will not push, merge, or close tickets."
    ;;
  forward-fix)
    fix_summary=$(jq -r '.suggested_fix_summary // ""' "$result_file")
    extra=":robot_face: *Recovery agent recommendation: forward-fix*  (confidence: ${confidence})"$'\n\n'
    extra+="${reasoning}"$'\n\n'
    if [ -n "$fix_summary" ] && [ "$fix_summary" != "null" ]; then
      extra+="*Suggested fix:* ${fix_summary}"$'\n'
    fi
    extra+="*Next:* a human should review the diagnosis and open a fix PR. Recovery agent will not write code or open PRs."
    ;;
  page-human)
    extra=":robot_face: *Recovery agent recommendation: page human*  (confidence: ${confidence})"$'\n\n'
    extra+="${reasoning}"$'\n\n'
    if [ "$flake" = "true" ]; then
      extra+="_Hint: agent suspects flake — a manual retry may pass._"$'\n'
    fi
    if [ "$demo_toggle" = "true" ]; then
      extra+="_Hint: agent suspects the demo toggle is set on prod (\`?demo=broken\`). Try \`./scripts/demo-toggle.sh normal\` first._"$'\n'
    fi
    extra+="*Next:* a human should investigate the failed run directly."
    ;;
  *)
    extra=":robot_face: *Recovery agent: unrecognized decision '${decision}'*"$'\n\n'
    extra+="Treating as page-human. Reasoning provided: ${reasoning}"
    ;;
esac

bash "${repo_root}/scripts/ci-notify.sh" fail "Recovery agent diagnosis" "$extra"

echo "recommend.sh: posted ${decision} (${confidence}) recommendation"
