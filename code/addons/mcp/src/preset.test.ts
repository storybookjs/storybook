import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Options } from 'storybook/internal/types';
import { experimental_devServer } from './preset.ts';

describe('experimental_devServer', () => {
	let mockApp: any;
	let mockOptions: Options;
	let mcpHandler: any;

	beforeEach(() => {
		mockApp = {
			post: vi.fn((path, handler) => {
				mcpHandler = handler;
			}),
			get: vi.fn(),
		};

		mockOptions = {
			presets: {
				apply: vi.fn((key: string) => {
					if (key === 'features') {
						return Promise.resolve({ experimentalComponentsManifest: false });
					}
					return Promise.resolve(undefined);
				}),
			},
		} as unknown as Options;
	});

	it('should register /mcp POST endpoint', async () => {
		await (experimental_devServer as any)(mockApp, mockOptions);

		expect(mockApp.post).toHaveBeenCalledWith('/mcp', expect.any(Function));
		expect(mcpHandler).toBeDefined();
	});

	it('should register /mcp GET endpoint', async () => {
		await (experimental_devServer as any)(mockApp, mockOptions);

		expect(mockApp.get).toHaveBeenCalledWith('/mcp', expect.any(Function));
	});

	it('should serve HTML for browser GET requests', async () => {
		let getHandler: any;
		mockApp.get = vi.fn((path, handler) => {
			getHandler = handler;
		});

		await (experimental_devServer as any)(mockApp, mockOptions);

		const mockReq = {
			headers: {
				accept: 'text/html',
			},
		} as any;

		const mockRes = {
			writeHead: vi.fn(),
			end: vi.fn(),
		} as any;

		await getHandler(mockReq, mockRes);

		expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
			'Content-Type': 'text/html',
		});
		expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('<html'));
	});

	it('should handle POST requests as MCP protocol', async () => {
		await (experimental_devServer as any)(mockApp, mockOptions);

		const initializeRequest = JSON.stringify({
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
		});

		const mockReq = {
			method: 'POST',
			headers: {
				accept: 'text/html',
				'content-type': 'application/json',
				host: 'localhost:6006',
			},
			socket: { encrypted: false },
			url: '/',
			[Symbol.asyncIterator]: async function* () {
				yield Buffer.from(initializeRequest);
			},
		} as any;

		const mockRes = {
			writeHead: vi.fn(),
			write: vi.fn(),
			end: vi.fn(),
			setHeader: vi.fn(),
			statusCode: 0,
		} as any;

		await mcpHandler(mockReq, mockRes);

		expect(mockRes.writeHead).not.toHaveBeenCalledWith(200, {
			'Content-Type': 'text/html',
		});
		expect(mockRes.end).not.toHaveBeenCalledWith(expect.stringContaining('<html'));
	});

	it('should return the app instance', async () => {
		const result = await (experimental_devServer as any)(mockApp, mockOptions);
		expect(result).toBe(mockApp);
	});

	it('should handle partial toolsets configuration', async () => {
		const partialOptions = {
			presets: {
				apply: vi.fn((key: string) => {
					if (key === 'features') {
						return Promise.resolve({ experimentalComponentsManifest: false });
					}
					return Promise.resolve(undefined);
				}),
			},
			toolsets: {
				dev: false,
			},
		} as unknown as Options;

		await (experimental_devServer as any)(mockApp, partialOptions);

		expect(mockApp.post).toHaveBeenCalledWith('/mcp', expect.any(Function));
		expect(mockApp.get).toHaveBeenCalledWith('/mcp', expect.any(Function));
	});
});
