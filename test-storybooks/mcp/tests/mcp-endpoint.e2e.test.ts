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
				    "name": "get-storybook-story-instructions",
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
	describe('Tool: get-storybook-story-instructions', () => {
		it('should return UI building instructions', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'get-storybook-story-instructions',
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
				      "text": "# Components

				- Button (example-button): A customizable button component for user interactions.
				- Header (header)
				- Page (page)
				- Card (other-ui-card): Card component with title, image, content, and action button",
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
			// Match markdown format: - ComponentName (component-id)
			const idMatch = listText.match(/- \w+ \(([^)]+)\)/);
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
				      "text": "# Button

				ID: example-button

				Primary UI component for user interaction

				## Stories

				### Primary

				\`\`\`
				import { Button } from "@my-org/my-component-library";

				const Primary = () => <Button onClick={fn()} primary label="Button"></Button>;
				\`\`\`

				### Secondary

				\`\`\`
				import { Button } from "@my-org/my-component-library";

				const Secondary = () => <Button onClick={fn()} label="Button"></Button>;
				\`\`\`

				### Large

				\`\`\`
				import { Button } from "@my-org/my-component-library";

				const Large = () => <Button onClick={fn()} size="large" label="Button"></Button>;
				\`\`\`

				### Small

				\`\`\`
				import { Button } from "@my-org/my-component-library";

				const Small = () => <Button onClick={fn()} size="small" label="Button"></Button>;
				\`\`\`

				## Props

				\`\`\`
				export type Props = {
				  /**
				    Is this the principal call to action on the page?
				  */
				  primary?: boolean = false;
				  /**
				    What background color to use
				  */
				  backgroundColor?: string;
				  /**
				    How large should the button be?
				  */
				  size?: 'small' | 'medium' | 'large' = 'medium';
				  /**
				    Button contents
				  */
				  label: string;
				  /**
				    Optional click handler
				  */
				  onClick?: () => void;
				}
				\`\`\`",
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
				  "get-storybook-story-instructions",
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
