import { logger } from 'storybook/internal/node-logger';
import { OpenServiceModuleGraphUnavailableError } from 'storybook/internal/server-errors';
import { clearToolsetRegistry, defineToolset, registerToolset } from 'storybook/open-service';
import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getService } from 'storybook/internal/core-server';

import { collectTelemetry } from '../telemetry.ts';
import { callToolsetMethod, getToolsetToolMetadata } from './toolset-tools.ts';

vi.mock('storybook/internal/core-server', { spy: true });
vi.mock('../telemetry.ts', { spy: true });

/**
 * Stands in for the real `stories` toolset so these tests assert the adapter's contract — what an
 * MCP client sees — rather than any one method's behaviour.
 */
function registerStubStoriesToolset(
  overrides: {
    handler?: (input: any, ctx: any) => any;
  } = {}
) {
  registerToolset(
    defineToolset({
      id: 'stories',
      description: 'stub',
      methods: {
        preview: {
          input: v.object({ id: v.string() }),
          output: v.object({ stories: v.array(v.object({ previewUrl: v.string() })) }),
          title: 'Get story preview URLs',
          description: (ctx) => `describes ${ctx.transport}`,
          handler:
            overrides.handler ??
            (async (input: { id: string }, ctx) => {
              await ctx.telemetry?.('tool:previewStories', {
                toolset: 'dev',
                inputStoryCount: 1,
              });
              const stories = [{ previewUrl: `${ctx.origin}/?path=/story/${input.id}` }];
              return {
                ok: true,
                data: { stories, extraNotInContract: 'internal' },
                markdown: stories.map((story) => story.previewUrl).join('\n'),
              };
            }),
        },
      },
    }) as any
  );
}

function makeServer(custom: Record<string, unknown> = {}) {
  return {
    ctx: { custom: { origin: 'http://localhost:6006', ...custom }, sessionId: 'session-1' },
  } as any;
}

const previewOptions = { method: 'stories.preview' } as const;

describe('toolset-backed MCP tools', () => {
  beforeEach(() => {
    clearToolsetRegistry();
    vi.mocked(getService).mockImplementation(() => undefined as never);
    vi.mocked(collectTelemetry).mockResolvedValue(undefined);
    vi.mocked(collectTelemetry).mockClear();
    vi.mocked(logger.error).mockClear();
  });

  afterEach(() => {
    clearToolsetRegistry();
  });

  it('publishes the derived tool name and title with the MCP-resolved description', () => {
    registerStubStoriesToolset();

    const metadata = getToolsetToolMetadata(previewOptions);

    expect(metadata.name).toBe('stories-preview');
    expect(metadata.title).toBe('Get story preview URLs');
    expect(metadata.description).toBe('describes mcp');
  });

  it('ships the outcome markdown and narrows structuredContent to the published output schema', async () => {
    registerStubStoriesToolset();

    const result = await callToolsetMethod(makeServer(), previewOptions, { id: 'button--primary' });

    expect(result.content).toEqual([
      { type: 'text', text: 'http://localhost:6006/?path=/story/button--primary' },
    ]);
    expect(result.structuredContent).toEqual({
      stories: [{ previewUrl: 'http://localhost:6006/?path=/story/button--primary' }],
    });
    expect(result.isError).toBeUndefined();
  });

  it('maps a failure outcome to an MCP error result that still carries the markdown', async () => {
    registerStubStoriesToolset({
      handler: async () => ({
        ok: false,
        data: { stories: [] },
        markdown: 'Component or Docs Entry not found: "nope".',
      }),
    });

    const result = await callToolsetMethod(makeServer(), previewOptions, { id: 'nope' });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: 'Component or Docs Entry not found: "nope".' },
    ]);
  });

  it('renders one text block per markdown entry', async () => {
    registerStubStoriesToolset({
      handler: async () => ({
        ok: true,
        data: { stories: [] },
        markdown: ['http://localhost:6006/one', 'http://localhost:6006/two'],
      }),
    });

    const result = await callToolsetMethod(makeServer(), previewOptions, { id: 'x' });

    expect(result.content).toEqual([
      { type: 'text', text: 'http://localhost:6006/one' },
      { type: 'text', text: 'http://localhost:6006/two' },
    ]);
  });

  it('omits structuredContent when the method publishes no output schema', async () => {
    registerToolset(
      defineToolset({
        id: 'stories',
        description: 'stub',
        methods: {
          changed: {
            input: v.object({}),
            title: 'Get changed stories metadata',
            description: 'changed',
            handler: async () => ({ ok: true, data: { stories: [] }, markdown: 'no changes' }),
          },
        },
      }) as any
    );

    const result = await callToolsetMethod(makeServer(), { method: 'stories.changed' }, {});

    expect(result.content).toEqual([{ type: 'text', text: 'no changes' }]);
    expect(result.structuredContent).toBeUndefined();
  });

  it('runs the handler once, so a method with side effects cannot double-publish', async () => {
    const handler = vi.fn(async () => ({
      ok: true,
      data: { stories: [{ previewUrl: 'http://localhost:6006/' }] },
      markdown: 'http://localhost:6006/',
    }));
    registerStubStoriesToolset({ handler });

    await callToolsetMethod(makeServer(), previewOptions, { id: 'button--primary' });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('surfaces an unavailable module graph verbatim, without the generic error prefix', async () => {
    registerStubStoriesToolset({
      handler: () => {
        throw new OpenServiceModuleGraphUnavailableError({
          reason:
            "Storybook's story module graph hasn't built yet — it is still being constructed.",
        });
      },
    });

    const result = await callToolsetMethod(makeServer(), previewOptions, { id: 'x' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(
      "Storybook's story module graph hasn't built yet — it is still being constructed."
    );
  });

  it('selects verbatim surfacing by the agentFacing trait, not an adapter class list', async () => {
    // Any error instance carrying the trait qualifies — including one from a different bundle
    // copy of a class, which is exactly when an instanceof list would misclassify it.
    const traitError = Object.assign(new Error('Do X, then retry the tool.'), {
      agentFacing: true,
    });
    registerStubStoriesToolset({
      handler: () => {
        throw traitError;
      },
    });

    const result = await callToolsetMethod(makeServer(), previewOptions, { id: 'x' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Do X, then retry the tool.');
    // A designed answer for the agent is not an incident for the maintainer.
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('wraps every other failure as an error result and logs it server-side', async () => {
    registerStubStoriesToolset({
      handler: () => {
        throw new Error('boom');
      },
    });

    const result = await callToolsetMethod(makeServer(), previewOptions, { id: 'x' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error: boom');
    // Without the log, the only evidence of a bug would be the calling agent's transcript.
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.error).mock.calls[0][0]).toContain('boom');
  });

  it('forwards method telemetry with the surface fields the adapter owns', async () => {
    registerStubStoriesToolset();

    await callToolsetMethod(makeServer(), previewOptions, { id: 'button--primary' });

    expect(collectTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'tool:previewStories',
        toolset: 'dev',
        inputStoryCount: 1,
      })
    );
  });

  it('emits no telemetry when the session disabled it', async () => {
    registerStubStoriesToolset();

    await callToolsetMethod(makeServer({ disableTelemetry: true }), previewOptions, {
      id: 'button--primary',
    });

    expect(collectTelemetry).not.toHaveBeenCalled();
  });

  it('includes the request subpath in the toolset origin', async () => {
    registerStubStoriesToolset({
      handler: async (_input, ctx) => ({ ok: true, data: { stories: [] }, markdown: ctx.origin }),
    });

    const result = await callToolsetMethod(
      makeServer({
        endpoint: '/mcp',
        request: new Request('http://localhost:6006/nested/mcp', { method: 'POST' }),
      }),
      previewOptions,
      { id: 'button--primary' }
    );

    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'http://localhost:6006/nested',
    });
  });
});
