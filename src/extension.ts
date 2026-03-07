import path from 'node:path';

import * as vscode from 'vscode';

import {
  ConfigurationError,
  EXTENSION_VERSION,
  acquireAzureCliToken,
  listConfigurationIssues,
  pingSnowflakeEndpoint,
  resolveConfig,
  type ResolvedConfig,
} from './common';

const PROVIDER_ID = 'snowflake-mcp-vscode.provider';

function readConfiguration(): ResolvedConfig {
  const config = vscode.workspace.getConfiguration('snowflakeMcp');

  return resolveConfig({
    endpointUrl: config.get<string>('endpointUrl'),
    azureAppIdUri: config.get<string>('azureAppIdUri'),
    azureTenantId: config.get<string>('azureTenantId'),
    role: config.get<string>('role'),
    serverLabel: config.get<string>('serverLabel'),
    useAzureCli: config.get<boolean>('useAzureCli'),
  });
}

function brokerEnv(config: ResolvedConfig): Record<string, string> {
  return {
    ...process.env,
    SNOWFLAKE_MCP_URL: config.endpointUrl,
    AZURE_APP_ID_URI: config.azureAppIdUri,
    AZURE_TENANT_ID: config.azureTenantId,
    SNOWFLAKE_MCP_ROLE: config.role,
    SNOWFLAKE_SERVER_LABEL: config.serverLabel,
    SNOWFLAKE_USE_AZURE_CLI: String(config.useAzureCli),
  } as Record<string, string>;
}

function brokerPath(context: vscode.ExtensionContext): string {
  return path.join(context.extensionPath, 'dist', 'broker.js');
}

class SnowflakeMcpProvider implements vscode.McpServerDefinitionProvider<vscode.McpStdioServerDefinition> {
  private readonly changeEmitter = new vscode.EventEmitter<void>();

  readonly onDidChangeMcpServerDefinitions = this.changeEmitter.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  private createDefinition(config: ResolvedConfig): vscode.McpStdioServerDefinition {
    return new vscode.McpStdioServerDefinition(
      config.serverLabel,
      process.execPath,
      [brokerPath(this.context)],
      brokerEnv(config),
      EXTENSION_VERSION,
    );
  }

  refresh(): void {
    this.changeEmitter.fire();
  }

  provideMcpServerDefinitions(): vscode.ProviderResult<vscode.McpStdioServerDefinition[]> {
    const config = readConfiguration();
    const issues = listConfigurationIssues(config);
    if (issues.length > 0) {
      return [];
    }

    return [this.createDefinition(config)];
  }

  async resolveMcpServerDefinition(
    _server: vscode.McpStdioServerDefinition,
  ): Promise<vscode.McpStdioServerDefinition | undefined> {
    const config = readConfiguration();
    const issues = listConfigurationIssues(config);
    if (issues.length > 0) {
      throw new ConfigurationError(issues.join(' '));
    }

    return this.createDefinition(config);
  }
}

async function showEffectiveConfiguration(): Promise<void> {
  const config = readConfiguration();
  const content = JSON.stringify(
    {
      ...config,
      configurationIssues: listConfigurationIssues(config),
    },
    null,
    2,
  );

  const document = await vscode.workspace.openTextDocument({
    language: 'json',
    content,
  });

  await vscode.window.showTextDocument(document, { preview: false });
}

async function refreshAzureToken(): Promise<void> {
  const config = readConfiguration();
  const token = await acquireAzureCliToken(config);
  const expiry = token.expiresOn ? ` Expires: ${token.expiresOn}.` : '';
  void vscode.window.showInformationMessage(`Azure token refresh succeeded.${expiry}`);
}

async function testConnection(): Promise<void> {
  const config = readConfiguration();
  const response = await pingSnowflakeEndpoint(config);

  const body = response.body as { error?: { message?: string } } | undefined;
  if (response.status >= 400 || body?.error) {
    const message = body?.error?.message ?? `Snowflake MCP test failed with HTTP ${response.status}.`;
    throw new Error(message);
  }

  void vscode.window.showInformationMessage(`Snowflake MCP connection succeeded (HTTP ${response.status}).`);
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new SnowflakeMcpProvider(context);

  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, provider),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('snowflakeMcp')) {
        provider.refresh();
      }
    }),
    vscode.commands.registerCommand('snowflakeMcp.showConfiguration', async () => {
      await showEffectiveConfiguration();
    }),
    vscode.commands.registerCommand('snowflakeMcp.refreshAzureToken', async () => {
      try {
        await refreshAzureToken();
      } catch (error) {
        void vscode.window.showErrorMessage(String(error));
      }
    }),
    vscode.commands.registerCommand('snowflakeMcp.testConnection', async () => {
      try {
        await testConnection();
      } catch (error) {
        void vscode.window.showErrorMessage(String(error));
      }
    }),
  );
}

export function deactivate(): void {}
