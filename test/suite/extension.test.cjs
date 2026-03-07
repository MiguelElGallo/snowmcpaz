const assert = require('node:assert/strict');
const vscode = require('vscode');

suite('snowflake-mcp-vscode', () => {
  test('activates and exposes the extension commands', async () => {
    const extension = vscode.extensions.all.find(
      (candidate) => candidate.packageJSON && candidate.packageJSON.name === 'snowflake-mcp-vscode',
    );

    assert.ok(extension, 'Expected the extension to be available in the test host.');

    await extension.activate();
    assert.equal(extension.isActive, true);

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('snowflakeMcp.refreshAzureToken'));
    assert.ok(commands.includes('snowflakeMcp.testConnection'));
    assert.ok(commands.includes('snowflakeMcp.showConfiguration'));
  });

  test('showConfiguration opens a JSON document with resolved settings', async () => {
    await vscode.commands.executeCommand('snowflakeMcp.showConfiguration');

    const document = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document;
    assert.ok(document, 'Expected showConfiguration to open a document.');

    const payload = JSON.parse(document.getText());
    assert.equal(payload.serverLabel, 'snowflakeMcpAzAuth');
    assert.equal(Array.isArray(payload.configurationIssues), true);
  });
});