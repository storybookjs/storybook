import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const MCP_DIR = path.dirname(fileURLToPath(import.meta.url));
const NODE_REPL_SCRIPT = path.join(MCP_DIR, 'node-repl-mock.mjs');
const BROWSER_CLIENT_SCRIPT = path.join(MCP_DIR, 'codex-browser-client-mock.mjs');

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
		this.child = spawn(process.execPath, [NODE_REPL_SCRIPT], { cwd });
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

	/** Run code through the `js` tool like Codex does and return the text output. */
	async js(code: string, timeoutMs = 60_000): Promise<ToolResult> {
		return this.callTool('js', { code, timeout_ms: timeoutMs, title: 'test' });
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

function expectOk(result: ToolResult): string {
	expect(result.isError, `expected success, got: ${toolText(result)}`).not.toBe(true);
	return toolText(result);
}

async function isChromiumInstalled(): Promise<boolean> {
	try {
		const { chromium } = await import('playwright');
		return existsSync(chromium.executablePath());
	} catch {
		return false;
	}
}

const FIXTURE_HTML = `<!doctype html>
<html>
	<head><title>Fixture App</title></head>
	<body>
		<h1>Fixture App</h1>
		<button id="counter" onclick="this.textContent = 'clicked'">click me</button>
		<input id="name" aria-label="Name" />
		<script>console.log('fixture loaded');</script>
	</body>
</html>`;

let fixtureServer: Server;
let fixtureUrl: string;
let workspace: string;
let client: McpClient;

beforeAll(async () => {
	workspace = mkdtempSync(path.join(tmpdir(), 'codex-browser-mock-'));
	fixtureServer = createServer((request, response) => {
		response.setHeader('content-type', 'text/html');
		response.end(FIXTURE_HTML);
	});
	await new Promise<void>((resolve) => {
		fixtureServer.listen(0, '127.0.0.1', resolve);
	});
	const address = fixtureServer.address();
	if (address === null || typeof address === 'string') {
		throw new Error('Failed to start fixture server');
	}
	fixtureUrl = `http://127.0.0.1:${address.port}/`;
	client = new McpClient(workspace);
});

afterAll(async () => {
	client.close();
	await new Promise<void>((resolve) => {
		fixtureServer.close(() => resolve());
	});
	rmSync(workspace, { recursive: true, force: true });
});

describe('node_repl mock', () => {
	test('handshake mirrors the real server surface', async () => {
		const init = await client.request('initialize', {
			protocolVersion: '2025-06-18',
			capabilities: {},
			clientInfo: { name: 'test', version: '0' },
		});
		expect(init.result?.serverInfo).toMatchObject({ name: 'node_repl' });
		expect(init.result?.instructions).toContain('nodeRepl.cwd');

		const list = await client.request('tools/list');
		const names = (list.result?.tools as Array<{ name: string }>).map((tool) => tool.name);
		expect(names).toEqual(['js', 'js_add_node_module_dir', 'js_reset']);
	});

	test('bindings persist across js calls with top-level await', async () => {
		expectOk(await client.js('var counter = await Promise.resolve(41);'));
		const result = expectOk(await client.js('nodeRepl.write(String(counter + 1));'));
		expect(result).toBe('42');
	});

	test('nodeRepl helpers are available', async () => {
		const result = expectOk(await client.js('nodeRepl.write(nodeRepl.cwd);'));
		// mkdtemp on macOS returns /var/... which resolves to /private/var/...
		expect(result).toContain(path.basename(workspace));
	});

	test('errors surface as isError results', async () => {
		const result = await client.js('throw new Error("boom");');
		expect(result.isError).toBe(true);
		expect(toolText(result)).toContain('boom');
	});

	test('js_reset clears bindings', async () => {
		expectOk(await client.js('var toBeCleared = 1;'));
		expectOk(await client.callTool('js_reset'));
		const result = await client.js('nodeRepl.write(String(typeof toBeCleared));');
		expect(expectOk(result)).toBe('undefined');
	});
});

describe.skipIf(!(await isChromiumInstalled()))(
	'in-app browser mock via node_repl',
	() => {
		test(
			'bootstraps the browser runtime exactly like the Codex skill',
			async () => {
				const result = expectOk(
					await client.js(`
						if (globalThis.agent?.browsers == null) {
							const { setupBrowserRuntime } = await import(${JSON.stringify(BROWSER_CLIENT_SCRIPT)});
							await setupBrowserRuntime({ globals: globalThis });
						}
						globalThis.browser = await agent.browsers.get("iab");
						nodeRepl.write(await browser.documentation());
					`),
				);
				expect(result).toContain('interface Tabs');
				expect(result).toContain('PlaywrightAPI');
				expect(result).toContain('domSnapshot');
			},
			BROWSER_TEST_TIMEOUT_MS,
		);

		test(
			'lists the in-app browser with its capabilities',
			async () => {
				const result = expectOk(
					await client.js('nodeRepl.write(JSON.stringify(await agent.browsers.list()));'),
				);
				const [entry] = JSON.parse(result) as Array<{
					id: string;
					type: string;
					capabilities: { browser: Array<{ id: string }> };
				}>;
				expect(entry).toMatchObject({ id: 'iab', type: 'iab' });
				expect(entry?.capabilities.browser.map((capability) => capability.id)).toEqual([
					'visibility',
					'viewport',
				]);
			},
			BROWSER_TEST_TIMEOUT_MS,
		);

		test(
			'opens a page and reads an ARIA dom snapshot',
			async () => {
				const result = expectOk(
					await client.js(`
						var tab = (await browser.tabs.selected()) ?? (await browser.tabs.new());
						await tab.goto(${JSON.stringify(fixtureUrl)});
						await tab.playwright.waitForLoadState({ state: "domcontentloaded", timeoutMs: 10000 });
						nodeRepl.write(JSON.stringify({
							title: await tab.title(),
							url: await tab.url(),
							snapshot: await tab.playwright.domSnapshot(),
						}));
					`),
				);
				const payload = JSON.parse(result) as { title: string; url: string; snapshot: string };
				expect(payload.title).toBe('Fixture App');
				expect(payload.url).toBe(fixtureUrl);
				expect(payload.snapshot).toContain('heading "Fixture App"');
				expect(payload.snapshot).toContain('button "click me"');
			},
			BROWSER_TEST_TIMEOUT_MS,
		);

		test(
			'clicks via playwright locators and reads console logs',
			async () => {
				const result = expectOk(
					await client.js(`
						await tab.playwright.getByRole("button", { name: "click me" }).click({});
						nodeRepl.write(JSON.stringify({
							buttonText: await tab.playwright.locator("#counter").innerText({}),
							logs: await tab.dev.logs({ limit: 10 }),
						}));
					`),
				);
				const payload = JSON.parse(result) as {
					buttonText: string;
					logs: Array<{ level: string; message: string; timestamp: string }>;
				};
				expect(payload.buttonText).toBe('clicked');
				expect(payload.logs).toContainEqual(
					expect.objectContaining({ level: 'log', message: 'fixture loaded' }),
				);
			},
			BROWSER_TEST_TIMEOUT_MS,
		);

		test(
			'fills inputs and evaluates javascript in the page',
			async () => {
				const result = expectOk(
					await client.js(`
						await tab.playwright.getByLabel("Name", {}).fill("Kasper", {});
						nodeRepl.write(String(await tab.playwright.evaluate(() => document.querySelector("#name").value)));
					`),
				);
				expect(result).toBe('Kasper');
			},
			BROWSER_TEST_TIMEOUT_MS,
		);

		test(
			'takes a JPEG screenshot and emits it as an image',
			async () => {
				const result = await client.js(
					'await nodeRepl.emitImage(await tab.screenshot({ fullPage: false }));',
				);
				expect(result.isError).not.toBe(true);
				const image = result.content.find((item) => item.type === 'image');
				expect(image?.mimeType).toBe('image/jpeg');
				expect((image?.data ?? '').length).toBeGreaterThan(1_000);
			},
			BROWSER_TEST_TIMEOUT_MS,
		);

		test(
			'applies viewport overrides through the browser capability',
			async () => {
				const result = expectOk(
					await client.js(`
						await (await browser.capabilities.get("viewport")).set({ width: 375, height: 812 });
						nodeRepl.write(String(await tab.playwright.evaluate(() => window.innerWidth)));
					`),
				);
				expect(result).toBe('375');
			},
			BROWSER_TEST_TIMEOUT_MS,
		);

		test(
			'interacts through the dom_cua node-id surface',
			async () => {
				const result = expectOk(
					await client.js(`
						var dom = await tab.dom_cua.get_visible_dom();
						var button = dom.nodes.find((node) => node.id === "counter");
						await tab.dom_cua.click({ node_id: button.node_id });
						nodeRepl.write(await tab.playwright.locator("#counter").innerText({}));
					`),
				);
				expect(result).toBe('clicked');
			},
			BROWSER_TEST_TIMEOUT_MS,
		);

		test(
			'reports locator timeouts with the in-app browser wording',
			async () => {
				const result = await client.js(`
					try {
						await tab.playwright.getByRole("button", { name: "Definitely Missing" }).click({ timeoutMs: 500 });
						nodeRepl.write("unexpected success");
					} catch (error) {
						nodeRepl.write(error.message);
					}
				`);
				expect(expectOk(result)).toContain('Playwright selector deadline exceeded');
			},
			BROWSER_TEST_TIMEOUT_MS,
		);

		test(
			'survives js_reset by re-running the skill bootstrap',
			async () => {
				expectOk(await client.callTool('js_reset'));
				const result = expectOk(
					await client.js(`
						const { setupBrowserRuntime } = await import(${JSON.stringify(BROWSER_CLIENT_SCRIPT)});
						await setupBrowserRuntime({ globals: globalThis });
						globalThis.browser = await agent.browsers.get("iab");
						const tabs = await browser.tabs.list();
						nodeRepl.write(JSON.stringify(tabs.map((tab) => tab.title)));
					`),
				);
				// The module-level browser session survives the kernel reset.
				expect(JSON.parse(result)).toContain('Fixture App');
			},
			BROWSER_TEST_TIMEOUT_MS,
		);
	},
	BROWSER_TEST_TIMEOUT_MS,
);
