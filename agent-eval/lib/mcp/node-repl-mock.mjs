#!/usr/bin/env node
/**
 * Stand-in MCP server for the Codex app's bundled `node_repl` server, used in
 * agent evals. The real server ships as a native binary inside Codex.app
 * (`Contents/Resources/cua_node/bin/node_repl`) and is not distributed with
 * the `@openai/codex` npm CLI, so Linux eval sandboxes need this replacement.
 *
 * Tool names, schemas, and the server instructions mirror the real server
 * (captured from an MCP handshake against the app binary, rmcp 1.5.0).
 * Behavior is real: `js` runs code in a persistent Node REPL kernel with
 * top-level await, `var` bindings that survive across calls, and the
 * `nodeRepl` helpers (`write`, `cwd`, `homeDir`, `tmpDir`, `emitImage`).
 * The Codex in-app-browser skill drives its browser runtime through this
 * exact surface (`mcp__node_repl__js`).
 */
import { Console } from 'node:console';
import { Module, createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import * as path from 'node:path';
import { createInterface } from 'node:readline';
import * as repl from 'node:repl';
import { PassThrough } from 'node:stream';
import { inspect } from 'node:util';

const SERVER_INFO = { name: 'node_repl', version: '1.5.0' };

const SERVER_INSTRUCTIONS =
	"Use `js` to run JavaScript in the persistent Node-backed kernel. When a skill or prompt says to use `node_repl`, call this server's `js` execution tool. Calls default to a 30000 ms (30 seconds) timeout when `timeout_ms` is omitted. The runtime exposes `nodeRepl.cwd`, `nodeRepl.homeDir`, `nodeRepl.tmpDir`, `nodeRepl.requestMeta`, `nodeRepl.setResponseMeta(...)`, and `await nodeRepl.emitImage(...)`.";

const DEFAULT_TIMEOUT_MS = 30_000;

const TOOLS = [
	{
		name: 'js',
		title: 'Run JavaScript',
		description:
			'Run JavaScript in a persistent Node-backed kernel with top-level await. This is the JavaScript execution tool for the `node_repl` MCP server; use it whenever instructions say to use `node_repl`, the Node REPL MCP, or run Node REPL code. If `timeout_ms` is omitted, execution defaults to 30000 ms (30 seconds). Bindings persist across calls until `js_reset`.',
		inputSchema: {
			type: 'object',
			properties: {
				code: {
					type: 'string',
					description:
						'JavaScript source to execute in the persistent Node-backed kernel. The code runs with top-level await and can use the `nodeRepl` helpers. Examples: `nodeRepl.write(nodeRepl.cwd)`, `const { chromium } = await import("playwright")`, or `await nodeRepl.emitImage(pngBuffer)`.',
				},
				timeout_ms: {
					type: 'integer',
					minimum: 1,
					description:
						'Optional execution timeout in milliseconds. Defaults to 30000 (30 seconds) when omitted.',
				},
				title: {
					type: 'string',
					description:
						'Short user-facing description of what this code block is doing. Use a few words, for example `Inspect package layout`.',
				},
			},
			required: ['code'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: false, openWorldHint: true },
	},
	{
		name: 'js_add_node_module_dir',
		title: 'Add Node Module Directory',
		description:
			'Add an absolute `node_modules` directory to the REPL-wide Node module search roots for future package imports. The directory stays available for this MCP server lifetime, including after `js_reset`. Returns `true` when the search root is newly added.',
		inputSchema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					minLength: 1,
					description:
						'Absolute path to a node_modules directory to add to Node package resolution.',
				},
			},
			required: ['path'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: false },
	},
	{
		name: 'js_reset',
		title: 'Reset JavaScript Kernel',
		description:
			'Reset the persistent JavaScript kernel and clear all bindings created by prior `js` calls. Use this when you need a clean state, or when reusing existing bindings, top-level `var` declarations, or fresh names cannot recover from conflicting declarations.',
		inputSchema: { type: 'object', properties: {}, additionalProperties: false },
		annotations: { readOnlyHint: false, idempotentHint: true },
	},
];

const moduleDirs = new Set();

/** Current `js` call sink; `nodeRepl.write`/`emitImage` and console output land here. */
let activeSink = null;
let kernel = null;

function registerModuleDir(dir) {
	const resolved = path.resolve(dir);
	if (moduleDirs.has(resolved)) {
		return false;
	}
	moduleDirs.add(resolved);
	// Affects CommonJS `require` resolution inside the kernel. ESM `import` of
	// bare specifiers still resolves from the workspace cwd, which is where the
	// eval templates install playwright, so that path needs no hook.
	if (Array.isArray(Module.globalPaths)) {
		Module.globalPaths.push(resolved);
	}
	return true;
}

function detectImageMimeType(bytes) {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return 'image/jpeg';
	}
	if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) {
		return 'image/png';
	}
	return 'image/png';
}

function createKernel() {
	const input = new PassThrough();
	const output = new PassThrough();
	output.resume();

	const server = repl.start({
		input,
		output,
		prompt: '',
		terminal: false,
		useGlobal: false,
		useColors: false,
		ignoreUndefined: true,
	});

	const installHelpers = (context) => {
		const consoleStream = new PassThrough();
		consoleStream.on('data', (chunk) => {
			activeSink?.consoleChunks.push(String(chunk));
		});
		context.console = new Console({ stdout: consoleStream, stderr: consoleStream });
		context.nodeRepl = {
			cwd: process.cwd(),
			homeDir: homedir(),
			tmpDir: tmpdir(),
			requestMeta: {},
			setResponseMeta() {},
			write(value) {
				activeSink?.writes.push(typeof value === 'string' ? value : inspect(value));
			},
			async emitImage(data) {
				const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
				activeSink?.images.push({
					type: 'image',
					data: Buffer.from(bytes).toString('base64'),
					mimeType: detectImageMimeType(bytes),
				});
			},
		};
		context.require = createRequire(path.join(process.cwd(), 'node_repl.cjs'));
	};

	installHelpers(server.context);
	server.on('reset', (context) => installHelpers(context));
	return server;
}

function getKernel() {
	kernel ??= createKernel();
	return kernel;
}

function evalInKernel(code, timeoutMs) {
	const server = getKernel();
	return new Promise((resolve) => {
		let settled = false;
		const timer = setTimeout(() => {
			if (!settled) {
				settled = true;
				resolve({
					error: new Error(
						`Execution timed out after ${timeoutMs} ms. The kernel may still be busy; call js_reset if the session stops responding.`,
					),
				});
			}
		}, timeoutMs);

		try {
			server.eval(code, server.context, '<node_repl>', (error, result) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				if (error instanceof repl.Recoverable) {
					resolve({ error: error.err ?? error });
					return;
				}
				resolve(error ? { error } : { result });
			});
		} catch (error) {
			if (!settled) {
				settled = true;
				clearTimeout(timer);
				resolve({ error });
			}
		}
	});
}

async function handleJs(args) {
	const code = args.code;
	if (typeof code !== 'string' || code.length === 0) {
		return errorText('Expected `code` to be a non-empty string.');
	}
	const timeoutMs =
		Number.isInteger(args.timeout_ms) && args.timeout_ms > 0 ? args.timeout_ms : DEFAULT_TIMEOUT_MS;

	const sink = { writes: [], consoleChunks: [], images: [] };
	activeSink = sink;
	let outcome;
	try {
		outcome = await evalInKernel(code, timeoutMs);
	} finally {
		activeSink = null;
	}

	const sections = [];
	if (sink.writes.length > 0) {
		sections.push(sink.writes.join(''));
	}
	const consoleOutput = sink.consoleChunks.join('').trimEnd();
	if (consoleOutput.length > 0) {
		sections.push(consoleOutput);
	}

	if (outcome.error) {
		const error = outcome.error;
		const rendered = error instanceof Error ? (error.stack ?? error.message) : inspect(error);
		sections.push(rendered);
		return {
			content: [...sink.images, { type: 'text', text: sections.join('\n') }],
			isError: true,
		};
	}

	if (outcome.result !== undefined) {
		sections.push(inspect(outcome.result, { depth: 4 }));
	}
	if (sections.length === 0 && sink.images.length === 0) {
		sections.push('undefined');
	}

	const content = [...sink.images];
	if (sections.length > 0) {
		content.push({ type: 'text', text: sections.join('\n') });
	}
	return { content };
}

const HANDLERS = {
	js: handleJs,
	js_add_node_module_dir: async (args) => {
		const dir = args.path;
		if (typeof dir !== 'string' || !path.isAbsolute(dir)) {
			return errorText('Expected `path` to be an absolute node_modules directory path.');
		}
		return text(String(registerModuleDir(dir)));
	},
	js_reset: async () => {
		if (kernel) {
			kernel.close();
			kernel = null;
		}
		return text('Kernel reset. All bindings from prior `js` calls were cleared.');
	},
};

function text(value) {
	return { content: [{ type: 'text', text: value }] };
}

function errorText(value) {
	return { content: [{ type: 'text', text: value }], isError: true };
}

function send(message) {
	process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
	send({ jsonrpc: '2.0', id, result });
}

function fail(id, code, message) {
	send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handle(request) {
	const { id, method, params } = request;

	if (method === 'initialize') {
		reply(id, {
			protocolVersion: params?.protocolVersion ?? '2025-06-18',
			capabilities: { tools: {} },
			serverInfo: SERVER_INFO,
			instructions: SERVER_INSTRUCTIONS,
		});
		return;
	}

	if (method === 'ping') {
		reply(id, {});
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
			reply(id, await handler(params?.arguments ?? {}));
		} catch (error) {
			// Tool-level failures become isError results so the agent can react.
			reply(id, errorText(`Tool ${name} failed: ${error?.message ?? error}`));
		}
		return;
	}

	// Notifications (no id) need no response; unknown requests get method-not-found.
	if (id !== undefined && id !== null) {
		fail(id, -32601, `Unknown method: ${method}`);
	}
}

const rl = createInterface({ input: process.stdin });
// Serialize request handling: handle() is async and shares the REPL kernel and
// active output sink, so overlapping requests would interleave their output.
let requestQueue = Promise.resolve();
rl.on('line', (line) => {
	const trimmed = line.trim();
	if (!trimmed) return;
	requestQueue = requestQueue.then(() => {
		try {
			return handle(JSON.parse(trimmed));
		} catch {
			// Ignore malformed lines; MCP clients resend on protocol errors.
			return undefined;
		}
	});
	requestQueue = requestQueue.catch(() => {});
});
rl.on('close', () => {
	process.exit(0);
});
