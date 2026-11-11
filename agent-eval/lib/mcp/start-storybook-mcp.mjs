import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const port = process.env.STORYBOOK_MCP_PORT || '6006';
const storybookUrl = 'http://127.0.0.1:' + port;
const mcpUrl = storybookUrl + '/mcp';
// Only the MCP experiments keep @storybook/addon-mcp, so only they have an MCP endpoint to wait for.
const usesMcp =
  JSON.parse(await readFile('__agent_eval__/agent.json', 'utf8')).integration === 'mcp';
const readyUrl = usesMcp ? mcpUrl : storybookUrl + '/index.json';
const logPath = process.env.STORYBOOK_MCP_LOG_PATH || '/tmp/storybook-mcp.log';
const parsedTimeoutMs = Number(process.env.STORYBOOK_MCP_TIMEOUT_MS);
const timeoutMs =
  Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs > 0 ? parsedTimeoutMs : 60_000;

await assertCheckoutPackagesInstalled();

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

// Failure path. This script runs from a package.json postinstall hook during
// `npm install`, inside a disposable @vercel/agent-eval sandbox. When
// Storybook never becomes ready, the sandbox is destroyed: files written in
// it (like the ones dumpMcpDebug() would write) are lost, and the eval
// report keeps only the last 10 lines of npm's output — about half of which
// npm's own "npm error" trailer fills. Those few surviving lines are the
// only diagnostics anyone will ever see. So: print the Storybook log tail
// as the very last stderr output, don't throw (a stack trace would push the
// tail out of the window), and set exitCode rather than calling
// process.exit(), which can truncate a pending pipe write.
const logTail = await readFile(logPath, 'utf8')
  .then((content) => content.trimEnd().split('\n').slice(-5).join('\n'))
  .catch(() => '')
  .then((tail) => tail || '(no Storybook log was written)');

process.stderr.write(
  'Storybook did not become ready at ' +
    readyUrl +
    ' within ' +
    timeoutMs +
    'ms. Storybook log tail:\n' +
    logTail +
    '\n'
);
process.exitCode = 1;

// The checkout carries the same version as a published release, so a package the harness packed
// that npm still resolved from the registry installs without any error. The harness writes
// local-packages/packages.json only when it installs Storybook from the checkout.
async function assertCheckoutPackagesInstalled() {
  let checkoutPackages;
  try {
    checkoutPackages = new Set(JSON.parse(await readFile('local-packages/packages.json', 'utf8')));
  } catch {
    return;
  }
  const lockfile = JSON.parse(await readFile('package-lock.json', 'utf8'));

  const fromRegistry = Object.entries(lockfile.packages)
    .filter(([location, entry]) => {
      const nameStart = location.lastIndexOf('node_modules/');
      return (
        nameStart !== -1 &&
        checkoutPackages.has(location.slice(nameStart + 'node_modules/'.length)) &&
        !entry.resolved?.startsWith('file:')
      );
    })
    .map(([location, entry]) => location + ' (' + entry.resolved + ')');

  if (fromRegistry.length > 0) {
    // Wait for the write to flush: process.exit() can truncate a pending pipe write.
    await new Promise((resolve) =>
      process.stderr.write(
        'Installed from the registry instead of the checkout:\n' + fromRegistry.join('\n') + '\n',
        resolve
      )
    );
    process.exit(1);
  }
}

async function isReady() {
  try {
    return usesMcp ? await initializeMcp() : await servesStoryIndex();
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

    // The startup log first, so it is captured even when the fetches below throw.
    await copyFile(logPath, debugDir + '/storybook.log').catch(() => {});

    if (!usesMcp) {
      return;
    }

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

async function servesStoryIndex() {
  const response = await fetch(storybookUrl + '/index.json', {
    signal: AbortSignal.timeout(5_000),
  });

  await response.body?.cancel();
  return response.ok;
}
