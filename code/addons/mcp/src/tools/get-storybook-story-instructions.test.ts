import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import {
  addGetUIBuildingInstructionsTool,
  buildStorybookStoryInstructions,
  getStorybookStoryInstructionsDescription,
} from './get-storybook-story-instructions.ts';
import type { AddonContext } from '../types.ts';
import { PREVIEW_STORIES_TOOL_NAME, GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME } from './tool-names.ts';

// Review/addon-vitest availability resolve through core's `resolveSkillInputs` (inside
// `buildStorybookStoryInstructions`'s adapter), so tests below drive them through the
// `options.presets` fixture or the `addonVitestAvailable` override instead of mocking an
// addon-local probe.
describe('getUIBuildingInstructionsTool', () => {
  let server: McpServer<any, AddonContext>;

  beforeEach(async () => {
    const adapter = new ValibotJsonSchemaAdapter();
    server = new McpServer(
      {
        name: 'test-server',
        version: '1.0.0',
        description: 'Test server for get-storybook-story-instructions tool',
      },
      {
        adapter,
        capabilities: {
          tools: { listChanged: true },
        },
      }
    ).withContext<AddonContext>();

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
      {
        sessionId: 'test-session',
      }
    );

    await addGetUIBuildingInstructionsTool(server, undefined, { addonVitestAvailable: true });
  });

  async function getToolDescription(context: AddonContext) {
    const response = await server.receive(
      {
        jsonrpc: '2.0' as const,
        id: 100,
        method: 'tools/list',
        params: {},
      },
      {
        sessionId: 'test-session',
        custom: context,
      }
    );

    const tools = response.result?.tools ?? [];
    const instructionsTool = tools.find(
      (tool: any) => tool.name === GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME
    );
    return instructionsTool?.description as string;
  }

  it('should include testing and a11y description when available', async () => {
    const mockOptions = {
      presets: {
        apply: vi.fn().mockResolvedValue('@storybook/react-vite'),
      },
    };

    const description = await getToolDescription({
      origin: 'http://localhost:6006',
      options: mockOptions as any,
      disableTelemetry: true,
      a11yEnabled: true,
      toolsets: {
        dev: true,
        docs: true,
        test: true,
      },
    });

    expect(description).toContain('- You run or fix story tests or accessibility violations.');
    expect(description).toContain('run story tests, and publish a review');
  });

  it('should exclude testing and a11y description when test toolset is disabled', async () => {
    const mockOptions = {
      presets: {
        apply: vi.fn().mockResolvedValue('@storybook/react-vite'),
      },
    };

    const description = await getToolDescription({
      origin: 'http://localhost:6006',
      options: mockOptions as any,
      disableTelemetry: true,
      a11yEnabled: true,
      toolsets: {
        dev: true,
        docs: true,
        test: false,
      },
    });

    expect(description).not.toContain('story tests');
    expect(description).not.toContain('accessibility');
  });

  it('promises the component lookup only when the docs tools are available', () => {
    const description = (docsEnabled: boolean) =>
      getStorybookStoryInstructionsDescription({
        testSupported: true,
        a11yAvailable: false,
        docsEnabled,
      });

    expect(description(true)).toContain('look up the components to reuse');
    expect(description(false)).not.toContain('look up the components');
  });

  it('should include testing but exclude a11y description when a11y is disabled', async () => {
    const mockOptions = {
      presets: {
        apply: vi.fn().mockResolvedValue('@storybook/react-vite'),
      },
    };

    const description = await getToolDescription({
      origin: 'http://localhost:6006',
      options: mockOptions as any,
      disableTelemetry: true,
      a11yEnabled: false,
      toolsets: {
        dev: true,
        docs: true,
        test: true,
      },
    });

    expect(description).toContain('- You run or fix story tests.');
    expect(description).not.toContain('accessibility');
  });

  it('returns the ui-workflow skill with the MCP tool names', async () => {
    const mockOptions = {
      presets: {
        apply: vi.fn(async (presetName: string) => {
          if (presetName === 'framework') return '@storybook/react-vite';
          return undefined;
        }),
      },
    };

    const testContext: AddonContext = {
      origin: 'http://localhost:6006',
      options: mockOptions as any,
      disableTelemetry: true,
    };

    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
        arguments: {},
      },
    };

    const response = await server.receive(request, {
      sessionId: 'test-session',
      custom: testContext,
    });

    const instructions = response.result?.content[0].text as string;

    expect(instructions).toContain('# Storybook UI workflow');
    expect(instructions).toContain(`\`${PREVIEW_STORIES_TOOL_NAME}\``);
    expect(instructions).toContain('Call `review-create` with:');
    expect(instructions).not.toContain('npx storybook tools');
  });

  // The story-instructions output is the one channel every agent reads before
  // writing UI and is never truncated by MCP clients, so it must carry the
  // component lookup whenever the documentation tools are registered.
  it('includes the component lookup when the docs tools are available', async () => {
    const mockOptions = {
      presets: {
        apply: vi.fn(async (presetName: string) => {
          if (presetName === 'framework') return '@storybook/react-vite';
          return undefined;
        }),
      },
    };

    const instructions = await buildStorybookStoryInstructions(mockOptions as any, {
      docsEnabled: true,
    });

    expect(instructions).toContain('## Look up components first');
    expect(instructions).toContain('call `docs-list` once');
    expect(instructions).toContain('`docs-show` with an `id`');
    expect(instructions).toContain('`storybookId: "acme"`');
  });

  it('omits the component lookup when the docs toolset is disabled', async () => {
    const mockOptions = {
      presets: {
        apply: vi.fn(async (presetName: string) => {
          if (presetName === 'framework') return '@storybook/react-vite';
          return undefined;
        }),
      },
    };

    const instructions = await buildStorybookStoryInstructions(mockOptions as any, {
      docsEnabled: true,
      toolsets: { dev: true, docs: false, test: true },
    });

    expect(instructions).not.toContain('## Look up components first');
  });

  // Regression: the story-instructions output must agree with the server
  // instructions about how to end after a review.
  it('tells the agent to end with the review lines and nothing else', async () => {
    const mockOptions = {
      presets: {
        apply: vi.fn(async (presetName: string) => {
          if (presetName === 'framework') return '@storybook/react-vite';
          return undefined;
        }),
      },
    };

    const response = await server.receive(
      {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: { name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME, arguments: {} },
      },
      {
        sessionId: 'test-session',
        custom: {
          origin: 'http://localhost:6006',
          options: mockOptions as any,
          disableTelemetry: true,
        },
      }
    );

    const instructions = response.result?.content[0].text as string;

    expect(instructions).toContain(
      'end your answer with the three lines of the review section it gives you, unchanged'
    );
    expect(instructions).toContain('Do not list separate story links next to it');
  });

  it('should collect telemetry when enabled', async () => {
    const { telemetry } = await import('storybook/internal/telemetry');

    const mockOptions = {
      presets: {
        apply: vi.fn().mockResolvedValue('@storybook/react-vite'),
      },
    };

    const testContext: AddonContext = {
      origin: 'http://localhost:6006',
      options: mockOptions as any,
      disableTelemetry: false,
    };

    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
        arguments: {},
      },
    };

    await server.receive(request, {
      sessionId: 'test-session',
      custom: testContext,
    });

    expect(telemetry).toHaveBeenCalledWith(
      'addon-mcp',
      expect.objectContaining({
        event: 'tool:getUIBuildingInstructions',
        mcpSessionId: 'test-session',
        toolset: 'dev',
      })
    );
  });

  it('should handle missing options in context', async () => {
    const testContext = {
      origin: 'http://localhost:6006',
      disableTelemetry: true,
    } as any;

    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: {
        name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
        arguments: {},
      },
    };

    const response = await server.receive(request, {
      sessionId: 'test-session',
      custom: testContext,
    });

    expect(response.result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error: Options are required in addon context',
        },
      ],
      isError: true,
    });
  });

  it('carries the docs steering exactly when the docs tools are available', async () => {
    const mockOptions = {
      presets: {
        apply: vi.fn(async (presetName: string) =>
          presetName === 'framework' ? '@storybook/react-vite' : undefined
        ),
      },
    } as any;

    const withDocs = await buildStorybookStoryInstructions(mockOptions, { docsEnabled: true });
    expect(withDocs).toContain('## Look up components first');
    expect(withDocs).toContain('docs-list');

    // Without the docs manifest the tools are not registered, so the
    // instructions must not tell agents to call them.
    const withoutDocs = await buildStorybookStoryInstructions(mockOptions, {
      docsEnabled: false,
    });
    expect(withoutDocs).not.toContain('## Look up components first');
    expect(withoutDocs).not.toContain('docs-list');
  });
});
