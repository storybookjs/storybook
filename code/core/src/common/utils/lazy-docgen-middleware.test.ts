import { describe, expect, it, vi } from 'vitest';

import type {
  DocgenPayload,
  DocgenProviderInput,
} from '../../shared/open-service/services/docgen/types.ts';
import { createLazyDocgenMiddleware, extractEach } from './lazy-docgen-middleware.ts';

const DOWNSTREAM: DocgenPayload = {
  id: 'button',
  name: 'Downstream',
  path: './Button.stories.ts',
  description: 'From downstream',
  jsDocTags: {},
};

const OURS: DocgenPayload = {
  id: 'button',
  name: 'Button',
  path: './Button.stories.ts',
  jsDocTags: {},
  renderer: 'svelte',
};

const MERGED: DocgenPayload = {
  id: 'button',
  name: 'Button',
  path: './Button.stories.ts',
  description: 'From downstream',
  jsDocTags: {},
  renderer: 'svelte',
};

const input = (name: string, importPath = `./${name}.stories.ts`): DocgenProviderInput => ({
  entry: {
    id: `${name.toLowerCase()}--primary`,
    name: 'Primary',
    title: name,
    type: 'story',
    subtype: 'story',
    importPath,
  },
});

const fulfilled = (value: DocgenPayload | undefined) => ({ status: 'fulfilled' as const, value });

describe('createLazyDocgenMiddleware', () => {
  it.each([
    { importPath: './Button.stories.ts', storyFileTest: undefined, expected: MERGED },
    { importPath: './Button.stories.svelte', storyFileTest: undefined, expected: DOWNSTREAM },
    { importPath: './Button.stories.svelte', storyFileTest: /\.svelte$/, expected: MERGED },
    { importPath: './Button.stories.ts', storyFileTest: /\.svelte$/, expected: DOWNSTREAM },
  ])(
    '$importPath with storyFileTest $storyFileTest',
    async ({ importPath, storyFileTest, expected }) => {
      const provider = createLazyDocgenMiddleware({
        storyFileTest,
        createManager: async () => ({}),
        extract: async (_manager, inputs) => inputs.map(() => fulfilled(OURS)),
      })(async (inputs) => inputs.map(() => fulfilled(DOWNSTREAM)));

      await expect(provider([input('Button', importPath)])).resolves.toEqual([fulfilled(expected)]);
    }
  );

  it('extracts only the matching inputs, in one call, and passes every input downstream once', async () => {
    const extract = vi.fn(async (_manager: object, inputs: DocgenProviderInput[]) =>
      inputs.map(() => fulfilled(OURS))
    );
    const downstream = vi.fn(async (inputs: DocgenProviderInput[]) =>
      inputs.map(() => fulfilled(DOWNSTREAM))
    );
    const button = input('Button');
    const icon = input('Icon', './Icon.stories.svelte');
    const card = input('Card');

    const results = await createLazyDocgenMiddleware({
      createManager: async () => ({}),
      extract,
    })(downstream)([button, icon, card]);

    expect(extract).toHaveBeenCalledOnce();
    expect(extract).toHaveBeenCalledWith({}, [button, card]);
    expect(downstream).toHaveBeenCalledOnce();
    expect(downstream).toHaveBeenCalledWith([button, icon, card]);
    expect(results).toEqual([fulfilled(MERGED), fulfilled(DOWNSTREAM), fulfilled(MERGED)]);
  });

  it('does not create the manager when no input matches', async () => {
    const createManager = vi.fn(async () => ({}));

    const results = await createLazyDocgenMiddleware({
      createManager,
      extract: async () => [],
    })(async (inputs) => inputs.map(() => fulfilled(DOWNSTREAM)))([
      input('Icon', './Icon.stories.svelte'),
    ]);

    expect(createManager).not.toHaveBeenCalled();
    expect(results).toEqual([fulfilled(DOWNSTREAM)]);
  });

  it('keeps one failing entry from failing the others', async () => {
    const error = new Error('Card exploded');
    const results = await createLazyDocgenMiddleware({
      createManager: async () => ({}),
      extract: async () => [
        fulfilled(OURS),
        { status: 'rejected', reason: error },
        fulfilled(undefined),
      ],
    })(async (inputs) => inputs.map(() => fulfilled(DOWNSTREAM)))([
      input('Button'),
      input('Card'),
      input('Icon'),
    ]);

    expect(results).toEqual([
      fulfilled(MERGED),
      { status: 'rejected', reason: error },
      fulfilled(DOWNSTREAM),
    ]);
  });

  it('combines the two payloads with the merge option', async () => {
    const provider = createLazyDocgenMiddleware({
      createManager: async () => ({}),
      extract: async (_manager, inputs) => inputs.map(() => fulfilled(OURS)),
      merge: (own, downstream) => ({ ...own, description: downstream?.name }),
    })(async (inputs) => inputs.map(() => fulfilled(DOWNSTREAM)));

    expect(await provider([input('Button')])).toEqual([
      fulfilled({ ...OURS, description: 'Downstream' }),
    ]);
  });

  it('keeps a downstream failure on its own entry', async () => {
    const error = new Error('downstream exploded');
    const results = await createLazyDocgenMiddleware({
      createManager: async () => ({}),
      extract: async (_manager, inputs) => inputs.map(() => fulfilled(OURS)),
    })(async () => [{ status: 'rejected', reason: error }, fulfilled(DOWNSTREAM)])([
      input('Button'),
      input('Card'),
    ]);

    expect(results).toEqual([{ status: 'rejected', reason: error }, fulfilled(MERGED)]);
  });
});

describe('extractEach', () => {
  it('extracts one input after another and settles each on its own', async () => {
    const order: string[] = [];
    const error = new Error('b exploded');

    const results = await extractEach(['a', 'b', 'c'], async (name) => {
      order.push(`start ${name}`);
      await Promise.resolve();
      order.push(`end ${name}`);
      if (name === 'b') {
        throw error;
      }
      return name === 'a' ? OURS : undefined;
    });

    expect(order).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
    expect(results).toEqual([
      fulfilled(OURS),
      { status: 'rejected', reason: error },
      fulfilled(undefined),
    ]);
  });
});
