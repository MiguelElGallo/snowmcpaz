# Snowflake MCP VS Code Extension Plan

## Goal

Build a clean sibling project that can be moved into its own repository and published to the VS Code Marketplace as a VS Code extension. The extension should register a local Node.js MCP broker that forwards requests to a Snowflake-managed MCP server using Microsoft Entra authentication.

## Phase 1

1. Scaffold the extension manifest, build, and source layout.
2. Implement a local Node.js broker that mirrors the working Python behavior:
   - newline-delimited stdio JSON-RPC
   - Azure CLI token acquisition
   - Snowflake header injection
   - retry once on 401
3. Register the broker through a VS Code MCP server definition provider.
4. Add commands to refresh token, test connectivity, and inspect the resolved configuration.
5. Document settings, packaging, and publishing.

## Phase 2

1. Replace Azure CLI-only auth with extension-managed sign-in where appropriate.
2. Add a setup wizard.
3. Add tests and CI packaging.
4. Prepare Marketplace branding and publisher metadata.

## Current Scope

This folder implements Phase 1 with minimal dependencies and without editing the existing Python-based project.
