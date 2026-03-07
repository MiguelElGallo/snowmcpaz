# snowmcpaz

[![CI](https://github.com/MiguelElGallo/snowmcpaz/actions/workflows/ci.yml/badge.svg)](https://github.com/MiguelElGallo/snowmcpaz/actions/workflows/ci.yml)

VS Code extension that exposes a Snowflake-managed MCP server through a local Node.js broker and authenticates requests with a Microsoft Entra access token acquired from Azure CLI.

## What This Extension Does

The extension starts a local stdio broker inside VS Code.

That broker:

- gets a token with `az account get-access-token`
- sends the token to your Snowflake MCP endpoint
- forwards JSON-RPC messages between VS Code and Snowflake
- retries once if Snowflake returns HTTP `401`

The extension does not create your Entra app registration, your Snowflake security integration, your Snowflake MCP server, or your Snowflake grants.

Those pieces must already exist.

## Before You Install It

If you only read one section, read this one.

This extension works only when all of the following are already true:

1. You have a Snowflake MCP endpoint.
2. Snowflake is configured for External OAuth with Microsoft Entra.
3. Your Entra app registration has an Application ID URI such as `api://<app-id>`.
4. Azure CLI is allowed to request tokens for that Entra app.
5. Your Snowflake user can be mapped from the token claims and can assume the role you plan to send.

If any of those are missing, the extension cannot compensate for it. It will fail at token acquisition or at the Snowflake connection test.

## What You Need

### On your machine

- VS Code `1.99+`
- Node.js `20+` if you are building from source
- Azure CLI `2.x+`
- An interactive Azure CLI login for the correct tenant

### In Microsoft Entra

You need one app registration dedicated to Snowflake OAuth.

Minimum expected setup:

- Sign-in audience: single tenant, typically `AzureADMyOrg`
- Application ID URI: `api://<app-id>`
- Delegated scope: `session:role-any`
- Azure CLI pre-authorized on the app: `04b07795-8ddb-461a-bbee-02f9e1bf7b46`
- Admin consent granted if your tenant requires it

Why this matters:

- the Application ID URI becomes the token audience
- the extension uses that value as `snowflakeMcp.azureAppIdUri`
- Azure CLI must be pre-authorized or consented, otherwise `az account get-access-token` can fail

### In Snowflake

You need all of these:

- an MCP server already created
- a reachable MCP endpoint URL
- an External OAuth security integration for Microsoft Entra
- user mapping between token claims and the Snowflake user
- role grants that allow the target role to use the MCP server

In the validated setup documented in the upstream project, Snowflake uses:

- `EXTERNAL_OAUTH_TYPE = AZURE`
- `EXTERNAL_OAUTH_ISSUER = 'https://sts.windows.net/<tenant-id>/'`
- `EXTERNAL_OAUTH_JWS_KEYS_URL = 'https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys'`
- `EXTERNAL_OAUTH_AUDIENCE_LIST = ('api://<app-id>')`
- `EXTERNAL_OAUTH_ANY_ROLE_MODE = 'ENABLE'`
- `EXTERNAL_OAUTH_TOKEN_USER_MAPPING_CLAIM = 'email'`
- `EXTERNAL_OAUTH_SNOWFLAKE_USER_MAPPING_ATTRIBUTE = 'email_address'`

That `email` to `email_address` mapping is especially important for guest or external users, because `upn` is often missing for them.

## Entra Setup

This is the setup your Entra admin should complete before anyone installs the extension.

### 1. Create the app registration

Create an app registration, for example `Snowflake MCP OAuth`.

Recommended properties:

- Sign-in audience: single tenant
- Identifier URI: `api://<app-id>`
- Scope: `session:role-any`

### 2. Pre-authorize Azure CLI

Pre-authorize Azure CLI on the app registration with this client ID:

```text
04b07795-8ddb-461a-bbee-02f9e1bf7b46
```

Grant it the delegated permission for `session:role-any`.

This is what allows the extension's Azure CLI flow to work without prompting the user for a custom client application.

### 3. Make sure consent is handled

Depending on tenant policy, one of these must be true:

- admin consent has already been granted
- users are allowed to consent
- users run a first login flow that satisfies tenant consent requirements

If this is not done, token acquisition can fail with consent errors such as `AADSTS65001`.

### 4. Know which values users will need

Your users need these exact values from Entra:

- Tenant ID
- Application ID URI, for example `api://e78b3971-ac83-4da7-ba8e-c99e42e5e8b9`

The client secret is not required by this extension.

## Snowflake Setup

This is the setup your Snowflake admin should complete before anyone uses the extension.

### 1. Create the MCP server

The MCP server must already exist in Snowflake.

Example endpoint shape:

```text
https://<account>.snowflakecomputing.com/api/v2/databases/<database>/schemas/<schema>/mcp-servers/<server>
```

Do not append `/mcp`. That path returns `404`.

### 2. Create the External OAuth integration

Snowflake must trust the Entra-issued token.

The upstream reference setup uses a security integration like this:

```sql
CREATE OR REPLACE SECURITY INTEGRATION azure_oauth_mcp
	TYPE = EXTERNAL_OAUTH
	ENABLED = TRUE
	EXTERNAL_OAUTH_TYPE = AZURE
	EXTERNAL_OAUTH_ISSUER = 'https://sts.windows.net/<tenant-id>/'
	EXTERNAL_OAUTH_JWS_KEYS_URL = 'https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys'
	EXTERNAL_OAUTH_TOKEN_USER_MAPPING_CLAIM = 'email'
	EXTERNAL_OAUTH_SNOWFLAKE_USER_MAPPING_ATTRIBUTE = 'email_address'
	EXTERNAL_OAUTH_ANY_ROLE_MODE = 'ENABLE'
	EXTERNAL_OAUTH_AUDIENCE_LIST = ('api://<app-id>');
```

### 3. Make sure the Snowflake user can be mapped

If you use the recommended `email` mapping, the Snowflake user must have the correct `EMAIL` value.

Typical setup:

```sql
ALTER USER <snowflake_user> SET EMAIL = 'user@example.com';
ALTER USER <snowflake_user> SET LOGIN_NAME = 'user@example.com';
```

The `EMAIL` value should match the `email` claim in the Entra token.

### 4. Grant an allowed role

The extension sends the configured Snowflake role in the `X-Snowflake-Role` header.

That role must:

- be granted to the user
- be allowed for External OAuth
- have usage on the database, schema, and MCP server

In many environments, `ACCOUNTADMIN` is blocked for External OAuth. Use a safer allowed role such as `SYSADMIN` or, preferably, a least-privileged custom role.

## Verify The Prerequisites Before Using VS Code

Before you debug the extension, verify the auth chain independently.

### 1. Sign in with Azure CLI

```bash
az login
```

If this is the first time you are using the app scope and your tenant requires it, use:

```bash
az login --scope "api://<app-id>/session:role-any" --allow-no-subscriptions
```

### 2. Request a token for the Entra app

```bash
az account get-access-token --resource "api://<app-id>" --output json
```

The extension first tries the `.default` scope form and then falls back to `--resource`. If you can get a token here, the extension can usually get one too.

### 3. Call the Snowflake MCP endpoint directly

```bash
TOKEN=$(az account get-access-token --resource "api://<app-id>" --query accessToken -o tsv)

curl -s -X POST "https://<account>.snowflakecomputing.com/api/v2/databases/<db>/schemas/<schema>/mcp-servers/<server>" \
	-H "Authorization: Bearer $TOKEN" \
	-H "X-Snowflake-Authorization-Token-Type: OAUTH" \
	-H "X-Snowflake-Role: SYSADMIN" \
	-H "Content-Type: application/json" \
	-d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

If this fails, fix Entra or Snowflake first. Do not start by debugging VS Code.

## Install And Configure The Extension

Once Entra and Snowflake are ready, the extension setup is small.

### 1. Install Azure CLI and sign in

The current implementation requires Azure CLI at runtime. This is not optional.

```bash
az login
```

### 2. Configure the extension settings

Set these values in VS Code settings:

- `snowflakeMcp.endpointUrl`
- `snowflakeMcp.azureAppIdUri`
- `snowflakeMcp.azureTenantId` if you want to force a specific tenant
- `snowflakeMcp.role`
- `snowflakeMcp.serverLabel`
- `snowflakeMcp.useAzureCli` and leave it as `true`

Example:

```json
{
	"snowflakeMcp.endpointUrl": "https://<account>.snowflakecomputing.com/api/v2/databases/MCP_DB/schemas/MCP_SCHEMA/mcp-servers/SQL_EXEC_SERVER",
	"snowflakeMcp.azureAppIdUri": "api://<app-id>",
	"snowflakeMcp.azureTenantId": "<tenant-id>",
	"snowflakeMcp.role": "SYSADMIN",
	"snowflakeMcp.serverLabel": "snowflakeMcpAzAuth",
	"snowflakeMcp.useAzureCli": true
}
```

Notes:

- `snowflakeMcp.endpointUrl` must be a valid `http` or `https` URL
- `snowflakeMcp.azureAppIdUri` is required
- `snowflakeMcp.useAzureCli` must remain enabled in the current release

You can also keep equivalent local values in [.env.example](.env.example) for development reference.

### 3. Test from the Command Palette

Run these commands:

- `Snowflake MCP: Refresh Azure Token`
- `Snowflake MCP: Test Connection`
- `Snowflake MCP: Show Effective Configuration`

Expected result:

- token refresh succeeds
- connection test returns success from Snowflake
- effective configuration shows no configuration issues

## Settings Reference

| Setting | Required | Meaning |
|---|---|---|
| `snowflakeMcp.endpointUrl` | Yes | Full Snowflake MCP endpoint URL |
| `snowflakeMcp.azureAppIdUri` | Yes | Entra Application ID URI used as token audience |
| `snowflakeMcp.azureTenantId` | No | Tenant override passed to Azure CLI |
| `snowflakeMcp.role` | No | Snowflake role sent in `X-Snowflake-Role` |
| `snowflakeMcp.serverLabel` | No | Display label for the MCP server inside VS Code |
| `snowflakeMcp.useAzureCli` | Yes | Must remain `true` in the current implementation |

## Development

```bash
npm install
npm run check
npm run build
npm test
```

To create a VSIX locally:

```bash
npm run package:vsix
```

## Troubleshooting

### `az account get-access-token` fails

Usually one of these is wrong:

- wrong tenant
- missing app consent
- Azure CLI was not pre-authorized on the app registration
- wrong `snowflakeMcp.azureAppIdUri`

Try:

```bash
az login --scope "api://<app-id>/session:role-any" --allow-no-subscriptions
```

### The Snowflake test returns `404`

Check the endpoint URL.

The correct form is:

```text
/api/v2/databases/<db>/schemas/<schema>/mcp-servers/<server>
```

Do not append `/mcp`.

### The Snowflake test returns auth or role errors

Usually one of these is wrong:

- the token audience does not match `EXTERNAL_OAUTH_AUDIENCE_LIST`
- the token issuer does not match `EXTERNAL_OAUTH_ISSUER`
- the user could not be mapped from the token claim
- the chosen role is not granted to the user
- the chosen role is blocked for External OAuth

### Guest or external users cannot connect

Use `email` claim mapping unless you have verified that `upn` is always present in your tenant scenario.

For guest users, ensure the Snowflake user's `EMAIL` attribute matches the Entra token's `email` claim.

## Current Limitation

Runtime authentication currently depends on Azure CLI.

If you disable `snowflakeMcp.useAzureCli`, the extension reports a configuration error. Extension-managed sign-in is not implemented yet.

## Reference Material

The setup described above is based on the validated Snowflake MCP work in the upstream project:

- <https://github.com/MiguelElGallo/mpz/tree/main/snowflake-mcp>

## Support

Issues and feature requests: <https://github.com/MiguelElGallo/snowmcpaz/issues>
