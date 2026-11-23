import { describe, expect, it, vi } from 'vitest';

import type {
  DocgenPayload,
  DocgenProviderInput,
} from '../../shared/open-service/services/docgen/types.ts';
import { type DocgenResult, createLazyDocgenMiddleware } from './lazy-docgen-middleware.ts';

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
        extract: async () => OURS,
      })(async () => DOWNSTREAM);

      await expect(
        provider({
          entry: {
            id: 'button--primary',
            name: 'Primary',
            title: 'Button',
            type: 'story',
            subtype: 'story',
            importPath,
          },
        })
      ).resolves.toEqual(expected);
    }
  );

  describe('extractBatch', () => {
    const input = (title: string): DocgenProviderInput => ({
      entry: {
        id: `${title.toLowerCase()}--primary`,
        name: 'Primary',
        title,
        type: 'story',
        subtype: 'story',
        importPath: `./${title}.stories.ts`,
      },
    });
    const payload = (name: string): DocgenPayload => ({
      id: name.toLowerCase(),
      name,
      path: `./${name}.stories.ts`,
      jsDocTags: {},
    });
    const titles = (inputs: DocgenProviderInput[]) => inputs.map(({ entry }) => entry.title);

    it('extracts the requests that arrive together in one call', async () => {
      const extractBatch = vi.fn(async (_manager: object, inputs: DocgenProviderInput[]) =>
        inputs.map(({ entry }) => ({ status: 'fulfilled' as const, value: payload(entry.title) }))
      );
      const provider = createLazyDocgenMiddleware({
        createManager: async () => ({}),
        extractBatch,
      })(async () => undefined);

      const results = await Promise.all(['Button', 'Card', 'Input'].map((t) => provider(input(t))));

      expect(extractBatch.mock.calls.map(([, inputs]) => titles(inputs))).toEqual([
        ['Button', 'Card', 'Input'],
      ]);
      expect(results.map((result) => result?.name)).toEqual(['Button', 'Card', 'Input']);
    });

    it('puts the requests that arrive during a batch in the next batch', async () => {
      let release = () => {};
      const firstBatchRuns = new Promise<void>((resolve) => {
        release = resolve;
      });
      const calls: string[][] = [];
      let provider = (async () => undefined) as ReturnType<
        ReturnType<typeof createLazyDocgenMiddleware>
      >;
      let late: Promise<unknown>[] = [];
      provider = createLazyDocgenMiddleware({
        createManager: async () => ({}),
        extractBatch: async (_manager, inputs) => {
          calls.push(titles(inputs));
          if (calls.length === 1) {
            late = ['Card', 'Input'].map((t) => provider(input(t)));
            release();
            await new Promise((resolve) => setImmediate(resolve));
          }
          return inputs.map(({ entry }) => ({ status: 'fulfilled', value: payload(entry.title) }));
        },
      })(async () => undefined);

      const first = provider(input('Button'));
      await firstBatchRuns;
      await Promise.all([first, ...late]);

      expect(calls).toEqual([['Button'], ['Card', 'Input']]);
    });

    it('fails every request of a batch that throws, and runs the next batch', async () => {
      const extractBatch = vi
        .fn<(manager: object, inputs: DocgenProviderInput[]) => Promise<DocgenResult[]>>()
        .mockRejectedValueOnce(new Error('batch failed'))
        .mockImplementation(async (_manager, inputs) =>
          inputs.map(({ entry }) => ({ status: 'fulfilled', value: payload(entry.title) }))
        );
      const provider = createLazyDocgenMiddleware({
        createManager: async () => ({}),
        extractBatch,
      })(async () => undefined);

      const failed = await Promise.allSettled(['Button', 'Card'].map((t) => provider(input(t))));
      const later = await provider(input('Input'));

      expect(failed).toMatchObject([
        { status: 'rejected', reason: new Error('batch failed') },
        { status: 'rejected', reason: new Error('batch failed') },
      ]);
      expect(later?.name).toBe('Input');
    });

    it('fails only the request whose result is rejected', async () => {
      const provider = createLazyDocgenMiddleware({
        createManager: async () => ({}),
        extractBatch: async (_manager, inputs) =>
          inputs.map(({ entry }) =>
            entry.title === 'Card'
              ? { status: 'rejected', reason: new Error('no props') }
              : { status: 'fulfilled', value: payload(entry.title) }
          ),
      })(async () => undefined);

      const results = await Promise.allSettled(['Button', 'Card'].map((t) => provider(input(t))));

      expect(results).toEqual([
        { status: 'fulfilled', value: payload('Button') },
        { status: 'rejected', reason: new Error('no props') },
      ]);
    });

    it('delegates a request downstream when its result is undefined', async () => {
      const provider = createLazyDocgenMiddleware({
        createManager: async () => ({}),
        extractBatch: async (_manager, inputs) =>
          inputs.map(() => ({ status: 'fulfilled', value: undefined })),
      })(async () => DOWNSTREAM);

      await expect(provider(input('Button'))).resolves.toEqual(DOWNSTREAM);
    });
  });
});
