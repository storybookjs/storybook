import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { addGetChangedStoriesTool } from './get-changed-stories.ts';
import type { AddonContext } from '../types.ts';
import * as getStoryIndexModule from '../utils/get-story-index.ts';
import smallStoryIndexFixture from '../../fixtures/small-story-index.fixture.json' with { type: 'json' };
import { GET_CHANGED_STORIES_TOOL_NAME } from './tool-names.ts';
import type { StoryIndex } from 'storybook/internal/types';

const { mockGetStatusStore, mockGetService, mockExecSync } = vi.hoisted(() => ({
  mockGetStatusStore: vi.fn<(...args: any[]) => any>(),
  // Resolves the `core/module-graph` open service. Defaults to "service inactive"
  // (returns undefined); tests exercising the unreachable-files path override it
  // with `mockGetService.mockReturnValue(moduleGraphStub(...))`.
  mockGetService: vi.fn<(...args: any[]) => any>(),
  // Hoisted because node:child_process is loaded inside
  // detect-unreachable-changes.ts at module-eval time; ESM forbids
  // retroactive vi.spyOn.
  mockExecSync: vi.fn<(...args: any[]) => any>(),
}));

vi.mock('storybook/internal/core-server', () => ({
  experimental_getStatusStore: (...args: unknown[]) => mockGetStatusStore(...args),
  // `get-changed-stories` resolves this via `detectUnreachableChanges` to surface
  // modified working-tree files that aren't reached from any story file.
  getService: (...args: unknown[]) => mockGetService(...args),
}));

/**
 * Builds a `core/module-graph` runtime stub. `storiesForFiles` maps the batched input files to
 * positional hit lists — an empty list marks a file as unreachable from every story.
 */
function moduleGraphStub(storiesForFiles: (files: string[]) => Array<Array<unknown>>) {
  return {
    queries: {
      status: { loaded: async () => ({ value: 'ready' as const }) },
      storiesForFiles: {
        loaded: async ({ files }: { files: string[] }) => storiesForFiles(files),
      },
    },
  };
}

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return { ...actual, execSync: (...args: unknown[]) => mockExecSync(...(args as [])) };
});

describe('getChangedStoriesTool', () => {
  let server: McpServer<any, AddonContext>;
  const testContext: AddonContext = {
    origin: 'http://localhost:6006',
    options: {} as AddonContext['options'],
    disableTelemetry: true,
  };

  beforeEach(async () => {
    mockGetStatusStore.mockReset();
    mockGetService.mockReset();
    mockGetService.mockReturnValue(undefined);
    mockExecSync.mockReset();
    mockExecSync.mockReturnValue('');
    const adapter = new ValibotJsonSchemaAdapter();
    server = new McpServer(
      {
        name: 'test-server',
        version: '1.0.0',
        description: 'Test server for get-changed-stories tool',
      },
      {
        adapter,
        capabilities: {
          tools: { listChanged: true },
        },
      }
    ).withContext<AddonContext>();

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

    await addGetChangedStoriesTool(server);
    vi.spyOn(getStoryIndexModule, 'getStoryIndex').mockResolvedValue(
      smallStoryIndexFixture as unknown as StoryIndex
    );
  });

  async function callTool() {
    return server.receive(
      {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: {
          name: GET_CHANGED_STORIES_TOOL_NAME,
          arguments: {},
        },
      },
      {
        sessionId: 'test-session',
        custom: testContext,
      }
    );
  }

  function getResultText(response: unknown): string {
    if (!response || typeof response !== 'object') return '';
    const result = (response as { result?: { content?: Array<{ text?: string }> } }).result;
    return result?.content?.[0]?.text ?? '';
  }

  it('returns grouped markdown text with changed story metadata', async () => {
    mockGetStatusStore.mockReturnValue({
      getAll: () => ({
        'button--primary': {
          'storybook/change-detection': {
            value: 'status-value:new',
            storyId: 'button--primary',
          },
        },
        'button--secondary': {
          'storybook/change-detection': {
            value: 'status-value:modified',
            storyId: 'button--secondary',
          },
        },
        'input--default': {
          'storybook/change-detection': {
            value: 'status-value:affected',
            storyId: 'input--default',
          },
        },
      }),
    });

    const response = await callTool();
    const text = getResultText(response);

    expect(getStoryIndexModule.getStoryIndex).toHaveBeenCalledWith(testContext.options);
    expect(text).toMatchInlineSnapshot(`
			"Detected 3 changed stories (1 new, 1 modified, 1 related).

			New stories:
			- \`button--primary\`: Button / Primary (\`./src/Button.stories.tsx\`)

			Modified stories:
			- \`button--secondary\`: Button / Secondary (\`./src/Button.stories.tsx\`)

			Related stories:
			- \`input--default\`: Input / Default (\`./src/Input.stories.tsx\`)"
		`);
  });

  it('filters out unsupported status values', async () => {
    mockGetStatusStore.mockReturnValue({
      getAll: () => ({
        'button--primary': {
          'storybook/change-detection': {
            value: 'status-value:new',
            storyId: 'button--primary',
          },
        },
        'button--secondary': {
          'storybook/change-detection': {
            value: 'status-value:success',
            storyId: 'button--secondary',
          },
        },
      }),
    });

    const response = await callTool();
    const text = getResultText(response);

    expect(text).toMatchInlineSnapshot(`
			"Detected 1 changed story (1 new, 0 modified, 0 related).

			New stories:
			- \`button--primary\`: Button / Primary (\`./src/Button.stories.tsx\`)"
		`);
  });

  it('groups by new, modified, related, then sorts by storyId', async () => {
    mockGetStatusStore.mockReturnValue({
      getAll: () => ({
        'input--default': {
          'storybook/change-detection': {
            value: 'status-value:affected',
            storyId: 'input--default',
          },
        },
        'button--secondary': {
          'storybook/change-detection': {
            value: 'status-value:new',
            storyId: 'button--secondary',
          },
        },
        'button--primary': {
          'storybook/change-detection': {
            value: 'status-value:new',
            storyId: 'button--primary',
          },
        },
      }),
    });

    const response = await callTool();
    const text = getResultText(response);

    expect(text).toMatchInlineSnapshot(`
			"Detected 3 changed stories (2 new, 0 modified, 1 related).

			New stories:
			- \`button--primary\`: Button / Primary (\`./src/Button.stories.tsx\`)
			- \`button--secondary\`: Button / Secondary (\`./src/Button.stories.tsx\`)

			Related stories:
			- \`input--default\`: Input / Default (\`./src/Input.stories.tsx\`)"
		`);
  });

  // Registers the tool on a fresh server with the review feature enabled, so
  // the "publish the review now" next-step hint paths can be exercised.
  async function createReviewEnabledServer() {
    const adapter = new ValibotJsonSchemaAdapter();
    const reviewServer = new McpServer(
      {
        name: 'test-server-review',
        version: '1.0.0',
        description: 'Test server for get-changed-stories with review enabled',
      },
      { adapter, capabilities: { tools: { listChanged: true } } }
    ).withContext<AddonContext>();

    await reviewServer.receive(
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

    await addGetChangedStoriesTool(reviewServer, undefined, { reviewEnabled: true });
    return reviewServer;
  }

  async function callToolOn(targetServer: McpServer<any, AddonContext>) {
    return targetServer.receive(
      {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: { name: GET_CHANGED_STORIES_TOOL_NAME, arguments: {} },
      },
      { sessionId: 'test-session', custom: testContext }
    );
  }

  it('appends the display-review next-step hint when review is enabled and stories were detected', async () => {
    mockGetStatusStore.mockReturnValue({
      getAll: () => ({
        'button--primary': {
          'storybook/change-detection': {
            value: 'status-value:new',
            storyId: 'button--primary',
          },
        },
      }),
    });

    const text = getResultText(await callToolOn(await createReviewEnabledServer()));

    expect(text).toContain('Detected 1 changed story');
    expect(text).toContain('publish the review now — call **display-review**');
  });

  it('omits the display-review hint when review is enabled but no stories resolve', async () => {
    // Status store entries that don't exist in the index resolve to zero
    // stories — exactly the case where the agent should fall back to
    // get-stories-by-component instead of being pointed at an empty list.
    mockGetStatusStore.mockReturnValue({
      getAll: () => ({
        'not-in-index--at-all': {
          'storybook/change-detection': {
            value: 'status-value:new',
            storyId: 'not-in-index--at-all',
          },
        },
      }),
    });

    const text = getResultText(await callToolOn(await createReviewEnabledServer()));

    expect(text).toContain('Detected 0 changed stories');
    expect(text).not.toContain('publish the review now');
  });

  it('omits the display-review hint when review is disabled', async () => {
    mockGetStatusStore.mockReturnValue({
      getAll: () => ({
        'button--primary': {
          'storybook/change-detection': {
            value: 'status-value:new',
            storyId: 'button--primary',
          },
        },
      }),
    });

    const text = getResultText(await callTool());

    expect(text).toContain('Detected 1 changed story');
    expect(text).not.toContain('publish the review now');
  });

  it('supports getAll() status-store API', async () => {
    mockGetStatusStore.mockReturnValue({
      getAll: () => ({
        'button--primary': {
          'storybook/change-detection': {
            value: 'status-value:new',
            storyId: 'button--primary',
          },
        },
      }),
    });

    const response = await callTool();
    const text = getResultText(response);

    expect(text).toContain('Detected 1 changed story (1 new, 0 modified, 0 related).');
    expect(text).toContain('- `button--primary`: Button / Primary (`./src/Button.stories.tsx`)');
  });

  it('supports getAll() for modified stories', async () => {
    mockGetStatusStore.mockReturnValue({
      getAll: () => ({
        'button--secondary': {
          'storybook/change-detection': {
            value: 'status-value:modified',
            storyId: 'button--secondary',
          },
        },
      }),
    });

    const response = await callTool();
    const text = getResultText(response);

    expect(text).toContain('Detected 1 changed story (0 new, 1 modified, 0 related).');
    expect(text).toContain(
      '- `button--secondary`: Button / Secondary (`./src/Button.stories.tsx`)'
    );
  });

  it('omits changed stories that are not in the index', async () => {
    mockGetStatusStore.mockReturnValue({
      getAll: () => ({
        'missing--story': {
          'storybook/change-detection': {
            value: 'status-value:modified',
            storyId: 'missing--story',
          },
        },
      }),
    });

    const response = await callTool();
    const text = getResultText(response);

    expect(text).toMatchInlineSnapshot(
      `"Detected 0 changed stories (0 new, 0 modified, 0 related)."`
    );
  });

  it('returns an MCP error when status store cannot be read', async () => {
    mockGetStatusStore.mockReturnValue({});

    const response = await server.receive(
      {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: { name: GET_CHANGED_STORIES_TOOL_NAME, arguments: {} },
      },
      { sessionId: 'test-session', custom: testContext }
    );

    expect(response.result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error: statusStore.getAll is not a function',
        },
      ],
      isError: true,
    });
  });

  it('returns early without fetching index when there are no relevant changed statuses', async () => {
    mockGetStatusStore.mockReturnValue({
      getAll: () => ({
        'button--primary': {
          'storybook/change-detection': {
            value: 'status-value:success',
            storyId: 'button--primary',
          },
        },
      }),
    });

    const callCountBefore = vi.mocked(getStoryIndexModule.getStoryIndex).mock.calls.length;
    const response = await callTool();
    const text = getResultText(response);

    expect(text).toBe('No new, modified, or related stories detected.');
    expect(vi.mocked(getStoryIndexModule.getStoryIndex).mock.calls.length).toBe(callCountBefore);
  });

  it('appends an unreachable-files hint to the empty response when the working tree has uncommitted source files outside the story graph', async () => {
    // The "theme-token edit" case: the agent changed a file that isn't
    // reached from any story root, so the status store is empty. Without
    // this hint the agent reads "no impact" and stops — the original
    // hallucination this whole feature exists to prevent.
    mockGetStatusStore.mockReturnValue({ getAll: () => ({}) });
    // theme.ts is modified but no story file imports it.
    mockGetService.mockReturnValue(moduleGraphStub((files) => files.map(() => [])));
    mockExecSync.mockReturnValue(' M src/styles/theme.ts\n');

    const response = await callTool();
    const text = getResultText(response);

    expect(text).toContain('No new, modified, or related stories detected.');
    expect(text).toContain('src/styles/theme.ts');
    expect(text).toMatch(/unreachable/i);
    expect(text).toContain('get-stories-by-component');
  });

  it('front-loads a coverage-gap banner AND appends a sanity-check hint when results coexist with unreachable working-tree files', async () => {
    // Belt-and-braces: long story lists (Chromatic-scale) can run past
    // host-side tool-output truncation caps, dropping the trailing hint.
    // The leading banner is the short, survivable salience aid; the tail
    // hint stays for agents that read in full.
    mockGetStatusStore.mockReturnValue({
      getAll: () => ({
        'button--primary': {
          'storybook/change-detection': {
            value: 'status-value:modified',
            storyId: 'button--primary',
          },
        },
      }),
    });
    mockGetService.mockReturnValue(moduleGraphStub((files) => files.map(() => [])));
    mockExecSync.mockReturnValue(' M .storybook/main.ts\n M src/server.ts\n');

    const response = await callTool();
    const text = getResultText(response);

    const bannerIdx = text.indexOf('Coverage gap');
    const headlineIdx = text.indexOf('Detected');
    expect(bannerIdx).toBeGreaterThanOrEqual(0);
    expect(bannerIdx).toBeLessThan(headlineIdx);
    expect(text).toContain('.storybook/main.ts');
    expect(text).toContain('src/server.ts');
    // And the long-form sanity-check hint still trails the bullet list,
    // so agents that read in full get the explanatory paragraph.
    expect(text).toMatch(/coverage sanity check/i);
  });

  it('omits both callouts when nothing in the working tree is unreachable', async () => {
    mockGetStatusStore.mockReturnValue({
      getAll: () => ({
        'button--primary': {
          'storybook/change-detection': {
            value: 'status-value:modified',
            storyId: 'button--primary',
          },
        },
      }),
    });
    // Every modified file IS in the graph — no unreachable callout fires.
    mockGetService.mockReturnValue(
      moduleGraphStub((files) =>
        files.map(() => [{ storyFile: './src/Button.stories.tsx', depth: 1 }])
      )
    );
    mockExecSync.mockReturnValue(' M src/Button.tsx\n');

    const response = await callTool();
    const text = getResultText(response);

    expect(text).not.toContain('Coverage gap');
    expect(text).not.toMatch(/coverage sanity check/i);
    expect(text.startsWith('Detected')).toBe(true);
  });
});
