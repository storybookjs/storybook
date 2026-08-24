import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const port = process.env.STORYBOOK_MCP_PORT || '6006';
const mcpUrl = 'http://127.0.0.1:' + port + '/mcp';
const logPath = process.env.STORYBOOK_MCP_LOG_PATH || '/tmp/storybook-mcp.log';
const parsedTimeoutMs = Number(process.env.STORYBOOK_MCP_TIMEOUT_MS);
const timeoutMs =
  Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs > 0 ? parsedTimeoutMs : 60_000;

if (await isReady()) {
  await dumpMcpDebug();
  process.exit(0);
}

const log = openSync(logPath, 'a');
const child = spawn('npm', ['run', 'storybook', '--', '--port', port], {
  detached: true,
  env: {
    ...process.env,
    BROWSER: 'none',
    CI: '1',
  },
  stdio: ['ignore', log, log],
});

let spawnError;
child.on('error', (error) => {
  spawnError = error;
});

child.unref();
closeSync(log);

const deadline = Date.now() + timeoutMs;
while (Date.now() < deadline) {
  if (spawnError !== undefined) {
    throw new Error('Failed to spawn Storybook: ' + spawnError.message);
  }

  if (await isReady()) {
    await dumpMcpDebug();
    process.exit(0);
  }

  await delay(1_000);
}

// Kill the detached process group so a failed start does not leak a background
// Storybook that keeps the port occupied for the next attempt.
if (child.pid !== undefined) {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // Already exited.
  }
}

// The sandbox is torn down with this failure, so the only diagnostics that
// survive are the final stderr lines: the eval harness snapshots a failed
// npm install as its last 10 lines of output, and npm's own error trailer
// takes about half of that window. Print the log tail last and exit without
// throwing — an uncaught error's stack and Node's version banner would push
// the log out of the window (and the in-sandbox dumpMcpDebug() files die
// with the sandbox, so there is no point writing them here).
const logTail = await readFile(logPath, 'utf8')
  .then((content) => content.trimEnd().split('\n').slice(-5).join('\n'))
  .catch(() => '(no Storybook log was written)');

process.stderr.write(
  'Storybook MCP server did not become ready at ' +
    mcpUrl +
    ' within ' +
    timeoutMs +
    'ms. Storybook log tail:\n' +
    logTail +
    '\n'
);
process.exit(1);

async function isReady() {
  try {
    return await initializeMcp();
  } catch {
    return false;
  }
}

// Snapshot MCP diagnostics into the workspace so eval result snapshots
// capture them: the addon's landing page (which explains per-toolset why a
// tool is disabled), the MCP server instructions actually served, and the
// Storybook startup log.
async function dumpMcpDebug() {
  const debugDir = '.storybook/mcp-debug';
  try {
    await mkdir(debugDir, { recursive: true });

    // The startup log first: on the failure path the fetches below throw, and the
    // log is the one artifact that explains why Storybook never became ready.
    await copyFile(logPath, debugDir + '/storybook.log').catch(() => {});

    const landing = await fetch(mcpUrl, {
      headers: { Accept: 'text/html' },
      signal: AbortSignal.timeout(5_000),
    });
    await writeFile(debugDir + '/landing.html', await landing.text());

    const init = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'agent-eval-mcp-debug', version: '1.0.0' },
        },
      }),
      signal: AbortSignal.timeout(5_000),
    });
    await writeFile(debugDir + '/initialize.txt', await init.text());
  } catch (error) {
    await writeFile(debugDir + '/error.txt', String(error)).catch(() => {});
  }
}

async function initializeMcp() {
  const response = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'agent-eval-storybook-mcp-ready', version: '1.0.0' },
      },
    }),
    signal: AbortSignal.timeout(5_000),
  });

  // Drain the body so the polling loop does not accumulate open sockets.
  await response.body?.cancel();
  return response.ok;
}
