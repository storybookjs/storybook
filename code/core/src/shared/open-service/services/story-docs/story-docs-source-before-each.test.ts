import { logger } from 'storybook/internal/client-logger';
import { SourceType, UnprintableArgError } from 'storybook/internal/docs-tools';
import type { StoryContext } from 'storybook/internal/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emitTransformCode, getService } from 'storybook/preview-api';

import type { StoryDocsService } from './definition.ts';
import { getPrintHole, selectLiveSnippetForStory } from './live-snippet.ts';
import { prependImportToSnippet, selectSnippetForStory, selectWarningForStory } from './snippet.ts';
import {
  shouldSkipStoryDocsEmit,
  storyDocsSourceBeforeEach,
} from './story-docs-source-before-each.ts';
import type { StoryDocsPayload, StoryTemplatesPayload } from './types.ts';

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
const templates: StoryTemplatesPayload = {
  import: payload.import,
  stories: {
    [storyId]: ['<Button ', { place: { kind: 'attr' }, arg: 'label', text: 'label="hi"' }, ' />'],
  },
};
const printHole = (_: unknown, value: unknown) => `label="${String(value)}"`;
// The story's args once `label` changed to `Go` from the `hi` it is written with.
const changed = { unmappedArgs: { label: 'Go' }, initialArgs: { label: 'hi' } };

// Builds a minimal `core/story-docs` service mock whose `storyDocs.loaded` resolves with `loaded`,
// which `storyDocs.get` reads from then on, and whose `storyTemplates` do the same with
// `loadedTemplates`.
function mockStoryDocsService(
  loaded: () => Promise<StoryDocsPayload>,
  loadedTemplates: () => Promise<StoryTemplatesPayload> = () => Promise.resolve(templates)
) {
  let state: StoryDocsPayload | undefined;
  let templatesState: StoryTemplatesPayload | undefined;
  const storyDocs = {
    loaded: vi.fn(() => loaded().then((value) => (state = value))),
    get: () => state,
  };
  const storyTemplates = {
    loaded: vi.fn(() => loadedTemplates().then((value) => (templatesState = value))),
    get: () => templatesState,
  };
  mockedGetService.mockReturnValue({
    queries: { storyDocs, storyTemplates },
  } as unknown as StoryDocsService);
  return Object.assign(storyDocs, { templates: storyTemplates });
}

// Runs the hook for one render and lets its snippet load settle before the story is torn down.
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

  it('fills the template with the args, with the warning', () => {
    expect(
      selectLiveSnippetForStory(payloadWithWarning, templates, storyId, changed, printHole)
    ).toEqual({
      snippet: 'import { Button } from \'./Button\';\n\n<Button label="Go" />',
      warning,
    });
  });

  it('selects the static snippet with a warning that it does not follow without a hole printer or a template', () => {
    const stale = `${warning} The snippet does not follow the changed args.`;
    expect(
      selectLiveSnippetForStory(payloadWithWarning, templates, storyId, changed, undefined)
    ).toEqual({
      snippet: serviceSnippet,
      warning: stale,
    });
    expect(
      selectLiveSnippetForStory(payloadWithWarning, { stories: {} }, storyId, changed, printHole)
    ).toEqual({
      snippet: serviceSnippet,
      warning: stale,
    });
  });

  it('selects the static snippet with a warning that it does not follow for a template of another snippet', () => {
    // The templates load apart from the story docs, so they can come from another revision.
    const otherRevision: StoryTemplatesPayload = {
      ...templates,
      stories: {
        [storyId]: [
          '<Button ',
          { place: { kind: 'attr' }, arg: 'label', text: 'label="ho"' },
          ' />',
        ],
      },
    };
    expect(
      selectLiveSnippetForStory(payloadWithWarning, otherRevision, storyId, changed, printHole)
    ).toEqual({
      snippet: serviceSnippet,
      warning: `${warning} The snippet does not follow the changed args.`,
    });
  });

  it('selects the static snippet and warns once when the hole printer throws', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const throwing = () => {
      throw new Error('unexpected value');
    };
    for (const label of ['Go', 'Stop']) {
      const args = { ...changed, unmappedArgs: { label } };
      expect(
        selectLiveSnippetForStory(payloadWithWarning, templates, storyId, args, throwing)
      ).toEqual({
        snippet: serviceSnippet,
        warning: `${warning} The snippet does not follow the changed args.`,
      });
    }
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      'Could not fill the snippet of button--primary with its args: Error: unexpected value'
    );
  });

  it('selects the static snippet with a warning that names an arg it cannot show', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const unprintable = () => {
      throw new UnprintableArgError('label');
    };
    expect(
      selectLiveSnippetForStory(payloadWithWarning, templates, storyId, changed, unprintable)
    ).toEqual({
      snippet: serviceSnippet,
      warning: `${warning} The snippet cannot show the current value of the \`label\` arg.`,
    });
    expect(
      selectLiveSnippetForStory(payload, { stories: {} }, storyId, changed, unprintable)
    ).toEqual({
      snippet: serviceSnippet,
      warning: 'The snippet does not follow the changed args.',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('selects the static snippet without a warning while the templates load', () => {
    expect(
      selectLiveSnippetForStory(payloadWithWarning, 'loading', storyId, changed, printHole)
    ).toEqual({ snippet: serviceSnippet, warning });
  });

  it('selects the static snippet with a warning that it does not follow when the templates did not load', () => {
    expect(
      selectLiveSnippetForStory(payloadWithWarning, undefined, storyId, changed, printHole)
    ).toEqual({
      snippet: serviceSnippet,
      warning: `${warning} The snippet does not follow the changed args.`,
    });
  });

  it('selects the static snippet while the story has the args it is written with', () => {
    const args = { unmappedArgs: { label: 'hi' }, initialArgs: { label: 'hi' } };
    expect(
      selectLiveSnippetForStory(payloadWithWarning, templates, storyId, args, printHole)
    ).toEqual({
      snippet: serviceSnippet,
      warning,
    });
  });
});

describe('getPrintHole', () => {
  it('reads the hole printer the renderer sets on the docs source parameters', () => {
    expect(getPrintHole({ docs: { source: { printHole } } })).toBe(printHole);
  });

  it('ignores a missing or invalid hole printer', () => {
    expect(getPrintHole(undefined)).toBeUndefined();
    expect(getPrintHole({ docs: { source: { printHole: 'nope' } } })).toBeUndefined();
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
    mockStoryDocsService(() => Promise.resolve(payloadWithWarning));
    const context = {
      id: storyId,
      args: { label: 'hi' },
      unmappedArgs: { label: 'hi' },
      initialArgs: { label: 'hi' },
      parameters: { __isArgsStory: true, docs: { source: { printHole } } },
    } as unknown as StoryContext;

    await render(context);

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(serviceSnippet, context, warning);
  });

  it('fills the template once the args change, loading the story docs and templates once', async () => {
    const storyDocs = mockStoryDocsService(() => Promise.resolve(payloadWithWarning));
    const parameters = { __isArgsStory: true, docs: { source: { printHole } } };
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
        warning
      );
    }
    expect(storyDocs.loaded).toHaveBeenCalledOnce();
    expect(storyDocs.templates.loaded).toHaveBeenCalledOnce();
    expect(storyDocs.templates.loaded).toHaveBeenCalledWith({ id: 'button' });
  });

  it('does not load the templates while the story has the args it is written with', async () => {
    const storyDocs = mockStoryDocsService(() => Promise.resolve(payloadWithWarning));
    await render({
      id: storyId,
      args: { label: 'hi' },
      unmappedArgs: { label: 'hi' },
      initialArgs: { label: 'hi' },
      parameters: { __isArgsStory: true, docs: { source: { printHole } } },
    } as unknown as StoryContext);
    expect(storyDocs.templates.loaded).not.toHaveBeenCalled();
  });

  it('emits the static snippet with a warning when the templates do not load, and loads them again', async () => {
    const storyDocs = mockStoryDocsService(
      () => Promise.resolve(payloadWithWarning),
      () => Promise.reject(new Error('offline'))
    );
    const context = {
      id: storyId,
      args: { label: 'Go' },
      unmappedArgs: { label: 'Go' },
      initialArgs: { label: 'hi' },
      parameters: { __isArgsStory: true, docs: { source: { printHole } } },
    } as unknown as StoryContext;

    await render(context);
    await render(context);

    expect(mockedEmitTransformCode).toHaveBeenLastCalledWith(
      serviceSnippet,
      context,
      `${warning} The snippet does not follow the changed args.`
    );
    expect(storyDocs.templates.loaded).toHaveBeenCalledTimes(2);
  });

  it('emits the filled template with the warning', async () => {
    mockStoryDocsService(() => Promise.resolve(payloadWithWarning));
    const context = {
      id: storyId,
      args: { label: 'Go' },
      unmappedArgs: { label: 'Go' },
      initialArgs: { label: 'hi' },
      parameters: { __isArgsStory: true, docs: { source: { printHole } } },
    } as unknown as StoryContext;

    await render(context);

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(
      `import { Button } from './Button';\n\n<Button label="Go" />`,
      context,
      warning
    );
  });

  it('emits every args change in order, even when an emit before it is not done', async () => {
    mockStoryDocsService(() => Promise.resolve(payloadWithWarning));
    let finishTransform = () => {};
    mockedEmitTransformCode.mockReturnValueOnce(
      new Promise<void>((resolve) => (finishTransform = resolve))
    );
    const parameters = { __isArgsStory: true, docs: { source: { printHole } } };
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
    expect(mockedEmitTransformCode).toHaveBeenCalledTimes(3);
    expect(mockedEmitTransformCode).toHaveBeenLastCalledWith(
      `import { Button } from './Button';\n\n<Button label="Wait" />`,
      expect.anything(),
      warning
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
