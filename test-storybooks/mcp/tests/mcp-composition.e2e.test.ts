import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { x } from 'tinyexec';
import {
	createMCPRequestBody,
	parseMCPResponse,
	waitForMcpEndpoint,
	killPort,
	startStorybook,
	stopStorybook,
} from './helpers';

const PORT = 6007;
const MCP_ENDPOINT = `http://localhost:${PORT}/mcp`;
const STARTUP_TIMEOUT = 30_000;

let storybookProcess: ReturnType<typeof x> | null = null;

async function mcpRequest(method: string, params: any = {}) {
	const response = await fetch(MCP_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(createMCPRequestBody(method, params)),
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	return parseMCPResponse(response);
}

describe('MCP Composition E2E Tests', () => {
	beforeAll(async () => {
		await killPort(PORT);
		storybookProcess = startStorybook('.storybook-composition', PORT);
		await waitForMcpEndpoint(MCP_ENDPOINT);
	}, STARTUP_TIMEOUT);

	afterAll(async () => {
		await stopStorybook(storybookProcess);
		storybookProcess = null;
	});

	describe('Multi-Source Documentation', () => {
		it('should list documentation from both local and remote sources', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'list-all-documentation',
				arguments: {},
			});

			const text = response.result.content[0].text;

			// Should contain Local source
			expect(text).toContain('# Local');
			expect(text).toContain('id: local');

			// Should contain remote Storybook UI source
			expect(text).toContain('# Storybook UI');
			expect(text).toContain('id: storybook-ui');

			// Local components should be present
			expect(text).toContain('Button (example-button)');

			// Remote components should be present (from storybook-ui)
			expect(text).toContain('## Components');
		});

		it('should fetch documentation for a local component', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'get-documentation',
				arguments: {
					id: 'example-button',
					storybookId: 'local',
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

				Story ID: example-button--primary

				\`\`\`
				import { Button } from "@my-org/my-component-library";

				const Primary = () => <Button onClick={fn()} primary label="Button" />;
				\`\`\`

				### Secondary

				Story ID: example-button--secondary

				\`\`\`
				import { Button } from "@my-org/my-component-library";

				const Secondary = () => <Button onClick={fn()} label="Button" />;
				\`\`\`

				### Large

				Story ID: example-button--large

				\`\`\`
				import { Button } from "@my-org/my-component-library";

				const Large = () => <Button onClick={fn()} size="large" label="Button" />;
				\`\`\`

				### Other Stories

				- Small (example-button--small)
				- With A 11 Y Violation (example-button--with-a-11-y-violation)

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
				\`\`\`

				## Docs

				### Additional Information

				import { Meta, Canvas } from '@storybook/addon-docs/blocks';
				import * as ButtonStories from './Button.stories';

				<Meta of={ButtonStories} name="Additional Information" />

				It is critical when using the Button component, that the string passed to the \`label\` prop uses the 🍌-emoji instead of spaces.

				Here is the button:

				<Canvas of={ButtonStories.Primary} />",
				      "type": "text",
				    },
				  ],
				}
			`);
		});

		it('should fetch documentation for a component from remote source', async () => {
			// Get documentation for a component that exists in the remote Storybook UI
			const response = await mcpRequest('tools/call', {
				name: 'get-documentation',
				arguments: {
					id: 'example-button',
					storybookId: 'storybook-ui',
				},
			});

			expect(response.result).toHaveProperty('content');
			expect(response.result.content[0].type).toBe('text');

			const text = response.result.content[0].text;
			// Should contain component documentation from remote source
			expect(text).toContain('Button');
			expect(text).toContain('example-button');
		});

		it('should silently exclude refs that have no manifest', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'list-all-documentation',
				arguments: {},
			});

			const text = response.result.content[0].text;

			// The no-manifest ref should be silently excluded — no error, no mention
			expect(text).not.toContain('No Manifest');
			expect(text).not.toContain('no-manifest');
		});

		it('should require storybookId in multi-source mode', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'get-documentation',
				arguments: {
					id: 'example-button',
				},
			});

			expect(response.result).toMatchInlineSnapshot(`
				{
				  "content": [
				    {
				      "text": "Invalid arguments for tool get-documentation: [{"kind":"schema","type":"object","expected":"\\"storybookId\\"","received":"undefined","message":"Invalid key: Expected \\"storybookId\\" but received undefined","path":[{"type":"object","origin":"key","input":{"id":"example-button"},"key":"storybookId"}]}]",
				      "type": "text",
				    },
				  ],
				  "isError": true,
				}
			`);
		});
	});

	describe('Public Refs (No Auth)', () => {
		it('should not require authentication for public refs', async () => {
			// The .well-known endpoint should return "Not found" for public refs
			const response = await fetch(`http://localhost:${PORT}/.well-known/oauth-protected-resource`);
			const text = await response.text();

			// Public refs should not expose OAuth metadata
			expect(text).toBe('Not found');
		});
	});

	describe('Tools Schema', () => {
		it('should include storybookId parameter in get-documentation schema', async () => {
			const response = await mcpRequest('tools/list');

			const getDocTool = response.result.tools.find((t: any) => t.name === 'get-documentation');

			expect(getDocTool).toBeDefined();
			expect(getDocTool.inputSchema.properties).toHaveProperty('storybookId');
			expect(getDocTool.inputSchema.properties.storybookId).toMatchObject({
				type: 'string',
				description: expect.stringContaining('source'),
			});
		});
	});
});
