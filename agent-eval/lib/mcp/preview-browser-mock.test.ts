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

const port = Number(process.argv[2]);
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
		expect(toolText(result)).toContain(".claude/launch.json doesn't exist");
		expect(toolText(result)).toContain('"configurations"');
	});

	test('preview_start fails when the named configuration does not exist', async () => {
		mkdirSync(path.join(workspace, '.claude'), { recursive: true });
		writeFileSync(
			path.join(workspace, '.claude', 'launch.json'),
			JSON.stringify({
				version: '0.0.1',
				configurations: [{ name: 'Other', runtimeExecutable: 'npm', port: 4000 }],
			}),
		);
		const result = await client.callTool('preview_start', { name: 'Storybook' });
		expect(result.isError).toBe(true);
		expect(toolText(result)).toContain('No configuration named "Storybook"');
		expect(toolText(result)).toContain('Available configurations: Other');
	});

	test('page tools fail for unknown server ids', async () => {
		const result = await client.callTool('preview_click', {
			serverId: 'preview-99',
			selector: 'button',
		});
		expect(result.isError).toBe(true);
		expect(toolText(result)).toContain('Unknown serverId');
	});
});

describe.skipIf(!(await isChromiumInstalled()))('preview-browser with a real browser', () => {
	let workspace: string;
	let client: McpClient;
	let port: number;

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
			expect(toolText(started)).toContain('Started "App" (serverId: preview-1)');

			const reused = await client.callTool('preview_start', { name: 'App' });
			expect(toolText(reused)).toContain('Reusing running server "App"');

			const list = await client.callTool('preview_list');
			expect(JSON.parse(toolText(list))).toMatchObject([
				{ serverId: 'preview-1', name: 'App', status: 'running' },
			]);
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_eval runs real JavaScript in the page',
		async () => {
			const result = await client.callTool('preview_eval', {
				serverId: 'preview-1',
				expression: 'document.title',
			});
			expect(result.isError).not.toBe(true);
			expect(toolText(result)).toBe('"Fixture App"');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_click mutates the live DOM',
		async () => {
			await client.callTool('preview_click', { serverId: 'preview-1', selector: '#counter' });
			const result = await client.callTool('preview_eval', {
				serverId: 'preview-1',
				expression: "document.querySelector('#counter').textContent",
			});
			expect(toolText(result)).toBe('"clicked"');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_fill fills real inputs',
		async () => {
			await client.callTool('preview_fill', {
				serverId: 'preview-1',
				selector: '#name',
				value: 'Kasper',
			});
			const result = await client.callTool('preview_eval', {
				serverId: 'preview-1',
				expression: "document.querySelector('#name').value",
			});
			expect(toolText(result)).toBe('"Kasper"');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_inspect returns real computed styles',
		async () => {
			const result = await client.callTool('preview_inspect', {
				serverId: 'preview-1',
				selector: '#counter',
				styles: ['color'],
			});
			const details = JSON.parse(toolText(result)) as {
				tagName: string;
				computedStyles: Record<string, string>;
				boundingBox: { width: number; height: number };
			};
			expect(details.tagName).toBe('BUTTON');
			expect(details.computedStyles.color).toBe('rgb(255, 0, 0)');
			expect(details.boundingBox.width).toBeGreaterThan(0);
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_snapshot returns the real accessibility tree',
		async () => {
			const result = await client.callTool('preview_snapshot', { serverId: 'preview-1' });
			const snapshot = toolText(result);
			expect(snapshot).toContain('Fixture App');
			expect(snapshot).not.toContain('mock');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_screenshot returns a real JPEG',
		async () => {
			const result = await client.callTool('preview_screenshot', { serverId: 'preview-1' });
			const image = result.content.find((item) => item.type === 'image');
			expect(image?.mimeType).toBe('image/jpeg');
			expect((image?.data ?? '').length).toBeGreaterThan(1_000);
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_console_logs captures real console output',
		async () => {
			const result = await client.callTool('preview_console_logs', { serverId: 'preview-1' });
			expect(toolText(result)).toContain('fixture loaded');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_network lists real requests and returns response bodies',
		async () => {
			const listing = await client.callTool('preview_network', { serverId: 'preview-1' });
			const requests = JSON.parse(toolText(listing)) as Array<{
				requestId: string;
				url: string;
				status: number;
			}>;
			const apiRequest = requests.find((request) => request.url.endsWith('/api/data'));
			expect(apiRequest?.status).toBe(200);

			const body = await client.callTool('preview_network', {
				serverId: 'preview-1',
				requestId: apiRequest?.requestId,
			});
			expect(JSON.parse(toolText(body))).toMatchObject({ body: '{"ok":true}' });
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_resize applies presets to the live viewport',
		async () => {
			const result = await client.callTool('preview_resize', {
				serverId: 'preview-1',
				preset: 'mobile',
			});
			expect(toolText(result)).toContain('375x812');

			const width = await client.callTool('preview_eval', {
				serverId: 'preview-1',
				expression: 'window.innerWidth',
			});
			expect(toolText(width)).toBe('375');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_logs returns the spawned server output',
		async () => {
			const result = await client.callTool('preview_logs', { serverId: 'preview-1' });
			expect(toolText(result)).toContain('fixture server listening');
		},
		BROWSER_TEST_TIMEOUT_MS,
	);

	test(
		'preview_stop stops the server',
		async () => {
			const result = await client.callTool('preview_stop', { serverId: 'preview-1' });
			expect(toolText(result)).toBe('Stopped server preview-1.');

			const list = await client.callTool('preview_list');
			expect(JSON.parse(toolText(list))).toEqual([]);
		},
		BROWSER_TEST_TIMEOUT_MS,
	);
});
