import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import {
	addListAllComponentsTool,
	LIST_TOOL_NAME,
} from './list-all-components.ts';
import type { StorybookContext } from '../types.ts';
import smallManifestFixture from '../../fixtures/small-manifest.fixture.json' with { type: 'json' };
import * as getManifest from '../utils/get-manifest.ts';

describe('listAllComponentsTool', () => {
	let server: McpServer<any, StorybookContext>;
	let getManifestSpy: any;

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
		await addListAllComponentsTool(server);

		// Mock getManifest to return the fixture
		getManifestSpy = vi.spyOn(getManifest, 'getManifest');
		getManifestSpy.mockResolvedValue(smallManifestFixture);
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
		getManifestSpy.mockRejectedValue(new Error('Network timeout'));

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

	it('should call onListAllComponents handler when provided', async () => {
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
			custom: { request: mockHttpRequest, onListAllComponents: handler },
		});

		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith({
			context: expect.objectContaining({
				request: mockHttpRequest,
				onListAllComponents: handler,
			}),
			manifest: smallManifestFixture,
		});
	});
});
