import { describe, it, expect, vi, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createStorybookMcpHandler } from './index.ts';
import smallManifestFixture from '../fixtures/small-manifest.fixture.json' with { type: 'json' };
import smallDocsManifestFixture from '../fixtures/small-docs-manifest.fixture.json' with { type: 'json' };

/**
 * Creates a manifestProvider mock that returns component manifest for components.json
 * and throws an error for docs.json (simulating no docs manifest available)
 */
function createManifestProviderMock() {
	return vi.fn().mockImplementation((_request: Request, path: string) => {
		if (path.includes('components.json')) {
			return Promise.resolve(JSON.stringify(smallManifestFixture));
		}
		// Simulate docs.json not found
		return Promise.reject(new Error('Not found'));
	});
}

/**
 * Creates a manifestProvider mock that returns both component and docs manifests
 */
function createManifestProviderMockWithDocs() {
	return vi.fn().mockImplementation((_request: Request, path: string) => {
		if (path.includes('components.json')) {
			return Promise.resolve(JSON.stringify(smallManifestFixture));
		}
		if (path.includes('docs.json')) {
			return Promise.resolve(JSON.stringify(smallDocsManifestFixture));
		}
		return Promise.reject(new Error('Not found'));
	});
}

describe('createStorybookMcpHandler', () => {
	let client: Client;
	let transport: StreamableHTTPClientTransport;
	let fetchMock: ReturnType<typeof vi.fn>;

	/**
	 * Helper to setup client with a mock fetch that routes to our handler
	 */
	async function setupClient(
		handler: Awaited<ReturnType<typeof createStorybookMcpHandler>>,
	) {
		// Mock global fetch to route to our handler
		fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.href
						: input.url;
			const request = new Request(url, init);
			return await handler(request);
		});
		(global as any).fetch = fetchMock;

		// Create client and transport
		transport = new StreamableHTTPClientTransport(
			new URL('http://localhost:3000/mcp'),
		);
		client = new Client({
			name: 'test-client',
			version: '1.0.0',
		});

		await client.connect(transport);
	}

	afterEach(async () => {
		if (client) {
			await client.close();
		}
		if (transport) {
			await transport.close();
		}
	});

	it('should handle initialize and list tools', async () => {
		const handler = await createStorybookMcpHandler();
		await setupClient(handler);

		const tools = await client.listTools();

		expect(tools.tools).toHaveLength(2);
		expect(tools.tools).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'list-all-documentation',
					title: 'List All Documentation',
				}),
				expect.objectContaining({
					name: 'get-documentation',
					title: 'Get Documentation',
				}),
			]),
		);
	});

	it('should call onSessionInitialize handler when provided', async () => {
		const onSessionInitialize = vi.fn();
		const handler = await createStorybookMcpHandler({ onSessionInitialize });
		await setupClient(handler);

		// The handler should be called during connect
		expect(onSessionInitialize).toHaveBeenCalledTimes(1);
		expect(onSessionInitialize).toHaveBeenCalledWith(
			expect.objectContaining({
				protocolVersion: expect.any(String),
				capabilities: expect.any(Object),
				clientInfo: expect.objectContaining({
					name: 'test-client',
					version: '1.0.0',
				}),
			}),
		);
	});

	it('should use manifestProvider when calling list-all-documentation', async () => {
		const manifestProvider = createManifestProviderMock();

		const handler = await createStorybookMcpHandler({
			manifestProvider,
		});
		await setupClient(handler);

		const result = await client.callTool({
			name: 'list-all-documentation',
			arguments: {},
		});

		expect(manifestProvider).toHaveBeenCalledWith(
			expect.any(Request),
			'./manifests/components.json',
		);
		expect(result.content).toHaveLength(1);
		expect((result.content as any)[0]).toMatchObject({
			type: 'text',
			text: expect.stringContaining('# Components'),
		});
	});

	it('should call onListAllDocumentation handler when tool is invoked', async () => {
		const onListAllDocumentation = vi.fn();
		const manifestProvider = createManifestProviderMock();

		const handler = await createStorybookMcpHandler({
			manifestProvider,
			onListAllDocumentation,
		});
		await setupClient(handler);

		await client.callTool({
			name: 'list-all-documentation',
			arguments: {},
		});

		expect(onListAllDocumentation).toHaveBeenCalledTimes(1);
		expect(onListAllDocumentation).toHaveBeenCalledWith({
			context: expect.objectContaining({
				request: expect.any(Request),
			}),
			manifests: { componentManifest: smallManifestFixture },
			resultText: expect.any(String),
		});
	});

	it('should call onGetDocumentation handler when tool is invoked', async () => {
		const onGetDocumentation = vi.fn();
		const manifestProvider = createManifestProviderMock();

		const handler = await createStorybookMcpHandler({
			manifestProvider,
			onGetDocumentation,
		});
		await setupClient(handler);

		const result = await client.callTool({
			name: 'get-documentation',
			arguments: {
				id: 'button',
			},
		});

		expect(onGetDocumentation).toHaveBeenCalledTimes(1);
		expect(onGetDocumentation).toHaveBeenCalledWith({
			context: expect.objectContaining({
				request: expect.any(Request),
			}),
			input: { id: 'button' },
			foundDocumentation: expect.objectContaining({
				id: 'button',
				name: 'Button',
			}),
			resultText: expect.any(String),
		});

		expect(result.content).toHaveLength(1);
		expect((result.content as any)[0]).toMatchObject({
			type: 'text',
			text: expect.stringContaining('Button'),
		});
	});

	it('should handle errors gracefully when manifest is not available', async () => {
		const handler = await createStorybookMcpHandler();
		await setupClient(handler);

		const result = await client.callTool({
			name: 'list-all-documentation',
			arguments: {},
		});

		expect(result.isError).toBe(true);
		expect((result.content as any)[0]).toMatchObject({
			type: 'text',
			text: expect.stringContaining('Error'),
		});
	});

	it('should handle non-existent component ID in get-documentation', async () => {
		const onGetDocumentation = vi.fn();
		const manifestProvider = createManifestProviderMock();

		const handler = await createStorybookMcpHandler({
			manifestProvider,
			onGetDocumentation,
		});
		await setupClient(handler);

		const result = await client.callTool({
			name: 'get-documentation',
			arguments: {
				id: 'non-existent',
			},
		});

		// Should still call the handler
		expect(onGetDocumentation).toHaveBeenCalledTimes(1);
		expect(onGetDocumentation).toHaveBeenCalledWith({
			context: expect.objectContaining({
				request: expect.any(Request),
			}),
			input: { id: 'non-existent' },
		});

		expect(result.content).toHaveLength(1);
		expect((result.content as any)[0]).toMatchObject({
			type: 'text',
			text: expect.stringContaining('not found'),
		});
	});

	describe('with docs manifest', () => {
		it('should return docs entries in list-all-documentation when docs manifest is available', async () => {
			const manifestProvider = createManifestProviderMockWithDocs();

			const handler = await createStorybookMcpHandler({
				manifestProvider,
			});
			await setupClient(handler);

			const result = await client.callTool({
				name: 'list-all-documentation',
				arguments: {},
			});

			expect(manifestProvider).toHaveBeenCalledWith(
				expect.any(Request),
				'./manifests/components.json',
			);
			expect(manifestProvider).toHaveBeenCalledWith(
				expect.any(Request),
				'./manifests/docs.json',
			);

			expect(result.content).toHaveLength(1);
			const text = (result.content as any)[0].text;
			expect(text).toContain('# Components');
			expect(text).toContain('# Docs');
			expect(text).toContain('Getting Started');
		});

		it('should include docs manifest in onListAllDocumentation handler', async () => {
			const onListAllDocumentation = vi.fn();
			const manifestProvider = createManifestProviderMockWithDocs();

			const handler = await createStorybookMcpHandler({
				manifestProvider,
				onListAllDocumentation,
			});
			await setupClient(handler);

			await client.callTool({
				name: 'list-all-documentation',
				arguments: {},
			});

			expect(onListAllDocumentation).toHaveBeenCalledTimes(1);
			expect(onListAllDocumentation).toHaveBeenCalledWith({
				context: expect.objectContaining({
					request: expect.any(Request),
				}),
				manifests: {
					componentManifest: smallManifestFixture,
					docsManifest: smallDocsManifestFixture,
				},
				resultText: expect.any(String),
			});
		});

		it('should return documentation for a docs entry', async () => {
			const onGetDocumentation = vi.fn();
			const manifestProvider = createManifestProviderMockWithDocs();

			const handler = await createStorybookMcpHandler({
				manifestProvider,
				onGetDocumentation,
			});
			await setupClient(handler);

			const result = await client.callTool({
				name: 'get-documentation',
				arguments: {
					id: 'getting-started',
				},
			});

			expect(onGetDocumentation).toHaveBeenCalledTimes(1);
			expect(onGetDocumentation).toHaveBeenCalledWith({
				context: expect.objectContaining({
					request: expect.any(Request),
				}),
				input: { id: 'getting-started' },
				foundDocumentation: expect.objectContaining({
					id: 'getting-started',
					name: 'Getting Started',
				}),
				resultText: expect.any(String),
			});

			expect(result.content).toHaveLength(1);
			expect((result.content as any)[0]).toMatchObject({
				type: 'text',
				text: expect.stringContaining('Getting Started'),
			});
		});
	});
});
