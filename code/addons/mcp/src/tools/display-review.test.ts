import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { addDisplayReviewTool, buildReviewUrl, type ReviewState } from './display-review.ts';
import { DISPLAY_REVIEW_TOOL_NAME } from './tool-names.ts';
import { PUSH_REVIEW_EVENT } from '../constants.ts';
import type { AddonContext } from '../types.ts';
import * as getStoryIndexModule from '../utils/get-story-index.ts';
import type { StoryIndex } from 'storybook/internal/types';

function makeIndex(ids: string[]): StoryIndex {
  const entries: StoryIndex['entries'] = {};
  for (const id of ids) {
    entries[id] = {
      id,
      type: 'story',
      title: 'X',
      name: id,
      importPath: './x.stories.ts',
      tags: [],
    } as unknown as StoryIndex['entries'][string];
  }
  return { v: 5, entries } as unknown as StoryIndex;
}

const sampleReview: ReviewState = {
  title: 'Recolour the primary button',
  description: 'Button background changed from blue to green.',
  collections: [
    {
      title: 'Button',
      rationale: 'The directly changed component.',
      storyIds: ['button--primary', 'button--secondary'],
    },
    {
      title: 'Pages',
      rationale: 'Pages that render Button.',
      storyIds: ['page--home'],
    },
  ],
  changedFiles: ['src/Button.tsx'],
};

describe('buildReviewUrl', () => {
  it('falls back to origin when there is no request', () => {
    expect(buildReviewUrl({ origin: 'http://localhost:6006' })).toBe(
      'http://localhost:6006/?path=/review/'
    );
  });

  it('uses the configured endpoint to recover a proxied Storybook root', () => {
    expect(
      buildReviewUrl({
        origin: 'http://localhost:6006',
        request: new Request('https://example.com/storybook/custom-mcp'),
        endpoint: '/custom-mcp',
      })
    ).toBe('http://localhost:6006/storybook/?path=/review/');
  });

  it('does not trust request host when origin is available', () => {
    expect(
      buildReviewUrl({
        origin: 'http://localhost:6006',
        request: new Request('https://evil.example.org/prefix/mcp'),
      })
    ).toBe('http://localhost:6006/prefix/?path=/review/');
  });

  it('throws when neither request nor origin is available', () => {
    expect(() => buildReviewUrl({} as any)).toThrow(/Cannot resolve the Storybook URL/);
  });

  it('falls back to origin when the request URL is unparseable', () => {
    const badRequest = { url: '::::not a url' } as unknown as Request;
    expect(buildReviewUrl({ origin: 'http://localhost:6006', request: badRequest })).toBe(
      'http://localhost:6006/?path=/review/'
    );
  });

  it('handles a trailing slash on the request pathname', () => {
    expect(
      buildReviewUrl({
        origin: 'http://localhost:6006',
        request: new Request('https://example.com/storybook/mcp/'),
      })
    ).toBe('http://localhost:6006/storybook/?path=/review/');
  });

  it('strips a multi-segment endpoint with a trailing slash on the request', () => {
    expect(
      buildReviewUrl({
        origin: 'http://localhost:6006',
        request: new Request('https://example.com/api/mcp/'),
        endpoint: '/api/mcp',
      })
    ).toBe('http://localhost:6006/?path=/review/');
  });
});

describe('displayReviewTool', () => {
  let server: McpServer<any, AddonContext>;
  let emitted: Array<{ event: string; payload: unknown }>;

  function makeContext(overrides: Partial<AddonContext> = {}): AddonContext {
    return {
      origin: 'http://localhost:6006',
      options: {
        channel: {
          emit: (event: string, payload: unknown) => emitted.push({ event, payload }),
        },
      } as unknown as AddonContext['options'],
      disableTelemetry: true,
      ...overrides,
    };
  }

  beforeEach(async () => {
    emitted = [];
    // Default: every story ID used in the sampleReview resolves. Individual
    // tests override this to exercise the validation path.
    vi.spyOn(getStoryIndexModule, 'getStoryIndex').mockResolvedValue(
      makeIndex(['button--primary', 'button--secondary', 'page--home'])
    );
    const adapter = new ValibotJsonSchemaAdapter();
    server = new McpServer(
      {
        name: 'test-server',
        version: '1.0.0',
        description: 'Test server for display-review tool',
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
      { sessionId: 'test-session' }
    );

    await addDisplayReviewTool(server);
  });

  async function callTool(args: ReviewState, custom: AddonContext) {
    return server.receive(
      {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/call',
        params: { name: DISPLAY_REVIEW_TOOL_NAME, arguments: args },
      },
      { sessionId: 'test-session', custom }
    );
  }

  function getResult(response: unknown) {
    return (
      response as {
        result?: {
          content?: Array<{ text?: string }>;
          structuredContent?: { reviewUrl?: string };
          isError?: boolean;
        };
      }
    ).result;
  }

  it('returns the review URL and a human summary', async () => {
    const response = await callTool(sampleReview, makeContext());
    const result = getResult(response);

    expect(result?.isError).toBeFalsy();
    expect(result?.structuredContent?.reviewUrl).toBe('http://localhost:6006/?path=/review/');
    expect(result?.content?.[0]?.text).toContain('2 collections, 3 stories');
    expect(result?.content?.[0]?.text).toContain('http://localhost:6006/?path=/review/');
  });

  it('uses singular nouns for a single collection and story', async () => {
    const response = await callTool(
      {
        title: 'Single',
        description: 'One collection, one story',
        collections: [
          {
            title: 'Button',
            rationale: 'Just the primary button',
            storyIds: ['button--primary'],
          },
        ],
        changedFiles: [],
      },
      makeContext()
    );
    const result = getResult(response);

    expect(result?.isError).toBeFalsy();
    expect(result?.content?.[0]?.text).toContain('1 collection, 1 story');
    expect(result?.content?.[0]?.text).not.toContain('1 collections');
    expect(result?.content?.[0]?.text).not.toContain('1 stories');
  });

  it('rejects a payload without changedFiles (pass [] for browse requests)', async () => {
    const payloadWithoutChangedFiles = {
      title: 'Missing changed files',
      description: 'Payload without changedFiles must fail validation',
      collections: [
        {
          title: 'Button',
          rationale: 'Just the primary button',
          storyIds: ['button--primary'],
        },
      ],
    } as unknown as ReviewState;
    const response = await callTool(payloadWithoutChangedFiles, makeContext());
    const result = getResult(response);

    expect(result?.isError).toBe(true);
    expect(JSON.stringify(result)).toContain('changedFiles');
  });

  it('hands the payload off to addon-review via the PUSH_REVIEW channel event', async () => {
    await callTool(sampleReview, makeContext());
    expect(emitted).toEqual([{ event: PUSH_REVIEW_EVENT, payload: sampleReview }]);
  });

  it('builds a subpath-aware review URL from the incoming request', async () => {
    const response = await callTool(
      sampleReview,
      makeContext({ request: new Request('https://sb.example.com/design-system/mcp') })
    );
    const result = getResult(response);

    expect(result?.structuredContent?.reviewUrl).toBe(
      'http://localhost:6006/design-system/?path=/review/'
    );
  });

  it('returns an MCP error when origin is missing from the addon context', async () => {
    const response = await callTool(sampleReview, {
      // Intentionally omit `origin` to exercise the error path.
      options: {} as unknown as AddonContext['options'],
      disableTelemetry: true,
    } as AddonContext);
    const result = getResult(response);

    expect(result?.isError).toBe(true);
    expect(result?.content?.[0]?.text).toMatch(/Cannot resolve the Storybook URL/);
    expect(emitted).toEqual([]);
  });

  describe('story ID validation', () => {
    it('rejects the whole review when any story ID is not in the live index', async () => {
      // Two real IDs, two fabricated ones — the agent invented the
      // "--default" exports based on naming conventions.
      vi.spyOn(getStoryIndexModule, 'getStoryIndex').mockResolvedValue(
        makeIndex(['button--primary', 'page--home'])
      );
      const reviewWithFakes: ReviewState = {
        ...sampleReview,
        collections: [
          {
            title: 'Button',
            rationale: 'Real ID.',
            storyIds: ['button--primary'],
          },
          {
            title: 'Sidebar',
            rationale: 'Fabricated.',
            storyIds: ['components-sidebar--default', 'components-modal--default'],
          },
          {
            title: 'Pages',
            rationale: 'Real ID.',
            storyIds: ['page--home'],
          },
        ],
      };
      const response = await callTool(reviewWithFakes, makeContext());
      const result = getResult(response);

      expect(result?.isError).toBe(true);
      expect(result?.content?.[0]?.text).toContain('Refusing to publish review');
      expect(result?.content?.[0]?.text).toContain('components-sidebar--default');
      expect(result?.content?.[0]?.text).toContain('components-modal--default');
      expect(result?.content?.[0]?.text).toContain('get-stories-by-component');
      // Crucially, the channel emit must not have run — we don't want a
      // partially-broken review to land on the review page.
      expect(emitted).toEqual([]);
    });

    it('lists each unknown ID only once even if reused across collections', async () => {
      vi.spyOn(getStoryIndexModule, 'getStoryIndex').mockResolvedValue(makeIndex([]));
      const review: ReviewState = {
        ...sampleReview,
        collections: [
          { title: 'A', rationale: '.', storyIds: ['fake--one', 'fake--two'] },
          { title: 'B', rationale: '.', storyIds: ['fake--one'] },
        ],
      };
      const response = await callTool(review, makeContext());
      const text = getResult(response)?.content?.[0]?.text ?? '';

      // `fake--one` appears once in the listing (it's in a backtick-bullet
      // like "- `fake--one`"), not twice.
      const occurrences = text.match(/`fake--one`/g)?.length ?? 0;
      expect(occurrences).toBe(1);
      expect(text).toContain('`fake--two`');
    });

    it('publishes normally when every ID resolves', async () => {
      const response = await callTool(sampleReview, makeContext());
      const result = getResult(response);

      expect(result?.isError).toBeFalsy();
      expect(emitted).toEqual([{ event: PUSH_REVIEW_EVENT, payload: sampleReview }]);
    });

    it('skips the index fetch when there are no story IDs to validate', async () => {
      const fetchSpy = vi.spyOn(getStoryIndexModule, 'getStoryIndex');
      const callCountBefore = fetchSpy.mock.calls.length;
      const emptyReview: ReviewState = {
        ...sampleReview,
        collections: [{ title: 'Empty', rationale: '.', storyIds: [] }],
      };
      await callTool(emptyReview, makeContext());
      expect(fetchSpy.mock.calls.length).toBe(callCountBefore);
    });
  });
});
