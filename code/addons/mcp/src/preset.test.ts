import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Options } from 'storybook/internal/types';
import { RequiresOwnMcpError } from '@storybook/mcp';
import { experimental_devServer } from './preset.ts';
import { STORYBOOK_MCP_PROXY_HEADER } from './auth/index.ts';
import * as mcpHandlerModule from './mcp-handler.ts';
import * as runStoryTests from './tools/run-story-tests.ts';
import { REQUEST_REVIEW_STATE_EVENT } from './constants.ts';

describe('experimental_devServer', () => {
	let mockApp: any;
	let mockOptions: Options;
	let mcpHandler: any;

	beforeEach(() => {
		vi.restoreAllMocks();

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
						return Promise.resolve({ componentsManifest: false });
					}
					return Promise.resolve(undefined);
				}),
			},
		} as unknown as Options;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const stubPrivateRefDiscovery = () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce({
					ok: false,
					status: 401,
					headers: new Headers({
						'WWW-Authenticate':
							'Bearer resource_metadata="https://private.example.com/.well-known/oauth-protected-resource"',
					}),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							resource: 'https://private.example.com/mcp',
							authorization_servers: ['https://auth.example.com'],
						}),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							issuer: 'https://auth.example.com',
							authorization_endpoint: 'https://auth.example.com/authorize',
							token_endpoint: 'https://auth.example.com/token',
						}),
				}),
		);
	};

	const createOptionsWithPrivateRef = () =>
		({
			...mockOptions,
			port: 6006,
			presets: {
				apply: vi.fn((key: string) => {
					if (key === 'refs') {
						return Promise.resolve({
							private: { title: 'Private', url: 'https://private.example.com' },
						});
					}
					if (key === 'features') {
						return Promise.resolve({ componentsManifest: false });
					}
					return Promise.resolve(undefined);
				}),
			},
		}) as unknown as Options;

	it('should register /mcp POST endpoint', async () => {
		await (experimental_devServer as any)(mockApp, mockOptions);

		expect(mockApp.post).toHaveBeenCalledWith('/mcp', expect.any(Function));
		expect(mcpHandler).toBeDefined();
	});

	it('registers review-state replay listener only when changeDetection is enabled', async () => {
		const channel = { on: vi.fn(), emit: vi.fn() };
		const optionsWithChangeDetection = {
			...mockOptions,
			channel,
			presets: {
				apply: vi.fn((key: string) => {
					if (key === 'features') {
						return Promise.resolve({ changeDetection: true });
					}
					return Promise.resolve(undefined);
				}),
			},
		} as unknown as Options;

		await (experimental_devServer as any)(mockApp, optionsWithChangeDetection);

		expect(channel.on).toHaveBeenCalledWith(REQUEST_REVIEW_STATE_EVENT, expect.any(Function));
	});

	it('does not register review-state replay listener when changeDetection is disabled', async () => {
		const channel = { on: vi.fn(), emit: vi.fn() };
		const optionsWithoutChangeDetection = {
			...mockOptions,
			channel,
			presets: {
				apply: vi.fn((key: string) => {
					if (key === 'features') {
						return Promise.resolve({ changeDetection: false });
					}
					return Promise.resolve(undefined);
				}),
			},
		} as unknown as Options;

		await (experimental_devServer as any)(mockApp, optionsWithoutChangeDetection);

		expect(channel.on).not.toHaveBeenCalledWith(REQUEST_REVIEW_STATE_EVENT, expect.any(Function));
	});

	it('should register /mcp GET endpoint', async () => {
		await (experimental_devServer as any)(mockApp, mockOptions);

		expect(mockApp.get).toHaveBeenCalledWith('/mcp', expect.any(Function));
	});

	it('should use a configured MCP endpoint for the dev server route', async () => {
		const customOptions = {
			...mockOptions,
			endpoint: '/custom-mcp',
		} as unknown as Options;

		await (experimental_devServer as any)(mockApp, customOptions);

		expect(mockApp.post).toHaveBeenCalledWith('/custom-mcp', expect.any(Function));
		expect(mockApp.get).toHaveBeenCalledWith('/custom-mcp', expect.any(Function));
	});

	it('should leave manifest fetching on the core default provider for the default endpoint', async () => {
		const handlers: Record<string, any> = {};
		mockApp.get = vi.fn((path: string, handler: any) => {
			handlers[path] = handler;
		});

		const mcpServerHandler = vi
			.spyOn(mcpHandlerModule, 'mcpServerHandler')
			.mockResolvedValue(undefined);

		const options = {
			...mockOptions,
			port: 6006,
		} as unknown as Options;

		await (experimental_devServer as any)(mockApp, options);
		await handlers['/mcp'](
			{
				headers: { accept: 'application/json' },
			},
			{},
		);

		expect(mcpServerHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				manifestProvider: undefined,
				sources: undefined,
			}),
		);
	});

	it('should leave manifest fetching on the core default provider for a custom endpoint without refs', async () => {
		const handlers: Record<string, any> = {};
		mockApp.get = vi.fn((path: string, handler: any) => {
			handlers[path] = handler;
		});

		const mcpServerHandler = vi
			.spyOn(mcpHandlerModule, 'mcpServerHandler')
			.mockResolvedValue(undefined);

		const customOptions = {
			...mockOptions,
			port: 6006,
			endpoint: '/custom-mcp',
		} as unknown as Options;

		await (experimental_devServer as any)(mockApp, customOptions);
		await handlers['/custom-mcp'](
			{
				headers: { accept: 'application/json' },
			},
			{},
		);

		expect(mcpServerHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				addonOptions: expect.objectContaining({
					endpoint: '/custom-mcp',
				}),
				manifestProvider: undefined,
				sources: undefined,
			}),
		);
	});

	it('should use localhost manifests for the local source when refs are configured', async () => {
		const handlers: Record<string, any> = {};
		mockApp.get = vi.fn((path: string, handler: any) => {
			handlers[path] = handler;
		});

		const mcpServerHandler = vi
			.spyOn(mcpHandlerModule, 'mcpServerHandler')
			.mockResolvedValue(undefined);
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			text: () => Promise.resolve('{"v":1,"components":{}}'),
		});
		vi.stubGlobal('fetch', fetchMock);

		const optionsWithRefs = {
			...mockOptions,
			port: 6006,
			endpoint: '/custom-mcp',
			presets: {
				apply: vi.fn((key: string) => {
					if (key === 'refs') {
						return Promise.resolve({
							'design-system': {
								title: 'Design System',
								url: 'https://ds.example.com/storybook',
							},
						});
					}
					if (key === 'features') {
						return Promise.resolve({ componentsManifest: false });
					}
					return Promise.resolve(undefined);
				}),
			},
		} as unknown as Options;

		await (experimental_devServer as any)(mockApp, optionsWithRefs);
		await handlers['/custom-mcp'](
			{
				headers: { accept: 'application/json' },
			},
			{},
		);

		const firstCall = mcpServerHandler.mock.calls[0];
		if (!firstCall) {
			throw new Error('Expected mcpServerHandler to be called');
		}
		const { manifestProvider } = firstCall[0];
		if (!manifestProvider) {
			throw new Error('Expected refs to create a manifest provider');
		}

		await manifestProvider(
			new Request('http://localhost:6006/custom-mcp?transport=sse'),
			'./manifests/components.json',
			{ id: 'local', title: 'Local' },
		);

		expect(fetchMock).toHaveBeenLastCalledWith(
			'http://localhost:6006/manifests/components.json',
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: 'application/json',
				}),
			}),
		);
	});

	it('should keep direct unauthenticated requests on the OAuth challenge path', async () => {
		const mcpServerHandler = vi
			.spyOn(mcpHandlerModule, 'mcpServerHandler')
			.mockResolvedValue(undefined);
		stubPrivateRefDiscovery();

		await (experimental_devServer as any)(mockApp, createOptionsWithPrivateRef());

		const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any;
		await mcpHandler(
			{
				headers: {},
			},
			mockRes,
		);

		expect(mockRes.writeHead).toHaveBeenCalledWith(
			401,
			expect.objectContaining({
				'WWW-Authenticate': expect.stringContaining('/.well-known/oauth-protected-resource'),
			}),
		);
		expect(mockRes.end).toHaveBeenCalledWith('401 - Unauthorized');
		expect(mcpServerHandler).not.toHaveBeenCalled();
	});

	it('should let proxy requests reach MCP with a requires-own-mcp manifest provider', async () => {
		const mcpServerHandler = vi
			.spyOn(mcpHandlerModule, 'mcpServerHandler')
			.mockResolvedValue(undefined);
		stubPrivateRefDiscovery();

		await (experimental_devServer as any)(mockApp, createOptionsWithPrivateRef());

		const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any;
		await mcpHandler(
			{
				headers: { [STORYBOOK_MCP_PROXY_HEADER.toLowerCase()]: 'true' },
			},
			mockRes,
		);

		expect(mockRes.writeHead).not.toHaveBeenCalledWith(401, expect.anything());
		expect(mcpServerHandler).toHaveBeenCalledTimes(1);

		const { manifestProvider, sources } = mcpServerHandler.mock.calls[0]![0];
		expect(manifestProvider).toBeDefined();
		expect(sources).toBeDefined();
		await expect(
			manifestProvider!(
				new Request('http://localhost:6006/mcp'),
				'./manifests/components.json',
				sources![1],
			),
		).rejects.toBeInstanceOf(RequiresOwnMcpError);
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

	it('should show Storybook version requirement for addon-vitest and a manual manifest link', async () => {
		vi.spyOn(runStoryTests, 'getAddonVitestConstants').mockResolvedValue(undefined);
		const manifestEnabledOptions = {
			presets: {
				apply: vi.fn((key: string) => {
					if (key === 'features') {
						return Promise.resolve({ experimentalComponentsManifest: true });
					}
					if (key === 'experimental_manifests') {
						return Promise.resolve({ components: { v: 1, components: {} } });
					}
					return Promise.resolve(undefined);
				}),
			},
		} as unknown as Options;

		const handlers: Record<string, any> = {};
		mockApp.get = vi.fn((path: string, handler: any) => {
			handlers[path] = handler;
		});

		await (experimental_devServer as any)(mockApp, manifestEnabledOptions);
		const getMcpHandler = handlers['/mcp'];
		expect(getMcpHandler).toBeDefined();

		const mockReq = {
			headers: {
				accept: 'text/html',
			},
		} as any;
		const mockRes = {
			writeHead: vi.fn(),
			end: vi.fn(),
		} as any;

		await getMcpHandler(mockReq, mockRes);

		expect(mockRes.end).toHaveBeenCalledWith(
			expect.stringContaining('This toolset requires Storybook 10.3.0+ with'),
		);
		expect(mockRes.end).toHaveBeenCalledWith(
			expect.stringContaining(
				'View the <a href="/manifests/components.html">component manifest debugger</a>.',
			),
		);
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
						return Promise.resolve({ componentsManifest: false });
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
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				headers: new Headers(),
				text: () => Promise.resolve('{"v":1,"components":{}}'),
			}),
		);

		const apply = vi.fn((key: string) => {
			if (key === 'refs') {
				return Promise.resolve({
					'my-lib': { title: 'My Library', url: 'https://my-lib.example.com' },
					'design-system': { url: 'https://ds.example.com' },
				});
			}
			if (key === 'features') {
				return Promise.resolve({ componentsManifest: false });
			}
			return Promise.resolve(undefined);
		});
		const optionsWithRefs = {
			port: 6006,
			presets: { apply },
		} as unknown as Options;

		await (experimental_devServer as any)(mockApp, optionsWithRefs);

		// The preset should have called presets.apply('refs')
		expect(apply).toHaveBeenCalledWith('refs', {});
	});

	it('should handle refs config returning non-object gracefully', async () => {
		const optionsWithBadRefs = {
			port: 6006,
			presets: {
				apply: vi.fn((key: string) => {
					if (key === 'refs') return Promise.resolve(null);
					if (key === 'features') {
						return Promise.resolve({ componentsManifest: false });
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
						return Promise.resolve({ componentsManifest: false });
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
