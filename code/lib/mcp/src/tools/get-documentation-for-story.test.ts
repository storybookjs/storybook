import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import {
	addGetStoryDocumentationTool,
	GET_STORY_TOOL_NAME,
} from './get-documentation-for-story.ts';
import type { StorybookContext } from '../types.ts';
import smallManifestFixture from '../../fixtures/small-manifest.fixture.json' with { type: 'json' };
import * as getManifest from '../utils/get-manifest.ts';

describe('getComponentStoryDocumentationTool', () => {
	let server: McpServer<any, StorybookContext>;
	let getManifestSpy: any;

	beforeEach(async () => {
		const adapter = new ValibotJsonSchemaAdapter();
		server = new McpServer(
			{
				name: 'test-server',
				version: '1.0.0',
				description: 'Test server for get story tool',
			},
			{
				adapter,
				capabilities: {
					tools: { listChanged: true },
				},
			},
		).withContext<StorybookContext>();

		// initialize test session
		await server.receive(
			{
				jsonrpc: '2.0',
				id: 1,
				method: 'initialize',
				params: {
					protocolVersion: '2025-06-18',
					capabilities: {},
					clientInfo: { name: 'test', version: '1.0.0' },
				},
			},
			{ sessionId: 'test-session' },
		);
		await addGetStoryDocumentationTool(server);

		// Mock getManifest to return the fixture
		getManifestSpy = vi.spyOn(getManifest, 'getManifests');
		getManifestSpy.mockResolvedValue({
			componentManifest: smallManifestFixture,
		});
	});

	it('should return formatted story documentation for a specific story', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_STORY_TOOL_NAME,
				arguments: {
					componentId: 'button',
					storyName: 'Primary',
				},
			},
		};

		const mockHttpRequest = new Request('https://example.com/mcp');
		const response = await server.receive(request, {
			custom: { request: mockHttpRequest },
		});

		expect(response.result).toMatchInlineSnapshot(`
			{
			  "content": [
			    {
			      "text": "# Button - Primary

			The primary button variant.

			\`\`\`
			const Primary = () => <Button variant="primary">Click Me</Button>
			\`\`\`",
			      "type": "text",
			    },
			  ],
			}
		`);
	});

	it('should return an error when a component is not found', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_STORY_TOOL_NAME,
				arguments: {
					componentId: 'nonexistent',
					storyName: 'Primary',
				},
			},
		};

		const mockHttpRequest = new Request('https://example.com/mcp');
		const response = await server.receive(request, {
			custom: { request: mockHttpRequest },
		});

		expect(response.result).toMatchInlineSnapshot(`
			{
			  "content": [
			    {
			      "text": "Component not found: "nonexistent". Use the list-all-documentation tool to see available components.",
			      "type": "text",
			    },
			  ],
			  "isError": true,
			}
		`);
	});

	it('should return an error when a story is not found', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_STORY_TOOL_NAME,
				arguments: {
					componentId: 'button',
					storyName: 'Nonexistent',
				},
			},
		};

		const mockHttpRequest = new Request('https://example.com/mcp');
		const response = await server.receive(request, {
			custom: { request: mockHttpRequest },
		});

		expect(response.result).toMatchInlineSnapshot(`
			{
			  "content": [
			    {
			      "text": "Story "Nonexistent" not found for component "button". Available stories: Primary",
			      "type": "text",
			    },
			  ],
			  "isError": true,
			}
		`);
	});

	it('should handle fetch errors gracefully', async () => {
		getManifestSpy.mockRejectedValue(
			new getManifest.ManifestGetError(
				'Failed to fetch manifest: 404 Not Found',
				'https://example.com/manifest.json',
			),
		);

		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_STORY_TOOL_NAME,
				arguments: {
					componentId: 'button',
					storyName: 'Primary',
				},
			},
		};

		const mockHttpRequest = new Request('https://example.com/mcp');
		const response = await server.receive(request, {
			custom: { request: mockHttpRequest },
		});

		expect(response.result).toMatchInlineSnapshot(`
			{
			  "content": [
			    {
			      "text": "Error getting manifest: Failed to fetch manifest: 404 Not Found",
			      "type": "text",
			    },
			  ],
			  "isError": true,
			}
		`);
	});

	it('should include import statement when available', async () => {
		const manifestWithImport = {
			v: 1,
			components: {
				button: {
					id: 'button',
					name: 'Button',
					path: 'src/components/Button.tsx',
					import: 'import { Button } from "@storybook/design-system";',
					stories: [
						{
							name: 'Primary',
							description: 'The primary button variant.',
							snippet: 'const Primary = () => <Button variant="primary">Click Me</Button>',
						},
					],
				},
			},
		};

		getManifestSpy.mockResolvedValue({ componentManifest: manifestWithImport });

		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_STORY_TOOL_NAME,
				arguments: {
					componentId: 'button',
					storyName: 'Primary',
				},
			},
		};

		const mockHttpRequest = new Request('https://example.com/mcp');
		const response = await server.receive(request, {
			custom: { request: mockHttpRequest },
		});

		expect(response.result.content[0].text).toContain(
			'import { Button } from "@storybook/design-system";',
		);
	});

	describe('multi-source mode', () => {
		const sources = [
			{ id: 'local', title: 'Local' },
			{ id: 'remote', title: 'Remote', url: 'http://remote.example.com' },
		];

		const remoteManifest = {
			v: 1,
			components: {
				badge: {
					id: 'badge',
					path: 'src/Badge.tsx',
					name: 'Badge',
					stories: [{ name: 'Default', snippet: 'const Default = () => <Badge />' }],
				},
			},
		};

		// Re-create server with multiSource schema so storybookId is in the schema
		beforeEach(async () => {
			const adapter = new ValibotJsonSchemaAdapter();
			server = new McpServer(
				{
					name: 'test-server',
					version: '1.0.0',
					description: 'Test server for get story tool',
				},
				{
					adapter,
					capabilities: { tools: { listChanged: true } },
				},
			).withContext<StorybookContext>();

			await server.receive(
				{
					jsonrpc: '2.0',
					id: 1,
					method: 'initialize',
					params: {
						protocolVersion: '2025-06-18',
						capabilities: {},
						clientInfo: { name: 'test', version: '1.0.0' },
					},
				},
				{ sessionId: 'test-session' },
			);
			await addGetStoryDocumentationTool(server, undefined, { multiSource: true });

			getManifestSpy = vi.spyOn(getManifest, 'getManifests');
			getManifestSpy.mockResolvedValue({
				componentManifest: smallManifestFixture,
			});
		});

		it('should return schema validation error when storybookId is missing', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: GET_STORY_TOOL_NAME,
					arguments: { componentId: 'button', storyName: 'Primary' },
				},
			};

			const mockHttpRequest = new Request('https://example.com/mcp');
			const response = await server.receive(request, {
				custom: { request: mockHttpRequest, sources },
			});

			// storybookId is required in multi-source mode — schema validation rejects it
			expect((response.result as any).isError).toBe(true);
			expect((response.result as any).content[0].text).toContain('storybookId');
		});

		it('should return error when storybookId is invalid', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: GET_STORY_TOOL_NAME,
					arguments: { componentId: 'button', storyName: 'Primary', storybookId: 'nonexistent' },
				},
			};

			const mockHttpRequest = new Request('https://example.com/mcp');
			const response = await server.receive(request, {
				custom: { request: mockHttpRequest, sources },
			});

			expect((response.result as any).isError).toBe(true);
			expect((response.result as any).content[0].text).toContain(
				'Storybook source not found: "nonexistent"',
			);
			expect((response.result as any).content[0].text).toContain('local, remote');
		});

		it('should fetch story documentation from a specific source', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: GET_STORY_TOOL_NAME,
					arguments: { componentId: 'button', storyName: 'Primary', storybookId: 'local' },
				},
			};

			const mockHttpRequest = new Request('https://example.com/mcp');
			const response = await server.receive(request, {
				custom: { request: mockHttpRequest, sources },
			});

			expect((response.result as any).content[0].text).toContain('# Button - Primary');
			expect(getManifestSpy).toHaveBeenCalledWith(mockHttpRequest, undefined, sources[0]);
		});

		it('should pass remote source to getManifests', async () => {
			getManifestSpy.mockResolvedValue({ componentManifest: remoteManifest });

			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: GET_STORY_TOOL_NAME,
					arguments: { componentId: 'badge', storyName: 'Default', storybookId: 'remote' },
				},
			};

			const mockHttpRequest = new Request('https://example.com/mcp');
			const response = await server.receive(request, {
				custom: { request: mockHttpRequest, sources },
			});

			expect((response.result as any).content[0].text).toContain('# Badge - Default');
			expect(getManifestSpy).toHaveBeenCalledWith(mockHttpRequest, undefined, sources[1]);
		});
	});
});
