# snowmcpaz

[![CI](https://github.com/MiguelElGallo/snowmcpaz/actions/workflows/ci.yml/badge.svg)](https://github.com/MiguelElGallo/snowmcpaz/actions/workflows/ci.yml)

VS Code extension that registers a local MCP broker for a Snowflake-managed MCP server and authenticates requests with a Microsoft Entra token acquired from Azure CLI.

## What It Does

- Registers a VS Code MCP server definition provider on startup.
- Spawns a local Node.js stdio broker that forwards JSON-RPC requests to the configured Snowflake MCP endpoint.
- Acquires an access token through Azure CLI and retries once on HTTP 401.
- Exposes commands to refresh the token, test connectivity, and inspect the effective configuration.

## Quick Start

1. Install Azure CLI and log in with an account that can request a token for your Microsoft Entra application.
2. Set `snowflakeMcp.endpointUrl` to your Snowflake MCP server endpoint.
3. Set `snowflakeMcp.azureAppIdUri` to your Entra Application ID URI, for example `api://<app-id>`.
4. Optionally set `snowflakeMcp.azureTenantId` and `snowflakeMcp.role`.
5. Run `Snowflake MCP: Test Connection` from the Command Palette.

## Commands

- `Snowflake MCP: Refresh Azure Token`
- `Snowflake MCP: Test Connection`
- `Snowflake MCP: Show Effective Configuration`

## Configuration

Set the extension settings in VS Code or through your user settings JSON:

- `snowflakeMcp.endpointUrl`: Snowflake MCP endpoint URL.
- `snowflakeMcp.azureAppIdUri`: Microsoft Entra Application ID URI used for the token audience.
- `snowflakeMcp.azureTenantId`: optional tenant override for Azure CLI token acquisition.
- `snowflakeMcp.role`: Snowflake role sent through `X-Snowflake-Role`.
- `snowflakeMcp.serverLabel`: label exposed in VS Code for the MCP server.
- `snowflakeMcp.useAzureCli`: must remain `true` in the current implementation.

You can also keep local development values in [.env.example](.env.example).

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

## Current Limitation

Runtime authentication still depends on Azure CLI. Extension-managed Azure sign-in is the next major feature if you want the broker to stop depending on `az account get-access-token`.

## Support

Issues and feature requests: [GitHub Issues](https://github.com/MiguelElGallo/snowmcpaz/issues)

## Marketplace Readiness

The repo now builds, tests, and packages locally. The main manual item still left before publishing is replacing the placeholder publisher ID in [package.json](/Users/miguelp/github/snowmcpaz/package.json) with your real Marketplace publisher identity.
