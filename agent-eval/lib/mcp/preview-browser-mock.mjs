#!/usr/bin/env node
/**
 * Mock MCP server that simulates Claude's native desktop "preview" tools
 */
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

// Name kept as `preview-browser` so scoring can recognize browser tool calls.
const SERVER_INFO = { name: 'preview-browser', version: '1.0.0' };

const DEFAULT_PORT = 6006;

// 1x1 placeholder returned by the screenshot tool.
const TINY_JPEG =
	'/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB' +
	'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAA' +
	'AAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA' +
	'/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AfwD/2Q==';

/** serverId -> { id, name, url, port, viewport, colorScheme } */
const servers = new Map();
let nextServerId = 1;

/** Resolve a launch.json server's port; default to Storybook's 6006 if unknown. */
function readLaunchPort(name) {
	try {
		const config = JSON.parse(readFileSync('.claude/launch.json', 'utf-8'));
		const configurations = Array.isArray(config?.configurations) ? config.configurations : [];
		const match = configurations.find((entry) => entry?.name === name);
		const port = Number(match?.port);
		return Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT;
	} catch {
		return DEFAULT_PORT;
	}
}

function text(value) {
	return { content: [{ type: 'text', text: value }] };
}

function errorText(value) {
	return { content: [{ type: 'text', text: value }], isError: true };
}

/** Run `fn` against a started server, or return a helpful error if unknown. */
function withServer(serverId, fn) {
	const server = servers.get(serverId);
	if (!server) {
		return errorText(
			`Unknown serverId "${serverId}". Call preview_start first, or preview_list to see running servers.`,
		);
	}
	return fn(server);
}

const TOOLS = [
	{
		name: 'preview_start',
		title: 'Start Preview Server',
		description:
			'Start a dev server by name from .claude/launch.json. Reuses the server if already running. ALWAYS use this instead of Bash for running servers.',
		inputSchema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Server name from .claude/launch.json.' },
			},
			required: ['name'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
	},
	{
		name: 'preview_stop',
		title: 'Stop Preview Server',
		description: 'Stop a server started with preview_start.',
		inputSchema: {
			type: 'object',
			properties: { serverId: { type: 'string', description: 'Server ID to stop' } },
			required: ['serverId'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: false, idempotentHint: true },
	},
	{
		name: 'preview_list',
		title: 'List Preview Servers',
		description:
			'List servers started with preview_start. Returns serverIds for use with other preview_* tools.',
		inputSchema: { type: 'object', properties: {} },
		annotations: { readOnlyHint: true },
	},
	{
		name: 'preview_click',
		title: 'Click Element',
		description:
			"Click an element by CSS selector (e.g., 'button.primary', '#submit', '[data-testid=\"btn\"]').",
		inputSchema: {
			type: 'object',
			properties: {
				serverId: { type: 'string', description: 'Server ID' },
				selector: { type: 'string', description: 'CSS selector for the element to click' },
				doubleClick: { type: 'boolean', description: 'Perform a double-click' },
			},
			required: ['serverId', 'selector'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: false },
	},
	{
		name: 'preview_fill',
		title: 'Fill Input',
		description:
			'Fill an input, textarea, or select element with a value. For select elements, matches by value or text.',
		inputSchema: {
			type: 'object',
			properties: {
				serverId: { type: 'string', description: 'Server ID' },
				selector: { type: 'string', description: 'CSS selector for the input element' },
				value: { type: 'string', description: 'Value to fill' },
			},
			required: ['serverId', 'selector', 'value'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: false },
	},
	{
		name: 'preview_eval',
		title: 'Evaluate JavaScript',
		description:
			'Execute JavaScript in the preview page for DEBUGGING and INSPECTION only. Use for reading page state, DOM queries, checking variables, navigation, page reload, hover/type/key events. Do NOT use this to implement UI changes the user requests — edit the source code instead. Wrap multi-step logic in an IIFE.',
		inputSchema: {
			type: 'object',
			properties: {
				serverId: { type: 'string', description: 'Server ID' },
				expression: {
					type: 'string',
					description:
						'JavaScript expression to evaluate in the page context. Return values are serialized as JSON.',
				},
			},
			required: ['serverId', 'expression'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: 'preview_screenshot',
		title: 'Screenshot',
		description:
			'Take a screenshot of the page. Good for checking layout and general appearance, but DO NOT rely on it for verifying colors, font sizes, or precise styles — use preview_inspect with specific CSS properties instead. Returns a compressed JPEG image.',
		inputSchema: {
			type: 'object',
			properties: { serverId: { type: 'string', description: 'Server ID' } },
			required: ['serverId'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: 'preview_snapshot',
		title: 'Accessibility Snapshot',
		description:
			'Get an accessibility tree snapshot of the page. Returns exact text content, roles, and element UIDs for use with click/fill/hover. PREFERRED over screenshot for verifying text, element presence, and page structure.',
		inputSchema: {
			type: 'object',
			properties: { serverId: { type: 'string', description: 'Server ID' } },
			required: ['serverId'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: 'preview_inspect',
		title: 'Inspect Element',
		description:
			'Inspect a DOM element by CSS selector. Returns text content, className, tagName, id, computed styles, and bounding box. BEST tool for verifying visual properties like colors, fonts, spacing, and dimensions — more accurate than screenshots.',
		inputSchema: {
			type: 'object',
			properties: {
				serverId: { type: 'string', description: 'Server ID' },
				selector: { type: 'string', description: "CSS selector (e.g., '.button', '#header')" },
				styles: {
					type: 'array',
					items: { type: 'string' },
					description:
						"CSS properties to return (e.g., ['padding', 'color']). Defaults to common properties.",
				},
			},
			required: ['serverId', 'selector'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: 'preview_console_logs',
		title: 'Console Logs',
		description:
			"Get browser console output (log, info, warn, error, debug). Use to check runtime behavior, debug values, or client-side errors. Use 'level' to filter to errors or warnings only.",
		inputSchema: {
			type: 'object',
			properties: {
				serverId: { type: 'string', description: 'Server ID' },
				level: {
					type: 'string',
					enum: ['all', 'error', 'warn'],
					description:
						"Filter by level: 'all' (default), 'error' (errors only), 'warn' (warnings + errors)",
				},
				lines: { type: 'number', description: 'Max lines to return (default: 50, max: 200)' },
			},
			required: ['serverId'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: 'preview_logs',
		title: 'Server Logs',
		description:
			"Get server stdout/stderr output. Use to check for build errors, verify server behavior, or read debug output. Use 'level' to filter to errors only, or 'search' to filter for specific text. Use after preview_start.",
		inputSchema: {
			type: 'object',
			properties: {
				serverId: { type: 'string', description: 'Server ID' },
				level: {
					type: 'string',
					enum: ['all', 'error'],
					description:
						"Filter by level: 'all' (default) shows all output, 'error' shows only lines containing error/exception/failed/fatal",
				},
				lines: { type: 'number', description: 'Max lines to return (default: 50)' },
				search: {
					type: 'string',
					description: "Filter to lines containing this text (e.g., '[DEBUG]', 'POST /api')",
				},
			},
			required: ['serverId'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: 'preview_network',
		title: 'Network Requests',
		description:
			'List network requests or inspect a specific response body. Without requestId, lists all requests with URL, method, status, and requestId. With requestId, returns the full response body for that request (useful for inspecting API payloads).',
		inputSchema: {
			type: 'object',
			properties: {
				serverId: { type: 'string', description: 'Server ID' },
				filter: {
					type: 'string',
					enum: ['all', 'failed'],
					description:
						"Filter: 'all' (default) shows all requests, 'failed' shows only 4xx/5xx and network errors. Ignored when requestId is provided.",
				},
				requestId: {
					type: 'string',
					description:
						'If provided, returns the response body for this specific request instead of listing all requests.',
				},
			},
			required: ['serverId'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: 'preview_resize',
		title: 'Resize Viewport',
		description:
			'Resize the preview viewport to test responsive layouts. Presets: mobile (375x812), tablet (768x1024), desktop (1280x800). Also supports custom dimensions and color scheme emulation for dark mode testing.',
		inputSchema: {
			type: 'object',
			properties: {
				serverId: { type: 'string', description: 'Server ID' },
				preset: {
					type: 'string',
					enum: ['mobile', 'tablet', 'desktop'],
					description: 'Device preset. Overrides width/height if provided.',
				},
				width: { type: 'number', description: 'Viewport width in pixels' },
				height: { type: 'number', description: 'Viewport height in pixels' },
				colorScheme: {
					type: 'string',
					enum: ['light', 'dark'],
					description: 'Emulate prefers-color-scheme media feature for dark/light mode testing.',
				},
			},
			required: ['serverId'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: false },
	},
];

const PRESETS = {
	mobile: { width: 375, height: 812 },
	tablet: { width: 768, height: 1024 },
	desktop: { width: 1280, height: 800 },
};

const HANDLERS = {
	preview_start({ name }) {
		if (typeof name !== 'string' || name.length === 0) {
			return errorText('preview_start requires a "name" from .claude/launch.json.');
		}
		for (const server of servers.values()) {
			if (server.name === name) {
				return text(`Reusing running server "${name}" (serverId: ${server.id}) at ${server.url}`);
			}
		}
		const port = readLaunchPort(name);
		const id = `preview-${nextServerId++}`;
		const url = `http://localhost:${port}`;
		servers.set(id, {
			id,
			name,
			url,
			port,
			viewport: { ...PRESETS.desktop },
			colorScheme: 'light',
		});
		return text(`Started "${name}" (serverId: ${id}) at ${url}`);
	},

	preview_stop({ serverId }) {
		if (!servers.delete(serverId)) {
			return errorText(`No running server with serverId "${serverId}". Call preview_list.`);
		}
		return text(`Stopped server ${serverId}.`);
	},

	preview_list() {
		const list = [...servers.values()].map((server) => ({
			serverId: server.id,
			name: server.name,
			url: server.url,
			status: 'running',
		}));
		return text(JSON.stringify(list, null, 2));
	},

	preview_click({ serverId, selector, doubleClick }) {
		if (typeof selector !== 'string' || selector.length === 0) {
			return errorText('preview_click requires a "selector".');
		}
		return withServer(serverId, (server) =>
			text(`${doubleClick ? 'Double-clicked' : 'Clicked'} "${selector}" on ${server.url}.`),
		);
	},

	preview_fill({ serverId, selector, value }) {
		if (typeof selector !== 'string' || typeof value !== 'string') {
			return errorText('preview_fill requires "selector" and "value".');
		}
		return withServer(serverId, (server) =>
			text(`Filled "${selector}" with "${value}" on ${server.url}.`),
		);
	},

	preview_eval({ serverId, expression }) {
		if (typeof expression !== 'string' || expression.length === 0) {
			return errorText('preview_eval requires an "expression".');
		}
		return withServer(serverId, (server) =>
			text(
				`Evaluated on ${server.url}:\n${expression}\n=> null (mock preview — no live DOM is executed)`,
			),
		);
	},

	preview_screenshot({ serverId }) {
		return withServer(serverId, (server) => ({
			content: [
				{
					type: 'text',
					text: `Screenshot of ${server.url} (${server.viewport.width}x${server.viewport.height}).`,
				},
				{ type: 'image', data: TINY_JPEG, mimeType: 'image/jpeg' },
			],
		}));
	},

	preview_snapshot({ serverId }) {
		return withServer(serverId, (server) =>
			text(
				[
					`Accessibility snapshot of ${server.url} (mock):`,
					'- document "Storybook" [uid=1]',
					'  - navigation "Sidebar" [uid=2]',
					'  - main [uid=3]',
					'    - iframe "storybook-preview-iframe" [uid=4]',
					'      - region "Canvas" [uid=5]',
				].join('\n'),
			),
		);
	},

	preview_inspect({ serverId, selector, styles }) {
		if (typeof selector !== 'string' || selector.length === 0) {
			return errorText('preview_inspect requires a "selector".');
		}
		const requested =
			Array.isArray(styles) && styles.length > 0 ? styles : ['color', 'font-size', 'padding'];
		const MOCK_STYLES = {
			color: 'rgb(17, 24, 39)',
			'font-size': '16px',
			'font-family': 'Inter, sans-serif',
			'background-color': 'rgb(255, 255, 255)',
			padding: '8px 16px',
			margin: '0px',
			display: 'block',
		};
		const computed = {};
		for (const property of requested) {
			computed[property] = MOCK_STYLES[property] ?? 'normal';
		}
		return withServer(serverId, () =>
			text(
				JSON.stringify(
					{
						selector,
						tagName: 'DIV',
						id: '',
						className: 'sb-show-main',
						textContent: '(mock preview — no live DOM)',
						computedStyles: computed,
						boundingBox: { x: 0, y: 0, width: 320, height: 48 },
					},
					null,
					2,
				),
			),
		);
	},

	preview_console_logs({ serverId, level }) {
		return withServer(serverId, () => {
			if (level === 'error' || level === 'warn') return text('No console messages.');
			return text('[log] (mock) Storybook preview loaded.');
		});
	},

	preview_logs({ serverId, search, level }) {
		return withServer(serverId, (server) => {
			if (level === 'error') return text('No errors in server output.');
			const lines = [`Storybook started on => ${server.url}`, 'webpack compiled successfully'];
			const filtered =
				typeof search === 'string' && search.length > 0
					? lines.filter((line) => line.includes(search))
					: lines;
			return text(filtered.join('\n') || `(no log lines matching "${search}")`);
		});
	},

	preview_network({ serverId, requestId }) {
		return withServer(serverId, (server) => {
			if (typeof requestId === 'string' && requestId.length > 0) {
				return text(JSON.stringify({ requestId, body: '(mock response body)' }, null, 2));
			}
			return text(
				JSON.stringify(
					[{ requestId: 'req-1', method: 'GET', url: `${server.url}/iframe.html`, status: 200 }],
					null,
					2,
				),
			);
		});
	},

	preview_resize({ serverId, preset, width, height, colorScheme }) {
		return withServer(serverId, (server) => {
			if (preset && PRESETS[preset]) {
				server.viewport = { ...PRESETS[preset] };
			} else if (Number.isFinite(width) && Number.isFinite(height)) {
				server.viewport = { width, height };
			}
			if (colorScheme === 'light' || colorScheme === 'dark') {
				server.colorScheme = colorScheme;
			}
			return text(
				`Resized ${server.url} to ${server.viewport.width}x${server.viewport.height} (${server.colorScheme} mode).`,
			);
		});
	},
};

function send(message) {
	process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
	send({ jsonrpc: '2.0', id, result });
}

function fail(id, code, message) {
	send({ jsonrpc: '2.0', id, error: { code, message } });
}

function handle(request) {
	const { id, method, params } = request;

	if (method === 'initialize') {
		reply(id, {
			protocolVersion: params?.protocolVersion ?? '2025-06-18',
			capabilities: { tools: {} },
			serverInfo: SERVER_INFO,
		});
		return;
	}

	if (method === 'tools/list') {
		reply(id, { tools: TOOLS });
		return;
	}

	if (method === 'tools/call') {
		const name = params?.name;
		const handler = HANDLERS[name];
		if (!handler) {
			fail(id, -32601, `Unknown tool: ${name}`);
			return;
		}
		try {
			reply(id, handler(params?.arguments ?? {}));
		} catch (error) {
			fail(id, -32603, `Tool ${name} failed: ${error?.message ?? error}`);
		}
		return;
	}

	// Notifications (no id) need no response; unknown requests get method-not-found.
	if (id !== undefined && id !== null) {
		fail(id, -32601, `Unknown method: ${method}`);
	}
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
	const trimmed = line.trim();
	if (!trimmed) return;
	try {
		handle(JSON.parse(trimmed));
	} catch {
		// Ignore malformed lines; MCP clients resend on protocol errors.
	}
});
