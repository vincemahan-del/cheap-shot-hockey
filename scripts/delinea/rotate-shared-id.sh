#!/usr/bin/env bash
# The (simulated) Delinea Secret Server rotation hook.
#
# In production this logic runs inside Delinea's post-rotation hook: Delinea
# rotates the Shared System ID's password in the target system, then calls the
# mabl API so the matching mabl credential carries the new secret. Here the
# script plays both parts:
#   1. Rotate the app-side password (token-guarded POST /api/test/rotate-password).
#   2. Sync the new secret into the mabl credential (PATCH /credentials/{id}).
#
# Flags:
#   --skip-sync   rotate the app password but do NOT update mabl — the
#                 negative control that shows what vault rotation does to
#                 UI tests when there is no sync in place.
#
# Requires: TEST_SEED_TOKEN; MABL_API_TOKEN unless --skip-sync.
# Usage: scripts/delinea/rotate-shared-id.sh [--skip-sync]

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SKIP_SYNC=false
[[ "${1:-}" == "--skip-sync" ]] && SKIP_SYNC=true

require_var TEST_SEED_TOKEN "Set it in .env.local and in the app's env."
$SKIP_SYNC || require_var MABL_API_TOKEN "Set it in .env.local (mabl cloud API key)."

NEW_PASSWORD="$(new_password)"

echo "── Delinea rotation hook (simulated) ──"
echo "shared ID:  $SHARED_ID_EMAIL"

# 1. Rotate in the target system (the app) — Delinea's job in production.
rotate_response=$(curl -sS -X POST "$APP_URL/api/test/rotate-password" \
  -H "Content-Type: application/json" \
  -H "x-test-seed-token: $TEST_SEED_TOKEN" \
  -d "$(jq -n --arg email "$SHARED_ID_EMAIL" --arg pw "$NEW_PASSWORD" \
        '{email: $email, newPassword: $pw}')")
if ! jq -e '.rotatedAt' <<<"$rotate_response" >/dev/null 2>&1; then
  echo "error: app-side rotation failed: $rotate_response" >&2
  exit 1
fi
echo "✓ app password rotated ($(jq -r '.rotatedAt' <<<"$rotate_response"))"

if $SKIP_SYNC; then
  echo "⚠ --skip-sync: mabl credential NOT updated. The next credential-driven"
  echo "  login test run will fail — this is the drift a real rotation causes"
  echo "  without a sync hook."
  exit 0
fi

# 2. Sync to mabl: read-merge-write so required fields survive the PATCH.
CRED_ID="${CRED_ID:-$(find_poc_credential_id)}"
if [[ -z "$CRED_ID" ]]; then
  echo "error: no mabl credential named '$CRED_NAME' — run setup-poc.sh first" >&2
  exit 1
fi
current=$(mabl_api GET "/credentials/$CRED_ID")
patched=$(jq --arg pw "$NEW_PASSWORD" '.properties.password = $pw' <<<"$current")
mabl_api PATCH "/credentials/$CRED_ID" "$patched" >/dev/null
echo "✓ mabl credential synced: $CRED_ID"
echo
echo "Rotation complete — app and mabl agree on the new secret."
echo "(demo visibility only, this is a fake store) new password: $NEW_PASSWORD"
