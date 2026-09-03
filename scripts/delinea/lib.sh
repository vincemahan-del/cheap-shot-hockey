#!/usr/bin/env bash
# Shared helpers for the Delinea rotation-sync POC scripts.
# See docs/DELINEA-ROTATION-POC.md for the full story.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Load local env (MABL_API_TOKEN, TEST_SEED_TOKEN, ...) without echoing values.
if [[ -f "$REPO_ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env.local"
  set +a
fi

MABL_API_BASE="${MABL_API_BASE:-https://api.mabl.com}"
MABL_WORKSPACE_ID="${MABL_WORKSPACE_ID:-pXXgThbNi4HfQOpiZptHfw-w}"
APP_URL="${APP_URL:-http://localhost:3000}"
SHARED_ID_EMAIL="${SHARED_ID_EMAIL:-svc-roletest@cheapshot.test}"
CRED_NAME="${CRED_NAME:-CSH Shared System ID (Delinea POC)}"

require_var() {
  local name="$1" hint="$2"
  if [[ -z "${!name:-}" ]]; then
    echo "error: $name is required. $hint" >&2
    exit 1
  fi
}

mabl_auth_header() {
  # mabl API auth: HTTP Basic with blank username + API token (same pattern
  # as scripts/mabl-deployment.sh).
  printf 'Authorization: Basic %s' "$(printf ':%s' "$MABL_API_TOKEN" | base64)"
}

# curl wrapper: prints body, fails loudly on HTTP >= 400 without leaking headers.
mabl_api() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -X "$method" "$MABL_API_BASE$path" -H "$(mabl_auth_header)" -H "Content-Type: application/json")
  [[ -n "$body" ]] && args+=(-d "$body")
  local response http_code
  response=$(curl "${args[@]}" -w '\n%{http_code}')
  http_code=$(tail -n1 <<<"$response")
  body=$(sed '$d' <<<"$response")
  if (( http_code >= 400 )); then
    echo "error: mabl API $method $path returned HTTP $http_code" >&2
    echo "$body" >&2
    exit 1
  fi
  echo "$body"
}

# Find the POC credential by name; prints its id or nothing.
find_poc_credential_id() {
  mabl_api GET "/credentials?organization_id=$MABL_WORKSPACE_ID" |
    jq -r --arg name "$CRED_NAME" '.credentials[]? | select(.name == $name) | .id' | head -1
}

new_password() {
  echo "Csh!$(openssl rand -hex 8)"
}
