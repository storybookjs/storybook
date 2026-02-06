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
	// Remove "data: " prefix if present
	const jsonText = text.replace(/^data: /, '').trim();
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

			expect(response.result.tools).toMatchInlineSnapshot(`
				[
				  {
				    "_meta": {
				      "ui": {
				        "resourceUri": "ui://preview-stories/preview.html",
				      },
				    },
				    "description": "Use this tool to preview one or more stories, rendering them as an MCP App using the UI Resource or returning the raw URL for users to visit.",
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
				                "description": "If the story has an explicit name set via the "name" propoerty, that is different from the export name, provide it here.
				Otherwise don't set this.",
				                "type": "string",
				              },
				              "exportName": {
				                "type": "string",
				              },
				              "globals": {
				                "additionalProperties": {},
				                "description": "Optional Storybook globals to set for the story preview. Globals are used for things like theme, locale, viewport, and other cross-cutting concerns.
				Common globals include 'theme' (e.g., 'dark', 'light'), 'locale' (e.g., 'en', 'fr'), and 'backgrounds' (e.g., { value: '#000' }).",
				                "type": "object",
				              },
				              "props": {
				                "additionalProperties": {},
				                "description": "Optional custom props to pass to the story for rendering. Use this when you don't want to render the default story,
				but you want to customize some args or other props.
				You can look up the component's documentation using the get-storybook-story-instructions tool to see what props are available.",
				                "type": "object",
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
				    "name": "preview-stories",
				    "outputSchema": {
				      "$schema": "http://json-schema.org/draft-07/schema#",
				      "properties": {
				        "stories": {
				          "items": {
				            "anyOf": [
				              {
				                "properties": {
				                  "name": {
				                    "type": "string",
				                  },
				                  "previewUrl": {
				                    "type": "string",
				                  },
				                  "title": {
				                    "type": "string",
				                  },
				                },
				                "required": [
				                  "title",
				                  "name",
				                  "previewUrl",
				                ],
				                "type": "object",
				              },
				              {
				                "properties": {
				                  "error": {
				                    "type": "string",
				                  },
				                  "input": {
				                    "properties": {
				                      "absoluteStoryPath": {
				                        "type": "string",
				                      },
				                      "explicitStoryName": {
				                        "description": "If the story has an explicit name set via the "name" propoerty, that is different from the export name, provide it here.
				Otherwise don't set this.",
				                        "type": "string",
				                      },
				                      "exportName": {
				                        "type": "string",
				                      },
				                      "globals": {
				                        "additionalProperties": {},
				                        "description": "Optional Storybook globals to set for the story preview. Globals are used for things like theme, locale, viewport, and other cross-cutting concerns.
				Common globals include 'theme' (e.g., 'dark', 'light'), 'locale' (e.g., 'en', 'fr'), and 'backgrounds' (e.g., { value: '#000' }).",
				                        "type": "object",
				                      },
				                      "props": {
				                        "additionalProperties": {},
				                        "description": "Optional custom props to pass to the story for rendering. Use this when you don't want to render the default story,
				but you want to customize some args or other props.
				You can look up the component's documentation using the get-storybook-story-instructions tool to see what props are available.",
				                        "type": "object",
				                      },
				                    },
				                    "required": [
				                      "exportName",
				                      "absoluteStoryPath",
				                    ],
				                    "type": "object",
				                  },
				                },
				                "required": [
				                  "input",
				                  "error",
				                ],
				                "type": "object",
				              },
				            ],
				          },
				          "type": "array",
				        },
				      },
				      "required": [
				        "stories",
				      ],
				      "type": "object",
				    },
				    "title": "Preview stories",
				  },
				  {
				    "description": "Get comprehensive instructions for writing and updating Storybook stories (.stories.tsx, .stories.ts, .stories.jsx, .stories.js, .stories.svelte, .stories.vue files).

				CRITICAL: You MUST call this tool before:
				- Creating new Storybook stories or story files
				- Updating or modifying existing Storybook stories
				- Adding new story variants or exports to story files
				- Editing any file matching *.stories.* patterns
				- Writing components that will need stories

				This tool provides essential Storybook-specific guidance including:
				- How to structure stories correctly for Storybook 9
				- Required imports (Meta, StoryObj from framework package)
				- Test utility imports (from 'storybook/test')
				- Story naming conventions and best practices
				- Play function patterns for interactive testing
				- Mocking strategies for external dependencies
				- Story variants and coverage requirements

				Even if you're familiar with Storybook, call this tool to ensure you're following the correct patterns, import paths, and conventions for this specific Storybook setup.",
				    "inputSchema": {
				      "properties": {},
				      "type": "object",
				    },
				    "name": "get-storybook-story-instructions",
				    "title": "Storybook Story Development Instructions",
				  },
				  {
				    "description": "Run tests for one or more stories.",
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
				    "name": "run-story-tests",
				    "title": "Storybook Tests",
				  },
				  {
				    "description": "List all available UI components and documentation entries from the Storybook",
				    "inputSchema": {
				      "properties": {},
				      "type": "object",
				    },
				    "name": "list-all-documentation",
				    "title": "List All Documentation",
				  },
				  {
				    "description": "Get documentation for a UI component or docs entry.

				Returns the first 3 stories with code snippets showing how props are used, plus TypeScript prop definitions. Call this before using a component to avoid hallucinating prop names, types, or valid combinations. Stories reveal real prop usage patterns, interactions, and edge cases that type definitions alone don't show. If the example stories don't show the prop you need, use the get-documentation-for-story tool to fetch the story documentation for the specific story variant you need.

				Example: id="button" returns Primary, Secondary, Large stories with code like <Button variant="primary" size="large"> showing actual prop combinations.",
				    "inputSchema": {
				      "$schema": "http://json-schema.org/draft-07/schema#",
				      "properties": {
				        "id": {
				          "type": "string",
				        },
				      },
				      "required": [
				        "id",
				      ],
				      "type": "object",
				    },
				    "name": "get-documentation",
				    "title": "Get Documentation",
				  },
				]
			`);
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

				const Primary = () => <Button onClick={fn()} primary label="Button" />;
				\`\`\`

				### Secondary

				\`\`\`
				import { Button } from "@my-org/my-component-library";

				const Secondary = () => <Button onClick={fn()} label="Button" />;
				\`\`\`

				### Large

				\`\`\`
				import { Button } from "@my-org/my-component-library";

				const Large = () => <Button onClick={fn()} size="large" label="Button" />;
				\`\`\`

				### Other Stories

				- Small

				### With A11y Violation

				\`\`\`
				import { Button } from "@my-org/my-component-library";

				const WithA11yViolation = () => <Button onClick={fn()} primary label="Button" backgroundColor="#ccc" />;
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

			expect(response.result).toMatchInlineSnapshot(`
				{
				  "content": [
				    {
				      "text": "## Passing Stories

				- example-button--with-a-11-y-violation

				## Accessibility Violations

				### example-button--with-a-11-y-violation - color-contrast

				Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds

				#### Affected Elements
				- **Impact**: serious
				  **Message**: Fix any of the following:
				  Element has insufficient color contrast of 1.6 (foreground color: #ffffff, background color: #cccccc, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1
				  **Element**: <button type="button" class="storybook-button storybook-button--medium storybook-button--primary" style="background-color: rgb(204, 204, 204);">Button</button>
				  **Inspect**: http://localhost:6006/?path=/story/example-button--with-a-11-y-violation&addonPanel=storybook/a11y/panel&a11ySelection=violations.color-contrast.1",
				      "type": "text",
				    },
				  ],
				}
			`);
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

			expect(response.result).toMatchInlineSnapshot(`
				{
				  "content": [
				    {
				      "text": "## Passing Stories

				- example-button--primary
				- example-button--secondary
				- example-button--large
				- example-button--small
				- example-button--with-a-11-y-violation

				## Accessibility Violations

				### example-button--primary - color-contrast

				Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds

				#### Affected Elements
				- **Impact**: serious
				  **Message**: Fix any of the following:
				  Element has insufficient color contrast of 2.62 (foreground color: #ffffff, background color: #1ea7fd, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1
				  **Element**: <button type="button" class="storybook-button storybook-button--medium storybook-button--primary">Button</button>
				  **Inspect**: http://localhost:6006/?path=/story/example-button--primary&addonPanel=storybook/a11y/panel&a11ySelection=violations.color-contrast.1

				### example-button--with-a-11-y-violation - color-contrast

				Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds

				#### Affected Elements
				- **Impact**: serious
				  **Message**: Fix any of the following:
				  Element has insufficient color contrast of 1.6 (foreground color: #ffffff, background color: #cccccc, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1
				  **Element**: <button type="button" class="storybook-button storybook-button--medium storybook-button--primary" style="background-color: rgb(204, 204, 204);">Button</button>
				  **Inspect**: http://localhost:6006/?path=/story/example-button--with-a-11-y-violation&addonPanel=storybook/a11y/panel&a11ySelection=violations.color-contrast.1",
				      "type": "text",
				    },
				  ],
				}
			`);
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

			expect(response.result).toMatchInlineSnapshot(`
				{
				  "content": [
				    {
				      "text": "No stories found matching the provided input.

				No story found for export name "NonExistent" with absolute file path "/Users/jeppe/dev/work/storybook/mcp/apps/internal-storybook/stories/components/NonExistent.stories.ts" (did you forget to pass the explicit story name?)",
				      "type": "text",
				    },
				  ],
				}
			`);
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
			const jsonText = text.replace(/^data: /, '').trim();
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
			const jsonText = text.replace(/^data: /, '').trim();
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
