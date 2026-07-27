import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const SERVER_SCRIPT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'preview-browser-mock.mjs',
);

const BROWSER_TEST_TIMEOUT_MS = 120_000;
const UUID_PATTERN = /"serverId": "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/;

type JsonRpcResponse = {
	id: number;
	result?: Record<string, unknown>;
	error?: { code: number; message: string };
};

type ToolResult = {
	isError?: boolean;
	content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
};

class McpClient {
	private child: ChildProcessWithoutNullStreams;
	private pending = new Map<number, (response: JsonRpcResponse) => void>();
	private nextId = 1;

	constructor(cwd: string) {
		this.child = spawn(process.execPath, [SERVER_SCRIPT], { cwd });
		createInterface({ input: this.child.stdout }).on('line', (line) => {
			const trimmed = line.trim();
			if (!trimmed) return;
			const response = JSON.parse(trimmed) as JsonRpcResponse;
			const resolve = this.pending.get(response.id);
			if (resolve) {
				this.pending.delete(response.id);
				resolve(response);
			}
		});
	}

	request(method: string, params: Record<string, unknown> = {}): Promise<JsonRpcResponse> {
		const id = this.nextId++;
		const promise = new Promise<JsonRpcResponse>((resolve) => {
			this.pending.set(id, resolve);
		});
		this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
		return promise;
	}

	async callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
		const response = await this.request('tools/call', { name, arguments: args });
		if (response.error) {
			throw new Error(`tools/call ${name} failed: ${response.error.message}`);
		}
		return response.result as ToolResult;
	}

	close(): void {
		this.child.stdin.end();
	}
}

function toolText(result: ToolResult): string {
	return result.content
		.filter((item) => item.type === 'text')
		.map((item) => item.text)
		.join('\n');
}

function startedServerId(result: ToolResult): string {
	const match = UUID_PATTERN.exec(toolText(result));
	expect(match, `expected a serverId in: ${toolText(result)}`).not.toBeNull();
	return (match as RegExpExecArray)[1] as string;
}

async function findFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = createServer();
		probe.once('error', reject);
		probe.listen(0, '127.0.0.1', () => {
			const address = probe.address();
			if (address === null || typeof address === 'string') {
				reject(new Error('Failed to allocate a free port'));
				return;
			}
			probe.close(() => resolve(address.port));
		});
	});
}

async function isChromiumInstalled(): Promise<boolean> {
	try {
		const { chromium } = await import('playwright');
		return existsSync(chromium.executablePath());
	} catch {
		return false;
	}
}

const FIXTURE_SERVER_SCRIPT = `import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? process.argv[2]);
createServer((request, response) => {
	if (request.url === '/api/data') {
		response.setHeader('content-type', 'application/json');
		response.end('{"ok":true}');
		return;
	}
	response.setHeader('content-type', 'text/html');
	response.end(\`<!doctype html>
<html>
	<head><title>Fixture App</title></head>
	<body>
		<h1>Fixture App</h1>
		<button id="counter" style="color: rgb(255, 0, 0)" onclick="this.textContent = 'clicked'">click me</button>
		<input id="name" aria-label="Name" />
		<script>
			console.log('fixture loaded');
			fetch('/api/data');
		</script>
	</body>
</html>\`);
}).listen(port, () => {
	console.log('fixture server listening on ' + port);
	if (process.env.FIXTURE_GREETING) {
		console.log('greeting: ' + process.env.FIXTURE_GREETING);
	}
});
`;

describe('preview-browser MCP protocol', () => {
	let workspace: string;
	let client: McpClient;

	beforeAll(() => {
		workspace = mkdtempSync(path.join(tmpdir(), 'preview-browser-protocol-'));
		client = new McpClient(workspace);
	});

	afterAll(() => {
		client.close();
		rmSync(workspace, { recursive: true, force: true });
	});

	test('initialize identifies the preview-browser server', async () => {
		const response = await client.request('initialize', {
			protocolVersion: '2025-06-18',
			capabilities: {},
			clientInfo: { name: 'preview-browser-test', version: '1.0.0' },
		});
		expect(response.result?.serverInfo).toMatchObject({ name: 'preview-browser' });
	});

	test('responds to ping', async () => {
		const response = await client.request('ping');
		expect(response.result).toEqual({});
	});

	test('tools/list matches the real Claude preview tool surface', async () => {
		const response = await client.request('tools/list');
		const tools = (response.result as { tools: Array<{ name: string; description: string }> })
			.tools;

		expect(tools.map((tool) => tool.name).sort()).toEqual([
			'preview_click',
			'preview_console_logs',
			'preview_eval',
			'preview_fill',
			'preview_inspect',
			'preview_list',
			'preview_logs',
			'preview_network',
			'preview_resize',
			'preview_screenshot',
			'preview_snapshot',
			'preview_start',
			'preview_stop',
		]);

		const start = tools.find((tool) => tool.name === 'preview_start');
		expect(start?.description).toContain("If .claude/launch.json doesn't exist");
		expect(start?.description).toContain('"runtimeExecutable": "<command>"');

		const evaluate = tools.find((tool) => tool.name === 'preview_eval');
		expect(evaluate?.description).toContain(
			'Any DOM modifications via eval are temporary and lost on reload.',
		);
	});

	test('preview_start fails with launch.json instructions when the file is missing', async () => {
		const result = await client.callTool('preview_start', { name: 'Storybook' });
		expect(result.isError).toBe(true);
		expect(toolText(result)).toContain('Failed to start server: No .claude/launch.json found.');
		expect(toolText(result)).toContain('"configurations"');
		expect(toolText(result)).toContain('Check the command in .claude/launch.json and try again.');
	});

	test('preview_start lists available servers when the name matches none of several', async () => {
		mkdirSync(path.join(workspace, '.claude'), { recursive: true });
		writeFileSync(
			path.join(workspace, '.claude', 'launch.json'),
			JSON.stringify({
				version: '0.0.1',
				configurations: [
					{ name: 'Other', runtimeExecutable: 'npm', port: 4000 },
					{ name: 'Second', runtimeExecutable: 'npm', port: 4001 },
				],
			}),
		);
		const result = await client.callTool('preview_start', { name: 'Storybook' });
		expect(result.isError).toBe(true);
		expect(toolText(result)).toContain('No server named "Storybook" found');
		expect(toolText(result)).toContain('Available servers: Other, Second');
	});

	test('preview_start spawns a "program" entry with its env, preview_stop stops it', async () => {
		const port = await findFreePort();
		writeFileSync(path.join(workspace, 'server.mjs'), FIXTURE_SERVER_SCRIPT);
		mkdirSync(path.join(workspace, '.claude'), { recursive: true });
		writeFileSync(
			path.join(workspace, '.claude', 'launch.json'),
			JSON.stringify({
				version: '0.0.1',
				configurations: [
					{
						name: 'ProgramApp',
						program: 'server.mjs',
						args: [String(port)],
						port,
						env: { FIXTURE_GREETING: 'hello-from-env' },
					},
				],
			}),
		);

		const started = await client.callTool('preview_start', { name: 'ProgramApp' });
		expect(started.isError).not.toBe(true);
		expect(toolText(started)).toContain('"reused": false');
		expect(toolText(started)).toContain(`Server started successfully on port ${port}.`);
		const serverId = startedServerId(started);

		const logs = await client.callTool('preview_logs', { serverId });
		expect(toolText(logs)).toContain('greeting: hello-from-env');

		const stopped = await client.callTool('preview_stop', { serverId });
		expect(toolText(stopped)).toBe(`Server ${serverId} stopped`);
	}, 60_000);

	test('preview_start falls back to the only configuration when the name is unknown', async () => {
		// Self-contained config: reusing the previous test's port races against its
		// stopped server fully releasing the port on slower CI runners.
		const port = await findFreePort();
		writeFileSync(path.join(workspace, 'server.mjs'), FIXTURE_SERVER_SCRIPT);
		writeFileSync(
			path.join(workspace, '.claude', 'launch.json'),
			JSON.stringify({
				version: '0.0.1',
				configurations: [{ name: 'ProgramApp', program: 'server.mjs', args: [String(port)], port }],
			}),
		);

		const started = await client.callTool('preview_start', { name: 'WrongName' });
		expect(started.isError).not.toBe(true);
		expect(toolText(started)).toContain('"name": "ProgramApp"');
		const serverId = startedServerId(started);
		await client.callTool('preview_stop', { serverId });
	}, 60_000);

	test('preview_start applies the real autoPort semantics on port conflicts', async () => {
		const busyPort = await findFreePort();
		const blocker = createServer();
		await new Promise<void>((resolve) => {
			blocker.listen(busyPort, '127.0.0.1', () => resolve());
		});

		try {
			writeFileSync(path.join(workspace, 'server.mjs'), FIXTURE_SERVER_SCRIPT);
			const writeConfig = (autoPort: boolean | undefined) => {
				writeFileSync(
					path.join(workspace, '.claude', 'launch.json'),
					JSON.stringify({
						version: '0.0.1',
						configurations: [
							{
								name: 'ConflictApp',
								program: 'server.mjs',
								args: [String(busyPort)],
								port: busyPort,
								...(autoPort === undefined ? {} : { autoPort }),
							},
						],
					}),
				);
			};

			// Unset: the agent must decide by setting autoPort.
			writeConfig(undefined);
			const unset = await client.callTool('preview_start', { name: 'ConflictApp' });
			expect(unset.isError).toBe(true);
			expect(toolText(unset)).toContain(`Port ${busyPort} is in use by`);
			expect(toolText(unset)).toContain('Ask the user:');
			expect(toolText(unset)).toContain('via the PORT environment variable. Then retry.');

			// false: the exact port is required, so the conflict is fatal.
			writeConfig(false);
			const strict = await client.callTool('preview_start', { name: 'ConflictApp' });
			expect(strict.isError).toBe(true);
			expect(toolText(strict)).toContain(
				`Port ${busyPort} is required by this server but is in use by`,
			);

			// true: an ephemeral port is assigned and passed to the server via PORT.
			writeConfig(true);
			const started = await client.callTool('preview_start', { name: 'ConflictApp' });
			expect(started.isError).not.toBe(true);
			expect(toolText(started)).toContain(`Configured port ${busyPort} was in use, so port `);
			expect(toolText(started)).toContain('was assigned instead (autoPort is enabled).');
			const serverId = startedServerId(started);
			const assignedPort = Number(/"port": (\d+)/.exec(toolText(started))?.[1]);
			expect(assignedPort).not.toBe(busyPort);

			const logs = await client.callTool('preview_logs', { serverId });
			expect(toolText(logs)).toContain(`fixture server listening on ${assignedPort}`);

			await client.callTool('preview_stop', { serverId });
		} finally {
			blocker.close();
		}
	}, 60_000);

	test('preview_stop reports unknown server ids', async () => {
		const result = await client.callTool('preview_stop', { serverId: 'unknown-id-123' });
		expect(result.isError).toBe(true);
		expect(toolText(result)).toBe('Server unknown-id-123 not found');
	});

	test('page tools fail only when no preview server is running', async () => {
		const result = await client.callTool('preview_click', {
			serverId: 'preview-99',
			selector: 'button',
		});
		expect(result.isError).toBe(true);
		expect(toolText(result)).toBe('No preview server is running. Call preview_start first.');
	});
});

describe.skipIf(!(await isChromiumInstalled()))('preview-browser with a real browser', () => {
	let workspace: string;
	let client: McpClient;
	let port: number;
	let serverId: string;

	beforeAll(async () => {
		workspace = mkdtempSync(path.join(tmpdir(), 'preview-browser-e2e-'));
		port = await findFreePort();
		writeFileSync(path.join(workspace, 'server.mjs'), FIXTURE_SERVER_SCRIPT);
		mkdirSync(path.join(workspace, '.claude'), { recursive: true });
		writeFileSync(
			path.join(workspace, '.claude', 'launch.json'),
			JSON.stringify({
				version: '0.0.1',
				configurations: [
					{
						name: 'App',
						runtimeExecutable: process.execPath,
						runtimeArgs: ['server.mjs', String(port)],
						port,
					},
				],
			}),
		);
		client = new McpClient(workspace);
		await client.request('initialize', {
			protocolVersion: '2025-06-18',
			capabilities: {},
			clientInfo: { name: 'preview-browser-test', version: '1.0.0' },
		});
	}, BROWSER_TEST_TIMEOUT_MS);

	afterAll(() => {
		client.close();
		rmSync(workspace, { recursive: true, force: true });
	});

	test(
		'starts the launch entry and reuses it on the second call',
		async () => {
			const started = await client.callTool('preview_start', { name: 'App' });
			expect(started.isError).not.toBe(true);
			expect(toolText(started)).toContain('"reused": false');
			expect(toolText(started)).toContain(`Server started successfully on port ${port}.`);
			serverId = startedServerId(started);

			const reused = await client.callTool('preview_start', { name: 'App' });
			expect(toolText(reused)).toContain('"reused": true');
			expect(toolText(reused)).toContain(
				'Server was already running and has been reused. No new process was started.',
			);
			expect(startedServerId(reused)).toBe(serverId);

			const list = await client.callTool('preview_list');
			const entries = JSON.parse(toolText(list)) as Array<Record<string, unknown>>;
			expect(entries).toHaveLength(1);
			expect(entries[0]).toMatchObject({ serverId, name: 'App', port, status: 'running' });
			expect(String(entries[0]?.sessionId)).toMatch(/^local_/);
			expect(entries[0]?.startedAt).toBeTruthy();
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_eval runs real JavaScript in the page',
		async () => {
			const result = await client.callTool('preview_eval', {
				serverId,
				expression: 'document.title',
			});
			expect(result.isError).not.toBe(true);
			expect(toolText(result)).toBe('"Fixture App"');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_eval reports errors like the real tool',
		async () => {
			const result = await client.callTool('preview_eval', {
				serverId,
				expression: 'nonexistentVariable.foo',
			});
			expect(result.isError).toBe(true);
			expect(toolText(result)).toContain('Eval failed: ');
			expect(toolText(result)).toContain('nonexistentVariable is not defined');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_click mutates the live DOM',
		async () => {
			const clicked = await client.callTool('preview_click', { serverId, selector: '#counter' });
			expect(toolText(clicked)).toBe('Successfully clicked: #counter');

			const result = await client.callTool('preview_eval', {
				serverId,
				expression: "document.querySelector('#counter').textContent",
			});
			expect(toolText(result)).toBe('"clicked"');

			const missing = await client.callTool('preview_click', { serverId, selector: '#nope' });
			expect(missing.isError).toBe(true);
			expect(toolText(missing)).toBe('Failed to click element: #nope');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_fill fills real inputs',
		async () => {
			const filled = await client.callTool('preview_fill', {
				serverId,
				selector: '#name',
				value: 'Kasper',
			});
			expect(toolText(filled)).toBe('Successfully filled: #name');

			const result = await client.callTool('preview_eval', {
				serverId,
				expression: "document.querySelector('#name').value",
			});
			expect(toolText(result)).toBe('"Kasper"');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_inspect returns real computed styles in the real format',
		async () => {
			const result = await client.callTool('preview_inspect', {
				serverId,
				selector: '#counter',
				styles: ['color'],
			});
			const details = JSON.parse(toolText(result)) as {
				tagName: string;
				text: string;
				styles: Record<string, string>;
				boundingBox: { width: number };
			};
			expect(details.tagName).toBe('button');
			expect(details.text).toBe('clicked');
			expect(details.styles.color).toBe('rgb(255, 0, 0)');
			expect(details.boundingBox.width).toBeGreaterThan(0);
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_snapshot returns the Chrome accessibility tree format',
		async () => {
			const result = await client.callTool('preview_snapshot', { serverId });
			const snapshot = toolText(result);
			expect(snapshot).toMatch(/\[\d+\] RootWebArea: "Fixture App"/);
			expect(snapshot).toMatch(/\[\d+\] heading: "Fixture App"/);
			expect(snapshot).not.toContain('mock');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_screenshot returns only a JPEG image',
		async () => {
			const result = await client.callTool('preview_screenshot', { serverId });
			expect(result.content).toHaveLength(1);
			const image = result.content[0];
			expect(image?.type).toBe('image');
			expect(image?.mimeType).toBe('image/jpeg');
			expect((image?.data ?? '').length).toBeGreaterThan(1_000);
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_console_logs captures real console output',
		async () => {
			const result = await client.callTool('preview_console_logs', { serverId });
			expect(toolText(result)).toContain('[log] fixture loaded');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_network lists requests and pretty-prints JSON bodies',
		async () => {
			const listing = await client.callTool('preview_network', { serverId });
			const line = toolText(listing)
				.split('\n')
				.find((candidate) => candidate.includes('/api/data'));
			expect(line).toMatch(/^\[\d+\.\d+\] GET http:\/\/localhost:\d+\/api\/data → 200/);

			const requestId = /^\[([\d.]+)\]/.exec(line ?? '')?.[1];
			const body = await client.callTool('preview_network', { serverId, requestId });
			expect(toolText(body)).toBe('{\n  "ok": true\n}');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_resize applies presets to the live viewport',
		async () => {
			const result = await client.callTool('preview_resize', { serverId, preset: 'mobile' });
			expect(toolText(result)).toBe('Viewport set to 375x812 (mobile).');

			const width = await client.callTool('preview_eval', {
				serverId,
				expression: 'window.innerWidth',
			});
			expect(toolText(width)).toBe('375');

			const custom = await client.callTool('preview_resize', {
				serverId,
				width: 1000,
				height: 700,
				colorScheme: 'dark',
			});
			expect(toolText(custom)).toBe('Viewport set to 1000x700. Color scheme set to dark.');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_logs returns the spawned server output',
		async () => {
			const result = await client.callTool('preview_logs', { serverId });
			expect(toolText(result)).toContain('fixture server listening');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_stop stops the server',
		async () => {
			const result = await client.callTool('preview_stop', { serverId });
			expect(toolText(result)).toBe(`Server ${serverId} stopped`);

			const list = await client.callTool('preview_list');
			expect(JSON.parse(toolText(list))).toEqual([]);
		},
		BROWSER_TEST_TIMEOUT_MS,
	);
});
