import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const port = process.env.STORYBOOK_MCP_PORT || '6006';
const mcpUrl = 'http://127.0.0.1:' + port + '/mcp';
const logPath = process.env.STORYBOOK_MCP_LOG_PATH || '/tmp/storybook-mcp.log';
const parsedTimeoutMs = Number(process.env.STORYBOOK_MCP_TIMEOUT_MS);
const timeoutMs =
	Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs > 0 ? parsedTimeoutMs : 60_000;

if (await isReady()) {
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

child.unref();
closeSync(log);

const deadline = Date.now() + timeoutMs;
while (Date.now() < deadline) {
	if (await isReady()) {
		process.exit(0);
	}

	await delay(1_000);
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

	return response.ok;
}
