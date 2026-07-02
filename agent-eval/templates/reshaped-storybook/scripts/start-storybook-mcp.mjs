import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
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

throw new Error(
	'Storybook MCP server did not become ready at ' +
		mcpUrl +
		' within ' +
		timeoutMs +
		'ms. See ' +
		logPath +
		' for Storybook logs.',
);

async function isReady() {
	try {
		return await initializeMcp();
	} catch {
		return false;
	}
}

// Temporary diagnostics for the docs-toolset regression hunt: snapshot the
// addon's landing page (which explains per-toolset why a tool is disabled),
// the MCP server instructions, and the Storybook startup log into the
// workspace so eval result snapshots capture them.
async function dumpMcpDebug() {
	const debugDir = '.storybook/mcp-debug';
	try {
		await mkdir(debugDir, { recursive: true });

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

		await copyFile(logPath, debugDir + '/storybook.log').catch(() => {});
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
