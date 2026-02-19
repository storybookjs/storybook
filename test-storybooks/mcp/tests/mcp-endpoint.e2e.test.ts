import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { x } from 'tinyexec';

const STORYBOOK_DIR = new URL('..', import.meta.url).pathname;
const MCP_ENDPOINT = 'http://localhost:6006/mcp';
const STARTUP_TIMEOUT = 15_000;

let storybookProcess: ReturnType<typeof x> | null = null;

/**
 * Helper to create MCP protocol requests
 */
function createMCPRequestBody(method: string, params: any = {}, id: number = 1) {
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
	// Extract the JSON from the "data: " line in the SSE response
	const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
	const jsonText = dataLine!.replace(/^data: /, '').trim();
	return JSON.parse(jsonText);
}

/**
 * Wait for MCP endpoint to be ready by polling it directly
 */
async function waitForMcpEndpoint(maxAttempts = 90, interval = 500): Promise<void> {
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
		} catch {
			// Server not ready yet
		}

		if (attempts >= maxAttempts) {
			clearInterval(intervalId);
			reject(new Error('MCP endpoint failed to start within the timeout period'));
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
			// Dev, docs, and test tools should be present
			expect(response.result.tools).toHaveLength(5);

			const toolNames = response.result.tools.map((tool: any) => tool.name);
			expect(toolNames).toEqual([
				'preview-stories',
				'get-storybook-story-instructions',
				'run-story-tests',
				'list-all-documentation',
				'get-documentation',
			]);

			const storyInstructionsTool = response.result.tools.find(
				(tool: any) => tool.name === 'get-storybook-story-instructions',
			);
			expect(storyInstructionsTool.description).toContain(
				'Get comprehensive instructions for writing, testing, and fixing Storybook stories',
			);
			expect(storyInstructionsTool.description).toContain(
				'Handling accessibility (a11y) violations in stories',
			);

			const runStoryTestsTool = response.result.tools.find(
				(tool: any) => tool.name === 'run-story-tests',
			);
			expect(runStoryTestsTool.description).toContain('Run story tests.');
			expect(runStoryTestsTool.inputSchema.properties).toHaveProperty('a11y');
			expect(runStoryTestsTool.inputSchema.properties).toHaveProperty('stories');
		});
	});

	describe('Tool: preview-stories', () => {
		it('should return story URLs for valid stories', async () => {
			const cwd = process.cwd();
			const storyPath = cwd.endsWith('/apps/internal-storybook')
				? `${cwd}/stories/components/Button.stories.ts`
				: `${cwd}/apps/internal-storybook/stories/components/Button.stories.ts`;

			const response = await mcpRequest('tools/call', {
				name: 'preview-stories',
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
				  "structuredContent": {
				    "stories": [
				      {
				        "name": "Primary",
				        "previewUrl": "http://localhost:6006/?path=/story/example-button--primary",
				        "title": "Example/Button",
				      },
				    ],
				  },
				}
			`);
		});

		it('should return error message for non-existent story', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'preview-stories',
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

	describe('Tool: list-all-documentation', () => {
		it('should list all documentation from manifest', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'list-all-documentation',
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
				- Card (other-ui-card): Card component with title, image, content, and action button

				# Docs

				- getting-started (getting-started--docs): # Getting Started This is the getting started documentation of this design system. ## Usag...",
				      "type": "text",
				    },
				  ],
				}
			`);
		});
	});

	describe('Tool: get-documentation', () => {
		it('should return documentation for a specific component', async () => {
			// First, get the list to find a valid component ID
			const listResponse = await mcpRequest('tools/call', {
				name: 'list-all-documentation',
				arguments: {},
			});

			const listText = listResponse.result.content[0].text;
			// Match markdown format: - ComponentName (component-id)
			const idMatch = listText.match(/- \w+ \(([^)]+)\)/);
			expect(idMatch).toBeTruthy();
			const componentId = idMatch![1];

			// Now get documentation for that component
			const response = await mcpRequest('tools/call', {
				name: 'get-documentation',
				arguments: {
					id: componentId,
				},
			});

			const text = response.result.content[0].text;
			expect(text).toContain('# Button');
			expect(text).toContain('## Stories');
			expect(text).toContain('### Primary');
			expect(text).toContain('### Secondary');
			expect(text).toContain('## Props');
			expect(text).toContain('export type Props =');
			expect(text).toContain('With A 11 Y Violation');
		});

		it('should return error for non-existent component', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'get-documentation',
				arguments: {
					id: 'non-existent-component-id',
				},
			});

			expect(response.result).toMatchInlineSnapshot(`
				{
				  "content": [
				    {
				      "text": "Component or Docs Entry not found: "non-existent-component-id". Use the list-all-documentation tool to see available components and documentation entries.",
				      "type": "text",
				    },
				  ],
				  "isError": true,
				}
			`);
		});
	});

	describe('Tool: run-story-tests', () => {
		it('should run all tests when stories are omitted', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {},
			});

			const text = response.result.content[0].text;
			expect(text).toContain('## Passing Stories');
			expect(text).toContain('example-button--primary');
			expect(text).toContain('page--logged-out');
		});

		it('should run tests for a story and report accessibility violations', async () => {
			const cwd = process.cwd();
			const storyPath = cwd.endsWith('/apps/internal-storybook')
				? `${cwd}/stories/components/Button.stories.ts`
				: `${cwd}/apps/internal-storybook/stories/components/Button.stories.ts`;

			const response = await mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {
					stories: [
						{
							exportName: 'WithA11yViolation',
							absoluteStoryPath: storyPath,
						},
					],
				},
			});

			const text = response.result.content[0].text;
			expect(text).toContain('## Passing Stories');
			expect(text).toContain('example-button--with-a-11-y-violation');
			expect(text).toContain('## Accessibility Violations');
			expect(text).toContain('example-button--with-a-11-y-violation - color-contrast');
			expect(text).toContain('Expected contrast ratio of 4.5:1');
		});

		it('should run tests for multiple stories', async () => {
			const cwd = process.cwd();
			const storyPath = cwd.endsWith('/apps/internal-storybook')
				? `${cwd}/stories/components/Button.stories.ts`
				: `${cwd}/apps/internal-storybook/stories/components/Button.stories.ts`;

			const response = await mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {
					stories: [
						{
							exportName: 'Primary',
							absoluteStoryPath: storyPath,
						},
						{
							exportName: 'Secondary',
							absoluteStoryPath: storyPath,
						},
					],
				},
			});

			const text = response.result.content[0].text;
			expect(text).toContain('## Passing Stories');
			expect(text).toContain('example-button--primary');
			expect(text).toContain('example-button--secondary');
			expect(text).toContain('## Accessibility Violations');
			expect(text).toContain('example-button--primary - color-contrast');
		});

		it('should return error for non-existent story', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {
					stories: [
						{
							exportName: 'NonExistent',
							absoluteStoryPath: `${process.cwd()}/stories/components/NonExistent.stories.ts`,
						},
					],
				},
			});

			const text = response.result.content[0].text;
			expect(text).toContain('No stories found matching the provided input.');
			expect(text).toContain('No story found for export name "NonExistent"');
		});

		it('should sequentialize 4 concurrent calls to run-story-tests', async () => {
			const cwd = process.cwd();
			const storyPath = cwd.endsWith('/apps/internal-storybook')
				? `${cwd}/stories/components/Button.stories.ts`
				: `${cwd}/apps/internal-storybook/stories/components/Button.stories.ts`;

			// Make 4 concurrent calls with different story exports
			const promise1 = mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {
					stories: [{ exportName: 'Primary', absoluteStoryPath: storyPath }],
				},
			});

			const promise2 = mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {
					stories: [{ exportName: 'Secondary', absoluteStoryPath: storyPath }],
				},
			});

			const promise3 = mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {
					stories: [{ exportName: 'Large', absoluteStoryPath: storyPath }],
				},
			});

			const promise4 = mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {
					stories: [{ exportName: 'Small', absoluteStoryPath: storyPath }],
				},
			});

			// All calls should complete successfully
			const [result1, result2, result3, result4] = await Promise.all([
				promise1,
				promise2,
				promise3,
				promise4,
			]);

			// Verify call 1 completed with Primary story
			expect(result1.result).toBeDefined();
			expect(result1.result.content).toBeDefined();
			expect(result1.result.content.length).toBeGreaterThan(0);
			expect(result1.result.content[0].text).toContain('example-button--primary');
			expect(result1.result.content[0].text).toContain('Passing Stories');

			// Verify call 2 completed with Secondary story
			expect(result2.result).toBeDefined();
			expect(result2.result.content).toBeDefined();
			expect(result2.result.content.length).toBeGreaterThan(0);
			expect(result2.result.content[0].text).toContain('example-button--secondary');
			expect(result2.result.content[0].text).toContain('Passing Stories');

			// Verify call 3 completed with Large story
			expect(result3.result).toBeDefined();
			expect(result3.result.content).toBeDefined();
			expect(result3.result.content.length).toBeGreaterThan(0);
			expect(result3.result.content[0].text).toContain('example-button--large');
			expect(result3.result.content[0].text).toContain('Passing Stories');

			// Verify call 4 completed with Small story
			expect(result4.result).toBeDefined();
			expect(result4.result.content).toBeDefined();
			expect(result4.result.content.length).toBeGreaterThan(0);
			expect(result4.result.content[0].text).toContain('example-button--small');
			expect(result4.result.content[0].text).toContain('Passing Stories');
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
			const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
			const jsonText = dataLine!.replace(/^data: /, '').trim();
			const result = JSON.parse(jsonText);

			const toolNames = result.result.tools.map((tool: any) => tool.name);

			expect(toolNames).toMatchInlineSnapshot(`
				[
				  "preview-stories",
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
			const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
			const jsonText = dataLine!.replace(/^data: /, '').trim();
			const result = JSON.parse(jsonText);

			const toolNames = result.result.tools.map((tool: any) => tool.name);

			expect(toolNames).toMatchInlineSnapshot(`
				[
				  "list-all-documentation",
				  "get-documentation",
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
