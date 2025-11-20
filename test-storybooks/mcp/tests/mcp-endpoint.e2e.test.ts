import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { x } from 'tinyexec';

const STORYBOOK_DIR = new URL('..', import.meta.url).pathname;
const MCP_ENDPOINT = 'http://localhost:6006/mcp';
const STARTUP_TIMEOUT = 15_000;

let storybookProcess: ReturnType<typeof x> | null = null;

/**
 * Helper to create MCP protocol requests
 */
function createMCPRequestBody(
	method: string,
	params: any = {},
	id: number = 1,
) {
	return {
		jsonrpc: '2.0',
		id,
		method,
		params,
	};
}

/**
 * Helper to make MCP requests
 */
async function mcpRequest(method: string, params: any = {}, id: number = 1) {
	const response = await fetch(MCP_ENDPOINT, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(createMCPRequestBody(method, params, id)),
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	// MCP responses come as SSE (Server-Sent Events) format
	const text = await response.text();
	// Remove "data: " prefix if present
	const jsonText = text.replace(/^data: /, '').trim();
	return JSON.parse(jsonText);
}

/**
 * Wait for MCP endpoint to be ready by polling it directly
 */
async function waitForMcpEndpoint(
	maxAttempts = 90,
	interval = 500,
): Promise<void> {
	const { promise, resolve, reject } = Promise.withResolvers<void>();
	let attempts = 0;

	const intervalId = setInterval(async () => {
		attempts++;
		try {
			const response = await fetch(MCP_ENDPOINT, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(createMCPRequestBody('tools/list')),
			});
			if (response.ok) {
				clearInterval(intervalId);
				resolve();
				return;
			}
		} catch (error) {
			// Server not ready yet
		}

		if (attempts >= maxAttempts) {
			clearInterval(intervalId);
			reject(
				new Error('MCP endpoint failed to start within the timeout period'),
			);
		}
	}, interval);

	return promise;
}

describe('MCP Endpoint E2E Tests', () => {
	beforeAll(async () => {
		storybookProcess = x('pnpm', ['storybook'], {
			nodeOptions: {
				cwd: STORYBOOK_DIR,
			},
		});

		// Wait for MCP endpoint to be ready
		await waitForMcpEndpoint();
	}, STARTUP_TIMEOUT);

	afterAll(async () => {
		if (!storybookProcess || !storybookProcess.process) {
			return;
		}
		const kill = Promise.withResolvers<void>();
		storybookProcess.process.on('exit', kill.resolve);
		storybookProcess.kill('SIGTERM');
		await kill.promise;
		storybookProcess = null;
	});

	describe('Session Initialization', () => {
		it('should successfully initialize an MCP session', async () => {
			const response = await mcpRequest('initialize', {
				protocolVersion: '2025-06-18',
				capabilities: {},
				clientInfo: {
					name: 'e2e-test-client',
					version: '1.0.0',
				},
			});

			expect(response).toMatchObject({
				jsonrpc: '2.0',
				id: 1,
				result: {
					protocolVersion: '2025-06-18',
					capabilities: {
						tools: { listChanged: true },
					},
					serverInfo: {
						name: '@storybook/addon-mcp',
						description: expect.stringContaining('agents'),
					},
				},
			});

			expect(response.result.serverInfo.version).toBeDefined();
		});

		it('should return error for invalid protocol version', async () => {
			const response = await mcpRequest('initialize', {
				protocolVersion: '1.0.0', // Invalid version
				capabilities: {},
				clientInfo: {
					name: 'test',
					version: '1.0.0',
				},
			});

			expect(response.error).toMatchInlineSnapshot(`
				{
				  "code": 0,
				  "message": "MCP error -32602: Invalid protocol version format",
				}
			`);
		});
	});

	describe('Tools Discovery', () => {
		it('should list available tools', async () => {
			const response = await mcpRequest('tools/list');

			expect(response.result).toHaveProperty('tools');
			// Dev and docs tools should be present
			expect(response.result.tools).toHaveLength(4);

			expect(response.result.tools).toMatchInlineSnapshot(`
				[
				  {
				    "description": "Get the URL for one or more stories.",
				    "inputSchema": {
				      "$schema": "http://json-schema.org/draft-07/schema#",
				      "properties": {
				        "stories": {
				          "items": {
				            "properties": {
				              "absoluteStoryPath": {
				                "type": "string",
				              },
				              "explicitStoryName": {
				                "type": "string",
				              },
				              "exportName": {
				                "type": "string",
				              },
				            },
				            "required": [
				              "exportName",
				              "absoluteStoryPath",
				            ],
				            "type": "object",
				          },
				          "type": "array",
				        },
				      },
				      "required": [
				        "stories",
				      ],
				      "type": "object",
				    },
				    "name": "get-story-urls",
				    "title": "Get stories' URLs",
				  },
				  {
				    "description": "Instructions on how to do UI component development. 
				      
				      ALWAYS call this tool before doing any UI/frontend/React/component development, including but not
				      limited to adding or updating new components, pages, screens or layouts.",
				    "inputSchema": {
				      "properties": {},
				      "type": "object",
				    },
				    "name": "get-ui-building-instructions",
				    "title": "UI Component Building Instructions",
				  },
				  {
				    "description": "List all available UI components from the component library",
				    "inputSchema": {
				      "properties": {},
				      "type": "object",
				    },
				    "name": "list-all-components",
				    "title": "List All Components",
				  },
				  {
				    "description": "Get detailed documentation for a specific UI component",
				    "inputSchema": {
				      "$schema": "http://json-schema.org/draft-07/schema#",
				      "properties": {
				        "componentId": {
				          "type": "string",
				        },
				      },
				      "required": [
				        "componentId",
				      ],
				      "type": "object",
				    },
				    "name": "get-component-documentation",
				    "title": "Get Documentation for Component",
				  },
				]
			`);
		});
	});

	describe('Tool: get-story-urls', () => {
		it('should return story URLs for valid stories', async () => {
			const cwd = process.cwd();
			const storyPath = cwd.endsWith('/apps/internal-storybook')
				? `${cwd}/stories/components/Button.stories.ts`
				: `${cwd}/apps/internal-storybook/stories/components/Button.stories.ts`;

			const response = await mcpRequest('tools/call', {
				name: 'get-story-urls',
				arguments: {
					stories: [
						{
							exportName: 'Primary',
							absoluteStoryPath: storyPath,
						},
					],
				},
			});

			expect(response.result).toMatchInlineSnapshot(`
				{
				  "content": [
				    {
				      "text": "http://localhost:6006/?path=/story/example-button--primary",
				      "type": "text",
				    },
				  ],
				}
			`);
		});

		it('should return error message for non-existent story', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'get-story-urls',
				arguments: {
					stories: [
						{
							exportName: 'NonExistent',
							absoluteStoryPath: `${process.cwd()}/stories/components/NonExistent.stories.ts`,
						},
					],
				},
			});

			// The tool returns error messages as regular content, not isError
			expect(response.result).toHaveProperty('content');
			expect(response.result.content).toHaveLength(1);
			expect(response.result.content[0].text).toContain('No story found');
			expect(response.result.content[0].text).toContain('NonExistent');
		});
	});
	describe('Tool: get-ui-building-instructions', () => {
		it('should return UI building instructions', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'get-ui-building-instructions',
				arguments: {},
			});

			expect(response.result).toHaveProperty('content');
			expect(response.result.content[0]).toHaveProperty('type', 'text');

			const text = response.result.content[0].text;
			expect(text).toContain('stories');
			expect(text.length).toBeGreaterThan(100);
		});
	});

	describe('Tool: list-all-components', () => {
		it('should list all components from manifest', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'list-all-components',
				arguments: {},
			});

			expect(response.result).toMatchInlineSnapshot(`
				{
				  "content": [
				    {
				      "text": "<components>
				<component>
				<id>example-button</id>
				<name>Button</name>
				<summary>
				A customizable button component for user interactions.
				</summary>
				</component>
				<component>
				<id>header</id>
				<name>Header</name>
				</component>
				<component>
				<id>page</id>
				<name>Page</name>
				</component>
				<component>
				<id>other-ui-card</id>
				<name>Card</name>
				<summary>
				Card component with title, image, content, and action button
				</summary>
				</component>
				</components>",
				      "type": "text",
				    },
				  ],
				}
			`);
		});
	});

	describe('Tool: get-component-documentation', () => {
		it('should return documentation for a specific component', async () => {
			// First, get the list to find a valid component ID
			const listResponse = await mcpRequest('tools/call', {
				name: 'list-all-components',
				arguments: {},
			});

			const listText = listResponse.result.content[0].text;
			const idMatch = listText.match(/<id>([^<]+)<\/id>/);
			expect(idMatch).toBeTruthy();

			const componentId = idMatch![1];

			// Now get documentation for that component
			const response = await mcpRequest('tools/call', {
				name: 'get-component-documentation',
				arguments: {
					componentId,
				},
			});

			expect(response.result).toMatchInlineSnapshot(`
				{
				  "content": [
				    {
				      "text": "<component>
				<id>example-button</id>
				<name>Button</name>
				<description>
				Primary UI component for user interaction
				</description>
				<story>
				<story_name>Primary</story_name>
				<story_code>
				import { Button } from "@my-org/my-component-library";

				const Primary = () => <Button onClick={fn()} primary label="Button"></Button>;
				</story_code>
				</story>
				<story>
				<story_name>Secondary</story_name>
				<story_code>
				import { Button } from "@my-org/my-component-library";

				const Secondary = () => <Button onClick={fn()} label="Button"></Button>;
				</story_code>
				</story>
				<story>
				<story_name>Large</story_name>
				<story_code>
				import { Button } from "@my-org/my-component-library";

				const Large = () => <Button onClick={fn()} size="large" label="Button"></Button>;
				</story_code>
				</story>
				<story>
				<story_name>Small</story_name>
				<story_code>
				import { Button } from "@my-org/my-component-library";

				const Small = () => <Button onClick={fn()} size="small" label="Button"></Button>;
				</story_code>
				</story>
				<props>
				<prop>
				<prop_name>primary</prop_name>
				<prop_description>
				Is this the principal call to action on the page?
				</prop_description>
				<prop_type>boolean</prop_type>
				<prop_required>false</prop_required>
				<prop_default>false</prop_default>
				</prop>
				<prop>
				<prop_name>backgroundColor</prop_name>
				<prop_description>
				What background color to use
				</prop_description>
				<prop_type>string</prop_type>
				<prop_required>false</prop_required>
				</prop>
				<prop>
				<prop_name>size</prop_name>
				<prop_description>
				How large should the button be?
				</prop_description>
				<prop_type>'small' | 'medium' | 'large'</prop_type>
				<prop_required>false</prop_required>
				<prop_default>'medium'</prop_default>
				</prop>
				<prop>
				<prop_name>label</prop_name>
				<prop_description>
				Button contents
				</prop_description>
				<prop_type>string</prop_type>
				<prop_required>true</prop_required>
				</prop>
				<prop>
				<prop_name>onClick</prop_name>
				<prop_description>
				Optional click handler
				</prop_description>
				<prop_type>() => void</prop_type>
				<prop_required>false</prop_required>
				</prop>
				</props>
				</component>",
				      "type": "text",
				    },
				  ],
				}
			`);
		});

		it('should return error for non-existent component', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'get-component-documentation',
				arguments: {
					componentId: 'non-existent-component-id',
				},
			});

			expect(response.result).toMatchInlineSnapshot(`
				{
				  "content": [
				    {
				      "text": "Component not found: "non-existent-component-id". Use the list-all-components tool to see available components.",
				      "type": "text",
				    },
				  ],
				  "isError": true,
				}
			`);
		});
	});

	describe('Toolset Filtering', () => {
		it('should respect X-MCP-Toolsets header for dev tools only', async () => {
			const response = await fetch(MCP_ENDPOINT, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-MCP-Toolsets': 'dev',
				},
				body: JSON.stringify(createMCPRequestBody('tools/list')),
			});

			const text = await response.text();
			const jsonText = text.replace(/^data: /, '').trim();
			const result = JSON.parse(jsonText);

			const toolNames = result.result.tools.map((tool: any) => tool.name);

			expect(toolNames).toMatchInlineSnapshot(`
				[
				  "get-story-urls",
				  "get-ui-building-instructions",
				]
			`);
		});

		it('should respect X-MCP-Toolsets header for docs tools only', async () => {
			const response = await fetch(MCP_ENDPOINT, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-MCP-Toolsets': 'docs',
				},
				body: JSON.stringify(createMCPRequestBody('tools/list')),
			});

			const text = await response.text();
			const jsonText = text.replace(/^data: /, '').trim();
			const result = JSON.parse(jsonText);

			const toolNames = result.result.tools.map((tool: any) => tool.name);

			expect(toolNames).toMatchInlineSnapshot(`
				[
				  "list-all-components",
				  "get-component-documentation",
				]
			`);
		});
	});

	describe('HTTP Methods', () => {
		it('should return HTML when Accept header is text/html', async () => {
			const response = await fetch(MCP_ENDPOINT, {
				method: 'GET',
				headers: {
					Accept: 'text/html',
				},
			});

			expect(response.ok).toBe(true);
			expect(response.headers.get('content-type')).toContain('text/html');

			const html = await response.text();
			expect(html.toLowerCase()).toContain('<!doctype html>');
		});
	});
});
