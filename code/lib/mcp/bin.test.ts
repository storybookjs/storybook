/**
 * Integration tests for the stdio MCP server in bin.ts
 *
 * These tests spawn the bin.ts process as a child process and communicate
 * with it via stdin/stdout, simulating how an MCP client would interact
 * with the server in production.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { x } from 'tinyexec';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChildProcess } from 'node:child_process';

/**
 * Helper to send a JSON-RPC request and wait for the response
 */
async function sendRequest(
	child: ChildProcess,
	stdoutData: string[],
	request: unknown,
	requestId: number,
	timeoutMs = 10_000,
): Promise<unknown> {
	// Send request
	child.stdin?.write(JSON.stringify(request) + '\n');

	// Wait for response with timeout
	const { promise, resolve, reject } = Promise.withResolvers<void>();
	const timeout = setTimeout(() => {
		reject(new Error(`Timeout waiting for response to request ${requestId}`));
	}, timeoutMs);

	const checkResponse = () => {
		const allData = stdoutData.join('');
		if (allData.includes(`"id":${requestId}`)) {
			clearTimeout(timeout);
			resolve();
		} else {
			setTimeout(checkResponse, 50);
		}
	};
	checkResponse();

	await promise;

	// Parse and return the response
	const allData = stdoutData.join('');
	const lines = allData.split('\n').filter((line) => line.trim());
	const responseLine = lines.find((line) => {
		try {
			const parsed = JSON.parse(line);
			return parsed.id === requestId;
		} catch {
			return false;
		}
	});

	if (!responseLine) {
		throw new Error(`No response found for request ${requestId}`);
	}

	return JSON.parse(responseLine);
}

describe('bin.ts stdio MCP server', () => {
	let child: ChildProcess;
	let stdoutData: string[] = [];
	let stderrData: string[] = [];

	beforeAll(() => {
		const currentDir = dirname(fileURLToPath(import.meta.url));
		const binPath = resolve(currentDir, './bin.ts');
		const fixturePath = resolve(
			currentDir,
			'./fixtures/full-manifest.fixture.json',
		);

		const proc = x('node', [binPath, '--manifestPath', fixturePath]);

		child = proc.process as ChildProcess;

		// Collect stdout for later assertions
		child.stdout?.on('data', (chunk) => {
			stdoutData.push(chunk.toString());
		});

		// Collect stderr for debugging
		child.stderr?.on('data', (chunk) => {
			stderrData.push(chunk.toString());
		});

		child.on('error', (err) => {
			console.error('Process error:', err);
		});
	});

	afterAll(() => {
		child.kill();
	});

	it('should respond to initialize request', async () => {
		const request = {
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: {
				protocolVersion: '2024-11-05',
				capabilities: {},
				clientInfo: {
					name: 'test-client',
					version: '1.0.0',
				},
			},
		};

		const response = await sendRequest(child, stdoutData, request, 1);

		expect(response).toMatchObject({
			jsonrpc: '2.0',
			id: 1,
			result: {
				protocolVersion: '2024-11-05',
				capabilities: {
					tools: {
						listChanged: true,
					},
				},
				serverInfo: {
					name: '@storybook/mcp',
				},
			},
		});
	}, 15000);

	it('should list available tools', async () => {
		const request = {
			jsonrpc: '2.0',
			id: 2,
			method: 'tools/list',
			params: {},
		};

		const response = await sendRequest(child, stdoutData, request, 2);

		expect(response).toMatchObject({
			jsonrpc: '2.0',
			id: 2,
			result: {
				tools: expect.arrayContaining([
					expect.objectContaining({
						name: 'list-all-components',
					}),
					expect.objectContaining({
						name: 'get-component-documentation',
					}),
				]),
			},
		});
	}, 15000);

	it('should execute list-all-components tool', async () => {
		const request = {
			jsonrpc: '2.0',
			id: 3,
			method: 'tools/call',
			params: {
				name: 'list-all-components',
				arguments: {},
			},
		};

		const response = await sendRequest(child, stdoutData, request, 3);

		expect(response).toMatchObject({
			jsonrpc: '2.0',
			id: 3,
			result: {
				content: [
					{
						type: 'text',
						text: expect.stringContaining('<components>'),
					},
				],
			},
		});
	}, 15000);
});
