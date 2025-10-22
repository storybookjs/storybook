import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import {
	addListAllComponentsTool,
	LIST_TOOL_NAME,
} from './list-all-components.ts';
import type { StorybookContext } from '../types.ts';
import smallManifestFixture from '../../fixtures/small-manifest.fixture.json' with { type: 'json' };
import * as fetchManifest from '../utils/fetch-manifest.ts';

describe('listAllComponentsTool', () => {
	let server: McpServer<any, StorybookContext>;
	let fetchManifestSpy: any;

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

		// Mock fetchManifest to return the fixture
		fetchManifestSpy = vi.spyOn(fetchManifest, 'fetchManifest');
		fetchManifestSpy.mockResolvedValue(smallManifestFixture);
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

		const response = await server.receive(request);

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
		fetchManifestSpy.mockRejectedValue(
			new fetchManifest.ManifestFetchError(
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

		const response = await server.receive(request);

		expect(response.result).toMatchInlineSnapshot(`
			{
			  "content": [
			    {
			      "text": "Error fetching manifest: Failed to fetch manifest: 404 Not Found",
			      "type": "text",
			    },
			  ],
			  "isError": true,
			}
		`);
	});

	it('should handle unexpected errors gracefully', async () => {
		fetchManifestSpy.mockRejectedValue(new Error('Network timeout'));

		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: LIST_TOOL_NAME,
				arguments: {},
			},
		};

		const response = await server.receive(request);

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
});
