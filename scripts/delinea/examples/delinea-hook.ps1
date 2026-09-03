# Sample Delinea Secret Server event-pipeline task for the mabl sync hook.
#
# Wiring: Event Pipeline with trigger "Secret: Password Change" -> task
# "Run script". Scope the pipeline (folder/template) to the Shared System ID
# secrets so it fires only for them.
#
# IMPORTANT — how the script receives the password (governance decision):
#   By default, event-pipeline scripts CANNOT receive Password-type fields:
#   the advanced setting "Event Pipelines: Allow Confidential Secret Fields
#   to be used in Scripts" defaults to False. Either your Delinea owner
#   enables it (explicit, auditable decision), or keep it off and have this
#   script read the secret back via the Secret Server REST API with its own
#   least-privileged credential.
#
# Where it runs: on-prem Secret Server runs scripts on the web server; Secret
# Server Cloud runs them on a distributed engine — that engine needs outbound
# HTTPS (443) to api.mabl.com and a least-privileged PowerShell RunAs secret.
#
# Per-secret mapping: store each Shared System ID's mabl credential ID in a
# NON-confidential custom field on its Delinea secret and pass it as a field
# token, so one pipeline serves the whole folder. (Alternative: one pipeline
# per secret with a hardcoded ID.)
#
# The mabl API key: keep it in its own Delinea secret. Use the "Workspace
# admin" key type — the documented type for credential read-write; set an
# expiration date at creation.

param(
    [Parameter(Mandatory)] [string] $Username,     # rotated account's username
    [Parameter(Mandatory)] [string] $NewPassword,  # see the confidential-fields note above
    [Parameter(Mandatory)] [string] $MablApiKey,   # from a Delinea secret, not inline
    [Parameter(Mandatory)] [string] $CredentialId  # mabl credential ID (custom field token)
)

$body = @{ properties = @{ username = $Username; password = $NewPassword } } |
    ConvertTo-Json -Depth 3

# mabl API auth: HTTP Basic, username literal "key", API key as the password.
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("key:$MablApiKey"))
$uri  = "https://api.mabl.com/credentials/$CredentialId"

# One retry with backoff, well inside the pipeline's script-time cap
# (default 5 minutes, configurable). Exit non-zero on failure so the
# pipeline records the failed task and Delinea-side notifications fire.
$maxAttempts = 2
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    try {
        $result = Invoke-RestMethod -Method Patch -Uri $uri `
            -Headers @{ Authorization = "Basic $auth" } `
            -ContentType 'application/json' -Body $body
        Write-Output "mabl credential $CredentialId synced for $Username (updated $($result.last_updated_time))"
        exit 0
    } catch {
        Write-Warning "mabl sync attempt $attempt failed: $($_.Exception.Message)"
        if ($attempt -lt $maxAttempts) { Start-Sleep -Seconds 10 }
    }
}
Write-Error "mabl credential sync FAILED for $Username -> $CredentialId after $maxAttempts attempts"
exit 1
