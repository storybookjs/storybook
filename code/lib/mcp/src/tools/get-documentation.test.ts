import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { addGetDocumentationTool, GET_TOOL_NAME } from './get-documentation.ts';
import type { StorybookContext } from '../types.ts';
import smallManifestFixture from '../../fixtures/small-manifest.fixture.json' with { type: 'json' };
import smallDocsManifestFixture from '../../fixtures/small-docs-manifest.fixture.json' with { type: 'json' };
import * as getManifest from '../utils/get-manifest.ts';

describe('getDocumentationTool', () => {
	let server: McpServer<any, StorybookContext>;
	let getManifestsSpy: any;

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
		await addGetDocumentationTool(server);

		// Mock getManifests to return the fixture
		getManifestsSpy = vi.spyOn(getManifest, 'getManifests');
		getManifestsSpy.mockResolvedValue({
			componentManifest: smallManifestFixture,
		});
	});

	it('should return formatted documentation for a single component', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_TOOL_NAME,
				arguments: {
					id: 'button',
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
			      "text": "# Button

			ID: button

			## Stories

			### Primary

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
				name: GET_TOOL_NAME,
				arguments: {
					id: 'nonexistent',
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
			      "text": "Component or Docs Entry not found: "nonexistent". Use the list-all-documentation tool to see available components and documentation entries.",
			      "type": "text",
			    },
			  ],
			  "isError": true,
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
				name: GET_TOOL_NAME,
				arguments: {
					id: 'button',
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

	it('should call onGetDocumentation handler when provided', async () => {
		const handler = vi.fn();

		const request = {
			jsonrpc: '2.0' as const,
			id: 2,
			method: 'tools/call',
			params: {
				name: GET_TOOL_NAME,
				arguments: {
					id: 'button',
				},
			},
		};

		const mockHttpRequest = new Request('https://example.com/mcp');
		// Pass the handler and request in the context for this specific request
		await server.receive(request, {
			custom: {
				request: mockHttpRequest,
				onGetDocumentation: handler,
			},
		});

		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith({
			context: expect.objectContaining({
				request: mockHttpRequest,
				onGetDocumentation: handler,
			}),
			input: { id: 'button' },
			foundDocumentation: expect.objectContaining({
				id: 'button',
				name: 'Button',
			}),
		});
	});

	it('should include props section when reactDocgen is present', async () => {
		const manifestWithReactDocgen = {
			v: 1,
			components: {
				button: {
					id: 'button',
					name: 'Button',
					description: 'A button component',
					reactDocgen: {
						props: {
							variant: {
								description: 'Button style variant',
								required: false,
								defaultValue: { value: '"primary"', computed: false },
								tsType: {
									name: 'union',
									raw: '"primary" | "secondary"',
									elements: [
										{ name: 'literal', value: '"primary"' },
										{ name: 'literal', value: '"secondary"' },
									],
								},
							},
							disabled: {
								description: 'Disable the button',
								required: false,
								tsType: {
									name: 'boolean',
								},
							},
						},
					},
				},
			},
		};

		getManifestsSpy.mockResolvedValue({
			componentManifest: manifestWithReactDocgen,
		});

		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_TOOL_NAME,
				arguments: {
					id: 'button',
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
			      "text": "# Button

			ID: button

			A button component

			## Props

			\`\`\`
			export type Props = {
			  /**
			    Button style variant
			  */
			  variant?: "primary" | "secondary" = "primary";
			  /**
			    Disable the button
			  */
			  disabled?: boolean;
			}
			\`\`\`",
			      "type": "text",
			    },
			  ],
			}
		`);
	});

	it('should format component as XML when format is "xml"', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_TOOL_NAME,
				arguments: {
					id: 'button',
				},
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
			      "text": "<component>
			<id>button</id>
			<name>Button</name>
			<story>
			<story_name>Primary</story_name>
			<story_description>
			The primary button variant.
			</story_description>
			<story_code>
			const Primary = () => <Button variant="primary">Click Me</Button>
			</story_code>
			</story>
			</component>",
			      "type": "text",
			    },
			  ],
			}
		`);
	});

	describe('docs manifest entries', () => {
		beforeEach(() => {
			getManifestsSpy.mockResolvedValue({
				componentManifest: smallManifestFixture,
				docsManifest: smallDocsManifestFixture,
			});
		});

		it('should return formatted documentation for a docs entry', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: GET_TOOL_NAME,
					arguments: {
						id: 'getting-started',
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
				      "text": "# Getting Started Guide

				# Getting Started

				Welcome to the component library. This guide will help you get up and running.

				## Installation

				\`\`\`bash
				npm install my-component-library
				\`\`\`

				## Usage

				Import components and use them in your application.",
				      "type": "text",
				    },
				  ],
				}
			`);
		});

		it('should return component documentation when id matches both component and docs entry', async () => {
			// When an ID exists in both manifests, prefer component documentation
			getManifestsSpy.mockResolvedValue({
				componentManifest: smallManifestFixture,
				docsManifest: {
					v: 1,
					docs: {
						button: {
							id: 'button',
							name: 'Button Docs',
							title: 'Button Documentation',
							path: 'docs/button.mdx',
							content: 'This is the button docs entry',
						},
					},
				},
			});

			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: GET_TOOL_NAME,
					arguments: {
						id: 'button',
					},
				},
			};

			const mockHttpRequest = new Request('https://example.com/mcp');
			const response = await server.receive(request, {
				custom: { request: mockHttpRequest },
			});

			// Should return the component, not the docs entry
			expect((response.result as any).content[0].text).toContain('## Stories');
			expect((response.result as any).content[0].text).toContain('Primary');
		});

		it('should format docs entry as XML when format is "xml"', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: GET_TOOL_NAME,
					arguments: {
						id: 'getting-started',
					},
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
				      "text": "<doc>
				<title>Getting Started Guide</title>
				<content>
				# Getting Started

				Welcome to the component library. This guide will help you get up and running.

				## Installation

				\`\`\`bash
				npm install my-component-library
				\`\`\`

				## Usage

				Import components and use them in your application.
				</content>
				</doc>",
				      "type": "text",
				    },
				  ],
				}
			`);
		});

		it('should call onGetDocumentation handler with docs entry when found', async () => {
			const handler = vi.fn();

			const request = {
				jsonrpc: '2.0' as const,
				id: 2,
				method: 'tools/call',
				params: {
					name: GET_TOOL_NAME,
					arguments: {
						id: 'getting-started',
					},
				},
			};

			const mockHttpRequest = new Request('https://example.com/mcp');
			await server.receive(request, {
				custom: {
					request: mockHttpRequest,
					onGetDocumentation: handler,
				},
			});

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith({
				context: expect.objectContaining({
					request: mockHttpRequest,
					onGetDocumentation: handler,
				}),
				input: { id: 'getting-started' },
				foundDocumentation: expect.objectContaining({
					id: 'getting-started',
					name: 'Getting Started',
				}),
			});
		});
	});
});
