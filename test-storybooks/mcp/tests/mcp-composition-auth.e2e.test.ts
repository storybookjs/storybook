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

const PORT = 6008;
const MCP_ENDPOINT = `http://localhost:${PORT}/mcp`;
const WELL_KNOWN_ENDPOINT = `http://localhost:${PORT}/.well-known/oauth-protected-resource`;
const STARTUP_TIMEOUT = 30_000;

let storybookProcess: ReturnType<typeof x> | null = null;

async function mcpRequest(method: string, params: any = {}, token?: string) {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	return fetch(MCP_ENDPOINT, {
		method: 'POST',
		headers,
		body: JSON.stringify(createMCPRequestBody(method, params)),
	});
}

describe('MCP Composition Auth E2E Tests', () => {
	beforeAll(async () => {
		await killPort(PORT);
		storybookProcess = startStorybook('.storybook-composition-auth', PORT);
		await waitForMcpEndpoint(MCP_ENDPOINT, { acceptStatuses: [401] });
	}, STARTUP_TIMEOUT);

	afterAll(async () => {
		await stopStorybook(storybookProcess);
		storybookProcess = null;
	});

	describe('OAuth Discovery', () => {
		it('should expose .well-known/oauth-protected-resource for private refs', async () => {
			const response = await fetch(WELL_KNOWN_ENDPOINT);
			expect(response.status).toBe(200);

			const metadata = await response.json();
			expect(metadata).toMatchInlineSnapshot(`
				{
				  "authorization_servers": [
				    "https://www.chromatic.com",
				  ],
				  "resource": "http://localhost:6008/mcp",
				  "scopes_supported": [
				    "storybook:read",
				    "project:read",
				  ],
				}
			`);
		});

		it('should point resource to the local MCP endpoint', async () => {
			const response = await fetch(WELL_KNOWN_ENDPOINT);
			const metadata = await response.json();

			expect(metadata.resource).toBe(`http://localhost:${PORT}/mcp`);
		});
	});

	describe('Auth Gate', () => {
		it('should return 401 without Bearer token', async () => {
			const response = await mcpRequest('tools/list');

			expect(response.status).toBe(401);
		});

		it('should include WWW-Authenticate header in 401 response', async () => {
			const response = await mcpRequest('tools/list');

			expect(response.status).toBe(401);
			expect(response.headers.get('www-authenticate')).toMatchInlineSnapshot(
				`"Bearer error="unauthorized", error_description="Authorization needed for composed Storybooks", resource_metadata="http://localhost:6008/.well-known/oauth-protected-resource""`,
			);
		});

		it('should reject requests without valid token', async () => {
			const response = await mcpRequest('tools/list', {}, 'invalid-token');

			// With an invalid token, the server accepts the request (token is present)
			// but the remote source will fail to fetch
			expect(response.status).toBe(200);
		});
	});

	describe('Multi-Source with Auth', () => {
		it('should list tools with storybookId parameter when authenticated', async () => {
			// Use a dummy token — the local source should still work
			const response = await mcpRequest('tools/list', {}, 'dummy-token');
			const data = await parseMCPResponse(response);

			const getDocTool = data.result.tools.find((t: any) => t.name === 'get-documentation');

			expect(getDocTool).toBeDefined();
			expect(getDocTool.inputSchema.properties).toHaveProperty('storybookId');
		});

		it('should return 401 with WWW-Authenticate for list-all-documentation with invalid token', async () => {
			const response = await mcpRequest(
				'tools/call',
				{ name: 'list-all-documentation', arguments: {} },
				'dummy-token',
			);

			// The remote source manifest fetch fails with 401,
			// which propagates as an HTTP 401 to trigger re-authentication
			expect(response.status).toBe(401);
			expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
		});

		it('should fetch local component documentation with storybookId', async () => {
			const response = await mcpRequest(
				'tools/call',
				{
					name: 'get-documentation',
					arguments: { id: 'example-button', storybookId: 'local' },
				},
				'dummy-token',
			);
			const data = await parseMCPResponse(response);

			expect(data.result).toMatchInlineSnapshot(`
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

		it('should return 401 with WWW-Authenticate when fetching remote source with invalid token', async () => {
			const response = await mcpRequest(
				'tools/call',
				{
					name: 'get-documentation',
					arguments: { id: 'button', storybookId: 'test-private-sb' },
				},
				'dummy-token',
			);

			// The manifest fetch to the remote Storybook fails with 401,
			// which propagates as an HTTP 401 to trigger re-authentication
			expect(response.status).toBe(401);
			expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
		});

		it('should require storybookId in multi-source auth mode', async () => {
			const response = await mcpRequest(
				'tools/call',
				{
					name: 'get-documentation',
					arguments: { id: 'example-button' },
				},
				'dummy-token',
			);
			const data = await parseMCPResponse(response);

			expect(data.result).toMatchInlineSnapshot(`
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
});
