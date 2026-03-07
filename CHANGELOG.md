# Changelog

## 0.0.5

- Rewrites the README around role-based setup, with clearer end-user, Entra admin, and Snowflake admin paths.
- Adds an Entra admin checklist document for app registration, Azure CLI pre-authorization, consent handling, and handoff.
- Documents the required Snowflake External OAuth authorization integration more explicitly before extension use.

## 0.0.4

- Overrides vulnerable transitive dev dependencies pulled in through Mocha.
- Resolves the `serialize-javascript` RCE advisory and the related `diff` advisory in the development toolchain.

## 0.0.3

- Fixes the extension-reported protocol version metadata to match the published package version.
- Fixes the tag-driven release workflow to use the correct `vsce publish` invocation for prebuilt VSIX files.

## 0.0.2

- Adds Marketplace icon and gallery banner metadata.
- Improves README quick-start and support information for the public listing.
- Adds deterministic tag-driven release automation for future publishes.
- Optimizes VSIX packaging with `.vscodeignore`.

## 0.0.1

- Initial public release of the Snowflake MCP VS Code extension.
- Adds a local stdio MCP broker that forwards JSON-RPC requests to Snowflake.
- Uses Azure CLI-issued Microsoft Entra tokens and retries once on HTTP 401.
- Adds commands for token refresh, connection testing, and effective configuration inspection.
- Current limitation: runtime auth still depends on Azure CLI rather than extension-managed sign-in.
