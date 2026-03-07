import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile, chmod } from 'node:fs/promises';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..');
const brokerPath = path.join(repoRoot, 'dist', 'broker.js');

async function createFakeAzureCli() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'snowmcpaz-az-'));
  const scriptPath = path.join(tempDir, 'az');
  await writeFile(
    scriptPath,
    '#!/bin/sh\nprintf \'{"accessToken":"stub-token","expiresOn":"2099-01-01T00:00:00Z"}\'',
    'utf8',
  );
  await chmod(scriptPath, 0o755);
  return tempDir;
}

function startBroker(envOverrides) {
  const child = spawn(process.execPath, [brokerPath], {
    env: {
      ...process.env,
      ...envOverrides,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  return child;
}

async function readSingleLine(stream) {
  let buffer = '';
  for await (const chunk of stream) {
    buffer += chunk;
    const newlineIndex = buffer.indexOf('\n');
    if (newlineIndex >= 0) {
      return buffer.slice(0, newlineIndex);
    }
  }

  throw new Error('Stream ended before a line was emitted.');
}

test('broker forwards JSON-RPC requests with Azure auth and Snowflake role header', async (t) => {
  const azureCliDir = await createFakeAzureCli();
  const seen = { headers: null, body: '' };

  const server = createServer(async (request, response) => {
    seen.headers = request.headers;

    for await (const chunk of request) {
      seen.body += chunk;
    }

    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ jsonrpc: '2.0', id: 7, result: { tools: [] } }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected an ephemeral test port.');
  }

  const child = startBroker({
    PATH: `${azureCliDir}:${process.env.PATH}`,
    SNOWFLAKE_MCP_URL: `http://127.0.0.1:${address.port}`,
    AZURE_APP_ID_URI: 'api://snowflake-mcp-test',
    SNOWFLAKE_MCP_ROLE: 'CUSTOMROLE',
    SNOWFLAKE_USE_AZURE_CLI: 'true',
  });

  t.after(async () => {
    child.stdin.end();
    child.kill();
    server.close();
    await rm(azureCliDir, { recursive: true, force: true });
  });

  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list', params: {} })}\n`);

  const line = await readSingleLine(child.stdout);
  const response = JSON.parse(line);

  assert.equal(response.id, 7);
  assert.deepEqual(response.result, { tools: [] });
  assert.equal(seen.headers.authorization, 'Bearer stub-token');
  assert.equal(seen.headers['x-snowflake-role'], 'CUSTOMROLE');
  assert.equal(JSON.parse(seen.body).method, 'tools/list');
});

test('broker returns invalid request for non-2.0 JSON-RPC payloads', async (t) => {
  const azureCliDir = await createFakeAzureCli();
  const child = startBroker({
    PATH: `${azureCliDir}:${process.env.PATH}`,
    SNOWFLAKE_MCP_URL: 'http://127.0.0.1:9',
    AZURE_APP_ID_URI: 'api://snowflake-mcp-test',
    SNOWFLAKE_USE_AZURE_CLI: 'true',
  });

  t.after(async () => {
    child.stdin.end();
    child.kill();
    await rm(azureCliDir, { recursive: true, force: true });
  });

  child.stdin.write(`${JSON.stringify({ jsonrpc: '1.0', id: 3, method: 'tools/list' })}\n`);

  const line = await readSingleLine(child.stdout);
  const response = JSON.parse(line);

  assert.equal(response.id, 3);
  assert.equal(response.error.code, -32600);
});