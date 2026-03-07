# Entra Admin Checklist

Use this document when you are the Microsoft Entra administrator preparing the OAuth side for the Snowflake MCP VS Code extension.

This extension does not manage Entra sign-in itself. At runtime it calls Azure CLI, so the goal is simple: users must be able to run `az account get-access-token` for the Snowflake audience and receive a valid token that Snowflake will accept.

## Outcome

You are done when all of the following are true:

- users can get a token for `api://<application-client-id>`
- the token contains the expected audience and scope
- Snowflake trusts that same audience
- end users know the Application ID URI and tenant ID they should use

## Values To Record

Record these values before you hand off to users or the Snowflake admin:

- Tenant ID
- Application (client) ID
- Application ID URI, for example `api://e78b3971-ac83-4da7-ba8e-c99e42e5e8b9`
- Whether your org requires users to specify the tenant explicitly during `az login`

Important:

- use the Application (client) ID as the `<app-id>` portion unless your organization intentionally uses a custom URI
- do not hand users the app display name as the audience
- if you use a custom Application ID URI instead of `api://<application-client-id>`, the Snowflake admin must configure that exact same URI in `EXTERNAL_OAUTH_AUDIENCE_LIST`

## Portal Checklist

### 1. Create or confirm the app registration

Target shape:

- single-tenant in most cases
- display name such as `Snowflake MCP OAuth`
- Application ID URI in the form `api://<application-client-id>`

### 2. Expose the API

Portal path:

- App registrations
- Your app
- Expose an API

Create or confirm:

- Application ID URI
- delegated permission named `session:role-any`

Expected result:

- users can request a token for your app audience
- the scope appears in the token as `scp`

### 3. Pre-authorize Azure CLI

Portal path:

- App registrations
- Your app
- Expose an API
- Authorized client applications

Add Azure CLI as an authorized client application:

```text
04b07795-8ddb-461a-bbee-02f9e1bf7b46
```

Grant it the delegated permission for `session:role-any`.

This step is separate from general admin consent. It tells your app registration that Azure CLI may request tokens for this audience.

### 4. Handle consent

Recommended default: grant admin consent if your tenant uses restrictive consent settings.

If your tenant allows user consent, users may be able to complete the first consent-bearing login themselves. If your tenant is restrictive, do not rely on that. Grant consent centrally.

If consent is not handled, users typically see an Entra error such as `AADSTS65001`.

### 5. Confirm tenant scope

If you are using a single-tenant app registration, only users from that tenant should expect token acquisition to work.

If you need multi-tenant behavior, design and validate that separately. This repository assumes the simpler single-tenant path.

## Validation

Run these checks with an account that represents a real extension user.

### 1. Login

```bash
az login
```

If you want to exercise consent on the exact scope:

```bash
az login --scope "api://<app-id>/session:role-any" --allow-no-subscriptions
```

### 2. Request a token

```bash
az account get-access-token --resource "api://<app-id>" --output json
```

Expected result:

- command succeeds
- output contains `accessToken`

### 3. Inspect the important claims

Check the issued token for:

- `aud = api://<app-id>`
- `scp` contains `session:role-any`
- `iss` matches the issuer Snowflake will trust
- `email` is present if Snowflake maps by email

Use an approved JWT inspection workflow in your environment.

If your organization does not emit `email` reliably for all users, especially across guest and non-guest scenarios, decide that before the Snowflake side is finalized. In that case, you may need a different mapping claim such as `upn`, but only if it is present for every intended user.

## Handoff To The Snowflake Admin

Give the Snowflake admin these exact values:

- Tenant ID
- Application ID URI
- Issuer format expected by your token flow, commonly `https://sts.windows.net/<tenant-id>/`
- JWKS URL, commonly `https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys`

The Snowflake admin must use the same audience and issuer values in the External OAuth integration.

That means the Snowflake admin still has a required implementation step on their side: they must create the Snowflake External OAuth authorization integration or security integration that trusts this Entra app.

## Handoff To End Users

Give end users these exact values:

- `snowflakeMcp.azureAppIdUri`
- `snowflakeMcp.azureTenantId` if tenant pinning is required

Also tell them whether they should run a normal `az login` or a tenant-specific sign-in flow.

The end user also needs values that come from the Snowflake side:

- `snowflakeMcp.endpointUrl`
- the Snowflake role they are expected to send in `X-Snowflake-Role`

Keep the handoff split explicit:

- Entra admin provides tenant and application audience values
- Snowflake admin provides endpoint and role values

## Common Failure Modes

### Users cannot get a token

Usually one of these is true:

- Azure CLI was not added under Authorized client applications
- consent has not been granted or allowed
- the user is signing into the wrong tenant
- the user was given the wrong audience

### Snowflake rejects the token even though Azure CLI succeeds

Usually one of these is true:

- Snowflake is configured with the wrong audience
- Snowflake is configured with the wrong issuer
- Snowflake expects a claim mapping that the token does not provide

### Guest users are inconsistent

Guest users often have claim differences. If Snowflake maps by email, verify that the issued token really contains the `email` claim and that it matches the Snowflake field mapped by the integration, typically the user's `email_address` value. If your organization includes guest users, verify claim availability with the Snowflake admin before finalizing the External OAuth configuration.