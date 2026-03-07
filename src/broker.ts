import readline from 'node:readline';

import {
  assertValidConfig,
  forwardJsonRpcRequest,
  readConfigFromEnv,
  type JsonRpcRequest,
} from './common';

const config = readConfigFromEnv();

function writeJson(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function writeError(id: string | number | null, message: string, code = -32000): void {
  writeJson({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  });
}

async function handleLine(line: string): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  let payload: JsonRpcRequest;
  let requestId: string | number | null = null;

  try {
    const parsed = JSON.parse(trimmed) as Partial<JsonRpcRequest>;
    requestId = parsed.id ?? null;

    if (parsed.jsonrpc !== '2.0' || typeof parsed.method !== 'string') {
      writeError(requestId, 'Invalid JSON-RPC request object.', -32600);
      return;
    }

    payload = parsed as JsonRpcRequest;
  } catch (error) {
    writeError(requestId, `Invalid JSON-RPC payload: ${String(error)}`, -32700);
    return;
  }

  try {
    const response = await forwardJsonRpcRequest(config, payload);

    if (response.body !== undefined) {
      writeJson(response.body);
      return;
    }

    if (payload.id !== undefined) {
      writeError(requestId, `Snowflake MCP returned HTTP ${response.status} without a JSON response.`);
    }
  } catch (error) {
    writeError(requestId, String(error));
  }
}

try {
  assertValidConfig(config);
} catch (error) {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

let sequence = Promise.resolve();

rl.on('line', (line) => {
  sequence = sequence.then(() => handleLine(line)).catch((error) => {
    process.stderr.write(`${String(error)}\n`);
  });
});

rl.on('close', () => {
  void sequence.finally(() => process.exit(0));
});
