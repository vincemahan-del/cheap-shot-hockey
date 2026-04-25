#!/usr/bin/env bash
#
# Queries mabl for tests relevant to a set of changed files and prints
# suggestions. Called by the pre-push git hook and the GHA test-impact job.
#
# Usage: pipe changed file paths via stdin, or pass as first argument
#   echo "src/components/Footer.tsx" | ./scripts/mabl-suggest-tests.sh
#   git diff --name-only main | ./scripts/mabl-suggest-tests.sh
#
# Requires: MABL_API_TOKEN, MABL_WORKSPACE_ID
# Optional: MABL_APPLICATION_ID, MABL_API_BASE

set -uo pipefail

[[ -z "${MABL_API_TOKEN:-}" || -z "${MABL_WORKSPACE_ID:-}" ]] && exit 0

API_BASE="${MABL_API_BASE:-https://api.mabl.com}"
AUTH_HEADER="Authorization: Basic $(printf ':%s' "$MABL_API_TOKEN" | base64)"
APP_PARAM="${MABL_APPLICATION_ID:+&application_id=${MABL_APPLICATION_ID}}"

# Accept file list from first arg or stdin
if [[ $# -gt 0 ]]; then
  changed_files="$1"
else
  changed_files=$(cat)
fi

[[ -z "$changed_files" ]] && exit 0

# Extract keywords from file paths (base name + meaningful parent dir)
declare -a keywords=()
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  base=$(basename "$f" | sed 's/\.[^.]*$//')
  parent=$(dirname "$f" | xargs basename 2>/dev/null || true)
  [[ -n "$base" && "$base" != "." ]] && keywords+=("$base")
  case "${parent:-}" in
    .|src|app|lib|components|api|''|pages|hooks|utils) ;;
    *) keywords+=("$parent") ;;
  esac
done <<< "$changed_files"

[[ ${#keywords[@]} -eq 0 ]] && exit 0

# Fetch all tests for this workspace/application
all_tests=$(
  curl -fsS "${API_BASE}/testing/runsets?workspace_id=${MABL_WORKSPACE_ID}${APP_PARAM}" \
    -H "$AUTH_HEADER" 2>/dev/null
) || exit 0

echo "$all_tests" | jq -e '.runsets // empty' >/dev/null 2>&1 || exit 0

# Match test names against keywords (case-insensitive)
declare -a matched=()
for kw in "${keywords[@]}"; do
  while IFS= read -r name; do
    [[ -n "$name" ]] && matched+=("$name")
  done < <(
    echo "$all_tests" | jq -r --arg kw "$kw" \
      '.runsets[]? | select(.name | ascii_downcase | contains($kw | ascii_downcase)) | .name' \
      2>/dev/null
  )
done

unique=$(printf '%s\n' "${matched[@]}" | sort -u | grep -v '^$' || true)

if [[ -z "$unique" ]]; then
  echo "  No existing mabl tests matched the changed files."
  exit 0
fi

echo "  These mabl tests may be affected by your changes."
echo "  Consider running them before pushing:"
echo ""
while IFS= read -r t; do
  echo "    • $t"
done <<< "$unique"
echo ""
echo "  Run locally: npm run test:mabl:local"
