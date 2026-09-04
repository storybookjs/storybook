import { logger } from 'storybook/internal/node-logger';
import type { DocgenPayload, DocgenProvider, IndexEntry } from 'storybook/internal/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDocgenPayload } from './build-docgen.ts';
import { createDocgenProvider } from './docgen-worker.ts';

// A structural fake keeps these tests runnable without a real TypeScript-backed analyzer.
const { analyzer } = vi.hoisted(() => {
  class FakeAngularComponentMetaManager {
    startWatching = vi.fn();
    recycleIfHeapPressured = vi.fn();
    extractComponentMeta = vi.fn();
    typescript: unknown;

    constructor(typescript: unknown) {
      state.constructions += 1;
      if (state.failConstruction) {
        throw new Error('the analyzer refused to start');
      }
      this.typescript = typescript;
      state.instances.push(this);
    }
  }

  const state = {
    FakeAngularComponentMetaManager,
    instances: [] as InstanceType<typeof FakeAngularComponentMetaManager>[],
    constructions: 0,
    failConstruction: false,
  };
  return { analyzer: state };
});

vi.mock('@storybook/angular-cm', () => ({
  AngularComponentMetaManager: analyzer.FakeAngularComponentMetaManager,
}));
// These tests cover the middleware chain, not payload building.
vi.mock('./build-docgen.ts', () => ({ buildDocgenPayload: vi.fn() }));
vi.mock(import('storybook/internal/node-logger'), { spy: true });

beforeEach(() => {
  analyzer.instances = [];
  analyzer.constructions = 0;
  analyzer.failConstruction = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const entry: IndexEntry = {
  id: 'button--default',
  name: 'Default',
  title: 'Button',
  type: 'story',
  subtype: 'story',
  importPath: './button.stories.ts',
};

const ours: DocgenPayload = {
  id: 'button',
  name: 'ButtonComponent',
  path: './button.stories.ts',
  jsDocTags: {},
  argTypes: { label: { name: 'label' } },
};

const downstream: DocgenPayload = {
  id: 'button',
  name: 'Downstream',
  path: './button.stories.ts',
  jsDocTags: {},
  argTypes: { caption: { name: 'caption' } },
};

const errored: DocgenPayload = {
  id: 'button',
  name: 'ButtonComponent',
  path: './button.stories.ts',
  jsDocTags: {},
  error: { name: 'AngularComponentMetaNotFound', message: 'no metadata' },
};

const passthrough: DocgenProvider = async () => undefined;

describe('createDocgenProvider', () => {
  it('falls through for a file that is not a story, without creating the analyzer', async () => {
    const next = vi.fn(passthrough);

    await expect(
      createDocgenProvider({ propsTable: 'api' })(next)({
        entry: { ...entry, importPath: './button.component.ts' },
      })
    ).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledOnce();
    expect(buildDocgenPayload).not.toHaveBeenCalled();
    expect(analyzer.constructions).toBe(0);
  });

  it('merges over downstream output on success', async () => {
    vi.mocked(buildDocgenPayload).mockReturnValue(ours);

    const payload = await createDocgenProvider({ propsTable: 'api' })(async () => ({
      ...downstream,
      somethingElse: 'kept',
    }))({ entry });

    expect(payload).toMatchObject({ name: 'ButtonComponent', somethingElse: 'kept' });
    expect(payload?.argTypes?.label).toBeDefined();
    expect(payload?.argTypes?.caption).toBeUndefined();
  });

  it('keeps another provider`s payload when our own extraction fails', async () => {
    vi.mocked(buildDocgenPayload).mockReturnValue(errored);
    const next = vi.fn<DocgenProvider>(async () => downstream);

    await expect(createDocgenProvider({ propsTable: 'api' })(next)({ entry })).resolves.toEqual(
      downstream
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('reports its own error only when no other provider described the component', async () => {
    vi.mocked(buildDocgenPayload).mockReturnValue(errored);

    await expect(
      createDocgenProvider({ propsTable: 'api' })(passthrough)({ entry })
    ).resolves.toEqual(errored);
  });

  it('delegates downstream when it has no payload for the component', async () => {
    vi.mocked(buildDocgenPayload).mockReturnValue(undefined);
    const next = vi.fn<DocgenProvider>(async () => downstream);

    await expect(createDocgenProvider({ propsTable: 'api' })(next)({ entry })).resolves.toEqual(
      downstream
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('lets an unexpected failure propagate, since core records it against this component', async () => {
    const failure = new TypeError('unexpected');
    vi.mocked(buildDocgenPayload).mockImplementation(() => {
      throw failure;
    });

    await expect(createDocgenProvider({ propsTable: 'api' })(passthrough)({ entry })).rejects.toBe(
      failure
    );
  });

  it('owns one watching analyzer for its lifetime and recycles after each extraction', async () => {
    vi.mocked(buildDocgenPayload).mockReturnValue(ours);
    const provider = createDocgenProvider({ propsTable: 'api' })(passthrough);

    await provider({ entry });
    await provider({ entry });

    expect(analyzer.constructions).toBe(1);
    const [manager] = analyzer.instances;
    expect(manager.startWatching).toHaveBeenCalledOnce();
    expect(manager.recycleIfHeapPressured).toHaveBeenCalledTimes(2);
    expect((manager.typescript as { version?: unknown }).version).toBeTypeOf('string');
  });

  it('threads a structured-cloneable options bag and the manager into the payload builder', async () => {
    vi.mocked(buildDocgenPayload).mockReturnValue(ours);

    await createDocgenProvider(structuredClone({ propsTable: 'inputs' } as const))(passthrough)({
      entry,
    });

    expect(buildDocgenPayload).toHaveBeenCalledExactlyOnceWith(
      { entry },
      {
        manager: analyzer.instances[0],
        options: { propsTable: 'inputs' },
        logger: expect.objectContaining({
          warn: expect.any(Function),
          debug: expect.any(Function),
        }),
      }
    );
  });

  it('passes through permanently when the analyzer cannot be created', async () => {
    analyzer.failConstruction = true;
    vi.mocked(logger.warn).mockImplementation(() => {});
    const next = vi.fn<DocgenProvider>(async () => downstream);
    const provider = createDocgenProvider({ propsTable: 'api' })(next);

    await expect(provider({ entry })).resolves.toEqual(downstream);
    await expect(provider({ entry })).resolves.toEqual(downstream);

    expect(analyzer.constructions).toBe(1);
    expect(next).toHaveBeenCalledTimes(2);
    expect(buildDocgenPayload).not.toHaveBeenCalled();
    expect(vi.mocked(logger.warn).mock.calls).toMatchInlineSnapshot(`
      [
        [
          "Angular docgen is unavailable: the component meta analyzer could not be created. the analyzer refused to start",
        ],
      ]
    `);
  });
});
