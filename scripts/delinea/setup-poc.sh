#!/usr/bin/env bash
# One-time setup for the Delinea rotation-sync POC:
#   1. Ensure the "Shared System ID" user exists in the app (register API).
#   2. Ensure the matching mabl credential exists (POST /credentials).
#   3. Run one rotation so app password and mabl credential converge.
#
# Requires: MABL_API_TOKEN, TEST_SEED_TOKEN (via env or .env.local), a running
# app at $APP_URL, and jq. Usage: scripts/delinea/setup-poc.sh
#
# See docs/DELINEA-ROTATION-POC.md.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_var MABL_API_TOKEN "Set it in .env.local (mabl cloud API key)."
require_var TEST_SEED_TOKEN "Set it in .env.local and in the app's env so /api/test/* endpoints are live."

echo "── Delinea rotation-sync POC setup ──"
echo "app:        $APP_URL"
echo "workspace:  $MABL_WORKSPACE_ID"
echo "shared ID:  $SHARED_ID_EMAIL"
echo

# 1. Ensure the Shared System ID user exists. A bootstrap password is fine —
# the rotation at the end converges everything.
BOOTSTRAP_PASSWORD="$(new_password)"
register_response=$(curl -sS -X POST "$APP_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg email "$SHARED_ID_EMAIL" --arg pw "$BOOTSTRAP_PASSWORD" --arg name "$SHARED_ID_NAME" \
        '{email: $email, password: $pw, name: $name}')")
if jq -e '.id' <<<"$register_response" >/dev/null 2>&1; then
  echo "✓ app user created: $SHARED_ID_EMAIL"
elif grep -q "already exists" <<<"$register_response"; then
  echo "✓ app user already exists: $SHARED_ID_EMAIL (rotation below will set a known password)"
else
  echo "error: register failed: $register_response" >&2
  exit 1
fi

# 2. Ensure the mabl credential exists.
CRED_ID="$(find_poc_credential_id)"
if [[ -n "$CRED_ID" ]]; then
  echo "✓ mabl credential already exists: $CRED_ID ($CRED_NAME)"
else
  create_body=$(jq -n \
    --arg name "$CRED_NAME" \
    --arg org "$MABL_WORKSPACE_ID" \
    --arg user "$SHARED_ID_EMAIL" \
    --arg pw "$BOOTSTRAP_PASSWORD" \
    '{name: $name, type: "basic", organization_id: $org,
      description: "POC: synced from the (simulated) Delinea Secret Server rotation hook. See docs/DELINEA-ROTATION-POC.md.",
      properties: {username: $user, password: $pw}}')
  CRED_ID=$(mabl_api POST "/credentials" "$create_body" | jq -r '.id')
  echo "✓ mabl credential created: $CRED_ID ($CRED_NAME)"
fi

# 3. Converge: one rotation syncs app + mabl to the same fresh secret.
echo
"$(dirname "${BASH_SOURCE[0]}")/rotate-shared-id.sh"

echo
echo "Setup complete. Demo verification run:"
echo "  mabl tests run --id <login-test-id> --credentials-id $CRED_ID --url $APP_URL --headless"
