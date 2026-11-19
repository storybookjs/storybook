import { logger } from 'storybook/internal/client-logger';
import {
  SourceType,
  UnprintableArgError,
  argChanges,
  printValue,
  registerPrintHole,
} from 'storybook/internal/docs-tools';
import type { StoryContext } from 'storybook/internal/types';

import { parse, stringify } from 'telejson';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emitTransformCode, getService } from 'storybook/preview-api';

import { type StoryDocsService, storyDocsServiceDef } from './definition.ts';
import { argsReachManager, selectLiveSnippetForStory } from './live-snippet.ts';
import { prependImportToSnippet, selectSnippetForStory, selectWarningForStory } from './snippet.ts';
import {
  shouldSkipStoryDocsEmit,
  storyDocsSourceBeforeEach,
} from './story-docs-source-before-each.ts';
import type { PrintHole, SnippetTemplate } from '../../../../docs-tools/snippetTemplate.ts';
import type { StoryDocsPayload } from './types.ts';

vi.mock('storybook/preview-api', { spy: true });

const mockedEmitTransformCode = vi.mocked(emitTransformCode);

// Lets the story docs load and the emit after it run.
const settled = () => new Promise((resolve) => setTimeout(resolve));
const mockedGetService = vi.mocked(getService);

const storyId = 'button--primary';
const template: SnippetTemplate = [
  '<Button ',
  { kind: 'attr', arg: 'label', text: 'label="hi"' },
  ' />',
];
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
      template,
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
const { template: _, ...storyWithoutTemplate } = payloadWithWarning.stories[storyId]!;
const payloadWithoutTemplate: StoryDocsPayload = {
  ...payloadWithWarning,
  stories: { [storyId]: storyWithoutTemplate },
};
const printHole = (_: unknown, value: unknown) => `label="${String(value)}"`;
// The story's `label` changed to `Go` from the `hi` it is written with.
const changed = { args: { label: 'Go' } };

// Builds a minimal `core/story-docs` service mock whose `storyDocs.loaded` resolves with `loaded`,
// which `storyDocs.get` reads from then on.
function mockStoryDocsService(loaded: () => Promise<StoryDocsPayload>) {
  let state: StoryDocsPayload | undefined;
  const storyDocs = {
    loaded: vi.fn(() => loaded().then((value) => (state = value))),
    get: () => state,
  };
  const liveSnippet = {
    get: (input: unknown) =>
      storyDocsServiceDef.queries.liveSnippet.handler!(
        input as never,
        {
          self: { queries: { storyDocs } },
        } as never
      ),
  };
  mockedGetService.mockReturnValue({
    queries: { storyDocs, liveSnippet },
  } as unknown as StoryDocsService);
  return storyDocs;
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
  beforeEach(() => {
    vi.stubGlobal('FEATURES', { experimentalLiveServerSnippets: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fills the template with the args, with the warning', () => {
    expect(selectLiveSnippetForStory(payloadWithWarning, storyId, changed, printHole)).toEqual({
      snippet: 'import { Button } from \'./Button\';\n\n<Button label="Go" />',
      warning,
    });
  });

  it('selects the static snippet with a warning that it does not follow without a hole printer or a template', () => {
    const stale = `${warning} The snippet does not follow the changed args.`;
    expect(selectLiveSnippetForStory(payloadWithWarning, storyId, changed, undefined)).toEqual({
      snippet: serviceSnippet,
      warning: stale,
    });
    expect(selectLiveSnippetForStory(payloadWithoutTemplate, storyId, changed, printHole)).toEqual({
      snippet: serviceSnippet,
      warning: stale,
    });
  });

  it('selects the static snippet and warns once when the hole printer throws', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const throwing = () => {
      throw new Error('unexpected value');
    };
    for (const label of ['Go', 'Stop']) {
      const args = { args: { label } };
      expect(selectLiveSnippetForStory(payloadWithWarning, storyId, args, throwing)).toEqual({
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
    expect(selectLiveSnippetForStory(payloadWithWarning, storyId, changed, unprintable)).toEqual({
      snippet: serviceSnippet,
      warning: `${warning} The snippet cannot show the current value of the \`label\` arg.`,
    });
    expect(
      selectLiveSnippetForStory(payloadWithoutTemplate, storyId, changed, unprintable)
    ).toEqual({
      snippet: serviceSnippet,
      warning: `${warning} The snippet does not follow the changed args.`,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('fills args sent through the channel as it fills the args they were sent from', () => {
    class Person {
      constructor(readonly name: string) {}
    }
    const printers: PrintHole[] = [
      (hole, value) => `label={${printValue(value, hole.arg ?? '')}}`,
      (_, value) => `label='${JSON.stringify(value)}'`,
    ];
    const values = [
      new Person('Ada'),
      new Map([['a', 1]]),
      new Set(['a']),
      { owner: new Person('Ada'), tags: ['a'] },
      [new Person('Ada'), 1],
      { name: 'Ada' },
    ];
    for (const printer of printers) {
      for (const label of values) {
        const args = { unmappedArgs: { label }, initialArgs: { label: 'hi' } };
        const sent = parse(stringify(args));
        expect(
          selectLiveSnippetForStory(payloadWithWarning, storyId, argChanges(sent), printer)
        ).toEqual(
          selectLiveSnippetForStory(payloadWithWarning, storyId, argChanges(args), printer)
        );
      }
    }
  });

  it('selects the static snippet while the story has the args it is written with', () => {
    expect(selectLiveSnippetForStory(payloadWithWarning, storyId, { args: {} }, printHole)).toEqual(
      {
        snippet: serviceSnippet,
        warning,
      }
    );
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

describe('argsReachManager', () => {
  const reaches = (unmappedArgs: Record<string, unknown>, initialArgs = unmappedArgs) =>
    argsReachManager({ unmappedArgs, initialArgs });

  it('holds for args the channel sends, and for functions and collections the story is written with', () => {
    class Person {
      constructor(readonly name: string) {}
    }
    const user: Record<string, unknown> = { name: 'Jane' };
    user.self = user;
    const initialArgs = {
      label: 'Hi',
      onClick: () => {},
      config: { format: () => '' },
      tags: new Set(['a']),
    };
    expect(
      reaches(
        {
          ...initialArgs,
          label: 'Bye',
          count: Number.NaN,
          max: Infinity,
          when: new Date(0),
          owner: new Person('Bob'),
          user,
        },
        initialArgs
      )
    ).toBe(true);
  });

  it.each([
    ['a function', () => {}],
    ['a function in an object', { format: () => '' }],
    ['a function in an array', [() => {}]],
    ['a Set', new Set(['a'])],
    ['a Map in an object', { lookup: new Map([['a', 1]]) }],
  ])('fails for %s that changed, whose contents the channel drops', (_, value) => {
    expect(reaches({ value }, { value: 'initial' })).toBe(false);
    expect(reaches({ value: 'current' }, { value })).toBe(false);
  });
});

describe('selectLiveSnippetForStory without experimentalLiveServerSnippets', () => {
  it('selects the static snippet with its own warning, as before live snippets', () => {
    vi.stubGlobal('FEATURES', {});
    expect(selectLiveSnippetForStory(payloadWithWarning, storyId, changed, printHole)).toEqual({
      snippet: selectSnippetForStory(payloadWithWarning, storyId),
      warning,
    });
    vi.unstubAllGlobals();
  });
});

describe('storyDocsSourceBeforeEach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('FEATURES', { docgenServer: true, experimentalLiveServerSnippets: true });
    vi.stubGlobal(Symbol.for('storybook/docs-tools/print-hole'), undefined);
    registerPrintHole(printHole);
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

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(serviceSnippet, context, undefined, false);
    await cleanup?.();
  });

  it('emits the static snippet while the story has the args it is written with', async () => {
    mockStoryDocsService(() => Promise.resolve(payloadWithWarning));
    const context = {
      id: storyId,
      args: { label: 'hi' },
      unmappedArgs: { label: 'hi' },
      initialArgs: { label: 'hi' },
      parameters: { __isArgsStory: true },
    } as unknown as StoryContext;

    await render(context);

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(serviceSnippet, context, warning, false);
  });

  it('fills the template once the args change, loading the story docs once', async () => {
    const storyDocs = mockStoryDocsService(() => Promise.resolve(payloadWithWarning));
    const parameters = { __isArgsStory: true };
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
        warning,
        false
      );
    }
    expect(storyDocs.loaded).toHaveBeenCalledOnce();
  });

  it('emits the filled template with the warning', async () => {
    mockStoryDocsService(() => Promise.resolve(payloadWithWarning));
    const context = {
      id: storyId,
      args: { label: 'Go' },
      unmappedArgs: { label: 'Go' },
      initialArgs: { label: 'hi' },
      parameters: { __isArgsStory: true },
    } as unknown as StoryContext;

    await render(context);

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(
      `import { Button } from './Button';\n\n<Button label="Go" />`,
      context,
      warning,
      false
    );
  });

  it('marks the emit of a story whose args the channel cannot carry', async () => {
    const context = {
      id: storyId,
      unmappedArgs: { label: 'hi', onClick: () => {} },
      initialArgs: { label: 'hi', onClick: () => {} },
      parameters: { __isArgsStory: true },
    } as unknown as StoryContext;

    await render(context);

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(serviceSnippet, context, undefined, true);
  });

  it('emits every args change in order, even when an emit before it is not done', async () => {
    mockStoryDocsService(() => Promise.resolve(payloadWithWarning));
    let finishTransform = () => {};
    mockedEmitTransformCode.mockReturnValueOnce(
      new Promise<void>((resolve) => (finishTransform = resolve))
    );
    const parameters = { __isArgsStory: true };
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
      warning,
      false
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

    expect(mockedEmitTransformCode).toHaveBeenCalledWith(serviceSnippet, context, warning, false);
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
      fallbackWarning,
      false
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
      fallbackWarning,
      false
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
      undefined,
      false
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
