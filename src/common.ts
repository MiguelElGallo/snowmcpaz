import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_ROLE = 'SYSADMIN';
const REQUEST_TIMEOUT_MS = 30000;

export const MCP_PROTOCOL_VERSION = '2024-11-05';
export const EXTENSION_VERSION = '0.0.4';

export interface ResolvedConfig {
  endpointUrl: string;
  azureAppIdUri: string;
  azureTenantId: string;
  role: string;
  serverLabel: string;
  useAzureCli: boolean;
}

export interface AzureCliToken {
  accessToken: string;
  expiresOn?: string;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponseEnvelope {
  status: number;
  body: unknown;
  bodyText: string;
  token: AzureCliToken;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function resolveConfig(input: Partial<ResolvedConfig>): ResolvedConfig {
  return {
    endpointUrl: (input.endpointUrl ?? '').trim(),
    azureAppIdUri: (input.azureAppIdUri ?? '').trim(),
    azureTenantId: (input.azureTenantId ?? '').trim(),
    role: (input.role ?? DEFAULT_ROLE).trim() || DEFAULT_ROLE,
    serverLabel: (input.serverLabel ?? 'snowflakeMcpAzAuth').trim() || 'snowflakeMcpAzAuth',
    useAzureCli: input.useAzureCli ?? true,
  };
}

export function readConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ResolvedConfig {
  return resolveConfig({
    endpointUrl: env.SNOWFLAKE_MCP_URL,
    azureAppIdUri: env.AZURE_APP_ID_URI,
    azureTenantId: env.AZURE_TENANT_ID,
    role: env.SNOWFLAKE_MCP_ROLE,
    serverLabel: env.SNOWFLAKE_SERVER_LABEL,
    useAzureCli: env.SNOWFLAKE_USE_AZURE_CLI !== 'false',
  });
}

export function listConfigurationIssues(config: ResolvedConfig): string[] {
  const issues: string[] = [];

  if (!config.endpointUrl) {
    issues.push('snowflakeMcp.endpointUrl is required.');
  } else {
    try {
      const parsed = new URL(config.endpointUrl);
      if (!/^https?:$/.test(parsed.protocol)) {
        issues.push('snowflakeMcp.endpointUrl must use http or https.');
      }
    } catch {
      issues.push('snowflakeMcp.endpointUrl must be a valid URL.');
    }
  }

  if (!config.azureAppIdUri) {
    issues.push('snowflakeMcp.azureAppIdUri is required.');
  }

  if (!config.useAzureCli) {
    issues.push('snowflakeMcp.useAzureCli must remain enabled until extension-managed sign-in is implemented.');
  }

  return issues;
}

export function assertValidConfig(config: ResolvedConfig): void {
  const issues = listConfigurationIssues(config);
  if (issues.length > 0) {
    throw new ConfigurationError(issues.join(' '));
  }
}

function normalizeAudience(azureAppIdUri: string): { scope: string; resource: string } {
  const resource = azureAppIdUri.replace(/\/.default$/, '');
  return {
    resource,
    scope: `${resource}/.default`,
  };
}

export async function acquireAzureCliToken(config: ResolvedConfig): Promise<AzureCliToken> {
  assertValidConfig(config);

  const audience = normalizeAudience(config.azureAppIdUri);
  const baseArgs = ['account', 'get-access-token', '--output', 'json'];

  if (config.azureTenantId) {
    baseArgs.push('--tenant', config.azureTenantId);
  }

  const attempts = [
    [...baseArgs, '--scope', audience.scope],
    [...baseArgs, '--resource', audience.resource],
  ];

  let lastError: unknown;

  for (const args of attempts) {
    try {
      const { stdout, stderr } = await execFileAsync('az', args, {
        env: process.env,
        timeout: 15000,
        maxBuffer: 1024 * 1024,
      });

      if (stderr.trim()) {
        lastError = new Error(stderr.trim());
      }

      const parsed = JSON.parse(stdout) as { accessToken?: string; expiresOn?: string };

      if (!parsed.accessToken) {
        throw new Error('Azure CLI did not return an access token.');
      }

      return {
        accessToken: parsed.accessToken,
        expiresOn: parsed.expiresOn,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Unable to acquire an Azure access token via Azure CLI. ${String(lastError)}`);
}

async function postJsonRpc(
  config: ResolvedConfig,
  payload: JsonRpcRequest,
  token: AzureCliToken,
): Promise<{ status: number; bodyText: string }> {
  const response = await fetch(config.endpointUrl, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token.accessToken}`,
      'content-type': 'application/json',
      'user-agent': 'snowflake-mcp-vscode',
      'x-snowflake-role': config.role,
    },
    body: JSON.stringify(payload),
  });

  return {
    status: response.status,
    bodyText: await response.text(),
  };
}

export async function forwardJsonRpcRequest(
  config: ResolvedConfig,
  payload: JsonRpcRequest,
): Promise<JsonRpcResponseEnvelope> {
  let token = await acquireAzureCliToken(config);
  let response = await postJsonRpc(config, payload, token);

  if (response.status === 401) {
    token = await acquireAzureCliToken(config);
    response = await postJsonRpc(config, payload, token);
  }

  const trimmed = response.bodyText.trim();
  if (!trimmed) {
    return {
      status: response.status,
      body: undefined,
      bodyText: response.bodyText,
      token,
    };
  }

  try {
    return {
      status: response.status,
      body: JSON.parse(trimmed),
      bodyText: response.bodyText,
      token,
    };
  } catch (error) {
    throw new Error(`Snowflake MCP returned a non-JSON response (${response.status}): ${trimmed || String(error)}`);
  }
}

export async function pingSnowflakeEndpoint(config: ResolvedConfig): Promise<JsonRpcResponseEnvelope> {
  const initializeRequest: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: 'connection-test',
    method: 'initialize',
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'snowflake-mcp-vscode',
        version: EXTENSION_VERSION,
      },
    },
  };

  const initializeResponse = await forwardJsonRpcRequest(config, initializeRequest);
  const body = initializeResponse.body as { error?: unknown } | undefined;
  if (initializeResponse.status < 400 && (!body || !('error' in body))) {
    return initializeResponse;
  }

  return forwardJsonRpcRequest(config, {
    jsonrpc: '2.0',
    id: 'connection-test-tools',
    method: 'tools/list',
    params: {},
  });
}
