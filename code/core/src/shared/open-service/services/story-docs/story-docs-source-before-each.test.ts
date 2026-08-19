import { SourceType } from 'storybook/internal/docs-tools';
import type { StoryContext } from 'storybook/internal/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emitTransformCode, getService } from 'storybook/preview-api';

import type { StoryDocsService } from './definition.ts';
import { prependImportToSnippet, selectSnippetForStory } from './snippet.ts';
import {
  shouldSkipStoryDocsEmit,
  storyDocsSourceBeforeEach,
} from './story-docs-source-before-each.ts';
import type { StoryDocsPayload } from './types.ts';

vi.mock('storybook/preview-api', { spy: true });

const mockedEmitTransformCode = vi.mocked(emitTransformCode);
const mockedGetService = vi.mocked(getService);

const storyId = 'button--primary';
const payload: StoryDocsPayload = {
  id: 'button',
  name: 'Button',
  path: './Button.stories.tsx',
  import: "import { Button } from './Button';",
  stories: {
    [storyId]: {
      id: storyId,
      name: 'Primary',
      snippet: '<Button label="hi" />',
    },
  },
};
const serviceSnippet = 'import { Button } from \'./Button\';\n\n<Button label="hi" />';

/** Builds a minimal `core/story-docs` service mock whose `storyDocs.loaded` returns `loaded`. */
function mockStoryDocsService(loaded: () => Promise<StoryDocsPayload>) {
  mockedGetService.mockReturnValue({
    queries: {
      storyDocs: Object.assign(() => payload, { loaded }),
    },
  } as unknown as StoryDocsService);
}

describe('snippet helpers', () => {
  it('prepends import blocks', () => {
    expect(prependImportToSnippet("import { X } from './X';", '<X />')).toBe(
      "import { X } from './X';\n\n<X />"
    );
  });

  it('selects a story snippet with its import block from a payload', () => {
    expect(selectSnippetForStory(payload, storyId)).toBe(serviceSnippet);
  });
});

describe('shouldSkipStoryDocsEmit', () => {
  it('skips when source code is provided', () => {
    expect(
      shouldSkipStoryDocsEmit({
        __isArgsStory: true,
        docs: { source: { code: 'const x = 1;' } },
      })
    ).toBe(true);
  });

  it('skips when source type is CODE', () => {
    expect(
      shouldSkipStoryDocsEmit({
        __isArgsStory: true,
        docs: { source: { type: SourceType.CODE } },
      })
    ).toBe(true);
  });

  it('does not skip for args stories with DYNAMIC source type', () => {
    expect(
      shouldSkipStoryDocsEmit({
        __isArgsStory: true,
        docs: { source: { type: SourceType.DYNAMIC } },
      })
    ).toBe(false);
  });
});

describe('storyDocsSourceBeforeEach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
    mockedEmitTransformCode.mockResolvedValue(undefined);
    mockStoryDocsService(() => Promise.resolve(payload));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The renderer travels in `docs.source.renderSnippetTemplate`, which is a contract between this
  // reader and every framework that sets it. Nothing else pins the key's spelling on both sides.
  it('rebuilds the snippet with the renderer the story parameters carry', async () => {
    mockStoryDocsService(() =>
      Promise.resolve({
        ...payload,
        stories: {
          [storyId]: { ...payload.stories[storyId]!, snippetTemplate: { kind: 'test-template' } },
        },
      })
    );
    const context = {
      id: storyId,
      unmappedArgs: { label: 'Live' },
      parameters: {
        __isArgsStory: true,
        docs: {
          source: {
            renderSnippetTemplate: (template: unknown, args: unknown) =>
              `${(template as { kind: string }).kind}:${JSON.stringify(args)}`,
          },
        },
      },
    } as unknown as StoryContext;

    const cleanup = storyDocsSourceBeforeEach(context);
    await vi.waitFor(() => expect(mockedEmitTransformCode).toHaveBeenCalled());

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(
      'import { Button } from \'./Button\';\n\ntest-template:{"label":"Live"}',
      context
    );
    await cleanup?.();
  });

  it("falls back to the story's own source when the payload fails to load", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockStoryDocsService(() => Promise.reject(new Error('boom')));
    const context = {
      id: storyId,
      parameters: { __isArgsStory: true, docs: { source: { originalSource: 'ORIGINAL' } } },
    } as unknown as StoryContext;

    const cleanup = storyDocsSourceBeforeEach(context);
    await vi.waitFor(() => expect(mockedEmitTransformCode).toHaveBeenCalled());

    expect(mockedEmitTransformCode).toHaveBeenCalledWith('ORIGINAL', context);
    expect(warn).toHaveBeenCalledOnce();
    await cleanup?.();
    vi.restoreAllMocks();
  });

  it('emits the service snippet through emitTransformCode', async () => {
    const context = {
      id: storyId,
      parameters: { __isArgsStory: true },
    } as unknown as StoryContext;

    const cleanup = storyDocsSourceBeforeEach(context);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(serviceSnippet, context);
    await cleanup?.();
  });

  it('does not emit for portable stories', async () => {
    const context = {
      id: storyId,
      parameters: { __isArgsStory: true, __isPortableStory: true },
    } as unknown as StoryContext;

    const cleanup = storyDocsSourceBeforeEach(context);
    await cleanup?.();

    expect(mockedGetService).not.toHaveBeenCalled();
    expect(mockedEmitTransformCode).not.toHaveBeenCalled();
  });

  it('does not emit when source code is provided', async () => {
    const context = {
      id: storyId,
      parameters: {
        __isArgsStory: true,
        docs: { source: { code: 'const x = 1;' } },
      },
    } as unknown as StoryContext;

    const cleanup = storyDocsSourceBeforeEach(context);
    await cleanup?.();

    expect(mockedEmitTransformCode).not.toHaveBeenCalled();
  });

  it('does not emit after cleanup cancels an in-flight load', async () => {
    let resolveLoaded: (value: StoryDocsPayload) => void = () => {};
    const loaded = new Promise<StoryDocsPayload>((resolve) => {
      resolveLoaded = resolve;
    });

    mockStoryDocsService(() => loaded);

    const context = {
      id: storyId,
      parameters: { __isArgsStory: true },
    } as unknown as StoryContext;

    const cleanup = storyDocsSourceBeforeEach(context);
    const cleanupDone = cleanup?.();
    resolveLoaded(payload);
    await cleanupDone;

    expect(mockedEmitTransformCode).not.toHaveBeenCalled();
  });
});
