import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { addListAllDocumentationTool, LIST_TOOL_NAME } from './list-all-documentation.ts';
import type { StorybookContext } from '../types.ts';
import smallManifestFixture from '../../fixtures/small-manifest.fixture.json' with { type: 'json' };
import smallDocsManifestFixture from '../../fixtures/small-docs-manifest.fixture.json' with { type: 'json' };
import * as getManifest from '../utils/get-manifest.ts';

describe('listAllDocumentationTool', () => {
	let server: McpServer<any, StorybookContext>;
	let getManifestsSpy: any;

	beforeEach(async () => {
		const adapter = new ValibotJsonSchemaAdapter();
		server = new McpServer(
			{
				name: 'test-server',
				version: '1.0.0',
				description: 'Test server for list tool',
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
		await addListAllDocumentationTool(server);

		// Mock getManifests to return the fixture
		getManifestsSpy = vi.spyOn(getManifest, 'getManifests');
		getManifestsSpy.mockResolvedValue({
			componentManifest: smallManifestFixture,
		});
	});

	it('should return a list of all components', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: LIST_TOOL_NAME,
				arguments: {},
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
			      "text": "# Components

			- Button (button): A simple button component
			- Card (card): A container component for grouping related content.
			- Input (input): A text input component with validation support.",
			      "type": "text",
			    },
			  ],
			}
		`);
	});

	it('should handle fetch errors gracefully', async () => {
		getManifestsSpy.mockRejectedValue(
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
				name: LIST_TOOL_NAME,
				arguments: {},
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

	it('should handle unexpected errors gracefully', async () => {
		getManifestsSpy.mockRejectedValue(new Error('Network timeout'));

		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: LIST_TOOL_NAME,
				arguments: {},
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
			      "text": "Unexpected error: Network timeout",
			      "type": "text",
			    },
			  ],
			  "isError": true,
			}
		`);
	});

	it('should call onListAllDocumentation handler when provided', async () => {
		const handler = vi.fn();

		const request = {
			jsonrpc: '2.0' as const,
			id: 2,
			method: 'tools/call',
			params: {
				name: LIST_TOOL_NAME,
				arguments: {},
			},
		};

		const mockHttpRequest = new Request('https://example.com/mcp');
		// Pass the handler and request in the context for this specific request
		await server.receive(request, {
			custom: { request: mockHttpRequest, onListAllDocumentation: handler },
		});

		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith({
			context: expect.objectContaining({
				request: mockHttpRequest,
				onListAllDocumentation: handler,
			}),
			manifests: {
				componentManifest: smallManifestFixture,
			},
			resultText: expect.any(String),
		});
	});

	it('should format components as XML when format is "xml"', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: LIST_TOOL_NAME,
				arguments: {},
			},
		};

		const mockHttpRequest = new Request('https://example.com/mcp');
		const response = await server.receive(request, {
			custom: { request: mockHttpRequest, format: 'xml' as const },
		});

		expect(response.result).toMatchInlineSnapshot(`
			{
			  "content": [
			    {
			      "text": "<components>
			<component>
			<id>button</id>
			<name>Button</name>
			<summary>
			A simple button component
			</summary>
			</component>
			<component>
			<id>card</id>
			<name>Card</name>
			<summary>
			A container component for grouping related content.
			</summary>
			</component>
			<component>
			<id>input</id>
			<name>Input</name>
			<summary>
			A text input component with validation support.
			</summary>
			</component>
			</components>",
			      "type": "text",
			    },
			  ],
			}
		`);
	});

	describe('with docs manifest', () => {
		beforeEach(() => {
			getManifestsSpy.mockResolvedValue({
				componentManifest: smallManifestFixture,
				docsManifest: smallDocsManifestFixture,
			});
		});

		it('should return both components and docs entries', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: LIST_TOOL_NAME,
					arguments: {},
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
				      "text": "# Components

				- Button (button): A simple button component
				- Card (card): A container component for grouping related content.
				- Input (input): A text input component with validation support.

				# Docs

				- Getting Started Guide (getting-started): # Getting Started Welcome to the component library. This guide will help you get up and ru...
				- Theming and Customization (theming): # Theming Learn how to customize the look and feel of components using our theming system....",
				      "type": "text",
				    },
				  ],
				}
			`);
		});

		it('should format both components and docs entries as XML when format is "xml"', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: LIST_TOOL_NAME,
					arguments: {},
				},
			};

			const mockHttpRequest = new Request('https://example.com/mcp');
			const response = await server.receive(request, {
				custom: { request: mockHttpRequest, format: 'xml' as const },
			});

			expect(response.result).toMatchInlineSnapshot(`
				{
				  "content": [
				    {
				      "text": "<components>
				<component>
				<id>button</id>
				<name>Button</name>
				<summary>
				A simple button component
				</summary>
				</component>
				<component>
				<id>card</id>
				<name>Card</name>
				<summary>
				A container component for grouping related content.
				</summary>
				</component>
				<component>
				<id>input</id>
				<name>Input</name>
				<summary>
				A text input component with validation support.
				</summary>
				</component>
				</components>
				<docs>
				<doc>
				<id>getting-started</id>
				<title>Getting Started Guide</title>
				<summary>
				# Getting Started Welcome to the component library. This guide will help you get up and ru...
				</summary>
				</doc>
				<doc>
				<id>theming</id>
				<title>Theming and Customization</title>
				<summary>
				# Theming Learn how to customize the look and feel of components using our theming system....
				</summary>
				</doc>
				</docs>",
				      "type": "text",
				    },
				  ],
				}
			`);
		});

		it('should include docs manifest in onListAllDocumentation handler call', async () => {
			const handler = vi.fn();

			const request = {
				jsonrpc: '2.0' as const,
				id: 2,
				method: 'tools/call',
				params: {
					name: LIST_TOOL_NAME,
					arguments: {},
				},
			};

			const mockHttpRequest = new Request('https://example.com/mcp');
			await server.receive(request, {
				custom: { request: mockHttpRequest, onListAllDocumentation: handler },
			});

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith({
				context: expect.objectContaining({
					request: mockHttpRequest,
					onListAllDocumentation: handler,
				}),
				manifests: {
					componentManifest: smallManifestFixture,
					docsManifest: smallDocsManifestFixture,
				},
				resultText: expect.any(String),
			});
		});
	});
});
