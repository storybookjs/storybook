import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { addGetDocumentationTool, GET_TOOL_NAME } from './register.ts';
import type { Source, StorybookContext } from '../types.ts';
import smallManifestFixture from '../../fixtures/small-manifest.fixture.json' with { type: 'json' };
import smallDocsManifestFixture from '../../fixtures/small-docs-manifest.fixture.json' with { type: 'json' };
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

describe('getDocumentationTool', () => {
  let server: McpServer<any, StorybookContext>;
  let served: Record<string, ServedManifests>;
  let manifestProvider: ReturnType<typeof createManifestProvider>;

  beforeEach(async () => {
    const adapter = new ValibotJsonSchemaAdapter();
    server = new McpServer(
      {
        name: 'test-server',
        version: '1.0.0',
        description: 'Test server for get tool',
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
    await addGetDocumentationTool(server);

    // Serve the fixture through the context's manifest provider
    served = { '': { componentManifest: smallManifestFixture } };
    manifestProvider = createManifestProvider(served);
  });

  it('should return formatted documentation for a single component', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: GET_TOOL_NAME,
        arguments: {
          id: 'button',
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
			      "text": "# Button

			ID: button

			## Stories

			### Primary

			Story ID: button--primary

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

  it('should return an error when a component is not found', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: GET_TOOL_NAME,
        arguments: {
          id: 'nonexistent',
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
            "text": "Component or Docs Entry not found: "nonexistent". Use the docs-list tool to see available components and documentation entries.",
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
        name: GET_TOOL_NAME,
        arguments: {
          id: 'button',
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

  it('should call onGetDocumentation handler when provided', async () => {
    const handler = vi.fn();

    const request = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'tools/call',
      params: {
        name: GET_TOOL_NAME,
        arguments: {
          id: 'button',
        },
      },
    };

    const mockHttpRequest = new Request('https://example.com/mcp');
    // Pass the handler and request in the context for this specific request
    await server.receive(request, {
      custom: {
        request: mockHttpRequest,
        manifestProvider,
        onGetDocumentation: handler,
      },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      context: expect.objectContaining({
        request: mockHttpRequest,
        onGetDocumentation: handler,
      }),
      input: { id: 'button' },
      foundDocumentation: expect.objectContaining({
        id: 'button',
        name: 'Button',
      }),
      resultText: expect.any(String),
    });
  });

  it('should include props section when reactDocgen is present', async () => {
    const manifestWithReactDocgen = {
      // v0: this manifest inlines docgen/subcomponents/import, which is the inline format.
      // Labelling it v1 would strip them — a v1 row carries those behind `$ref`s instead.
      v: 0,
      components: {
        button: {
          id: 'button',
          name: 'Button',
          description: 'A button component',
          reactDocgen: {
            props: {
              variant: {
                description: 'Button style variant',
                required: false,
                defaultValue: { value: '"primary"', computed: false },
                tsType: {
                  name: 'union',
                  raw: '"primary" | "secondary"',
                  elements: [
                    { name: 'literal', value: '"primary"' },
                    { name: 'literal', value: '"secondary"' },
                  ],
                },
              },
              disabled: {
                description: 'Disable the button',
                required: false,
                tsType: {
                  name: 'boolean',
                },
              },
            },
          },
        },
      },
    };

    served[''] = { componentManifest: manifestWithReactDocgen };

    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: GET_TOOL_NAME,
        arguments: {
          id: 'button',
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
			      "text": "# Button

			ID: button

			A button component

			## Props

			\`\`\`
			export type Props = {
			  /**
			    Button style variant
			  */
			  variant?: "primary" | "secondary" = "primary";
			  /**
			    Disable the button
			  */
			  disabled?: boolean;
			}
			\`\`\`",
			      "type": "text",
			    },
			  ],
			}
		`);
  });

  it('should include props section when reactComponentMeta is present', async () => {
    const manifestWithReactComponentMeta = {
      // v0: this manifest inlines docgen/subcomponents/import, which is the inline format.
      // Labelling it v1 would strip them — a v1 row carries those behind `$ref`s instead.
      v: 0,
      components: {
        button: {
          id: 'button',
          name: 'Button',
          description: 'A button component',
          reactComponentMeta: {
            displayName: 'Button',
            filePath: 'src/components/Button.tsx',
            description: '',
            exportName: 'Button',
            props: {
              variant: {
                name: 'variant',
                description: 'Button style variant',
                required: false,
                defaultValue: { value: '"primary"' },
                type: {
                  name: 'enum',
                  raw: '"primary" | "secondary"',
                },
              },
              disabled: {
                name: 'disabled',
                description: 'Disable the button',
                required: false,
                defaultValue: null,
                type: {
                  name: 'boolean',
                },
              },
            },
          },
        },
      },
    };

    served[''] = { componentManifest: manifestWithReactComponentMeta };

    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: GET_TOOL_NAME,
        arguments: {
          id: 'button',
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
			      "text": "# Button

			ID: button

			A button component

			## Props

			\`\`\`
			export type Props = {
			  /**
			    Button style variant
			  */
			  variant?: "primary" | "secondary" = "primary";
			  /**
			    Disable the button
			  */
			  disabled?: boolean;
			}
			\`\`\`",
			      "type": "text",
			    },
			  ],
			}
		`);
  });

  it('should render apiDescription ahead of the stories it is applied by', async () => {
    served[''] = {
      componentManifest: {
        // v0: this manifest inlines docgen/subcomponents/import, which is the inline format.
        // Labelling it v1 would strip them — a v1 row carries those behind `$ref`s instead.
        v: 0,
        components: {
          widget: {
            id: 'widget',
            name: 'Widget',
            description: 'A widget.',
            apiDescription: [
              '## API',
              '',
              '```',
              'export type WidgetApi = {',
              '  /** @default medium */',
              '  size?: "small" | "medium";',
              '}',
              '```',
            ].join('\n'),
            stories: [
              {
                id: 'widget--basic',
                name: 'Basic',
                snippet: '<Widget />',
              },
              {
                id: 'widget--small',
                name: 'Small',
                snippet: '<Widget size="small" />',
              },
            ],
          },
        },
      },
    };

    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: GET_TOOL_NAME,
        arguments: {
          id: 'widget',
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
            "text": "# Widget

      ID: widget

      A widget.

      ## API

      \`\`\`
      export type WidgetApi = {
        /** @default medium */
        size?: "small" | "medium";
      }
      \`\`\`

      ## Stories

      ### Basic

      Story ID: widget--basic

      \`\`\`
      <Widget />
      \`\`\`

      ### Small

      Story ID: widget--small

      \`\`\`
      <Widget size="small" />
      \`\`\`",
            "type": "text",
          },
        ],
      }
    `);
  });

  it('should include subcomponents in get-documentation output', async () => {
    served[''] = {
      componentManifest: {
        // v0: this manifest inlines docgen/subcomponents/import, which is the inline format.
        // Labelling it v1 would strip them — a v1 row carries those behind `$ref`s instead.
        v: 0,
        components: {
          'combo-box': {
            id: 'combo-box',
            name: 'ComboBox',
            path: 'src/components/ComboBox.tsx',
            description: 'A combo box component',
            subcomponents: {
              Item: {
                name: 'ComboBoxItem',
                path: 'src/components/ComboBoxItem.tsx',
                description: 'Use for individual options.',
                import: 'import { ComboBoxItem } from "@/components";',
                reactComponentMeta: {
                  displayName: 'ComboBoxItem',
                  filePath: 'src/components/ComboBoxItem.tsx',
                  description: '',
                  exportName: 'ComboBoxItem',
                  props: {
                    textValue: {
                      name: 'textValue',
                      description: 'Required when children are not plain text.',
                      required: false,
                      defaultValue: null,
                      type: {
                        name: 'string',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: GET_TOOL_NAME,
        arguments: {
          id: 'combo-box',
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
			      "text": "# ComboBox

			ID: combo-box

			A combo box component

			## Subcomponents

			### ComboBoxItem

			Use for individual options.

			\`\`\`
			import { ComboBoxItem } from "@/components";
			\`\`\`

			#### Props

			\`\`\`
			export type ComboBoxItemProps = {
			  /**
			    Required when children are not plain text.
			  */
			  textValue?: string;
			}
			\`\`\`",
			      "type": "text",
			    },
			  ],
			}
		`);
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
          summary: 'A badge component',
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
          description: 'Test server for get tool',
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
      await addGetDocumentationTool(server, undefined, { multiSource: true });

      served.local = { componentManifest: smallManifestFixture };
      served.remote = { componentManifest: smallManifestFixture };
    });

    it('should return schema validation error when storybookId is missing', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_TOOL_NAME,
          arguments: { id: 'button' },
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
          name: GET_TOOL_NAME,
          arguments: { id: 'button', storybookId: 'nonexistent' },
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

    it('should fetch documentation with storybookId', async () => {
      served.local = { componentManifest: smallManifestFixture };

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_TOOL_NAME,
          arguments: { id: 'button', storybookId: 'local' },
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, sources },
      });

      expect((response.result as any).content[0].text).toContain('# Button');
      expect(manifestProvider).toHaveBeenCalledWith(
        mockHttpRequest,
        COMPONENT_MANIFEST_PATH,
        sources[0]
      );
    });

    it('resolves the local source in-process via resolveEntry (composition + docgen-server)', async () => {
      manifestProvider.mockClear();
      const resolveEntry = vi.fn().mockResolvedValue({
        kind: 'component',
        component: {
          id: 'button',
          name: 'Button',
          stories: [{ id: 'button--primary', name: 'Primary', snippet: '<Button />' }],
        },
      });

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_TOOL_NAME,
          arguments: { id: 'button', storybookId: 'local' },
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, sources, resolveEntry },
      });

      // The urlless local source is resolved in-process; the all-component index is never built.
      expect(resolveEntry).toHaveBeenCalledWith('button', sources[0]);
      expect(manifestProvider).not.toHaveBeenCalled();
      expect((response.result as any).content[0].text).toContain('# Button');
    });

    it('does not use resolveEntry for a remote source even when one is present', async () => {
      const resolveEntry = vi.fn();
      served.remote = { componentManifest: remoteManifest };

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_TOOL_NAME,
          arguments: { id: 'badge', storybookId: 'remote' },
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, sources, resolveEntry },
      });

      expect(resolveEntry).not.toHaveBeenCalled();
      expect(manifestProvider).toHaveBeenCalledWith(
        mockHttpRequest,
        COMPONENT_MANIFEST_PATH,
        sources[1]
      );
    });

    it('should pass remote source to getManifests', async () => {
      served.remote = { componentManifest: remoteManifest };

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_TOOL_NAME,
          arguments: { id: 'badge', storybookId: 'remote' },
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, sources },
      });

      expect((response.result as any).content[0].text).toContain('# Badge');
      expect(manifestProvider).toHaveBeenCalledWith(
        mockHttpRequest,
        COMPONENT_MANIFEST_PATH,
        sources[1]
      );
    });

    it('should include source in not-found error message', async () => {
      served.local = { componentManifest: smallManifestFixture };

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_TOOL_NAME,
          arguments: { id: 'nonexistent', storybookId: 'local' },
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, sources },
      });

      expect((response.result as any).isError).toBe(true);
      expect((response.result as any).content[0].text).toContain('in source "local"');
    });

    it('should return a routing notice when the selected source requires its own MCP', async () => {
      const remoteSource = sources[1] as Source & { url: string };
      served.remote = { rejectWith: new RequiresOwnMcpError(remoteSource) };

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_TOOL_NAME,
          arguments: { id: 'badge', storybookId: 'remote' },
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

    it('should call onGetDocumentation with storybookId', async () => {
      served.local = { componentManifest: smallManifestFixture };

      const handler = vi.fn();
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_TOOL_NAME,
          arguments: { id: 'button', storybookId: 'local' },
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      await server.receive(request, {
        custom: {
          request: mockHttpRequest,
          manifestProvider,
          sources,
          onGetDocumentation: handler,
        },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { id: 'button', storybookId: 'local' },
          foundDocumentation: expect.objectContaining({ id: 'button' }),
          resultText: expect.any(String),
        })
      );
    });
  });

  describe('docs manifest entries', () => {
    beforeEach(() => {
      served[''] = {
        componentManifest: smallManifestFixture,
        docsManifest: smallDocsManifestFixture,
      };
    });

    it('should return formatted documentation for a docs entry', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_TOOL_NAME,
          arguments: {
            id: 'getting-started',
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
				      "text": "# Getting Started Guide

				# Getting Started

				Welcome to the component library. This guide will help you get up and running.

				## Installation

				\`\`\`bash
				npm install my-component-library
				\`\`\`

				## Usage

				Import components and use them in your application.",
				      "type": "text",
				    },
				  ],
				}
			`);
    });

    it('should return component documentation when id matches both component and docs entry', async () => {
      // When an ID exists in both manifests, prefer component documentation
      served[''] = {
        componentManifest: smallManifestFixture,
        docsManifest: {
          v: 1,
          docs: {
            button: {
              id: 'button',
              name: 'Button Docs',
              title: 'Button Documentation',
              path: 'docs/button.mdx',
              content: 'This is the button docs entry',
            },
          },
        },
      };

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_TOOL_NAME,
          arguments: {
            id: 'button',
          },
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider },
      });

      // Should return the component, not the docs entry
      expect((response.result as any).content[0].text).toContain('## Stories');
      expect((response.result as any).content[0].text).toContain('Primary');
    });

    it('should call onGetDocumentation handler with docs entry when found', async () => {
      const handler = vi.fn();

      const request = {
        jsonrpc: '2.0' as const,
        id: 2,
        method: 'tools/call',
        params: {
          name: GET_TOOL_NAME,
          arguments: {
            id: 'getting-started',
          },
        },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      await server.receive(request, {
        custom: {
          request: mockHttpRequest,
          manifestProvider,
          onGetDocumentation: handler,
        },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        context: expect.objectContaining({
          request: mockHttpRequest,
          onGetDocumentation: handler,
        }),
        input: { id: 'getting-started' },
        foundDocumentation: expect.objectContaining({
          id: 'getting-started',
          name: 'Getting Started',
        }),
        resultText: expect.any(String),
      });
    });
  });

  describe('resolveEntry hook (dev / experimentalDocgenServer)', () => {
    beforeEach(() => {
      manifestProvider.mockClear();
    });

    it('resolves a single component via resolveEntry without building the index', async () => {
      const resolveEntry = vi.fn().mockResolvedValue({
        kind: 'component',
        component: {
          id: 'button',
          name: 'Button',
          stories: [
            { id: 'button--primary', name: 'Primary', snippet: '<Button variant="primary" />' },
          ],
        },
      });

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: { name: GET_TOOL_NAME, arguments: { id: 'button' } },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, resolveEntry },
      });

      // The single-entry hook is used, and the all-component manifest index is never fetched.
      expect(resolveEntry).toHaveBeenCalledWith('button', undefined);
      expect(manifestProvider).not.toHaveBeenCalled();
      expect((response.result as any).content[0].text).toContain('# Button');
      expect((response.result as any).content[0].text).toContain('button--primary');
    });

    it('resolves a single docs entry via resolveEntry', async () => {
      const resolveEntry = vi.fn().mockResolvedValue({
        kind: 'doc',
        doc: { id: 'intro', name: 'Intro', title: 'Introduction', content: '# Welcome' },
      });

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: { name: GET_TOOL_NAME, arguments: { id: 'intro' } },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, resolveEntry },
      });

      expect(resolveEntry).toHaveBeenCalledWith('intro', undefined);
      expect(manifestProvider).not.toHaveBeenCalled();
      expect((response.result as any).content[0].text).toContain('# Welcome');
    });

    it('returns not-found when resolveEntry yields nothing', async () => {
      const resolveEntry = vi.fn().mockResolvedValue(undefined);

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: { name: GET_TOOL_NAME, arguments: { id: 'nope' } },
      };

      const mockHttpRequest = new Request('https://example.com/mcp');
      const response = await server.receive(request, {
        custom: { request: mockHttpRequest, manifestProvider, resolveEntry },
      });

      expect(manifestProvider).not.toHaveBeenCalled();
      expect((response.result as any).isError).toBe(true);
      expect((response.result as any).content[0].text).toContain('not found');
    });
  });
});
