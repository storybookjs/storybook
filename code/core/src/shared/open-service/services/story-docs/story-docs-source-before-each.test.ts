import { logger } from 'storybook/internal/client-logger';
import { SourceType, UnprintableArgError } from 'storybook/internal/docs-tools';
import type { StoryContext } from 'storybook/internal/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emitTransformCode, getService } from 'storybook/preview-api';

import type { StoryDocsService } from './definition.ts';
import { argsToFill, getFillTemplate, selectLiveSnippetForStory } from './live-snippet.ts';
import { prependImportToSnippet, selectSnippetForStory, selectWarningForStory } from './snippet.ts';
import {
  shouldSkipStoryDocsEmit,
  storyDocsSourceBeforeEach,
} from './story-docs-source-before-each.ts';
import type { StoryDocsPayload } from './types.ts';

vi.mock('storybook/preview-api', { spy: true });

const mockedEmitTransformCode = vi.mocked(emitTransformCode);

// Lets the story docs load and the emit after it run.
const settled = () => new Promise((resolve) => setTimeout(resolve));
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
const payloadWithTemplate: StoryDocsPayload = {
  ...payload,
  stories: {
    [storyId]: { ...payload.stories[storyId]!, template: '<Button label={args.label} />', warning },
  },
};
const fillTemplate = (template: string, args: Record<string, unknown>) =>
  template.replace('{args.label}', `"${String(args.label)}"`);

/**
 * Builds a minimal `core/story-docs` service mock whose `storyDocs.loaded` resolves with `loaded`,
 * which `storyDocs.get` reads from then on.
 */
function mockStoryDocsService(loaded: () => Promise<StoryDocsPayload>) {
  let state: StoryDocsPayload | undefined;
  const storyDocs = {
    loaded: vi.fn(() => loaded().then((value) => (state = value))),
    get: () => state,
  };
  mockedGetService.mockReturnValue({ queries: { storyDocs } } as unknown as StoryDocsService);
  return storyDocs;
}

/** Runs the hook for one render and lets its snippet load settle before the story is torn down. */
async function render(context: StoryContext) {
  const cleanup = storyDocsSourceBeforeEach(context);
  await new Promise((resolve) => setTimeout(resolve));
  await cleanup?.();
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

describe('selectLiveSnippetForStory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fills the template with the args, without the static warning', () => {
    expect(
      selectLiveSnippetForStory(payloadWithTemplate, storyId, { label: 'Go' }, fillTemplate)
    ).toEqual({ snippet: 'import { Button } from \'./Button\';\n\n<Button label="Go" />' });
  });

  it('selects the static snippet and its warning without a filler', () => {
    expect(
      selectLiveSnippetForStory(payloadWithTemplate, storyId, { label: 'Go' }, undefined)
    ).toEqual({ snippet: serviceSnippet, warning });
  });

  it('selects the static snippet and its warning without a template', () => {
    expect(
      selectLiveSnippetForStory(payloadWithWarning, storyId, { label: 'Go' }, fillTemplate)
    ).toEqual({ snippet: serviceSnippet, warning });
  });

  it('selects the static snippet and warns once when the filler throws', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const throwing = () => {
      throw new Error('unexpected value');
    };
    for (const label of ['Go', 'Stop']) {
      expect(selectLiveSnippetForStory(payloadWithTemplate, storyId, { label }, throwing)).toEqual({
        snippet: serviceSnippet,
        warning,
      });
    }
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      'Could not fill the snippet of button--primary with its args: Error: unexpected value'
    );
  });

  it('selects the static snippet without a warning for an arg value it cannot show', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const unprintable = () => {
      throw new UnprintableArgError('label');
    };
    expect(
      selectLiveSnippetForStory(payloadWithTemplate, storyId, { label: 'Go' }, unprintable)
    ).toEqual({ snippet: serviceSnippet, warning });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('argsToFill', () => {
  it('fills nothing while the story has the args it is written with', () => {
    const initialArgs = { label: 'Hi', onClick: () => {} };
    expect(
      argsToFill({ args: { ...initialArgs }, unmappedArgs: { ...initialArgs }, initialArgs })
    ).toBeUndefined();
  });

  it('fills the args after mapping once they change', () => {
    const args = { icon: '<Icon />' };
    expect(
      argsToFill({ args, unmappedArgs: { icon: 'star' }, initialArgs: { icon: 'none' } })
    ).toBe(args);
  });
});

describe('getFillTemplate', () => {
  it('reads the filler the renderer sets on the docs source parameters', () => {
    expect(getFillTemplate({ docs: { source: { fillTemplate } } })).toBe(fillTemplate);
  });

  it('ignores a missing or invalid filler', () => {
    expect(getFillTemplate(undefined)).toBeUndefined();
    expect(getFillTemplate({ docs: { source: { fillTemplate: 'nope' } } })).toBeUndefined();
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
    vi.stubGlobal('FEATURES', { docgenServer: true });
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
    await settled();

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(serviceSnippet, context, undefined);
    await cleanup?.();
  });

  it('emits the static snippet while the story has the args it is written with', async () => {
    mockStoryDocsService(() => Promise.resolve(payloadWithTemplate));
    const context = {
      id: storyId,
      args: { label: 'hi' },
      unmappedArgs: { label: 'hi' },
      initialArgs: { label: 'hi' },
      parameters: { __isArgsStory: true, docs: { source: { fillTemplate } } },
    } as unknown as StoryContext;

    await render(context);

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(serviceSnippet, context, warning);
  });

  it('fills the template once the args change, loading the story docs once', async () => {
    const storyDocs = mockStoryDocsService(() => Promise.resolve(payloadWithTemplate));
    const parameters = { __isArgsStory: true, docs: { source: { fillTemplate } } };
    const withLabel = (label: string) =>
      ({
        id: storyId,
        args: { label },
        unmappedArgs: { label },
        initialArgs: { label: 'hi' },
        parameters,
      }) as unknown as StoryContext;

    for (const label of ['Go', 'Stop']) {
      const context = withLabel(label);
      await render(context);
      expect(mockedEmitTransformCode).toHaveBeenLastCalledWith(
        `import { Button } from './Button';\n\n<Button label="${label}" />`,
        context,
        undefined
      );
    }
    expect(storyDocs.loaded).toHaveBeenCalledOnce();
  });

  it('emits only the newest args when they change before an emit is done', async () => {
    mockStoryDocsService(() => Promise.resolve(payloadWithTemplate));
    let finishTransform = () => {};
    mockedEmitTransformCode.mockReturnValueOnce(
      new Promise<void>((resolve) => (finishTransform = resolve))
    );
    const parameters = { __isArgsStory: true, docs: { source: { fillTemplate } } };
    const withLabel = (label: string) =>
      ({
        id: storyId,
        args: { label },
        unmappedArgs: { label },
        initialArgs: { label: 'hi' },
        parameters,
      }) as unknown as StoryContext;

    storyDocsSourceBeforeEach(withLabel('Go'));
    await settled();
    storyDocsSourceBeforeEach(withLabel('Stop'));
    storyDocsSourceBeforeEach(withLabel('Wait'));
    await settled();
    expect(mockedEmitTransformCode).toHaveBeenCalledOnce();

    finishTransform();
    await settled();
    expect(mockedEmitTransformCode).toHaveBeenCalledTimes(2);
    expect(mockedEmitTransformCode).toHaveBeenLastCalledWith(
      `import { Button } from './Button';\n\n<Button label="Wait" />`,
      expect.anything(),
      undefined
    );
  });

  it('loads the story docs again after a failed load', async () => {
    const storyDocs = mockStoryDocsService(() => Promise.reject(new Error('offline')));
    const context = { id: storyId, parameters: { __isArgsStory: true } } as unknown as StoryContext;
    await render(context);
    await render(context);
    expect(storyDocs.loaded).toHaveBeenCalledTimes(2);
  });

  it('keeps a loaded payload when emitting its snippet fails', async () => {
    const storyDocs = mockStoryDocsService(() => Promise.resolve(payload));
    mockedEmitTransformCode.mockRejectedValue(new Error('transform failed'));
    const context = { id: storyId, parameters: { __isArgsStory: true } } as unknown as StoryContext;
    await render(context);
    await render(context);
    expect(storyDocs.loaded).toHaveBeenCalledOnce();
  });

  it('loads the story docs again for a hot-updated story', async () => {
    const storyDocs = mockStoryDocsService(() => Promise.resolve(payload));
    for (const parameters of [{ __isArgsStory: true }, { __isArgsStory: true }]) {
      await render({ id: storyId, parameters } as unknown as StoryContext);
    }
    expect(storyDocs.loaded).toHaveBeenCalledTimes(2);
  });

  it('emits the story warning alongside the service snippet', async () => {
    mockStoryDocsService(() => Promise.resolve(payloadWithWarning));
    const context = {
      id: storyId,
      parameters: { __isArgsStory: true },
    } as unknown as StoryContext;

    const cleanup = storyDocsSourceBeforeEach(context);
    await settled();

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
    await settled();

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
    await settled();

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
    await settled();

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

  it('settles without rejecting when the story docs load fails', async () => {
    mockStoryDocsService(() => Promise.reject(new Error('no runtime acknowledged the command')));

    const cleanup = storyDocsSourceBeforeEach({
      id: storyId,
      parameters: { __isArgsStory: true },
    } as unknown as StoryContext);

    await expect(cleanup?.()).resolves.toBeUndefined();
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
