import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { addListAllDocumentationTool, LIST_TOOL_NAME } from './register.ts';
import type { ComponentManifestMap, DocsManifestMap, Source, StorybookContext } from '../types.ts';
import smallManifestFixtureRaw from '../../fixtures/small-manifest.fixture.json' with { type: 'json' };
import smallDocsManifestFixtureRaw from '../../fixtures/small-docs-manifest.fixture.json' with { type: 'json' };
import {
  COMPONENT_MANIFEST_PATH,
  DOCS_MANIFEST_PATH,
  ManifestGetError,
  RequiresOwnMcpError,
} from 'storybook/internal/toolsets-docs';

// JSON imports widen the `v` literal to `number`, so re-type the fixtures against
// the discriminated-union schema for use in strongly-typed mocks.
const smallManifestFixture = smallManifestFixtureRaw as unknown as ComponentManifestMap;
const smallDocsManifestFixture = smallDocsManifestFixtureRaw as unknown as DocsManifestMap;

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

describe('listAllDocumentationTool', () => {
  let server: McpServer<any, StorybookContext>;
  let served: Record<string, ServedManifests>;
  let manifestProvider: ReturnType<typeof createManifestProvider>;

  beforeEach(async () => {
    const adapter = new ValibotJsonSchemaAdapter();
    server = new McpServer(
      {
        name: 'test-server',
        version: '1.0.0',
        description: 'Test server for list tool',
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
    await addListAllDocumentationTool(server);

    // Serve the fixture through the context's manifest provider
    served = { '': { componentManifest: smallManifestFixture } };
    manifestProvider = createManifestProvider(served);
  });

  it('should return a list of all components', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: LIST_TOOL_NAME,
        arguments: {},
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
			      "text": "# Components

			- Button (button): A simple button component
			- Card (card): A container component for grouping related content.
			- Input (input): A text input component with validation support.",
			      "type": "text",
			    },
			  ],
			}
		`);
  });

  it('should include nested story IDs when withStoryIds is true', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'tools/call',
      params: {
        name: LIST_TOOL_NAME,
        arguments: {
          withStoryIds: true,
        },
      },
    };

    const mockHttpRequest = new Request('https://example.com/mcp');
    const response = await server.receive(request, {
      custom: { request: mockHttpRequest, manifestProvider },
    });

    const text = (response.result as any).content[0].text;
    expect(text).toContain('Button (button): A simple button component');
    expect(text).toContain('  - Primary (button--primary)');
  });

  describe('multi-source mode', () => {
    const sources = [
      { id: 'local', title: 'Local' },
      { id: 'remote', title: 'Remote', url: 'http://remote.example.com' },
    ];

    const remoteManifest: ComponentManifestMap = {
      v: 0,
      components: {
        badge: {
          id: 'badge',
          path: 'src/Badge.tsx',
          name: 'Badge',
          summary: 'A badge component',
        },
      },
    };

    it('should return grouped output from multiple sources', async () => {
      manifestProvider = createManifestProvider({
        local: { componentManifest: smallManifestFixture },
        remote: { componentManifest: remoteManifest },
      });

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: LIST_TOOL_NAME,
          arguments: {},
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, sources },
      });

      const text = (response.result as any).content[0].text;
      expect(text).toContain('# Local');
      expect(text).toContain('id: local');
      expect(text).toContain('Button (button)');
      expect(text).toContain('# Remote');
      expect(text).toContain('id: remote');
      expect(text).toContain('Badge (badge)');
    });

    it('should call onListAllDocumentation with first successful source', async () => {
      manifestProvider = createManifestProvider({
        local: { componentManifest: smallManifestFixture },
        remote: { componentManifest: remoteManifest },
      });

      const handler = vi.fn();
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: LIST_TOOL_NAME,
          arguments: {},
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      await server.receive(request, {
        custom: {
          request: mockHttpRequest,
          manifestProvider,
          sources,
          onListAllDocumentation: handler,
        },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          manifests: {
            componentManifest: smallManifestFixture,
          },
          resultText: expect.any(String),
        })
      );
    });

    it('should report every source flat, with its manifests directly on the entry', async () => {
      manifestProvider = createManifestProvider({
        local: { componentManifest: smallManifestFixture },
        remote: { componentManifest: remoteManifest },
      });

      const handler = vi.fn();
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: LIST_TOOL_NAME,
          arguments: {},
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      await server.receive(request, {
        custom: {
          request: mockHttpRequest,
          manifestProvider,
          sources,
          onListAllDocumentation: handler,
        },
      });

      // Exact shape, not objectContaining: embedders read `componentManifest` straight off each
      // source entry, and the nested `manifests` shape this replaced must not silently return.
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]![0].sources).toEqual([
        { source: sources[0], componentManifest: smallManifestFixture },
        { source: sources[1], componentManifest: remoteManifest },
      ]);
    });

    it('should show error for failed sources while displaying successful ones', async () => {
      manifestProvider = createManifestProvider({
        local: { componentManifest: smallManifestFixture },
        remote: {
          rejectWith: new ManifestGetError('Failed to fetch manifest: 401 Unauthorized'),
        },
      });

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: LIST_TOOL_NAME,
          arguments: {},
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, sources },
      });

      const text = (response.result as any).content[0].text;
      expect(text).toContain('# Local');
      expect(text).toContain('Button (button)');
      expect(text).toContain('# Remote');
      // The provider's rejection reaches the listing through the same wrapping a real fetch
      // failure goes through, hence the `Failed to get component manifest:` prefix.
      expect(text).toContain(
        'error: Failed to get component manifest: Failed to fetch manifest: 401 Unauthorized'
      );
    });

    it('should show private composed sources as routing notices', async () => {
      const tetraSource = {
        id: 'tetra',
        title: 'Tetra Design System',
        url: 'https://tetra.chromatic.com',
      };
      const composedSources = [sources[0]!, tetraSource];
      manifestProvider = createManifestProvider({
        local: { componentManifest: smallManifestFixture },
        tetra: { rejectWith: new RequiresOwnMcpError(tetraSource) },
      });

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: LIST_TOOL_NAME,
          arguments: {},
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, sources: composedSources },
      });

      const text = (response.result as any).content[0].text;
      expect(text).toContain('# Local');
      expect(text).toContain('Button (button)');
      expect(text).toContain('# Tetra Design System');
      expect(text).toContain('id: tetra');
      expect(text).toContain(
        'This composed Storybook is private and cannot be read through the local Storybook MCP proxy.'
      );
      expect(text).toContain('https://tetra.chromatic.com/mcp');
      expect(text).not.toContain('error:');
    });
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
        name: LIST_TOOL_NAME,
        arguments: {},
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

  it('should handle unexpected errors gracefully', async () => {
    served[''] = { rejectWith: new Error('Network timeout') };

    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: LIST_TOOL_NAME,
        arguments: {},
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
            "text": "Error getting manifest: Failed to get component manifest: Network timeout
      Caused by: Network timeout",
            "type": "text",
          },
        ],
        "isError": true,
      }
    `);
  });

  it('should call onListAllDocumentation handler when provided', async () => {
    const handler = vi.fn();

    const request = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'tools/call',
      params: {
        name: LIST_TOOL_NAME,
        arguments: {},
      },
    };

    const mockHttpRequest = new Request('https://example.com/mcp');
    // Pass the handler and request in the context for this specific request
    await server.receive(request, {
      custom: { request: mockHttpRequest, manifestProvider, onListAllDocumentation: handler },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      context: expect.objectContaining({
        request: mockHttpRequest,
        onListAllDocumentation: handler,
      }),
      manifests: {
        componentManifest: smallManifestFixture,
      },
      resultText: expect.any(String),
    });
  });

  describe('with docs manifest', () => {
    beforeEach(() => {
      served[''] = {
        componentManifest: smallManifestFixture,
        docsManifest: smallDocsManifestFixture,
      };
    });

    it('should return both components and docs entries', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: LIST_TOOL_NAME,
          arguments: {},
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
				      "text": "# Components

				- Button (button): A simple button component
				- Card (card): A container component for grouping related content.
				- Input (input): A text input component with validation support.

				# Docs

				- Getting Started Guide (getting-started): # Getting Started Welcome to the component library. This guide will help you get up and ru...
				- Theming and Customization (theming): # Theming Learn how to customize the look and feel of components using our theming system....",
				      "type": "text",
				    },
				  ],
				}
			`);
    });

    it('should include docs manifest in onListAllDocumentation handler call', async () => {
      const handler = vi.fn();

      const request = {
        jsonrpc: '2.0' as const,
        id: 2,
        method: 'tools/call',
        params: {
          name: LIST_TOOL_NAME,
          arguments: {},
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, onListAllDocumentation: handler },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        context: expect.objectContaining({
          request: mockHttpRequest,
          onListAllDocumentation: handler,
        }),
        manifests: {
          componentManifest: smallManifestFixture,
          docsManifest: smallDocsManifestFixture,
        },
        resultText: expect.any(String),
      });
    });
  });
});
