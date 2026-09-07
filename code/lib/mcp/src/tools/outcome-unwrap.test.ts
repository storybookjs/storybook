/**
 * Outcome-unwrap contract of the hosted adapter: what an MCP client observes must match what the
 * dev-server adapter (`@storybook/addon-mcp`) produces from the same toolset — published
 * `outputSchema`, validated `structuredContent`, verbatim agent-facing errors, and a server-side
 * log for unexpected failures. No docs method declares an `outputSchema` yet, so the schema cases
 * doctor the toolset the adapter is fed; the toolset is this adapter's input, not its internals.
 */
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { McpServer } from 'tmcp';
import * as v from 'valibot';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { COMPONENT_MANIFEST_PATH, ManifestGetError } from 'storybook/internal/toolsets-docs';

import type { ComponentManifestMap, StorybookContext } from '../types.ts';
import smallManifestFixtureRaw from '../../fixtures/small-manifest.fixture.json' with { type: 'json' };
import { addListAllDocumentationTool, LIST_TOOL_NAME } from './register.ts';

const smallManifestFixture = smallManifestFixtureRaw as unknown as ComponentManifestMap;

const listMethod = vi.hoisted(() => ({
  output: undefined as unknown,
  handler: undefined as ((input: unknown, ctx: unknown) => unknown) | undefined,
}));

vi.mock('storybook/internal/toolsets-docs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/toolsets-docs')>();
  return {
    ...actual,
    createDocsToolset: (options: never) => {
      const toolset = actual.createDocsToolset(options);
      const list = toolset.methods.list as { output?: unknown; handler: unknown };
      if (listMethod.output) {
        list.output = listMethod.output;
      }
      if (listMethod.handler) {
        list.handler = listMethod.handler;
      }
      return toolset;
    },
  };
});

async function createServer() {
  const server = new McpServer(
    { name: 'test-server', version: '1.0.0', description: 'Test server for outcome unwrap' },
    { adapter: new ValibotJsonSchemaAdapter(), capabilities: { tools: { listChanged: true } } }
  ).withContext<StorybookContext>();

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
    { sessionId: 'test-session' }
  );

  return server;
}

function createManifestProvider() {
  return vi.fn(async (_request: Request | undefined, path: string) => {
    if (path !== COMPONENT_MANIFEST_PATH) {
      throw new ManifestGetError('Failed to fetch manifest: 404 Not Found', path);
    }
    return JSON.stringify(smallManifestFixture);
  });
}

async function callListTool(server: McpServer<any, StorybookContext>) {
  const response = await server.receive(
    {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'tools/call',
      params: { name: LIST_TOOL_NAME, arguments: {} },
    },
    {
      custom: {
        request: new Request('https://example.com/mcp'),
        manifestProvider: createManifestProvider(),
      },
    }
  );
  return (response as { result: { content: Array<{ text: string }>; isError?: boolean } }).result;
}

describe('hosted outcome unwrap', () => {
  // The global setup turns console.error into a test failure; this file asserts on it instead.
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    listMethod.output = undefined;
    listMethod.handler = undefined;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('publishes a method output schema as MCP tool metadata', async () => {
    listMethod.output = v.object({ manifests: v.looseObject({}) });
    const server = await createServer();
    await addListAllDocumentationTool(server);

    const response = await server.receive(
      { jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} },
      { sessionId: 'test-session' }
    );
    const [tool] = (response as { result: { tools: Array<Record<string, unknown>> } }).result.tools;

    expect(tool.name).toBe(LIST_TOOL_NAME);
    expect(tool.outputSchema).toMatchObject({
      type: 'object',
      properties: { manifests: expect.anything() },
    });
  });

  it('emits structuredContent narrowed to the published output schema', async () => {
    // A strict subset of the real outcome data: validation must strip everything undeclared.
    listMethod.output = v.object({ manifests: v.looseObject({}) });
    const server = await createServer();
    await addListAllDocumentationTool(server);

    const result = (await callListTool(server)) as { structuredContent?: Record<string, unknown> };

    expect(result.structuredContent).toBeDefined();
    expect(Object.keys(result.structuredContent!)).toEqual(['manifests']);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('maps a failure outcome to isError and still emits its validated structuredContent', async () => {
    listMethod.output = v.object({ reason: v.string() });
    listMethod.handler = () => ({
      ok: false,
      data: { reason: 'nothing indexed', internal: 'not-published' },
      markdown: 'Nothing indexed yet.',
    });
    const server = await createServer();
    await addListAllDocumentationTool(server);

    const result = (await callListTool(server)) as {
      content: Array<{ type: string; text: string }>;
      structuredContent?: Record<string, unknown>;
      isError?: boolean;
    };

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'Nothing indexed yet.' }]);
    expect(result.structuredContent).toEqual({ reason: 'nothing indexed' });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('reports and logs outcome data its published output schema rejects', async () => {
    listMethod.output = v.object({ fieldTheDataDoesNotHave: v.string() });
    const server = await createServer();
    await addListAllDocumentationTool(server);

    const result = await callListTool(server);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('did not match its published output schema');
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('surfaces agent-facing errors verbatim, without the generic error prefix', async () => {
    // The trait is a property read, never a class list — it must travel across bundle copies.
    listMethod.handler = () => {
      throw Object.assign(new Error('Do X, then retry the tool.'), { agentFacing: true });
    };
    const server = await createServer();
    await addListAllDocumentationTool(server);

    const result = await callListTool(server);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Do X, then retry the tool.');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('logs unexpected failures so they reach the server terminal, not only the transcript', async () => {
    listMethod.handler = () => {
      throw new Error('boom');
    };
    const server = await createServer();
    await addListAllDocumentationTool(server);

    const result = await callListTool(server);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Unexpected error: boom');
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
