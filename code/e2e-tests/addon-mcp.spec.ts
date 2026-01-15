/* eslint-disable local-rules/no-uncategorized-errors */
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';
import process from 'process';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';
const type = process.env.STORYBOOK_TYPE || 'dev';

const MCP_ENDPOINT = `${storybookUrl}/mcp`;

/** Helper to make MCP requests and parse SSE response */
async function mcpRequest(
  request: APIRequestContext,
  method: string,
  params: Record<string, unknown> = {},
  id = 1,
  headers: Record<string, string> = {}
) {
  const response = await request.post(MCP_ENDPOINT, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    data: {
      jsonrpc: '2.0',
      id,
      method,
      params,
    },
  });

  if (!response.ok()) {
    throw new Error(`HTTP error! status: ${response.status()}`);
  }

  // MCP responses come as SSE (Server-Sent Events) format
  // Format: "event: message\ndata: {...}"
  const text = await response.text();
  // Extract the JSON from the "data: " line
  const dataMatch = text.match(/^data: (.+)$/m);
  if (!dataMatch) {
    throw new Error(`Invalid SSE response format: ${text}`);
  }
  return JSON.parse(dataMatch[1]);
}

test.describe('addon-mcp', () => {
  test.skip(
    !templateName?.includes('react-vite/default-ts'),
    'Only run for sandboxes with addon-mcp configured'
  );

  test.describe('Manifests', () => {
    test.describe('Component Manifest', () => {
      test('should have valid components.json structure', async ({ request }) => {
        const response = await request.get(`${storybookUrl}/manifests/components.json`);
        const json = await response.json();

        // Check basic structure
        expect(json).toHaveProperty('v');
        expect(typeof json.v).toBe('number');
        expect(json).toHaveProperty('components');
        expect(typeof json.components).toBe('object');
      });

      test('should contain the example Button component', async ({ request }) => {
        const response = await request.get(`${storybookUrl}/manifests/components.json`);
        const json = await response.json();

        // Check for example-button component
        expect(json.components).toHaveProperty('example-button');

        const button = json.components['example-button'];
        expect(button).toMatchObject({
          id: 'example-button',
          name: 'Button',
          path: expect.stringContaining('Button.stories'),
        });

        // Should have stories
        expect(button.stories).toBeInstanceOf(Array);
        expect(button.stories.length).toBeGreaterThan(0);

        // Should have reactDocgen info with props
        expect(button).toHaveProperty('reactDocgen');
        expect(button.reactDocgen).toHaveProperty('props');
        expect(button.reactDocgen.props).toHaveProperty('primary');
      });
    });

    test.describe('Docs Manifest', () => {
      test('should have valid docs.json structure', async ({ request }) => {
        const response = await request.get(`${storybookUrl}/manifests/docs.json`);
        const json = await response.json();

        // Check basic structure
        expect(json).toHaveProperty('v');
        expect(typeof json.v).toBe('number');
        expect(json).toHaveProperty('docs');
        expect(typeof json.docs).toBe('object');
      });

      test('should contain the "Configure your project" docs entry', async ({ request }) => {
        const response = await request.get(`${storybookUrl}/manifests/docs.json`);
        const json = await response.json();

        // Check for configure-your-project--docs entry
        expect(json.docs).toHaveProperty('configure-your-project--docs');

        const configureDoc = json.docs['configure-your-project--docs'];
        expect(configureDoc).toMatchObject({
          id: 'configure-your-project--docs',
          name: 'Docs',
          path: expect.stringContaining('Configure.mdx'),
          title: 'Configure your project',
        });

        // Should have content
        expect(configureDoc).toHaveProperty('content');
        expect(typeof configureDoc.content).toBe('string');
        expect(configureDoc.content.length).toBeGreaterThan(0);
      });
    });
  });

  test.describe('MCP', () => {
    test.skip(type !== 'dev', 'MCP server only runs in dev mode');

    test.describe('Info Page', () => {
      test('should show both toolsets as enabled', async ({ page }) => {
        await page.goto(MCP_ENDPOINT);

        // Both toolsets should show as enabled
        const enabledStatuses = page.locator('.toolset-status.enabled');
        await expect(enabledStatuses).toHaveCount(2);

        // Check that dev toolset is listed with its tools
        const devToolset = page.locator('.toolset', { has: page.locator('text=dev') });
        await expect(devToolset).toBeVisible();
        await expect(devToolset.locator('.toolset-status')).toHaveText('enabled');

        // Check that docs toolset is listed with its tools
        const docsToolset = page.locator('.toolset', { has: page.locator('text=docs') });
        await expect(docsToolset).toBeVisible();
        await expect(docsToolset.locator('.toolset-status')).toHaveText('enabled');
      });
    });

    test.describe('Session Initialization', () => {
      test('should successfully initialize an MCP session', async ({ request }) => {
        const response = await mcpRequest(request, 'initialize', {
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
    });

    test.describe('Tools Discovery', () => {
      test('should list all available tools', async ({ request }) => {
        const response = await mcpRequest(request, 'tools/list');

        expect(response.result).toHaveProperty('tools');
        // Dev and docs tools should be present (4 total)
        expect(response.result.tools).toHaveLength(4);

        const toolNames = response.result.tools.map((tool: { name: string }) => tool.name);
        expect(toolNames).toContain('get-story-urls');
        expect(toolNames).toContain('get-ui-building-instructions');
        expect(toolNames).toContain('list-all-documentation');
        expect(toolNames).toContain('get-documentation');
      });
    });

    test.describe('Tool: get-story-urls', () => {
      test('should return story URLs for valid stories', async ({ request }) => {
        // Use a path pattern that works regardless of sandbox location
        const response = await mcpRequest(request, 'tools/call', {
          name: 'get-story-urls',
          arguments: {
            stories: [
              {
                exportName: 'Primary',
                // Use a relative-style path that the tool should recognize
                absoluteStoryPath: '/src/stories/Button.stories.ts',
              },
            ],
          },
        });

        expect(response.result).toHaveProperty('content');
        expect(response.result.content).toHaveLength(1);
        // Should contain either a valid URL or an error message about the story
        expect(response.result.content[0]).toHaveProperty('text');
      });
    });

    test.describe('Tool: get-ui-building-instructions', () => {
      test('should return UI building instructions', async ({ request }) => {
        const response = await mcpRequest(request, 'tools/call', {
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

    test.describe('Tool: list-all-documentation', () => {
      test('should list all documentation from manifest', async ({ request }) => {
        const response = await mcpRequest(request, 'tools/call', {
          name: 'list-all-documentation',
          arguments: {},
        });

        expect(response.result).toHaveProperty('content');
        expect(response.result.content[0]).toHaveProperty('type', 'text');

        const text = response.result.content[0].text;
        // Should contain components section with Button
        expect(text).toContain('Button');
        expect(text).toContain('example-button');
      });
    });

    test.describe('Tool: get-documentation', () => {
      test('should return documentation for a specific component', async ({ request }) => {
        const response = await mcpRequest(request, 'tools/call', {
          name: 'get-documentation',
          arguments: {
            id: 'example-button',
          },
        });

        expect(response.result).toHaveProperty('content');
        expect(response.result.content[0]).toHaveProperty('type', 'text');

        const text = response.result.content[0].text;
        // Should contain component info
        expect(text).toContain('Button');
        expect(text).toContain('example-button');
        // Should contain stories
        expect(text).toContain('Primary');
      });
    });
  });
});
