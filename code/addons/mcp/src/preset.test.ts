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

	it('should register .well-known endpoint that returns 404 when no auth required', async () => {
		const handlers: Record<string, any> = {};
		mockApp.get = vi.fn((path: string, handler: any) => {
			handlers[path] = handler;
		});

		await (experimental_devServer as any)(mockApp, mockOptions);

		const wellKnownHandler = handlers['/.well-known/oauth-protected-resource'];
		expect(wellKnownHandler).toBeDefined();

		const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any;
		wellKnownHandler({}, mockRes);

		expect(mockRes.writeHead).toHaveBeenCalledWith(404);
		expect(mockRes.end).toHaveBeenCalledWith('Not found');
	});

	it('should forward non-HTML GET /mcp requests to MCP handler', async () => {
		const handlers: Record<string, any> = {};
		mockApp.get = vi.fn((path: string, handler: any) => {
			handlers[path] = handler;
		});

		await (experimental_devServer as any)(mockApp, mockOptions);

		const getMcpHandler = handlers['/mcp'];
		expect(getMcpHandler).toBeDefined();

		// Non-HTML request (JSON accept) — uses POST method since GET can't have body
		const mockReq = {
			method: 'POST',
			headers: { accept: 'application/json', host: 'localhost:6006' },
			socket: { encrypted: false },
			url: '/mcp',
			[Symbol.asyncIterator]: async function* () {
				yield Buffer.from(
					JSON.stringify({
						jsonrpc: '2.0',
						id: 1,
						method: 'initialize',
						params: {
							protocolVersion: '2024-11-05',
							capabilities: {},
							clientInfo: { name: 'test', version: '1.0.0' },
						},
					}),
				);
			},
		} as any;

		const mockRes = {
			writeHead: vi.fn(),
			write: vi.fn(),
			end: vi.fn(),
			setHeader: vi.fn(),
			statusCode: 0,
		} as any;

		await getMcpHandler(mockReq, mockRes);

		// Should NOT serve HTML — goes through MCP handler instead
		expect(mockRes.writeHead).not.toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
	});

	it('should parse refs from storybook config', async () => {
		const optionsWithRefs = {
			port: 6006,
			presets: {
				apply: vi.fn((key: string) => {
					if (key === 'refs') {
						return Promise.resolve({
							'my-lib': { title: 'My Library', url: 'https://my-lib.example.com' },
							'design-system': { url: 'https://ds.example.com' },
						});
					}
					if (key === 'features') {
						return Promise.resolve({ experimentalComponentsManifest: false });
					}
					return Promise.resolve(undefined);
				}),
			},
		} as unknown as Options;

		await (experimental_devServer as any)(mockApp, optionsWithRefs);

		// The preset should have called presets.apply('refs')
		expect(optionsWithRefs.presets.apply).toHaveBeenCalledWith('refs', {});
	});

	it('should handle refs config returning non-object gracefully', async () => {
		const optionsWithBadRefs = {
			port: 6006,
			presets: {
				apply: vi.fn((key: string) => {
					if (key === 'refs') return Promise.resolve(null);
					if (key === 'features') {
						return Promise.resolve({ experimentalComponentsManifest: false });
					}
					return Promise.resolve(undefined);
				}),
			},
		} as unknown as Options;

		// Should not throw
		const result = await (experimental_devServer as any)(mockApp, optionsWithBadRefs);
		expect(result).toBe(mockApp);
	});

	it('should handle refs config throwing gracefully', async () => {
		const optionsWithThrowingRefs = {
			port: 6006,
			presets: {
				apply: vi.fn((key: string) => {
					if (key === 'refs') return Promise.reject(new Error('Config error'));
					if (key === 'features') {
						return Promise.resolve({ experimentalComponentsManifest: false });
					}
					return Promise.resolve(undefined);
				}),
			},
		} as unknown as Options;

		// Should not throw
		const result = await (experimental_devServer as any)(mockApp, optionsWithThrowingRefs);
		expect(result).toBe(mockApp);
	});
});
