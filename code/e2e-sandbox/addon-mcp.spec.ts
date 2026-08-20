import { spawn } from 'node:child_process';
import path from 'node:path';

import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';
import process from 'process';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';
const type = process.env.STORYBOOK_TYPE || 'dev';
const sandboxDir = process.env.STORYBOOK_SANDBOX_DIR!;

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

/**
 * Drives `@storybook/mcp` over stdio against a served static build.
 *
 * This is the hosted path, and a different package from the dev server's `@storybook/addon-mcp`:
 * it reads `manifests/components.json` over HTTP and follows the `$ref`s into `services/`. Pointing
 * it at a URL rather than a directory is deliberate — that is the branch a deployed Storybook takes.
 */
async function hostedMcpCalls(manifestsUrl: string, toolCalls: { name: string; id: string }[]) {
  // Playwright transpiles this spec to CJS, so `__dirname` is the portable way to reach the package.
  const binPath = path.resolve(__dirname, '../lib/mcp/bin.ts');
  const child = spawn('node', [binPath, '--manifestsDir', manifestsUrl], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  type Reply = { id: number; result: { content: { text: string }[] } };
  const responses = new Map<number, Reply>();
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
    const lines = stdout.split('\n');
    stdout = lines.pop() ?? '';
    for (const line of lines) {
      try {
        const message = JSON.parse(line);
        if (message.id !== undefined) {
          responses.set(message.id, message);
        }
      } catch {
        // The server also writes non-JSON diagnostics; only replies matter here.
      }
    }
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const send = (message: unknown) => child.stdin.write(`${JSON.stringify(message)}\n`);
  const awaitReply = async (id: number) => {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const reply = responses.get(id);
      if (reply) {
        return reply;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Timed out waiting for reply ${id}. stderr:\n${stderr}`);
  };

  try {
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'e2e-test-client', version: '1.0.0' },
      },
    });
    await awaitReply(1);
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });

    const texts: string[] = [];
    for (const [index, call] of toolCalls.entries()) {
      const id = index + 2;
      send({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: call.name, arguments: call.id ? { id: call.id } : {} },
      });
      texts.push((await awaitReply(id)).result.content[0].text);
    }
    return texts;
  } finally {
    child.kill();
  }
}

// Derived from the story file's path under the linked framework template stories.
const COLOR_PICKER_ID = 'stories-frameworks-angular-vite-model-signal-color-picker';
// Derived from the story file's path under the linked renderer template stories.
const DEFINE_MODEL_ID = 'stories-renderers-vue3-vue3-vite-default-ts-component-meta-definemodel';

const isReactSandbox = templateName === 'react-vite/default-ts';
const isAngularSandbox = templateName === 'angular-vite/docgen-server-ts';
const isVueSandbox = templateName === 'vue3-vite/docgen-server-ts';

test.describe('addon-mcp', () => {
  test.skip(
    !isReactSandbox && !isAngularSandbox && !isVueSandbox,
    'Only run for sandboxes with addon-mcp configured'
  );

  test.describe('Manifests', () => {
    test.skip(!isReactSandbox, 'Asserts on the React sandbox fixtures');

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
    test.skip(!isReactSandbox, 'Asserts on the React sandbox fixtures');

    test.describe('Info Page', () => {
      test('should show both toolsets as enabled', async ({ page }) => {
        await page.goto(MCP_ENDPOINT);

        // Check that dev toolset is listed with its tools
        const devToolset = page.locator('.toolset', { has: page.locator('text=dev') });
        await expect(devToolset).toBeVisible();
        await expect(devToolset.locator('.toolset-status').first()).toHaveText('enabled');

        // Check that docs toolset is listed with its tools
        const docsToolset = page.locator('.toolset', { has: page.locator('text=docs') });
        await expect(docsToolset).toBeVisible();
        await expect(docsToolset.locator('.toolset-status').first()).toHaveText('enabled');

        // Check that test toolset is listed with its tools
        const testToolset = page.locator('.toolset', { has: page.locator('text=test') });
        await expect(testToolset).toBeVisible();
        await expect(testToolset.locator('.toolset-status').first()).toHaveText('enabled');

        // Check that accessibility tool is enabled
        const accessibilityTool = testToolset.locator(
          '.toolset-tools li:has-text("accessibility")'
        );
        await expect(accessibilityTool).toBeVisible();
        await expect(accessibilityTool.locator('.toolset-status')).toHaveText('+ accessibility');
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
        // At least dev and docs tools should be present (4 total)
        expect(response.result.tools.length).toBeGreaterThanOrEqual(4);
      });
    });

    test.describe('Tool: stories-preview', () => {
      test('should return story URLs for valid stories', async ({ request }) => {
        const storyName = 'Primary';
        const expectedPreviewUrl = `${storybookUrl}/?path=/story/example-button--primary`;

        // Use a path pattern that works regardless of sandbox location
        const response = await mcpRequest(request, 'tools/call', {
          name: 'stories-preview',
          arguments: {
            stories: [
              {
                exportName: storyName,
                absoluteStoryPath: path.join(sandboxDir, 'src', 'stories', 'Button.stories.ts'),
              },
            ],
          },
        });

        expect(response.result).toStrictEqual({
          content: [
            {
              type: 'text',
              text: expectedPreviewUrl,
            },
          ],
          structuredContent: {
            stories: [
              {
                name: storyName,
                previewUrl: expectedPreviewUrl,
                title: 'Example/Button',
              },
            ],
          },
        });
      });
    });

    test.describe('Tool: get-storybook-story-instructions', () => {
      test('should return UI building instructions', async ({ request }) => {
        const response = await mcpRequest(request, 'tools/call', {
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

    test.describe('Tool: docs-list', () => {
      test('should list all documentation from manifest', async ({ request }) => {
        const response = await mcpRequest(request, 'tools/call', {
          name: 'docs-list',
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

    test.describe('Tool: docs-show', () => {
      test('should return documentation for a specific component', async ({ request }) => {
        const response = await mcpRequest(request, 'tools/call', {
          name: 'docs-show',
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

  test.describe('MCP (Angular)', () => {
    test.skip(type !== 'dev', 'MCP server only runs in dev mode');
    test.skip(!isAngularSandbox, 'Asserts on the Angular sandbox fixtures');

    test('docs-show returns the inputs and outputs of a model() component', async ({ request }) => {
      const list = await mcpRequest(request, 'tools/call', {
        name: 'docs-list',
        arguments: {},
      });
      const listing: string = list.result.content[0].text;
      expect(listing, `no color-picker component listed:\n${listing}`).toContain(COLOR_PICKER_ID);

      const response = await mcpRequest(request, 'tools/call', {
        name: 'docs-show',
        arguments: { id: COLOR_PICKER_ID },
      });
      const text: string = response.result.content[0].text;

      expect(text).toContain('## Inputs');
      expect(text).toContain('export type ColorPickerComponentInputs = {');
      expect(text).toContain('// two-way: [(color)]');
      expect(text).toContain('## Outputs');
      const outputs = text.slice(text.indexOf('## Outputs')).split('\n## ')[0];
      expect(outputs.match(/\bcolorChange\b/g)).toHaveLength(1);
      expect(outputs).not.toMatch(/^\s+color[?:]/m);
    });
  });

  test.describe('MCP (Vue)', () => {
    test.skip(type !== 'dev', 'MCP server only runs in dev mode');
    test.skip(!isVueSandbox, 'Asserts on the Vue sandbox fixtures');

    test('docs-show returns the models and events of a defineModel() component', async ({
      request,
    }) => {
      const list = await mcpRequest(request, 'tools/call', {
        name: 'docs-list',
        arguments: {},
      });
      const listing: string = list.result.content[0].text;
      expect(listing, `no define-model component listed:\n${listing}`).toContain(DEFINE_MODEL_ID);

      const response = await mcpRequest(request, 'tools/call', {
        name: 'docs-show',
        arguments: { id: DEFINE_MODEL_ID },
      });
      const text: string = response.result.content[0].text;

      expect(text).toContain('## Models');
      expect(text).toContain('modelValue?: string; // v-model="..."');
      expect(text).toContain('## Events');
      expect(text).toContain('"update:modelValue": [value: string | undefined];');
      expect(text).toContain('<Component v-model="modelValue" />');
    });
  });

  test.describe('Hosted MCP (Vue, static build)', () => {
    test.skip(type !== 'build', 'Reads the built output a hosted Storybook serves');
    test.skip(!isVueSandbox, 'Asserts on the Vue sandbox fixtures');

    test('@storybook/mcp serves the same api sections as the dev server', async () => {
      const [listing, documentation] = await hostedMcpCalls(`${storybookUrl}/manifests`, [
        { name: 'docs-list', id: '' },
        { name: 'docs-show', id: DEFINE_MODEL_ID },
      ]);

      expect(listing).toContain(DEFINE_MODEL_ID);

      expect(documentation).toContain('## Models');
      expect(documentation).toContain('modelValue?: string; // v-model="..."');
      expect(documentation).toContain('## Events');
      expect(documentation).toContain('"update:modelValue"');
      expect(documentation.indexOf('## Models')).toBeLessThan(documentation.indexOf('## Stories'));
    });
  });

  test.describe('Hosted MCP (Angular, static build)', () => {
    test.skip(type !== 'build', 'Reads the built output a hosted Storybook serves');
    test.skip(!isAngularSandbox, 'Asserts on the Angular sandbox fixtures');

    test('@storybook/mcp serves the same api sections as the dev server', async () => {
      const [listing, documentation] = await hostedMcpCalls(`${storybookUrl}/manifests`, [
        { name: 'docs-list', id: '' },
        { name: 'docs-show', id: COLOR_PICKER_ID },
      ]);

      expect(listing).toContain(COLOR_PICKER_ID);

      expect(documentation).toContain('## Inputs');
      expect(documentation).toContain('export type ColorPickerComponentInputs = {');
      expect(documentation).toContain('// two-way: [(color)]');
      expect(documentation).toContain('## Outputs');
      expect(documentation).toContain('colorChange');
      expect(documentation.indexOf('## Inputs')).toBeLessThan(documentation.indexOf('## Stories'));
    });
  });
});
