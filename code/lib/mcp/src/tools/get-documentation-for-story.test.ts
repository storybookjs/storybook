import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { addGetStoryDocumentationTool, GET_STORY_TOOL_NAME } from './register.ts';
import type { Source, StorybookContext } from '../types.ts';
import smallManifestFixture from '../../fixtures/small-manifest.fixture.json' with { type: 'json' };
import {
  COMPONENT_MANIFEST_PATH,
  DOCS_MANIFEST_PATH,
  ManifestGetError,
  RequiresOwnMcpError,
} from 'storybook/internal/toolsets-docs';

/**
 * The manifests one provider serves, keyed by source id (`''` for the single-source case). Each
 * entry either resolves to the manifest JSON or rejects, which is how these tests stand in for a
 * Storybook that cannot be read.
 */
type ServedManifests = {
  componentManifest?: unknown;
  docsManifest?: unknown;
  rejectWith?: unknown;
};

function createManifestProvider(served: Record<string, ServedManifests>) {
  return vi.fn(async (_request: Request | undefined, path: string, source?: Source) => {
    const entry = served[source?.id ?? ''];
    if (!entry) {
      throw new ManifestGetError('Failed to fetch manifest: 404 Not Found', path);
    }
    if (entry.rejectWith) {
      throw entry.rejectWith;
    }
    const manifest =
      path === COMPONENT_MANIFEST_PATH
        ? entry.componentManifest
        : path === DOCS_MANIFEST_PATH
          ? entry.docsManifest
          : undefined;
    if (!manifest) {
      throw new ManifestGetError('Failed to fetch manifest: 404 Not Found', path);
    }
    return JSON.stringify(manifest);
  });
}

describe('getComponentStoryDocumentationTool', () => {
  let server: McpServer<any, StorybookContext>;
  let served: Record<string, ServedManifests>;
  let manifestProvider: ReturnType<typeof createManifestProvider>;

  beforeEach(async () => {
    const adapter = new ValibotJsonSchemaAdapter();
    server = new McpServer(
      {
        name: 'test-server',
        version: '1.0.0',
        description: 'Test server for get story tool',
      },
      {
        adapter,
        capabilities: {
          tools: { listChanged: true },
        },
      }
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
      { sessionId: 'test-session' }
    );
    await addGetStoryDocumentationTool(server);

    // Serve the fixture through the context's manifest provider
    served = { '': { componentManifest: smallManifestFixture } };
    manifestProvider = createManifestProvider(served);
  });

  it('should return formatted story documentation for a specific story', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: GET_STORY_TOOL_NAME,
        arguments: {
          componentId: 'button',
          storyName: 'Primary',
        },
      },
    };

    const mockHttpRequest = new Request('https://example.com/mcp');
    const response = await server.receive(request, {
      custom: { request: mockHttpRequest, manifestProvider },
    });

    expect(response.result).toMatchInlineSnapshot(`
			{
			  "content": [
			    {
			      "text": "# Button - Primary

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

  it('should return the same story documentation for a story id', async () => {
    const call = async (args: Record<string, string>) => {
      const response = await server.receive(
        {
          jsonrpc: '2.0' as const,
          id: 1,
          method: 'tools/call',
          params: { name: GET_STORY_TOOL_NAME, arguments: args },
        },
        { custom: { request: new Request('https://example.com/mcp'), manifestProvider } }
      );
      return (response.result as any).content[0].text;
    };

    expect(await call({ storyId: 'button--primary' })).toBe(
      await call({ componentId: 'button', storyName: 'Primary' })
    );
  });

  it('should return an error listing available story ids when a story id is not found', async () => {
    const response = await server.receive(
      {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: { name: GET_STORY_TOOL_NAME, arguments: { storyId: 'button--nope' } },
      },
      { custom: { request: new Request('https://example.com/mcp'), manifestProvider } }
    );

    expect((response.result as any).isError).toBe(true);
    expect((response.result as any).content[0].text).toBe(
      'Story not found: "button--nope" for component "button". Available stories: Primary (button--primary)'
    );
  });

  it('should return guidance when neither a story id nor a name pair is given', async () => {
    const response = await server.receive(
      {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: { name: GET_STORY_TOOL_NAME, arguments: { componentId: 'button' } },
      },
      { custom: { request: new Request('https://example.com/mcp'), manifestProvider } }
    );

    expect((response.result as any).isError).toBe(true);
    expect((response.result as any).content[0].text).toBe(
      'Provide either `storyId`, or both `componentId` and `storyName`. Story ids are listed by the docs-list tool with `withStoryIds: true` and in docs-show output.'
    );
  });

  it('should return an error when a component is not found', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: GET_STORY_TOOL_NAME,
        arguments: {
          componentId: 'nonexistent',
          storyName: 'Primary',
        },
      },
    };

    const mockHttpRequest = new Request('https://example.com/mcp');
    const response = await server.receive(request, {
      custom: { request: mockHttpRequest, manifestProvider },
    });

    expect(response.result).toMatchInlineSnapshot(`
      {
        "content": [
          {
            "text": "Component not found: "nonexistent". Use the docs-list tool to see available components.",
            "type": "text",
          },
        ],
        "isError": true,
      }
    `);
  });

  it('should return an error when a story is not found', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: GET_STORY_TOOL_NAME,
        arguments: {
          componentId: 'button',
          storyName: 'Nonexistent',
        },
      },
    };

    const mockHttpRequest = new Request('https://example.com/mcp');
    const response = await server.receive(request, {
      custom: { request: mockHttpRequest, manifestProvider },
    });

    expect(response.result).toMatchInlineSnapshot(`
      {
        "content": [
          {
            "text": "Story "Nonexistent" not found for component "button". Available stories: Primary (button--primary)",
            "type": "text",
          },
        ],
        "isError": true,
      }
    `);
  });

  it('should handle fetch errors gracefully', async () => {
    served[''] = {
      rejectWith: new ManifestGetError(
        'Failed to fetch manifest: 404 Not Found',
        'https://example.com/manifest.json'
      ),
    };

    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: GET_STORY_TOOL_NAME,
        arguments: {
          componentId: 'button',
          storyName: 'Primary',
        },
      },
    };

    const mockHttpRequest = new Request('https://example.com/mcp');
    const response = await server.receive(request, {
      custom: { request: mockHttpRequest, manifestProvider },
    });

    expect(response.result).toMatchInlineSnapshot(`
      {
        "content": [
          {
            "text": "Error getting manifest: Failed to get component manifest: Failed to fetch manifest: 404 Not Found
      Hint: The Storybook at this URL may not have the component manifest enabled. Add \`features: { componentsManifest: true }\` (or \`features: { experimentalComponentsManifest: true }\` for older Storybook versions) to its main.ts config.
      Caused by: Failed to fetch manifest: 404 Not Found",
            "type": "text",
          },
        ],
        "isError": true,
      }
    `);
  });

  it('should include import statement when available', async () => {
    const manifestWithImport = {
      // v0: this manifest inlines docgen/subcomponents/import, which is the inline format.
      // Labelling it v1 would strip them — a v1 row carries those behind `$ref`s instead.
      v: 0,
      components: {
        button: {
          id: 'button',
          name: 'Button',
          path: 'src/components/Button.tsx',
          import: 'import { Button } from "@storybook/design-system";',
          stories: [
            {
              name: 'Primary',
              description: 'The primary button variant.',
              snippet: 'const Primary = () => <Button variant="primary">Click Me</Button>',
            },
          ],
        },
      },
    };

    served[''] = { componentManifest: manifestWithImport };

    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: GET_STORY_TOOL_NAME,
        arguments: {
          componentId: 'button',
          storyName: 'Primary',
        },
      },
    };

    const mockHttpRequest = new Request('https://example.com/mcp');
    const response = await server.receive(request, {
      custom: { request: mockHttpRequest, manifestProvider },
    });

    expect(response.result.content[0].text).toContain(
      'import { Button } from "@storybook/design-system";'
    );
  });

  describe('multi-source mode', () => {
    const sources = [
      { id: 'local', title: 'Local' },
      { id: 'remote', title: 'Remote', url: 'http://remote.example.com' },
    ];

    const remoteManifest = {
      v: 1,
      components: {
        badge: {
          id: 'badge',
          path: 'src/Badge.tsx',
          name: 'Badge',
          stories: [{ name: 'Default', snippet: 'const Default = () => <Badge />' }],
        },
      },
    };

    // Re-create server with multiSource schema so storybookId is in the schema
    beforeEach(async () => {
      const adapter = new ValibotJsonSchemaAdapter();
      server = new McpServer(
        {
          name: 'test-server',
          version: '1.0.0',
          description: 'Test server for get story tool',
        },
        {
          adapter,
          capabilities: { tools: { listChanged: true } },
        }
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
      await addGetStoryDocumentationTool(server, undefined, { multiSource: true });

      served.local = { componentManifest: smallManifestFixture };
      served.remote = { componentManifest: smallManifestFixture };
    });

    it('should return schema validation error when storybookId is missing', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_STORY_TOOL_NAME,
          arguments: { componentId: 'button', storyName: 'Primary' },
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, sources },
      });

      // storybookId is required in multi-source mode — schema validation rejects it
      expect((response.result as any).isError).toBe(true);
      expect((response.result as any).content[0].text).toContain('storybookId');
    });

    it('should return error when storybookId is invalid', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_STORY_TOOL_NAME,
          arguments: { componentId: 'button', storyName: 'Primary', storybookId: 'nonexistent' },
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, sources },
      });

      expect((response.result as any).isError).toBe(true);
      expect((response.result as any).content[0].text).toContain(
        'Storybook source not found: "nonexistent"'
      );
      expect((response.result as any).content[0].text).toContain('local, remote');
    });

    it('should fetch story documentation from a specific source', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_STORY_TOOL_NAME,
          arguments: { componentId: 'button', storyName: 'Primary', storybookId: 'local' },
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, sources },
      });

      expect((response.result as any).content[0].text).toContain('# Button - Primary');
      expect(manifestProvider).toHaveBeenCalledWith(
        mockHttpRequest,
        COMPONENT_MANIFEST_PATH,
        sources[0]
      );
    });

    it('should fetch story documentation by story id from a specific source', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_STORY_TOOL_NAME,
          arguments: { storyId: 'button--primary', storybookId: 'local' },
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, sources },
      });

      expect((response.result as any).content[0].text).toContain('# Button - Primary');
      expect(manifestProvider).toHaveBeenCalledWith(
        mockHttpRequest,
        COMPONENT_MANIFEST_PATH,
        sources[0]
      );
    });

    it('should pass remote source to getManifests', async () => {
      served.remote = { componentManifest: remoteManifest };

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_STORY_TOOL_NAME,
          arguments: { componentId: 'badge', storyName: 'Default', storybookId: 'remote' },
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, sources },
      });

      expect((response.result as any).content[0].text).toContain('# Badge - Default');
      expect(manifestProvider).toHaveBeenCalledWith(
        mockHttpRequest,
        COMPONENT_MANIFEST_PATH,
        sources[1]
      );
    });

    it('should return a routing notice when the selected source requires its own MCP', async () => {
      const remoteSource = sources[1] as Source & { url: string };
      served.remote = { rejectWith: new RequiresOwnMcpError(remoteSource) };

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_STORY_TOOL_NAME,
          arguments: {
            componentId: 'badge',
            storyName: 'Default',
            storybookId: 'remote',
          },
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, sources },
      });

      expect((response.result as any).isError).toBeUndefined();
      expect((response.result as any).content[0].text).toBe(`# Remote
id: remote

This composed Storybook is private and cannot be read through the local Storybook MCP proxy.

Use this source's own MCP endpoint instead:
http://remote.example.com/mcp`);
    });
  });
});
