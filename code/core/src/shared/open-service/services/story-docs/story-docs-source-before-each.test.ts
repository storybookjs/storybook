import { SourceType } from 'storybook/internal/docs-tools';
import type { StoryContext } from 'storybook/internal/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emitTransformCode, getService } from 'storybook/preview-api';

import type { StoryDocsService } from './definition.ts';
import { prependImportToSnippet, selectSnippetForStory, selectWarningForStory } from './snippet.ts';
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
const warning =
  'Label is declared in the story file, so the snippet references it without importing it.';
const fallbackWarning = `${warning} Showing the story source instead.`;
const payloadWithWarning: StoryDocsPayload = {
  ...payload,
  stories: { [storyId]: { ...payload.stories[storyId]!, warning } },
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

  it('selects the story warning from a payload', () => {
    expect(selectWarningForStory(payloadWithWarning, storyId)).toBe(warning);
  });

  it('selects no warning for a story that does not carry one', () => {
    expect(selectWarningForStory(payload, storyId)).toBeUndefined();
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

  it('emits the service snippet through emitTransformCode', async () => {
    const context = {
      id: storyId,
      parameters: { __isArgsStory: true },
    } as unknown as StoryContext;

    const cleanup = storyDocsSourceBeforeEach(context);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(serviceSnippet, context, undefined);
    await cleanup?.();
  });

  it('emits the story warning alongside the service snippet', async () => {
    mockStoryDocsService(() => Promise.resolve(payloadWithWarning));
    const context = {
      id: storyId,
      parameters: { __isArgsStory: true },
    } as unknown as StoryContext;

    const cleanup = storyDocsSourceBeforeEach(context);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(serviceSnippet, context, warning);
    await cleanup?.();
  });

  it('emits the story warning with fallback context when it falls back to the CSF source', async () => {
    mockStoryDocsService(() =>
      Promise.resolve({
        ...payloadWithWarning,
        stories: { [storyId]: { id: storyId, name: 'Primary', warning } },
      })
    );
    const context = {
      id: storyId,
      parameters: {
        __isArgsStory: true,
        docs: { source: { originalSource: 'export const Primary = {};' } },
      },
    } as unknown as StoryContext;

    const cleanup = storyDocsSourceBeforeEach(context);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(
      'export const Primary = {};',
      context,
      fallbackWarning
    );
    await cleanup?.();
  });

  it('keeps the fallback warning in production builds', async () => {
    vi.stubGlobal('CONFIG_TYPE', 'PRODUCTION');
    mockStoryDocsService(() =>
      Promise.resolve({
        ...payloadWithWarning,
        stories: { [storyId]: { id: storyId, name: 'Primary', warning } },
      })
    );
    const context = {
      id: storyId,
      parameters: {
        __isArgsStory: true,
        docs: { source: { originalSource: 'export const Primary = {};' } },
      },
    } as unknown as StoryContext;

    const cleanup = storyDocsSourceBeforeEach(context);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(
      'export const Primary = {};',
      context,
      fallbackWarning
    );
    await cleanup?.();
  });

  it('emits no warning for the CSF source fallback without a story warning', async () => {
    mockStoryDocsService(() =>
      Promise.resolve({
        ...payload,
        stories: { [storyId]: { id: storyId, name: 'Primary' } },
      })
    );
    const context = {
      id: storyId,
      parameters: {
        __isArgsStory: true,
        docs: { source: { originalSource: 'export const Primary = {};' } },
      },
    } as unknown as StoryContext;

    const cleanup = storyDocsSourceBeforeEach(context);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(
      'export const Primary = {};',
      context,
      undefined
    );
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
