import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import {
	addGetComponentDocumentationTool,
	GET_TOOL_NAME,
} from './get-component-documentation.ts';
import type { StorybookContext } from '../types.ts';
import smallManifestFixture from '../../fixtures/small-manifest.fixture.json' with { type: 'json' };
import * as getManifest from '../utils/get-manifest.ts';

describe('getComponentDocumentationTool', () => {
	let server: McpServer<any, StorybookContext>;
	let getManifestSpy: any;

	beforeEach(async () => {
		const adapter = new ValibotJsonSchemaAdapter();
		server = new McpServer(
			{
				name: 'test-server',
				version: '1.0.0',
				description: 'Test server for get tool',
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
		await addGetComponentDocumentationTool(server);

		// Mock getManifest to return the fixture
		getManifestSpy = vi.spyOn(getManifest, 'getManifest');
		getManifestSpy.mockResolvedValue(smallManifestFixture);
	});

	it('should return formatted documentation for a single component', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_TOOL_NAME,
				arguments: {
					componentIds: ['button'],
				},
			},
		};

		const response = await server.receive(request);

		expect(response.result).toMatchInlineSnapshot(`
			{
			  "content": [
			    {
			      "text": "<component>
			<id>button</id>
			<name>Button</name>
			<example>
			<example_name>Primary</example_name>
			<example_description>
			The primary button variant.
			</example_description>
			<example_code>
			const Primary = () => <Button variant="primary">Click Me</Button>
			</example_code>
			</example>
			</component>",
			      "type": "text",
			    },
			  ],
			}
		`);
	});

	it('should return formatted documentation for multiple components', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_TOOL_NAME,
				arguments: {
					componentIds: ['button', 'card', 'input'],
				},
			},
		};

		const response = await server.receive(request);

		expect(response.result).toMatchInlineSnapshot(`
			{
			  "content": [
			    {
			      "text": "<component>
			<id>button</id>
			<name>Button</name>
			<example>
			<example_name>Primary</example_name>
			<example_description>
			The primary button variant.
			</example_description>
			<example_code>
			const Primary = () => <Button variant="primary">Click Me</Button>
			</example_code>
			</example>
			</component>",
			      "type": "text",
			    },
			    {
			      "text": "<component>
			<id>card</id>
			<name>Card</name>
			<description>
			A container component for grouping related content.
			</description>
			<example>
			<example_name>Basic</example_name>
			<example_description>
			A basic card with content.
			</example_description>
			<example_code>
			const Basic = () => (
			  <Card>
			    <h3>Title</h3>
			    <p>Content</p>
			  </Card>
			)
			</example_code>
			</example>
			</component>",
			      "type": "text",
			    },
			    {
			      "text": "<component>
			<id>input</id>
			<name>Input</name>
			<description>
			A text input component with validation support.
			</description>
			<example>
			<example_name>Basic</example_name>
			<example_description>
			A basic text input.
			</example_description>
			<example_code>
			const Basic = () => <Input label="Name" placeholder="Enter name" />
			</example_code>
			</example>
			</component>",
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
				name: GET_TOOL_NAME,
				arguments: {
					componentIds: ['nonexistent'],
				},
			},
		};

		const response = await server.receive(request);

		expect(response.result).toMatchInlineSnapshot(`
			{
			  "content": [
			    {
			      "text": "Error: Component not found: nonexistent",
			      "type": "text",
			    },
			  ],
			  "isError": true,
			}
		`);
	});

	it('should return partial results and a warning when some components are not found', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_TOOL_NAME,
				arguments: {
					componentIds: ['button', 'nonexistent', 'card'],
				},
			},
		};

		const response = await server.receive(request);
		expect(response.result).toMatchInlineSnapshot(`
			{
			  "content": [
			    {
			      "text": "<component>
			<id>button</id>
			<name>Button</name>
			<example>
			<example_name>Primary</example_name>
			<example_description>
			The primary button variant.
			</example_description>
			<example_code>
			const Primary = () => <Button variant="primary">Click Me</Button>
			</example_code>
			</example>
			</component>",
			      "type": "text",
			    },
			    {
			      "text": "<component>
			<id>card</id>
			<name>Card</name>
			<description>
			A container component for grouping related content.
			</description>
			<example>
			<example_name>Basic</example_name>
			<example_description>
			A basic card with content.
			</example_description>
			<example_code>
			const Basic = () => (
			  <Card>
			    <h3>Title</h3>
			    <p>Content</p>
			  </Card>
			)
			</example_code>
			</example>
			</component>",
			      "type": "text",
			    },
			    {
			      "text": "Warning: Component not found: nonexistent",
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
				name: GET_TOOL_NAME,
				arguments: {
					componentIds: ['button'],
				},
			},
		};

		const response = await server.receive(request);

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

	it('should call onGetComponentDocumentation handler when provided', async () => {
		const handler = vi.fn();

		const request = {
			jsonrpc: '2.0' as const,
			id: 2,
			method: 'tools/call',
			params: {
				name: GET_TOOL_NAME,
				arguments: {
					componentIds: ['button', 'card', 'non-existent'],
				},
			},
		};

		// Pass the handler in the context for this specific request
		await server.receive(request, {
			custom: { onGetComponentDocumentation: handler },
		});

		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith({
			context: expect.objectContaining({
				onGetComponentDocumentation: handler,
			}),
			input: { componentIds: ['button', 'card', 'non-existent'] },
			foundComponents: [
				expect.objectContaining({ id: 'button', name: 'Button' }),
				expect.objectContaining({ id: 'card', name: 'Card' }),
			],
			notFoundIds: ['non-existent'],
		});
	});
});
