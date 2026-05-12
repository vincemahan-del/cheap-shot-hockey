# Local-only scripts

Scripts that run on a contributor's laptop, not in CI. Committed to the
repo so the pattern is forkable, but they only matter on individual
developer machines.

## `mcp-atlassian-launch.sh` — keep the Jira API token off plaintext disk

The `.mcp.json` config in the repo root is gitignored and never makes
it into a commit, but the token inside it sits as plain text on the
laptop's filesystem — readable by anything with FS access, recoverable
from Time Machine snapshots, occasionally captured in screen-shares.

This launcher moves the token into the macOS keychain and pulls it at
MCP-server start time. The repo's `.mcp.json` then references the
launcher (which has no secret in it) instead of the token directly.

### One-time setup

```bash
# 1. Store your Atlassian API token in keychain.
security add-generic-password \
  -a "$USER@$(hostname -s)" \
  -s "csh-atlassian-mcp" \
  -w "<paste your token here>" \
  -U   # -U updates if entry already exists
```

### Wire `.mcp.json` to use the launcher

Replace the `atlassian` entry in `.mcp.json` (in the repo root) with:

```json
"atlassian": {
  "command": "/absolute/path/to/cheap-shot-hockey/scripts/local/mcp-atlassian-launch.sh"
}
```

Verify by running the launcher directly — it should exec the MCP server
and wait on stdio:

```bash
./scripts/local/mcp-atlassian-launch.sh
# Ctrl-C to exit; you'll see no output if the keychain lookup worked.
```

If the launcher prints a `no entry for service=...` diagnostic, the
keychain entry isn't set up yet — re-run the `add-generic-password`
command above.

### Why a launcher and not `${VARIABLE}` substitution

`.mcp.json` is JSON. It can't run `$(security find-generic-password)`.
A shell launcher is the minimum bridge between "JSON config can only
hold static values" and "the token must come from a keychain at
runtime."

### Linux fork

The launcher uses macOS's `security` CLI. On Linux:
- `pass` (the standard Unix password manager) — replace the `security find-generic-password` block with `pass csh-atlassian-mcp/api-token`
- `secret-tool` (libsecret) — replace with `secret-tool lookup service csh-atlassian-mcp account "$USER"`

Same launcher shape, different keystore.
