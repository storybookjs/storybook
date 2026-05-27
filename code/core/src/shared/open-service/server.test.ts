import { readFile } from 'node:fs/promises';

import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { join } from 'pathe';
import { vol } from 'memfs';

import { defineService } from './service-definition.ts';
import {
  buildStaticFiles,
  clearRegistry,
  registerService,
  writeOpenServiceStaticFiles,
} from './server.ts';
import {
  awaitedPreloadValueServiceDef,
  createSharedStaticFileServiceDef,
  mutableRecordLookupServiceDef,
} from './fixtures.ts';

vi.mock('node:fs/promises', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return memfs.fs.promises;
});

afterEach(() => {
  clearRegistry();
  vol.reset();
});

describe('server static builds', () => {
  describe('buildStaticFiles', () => {
    it('runs preload from initial state for each input and deep-merges by path', async () => {
      await expect(buildStaticFiles([awaitedPreloadValueServiceDef])).resolves.toEqual({
        'test/awaited-preload-value.json': {
          'entry-a': 'preloaded',
          'entry-b': 'preloaded',
        },
      });
    });

    it('uses a single default path per service', async () => {
      const store = await buildStaticFiles([awaitedPreloadValueServiceDef]);

      expect(Object.keys(store)).toEqual(['test/awaited-preload-value.json']);
    });

    it('deep-merges outputs from different queries that resolve to the same custom path', async () => {
      const sharedStaticFileServiceDef = createSharedStaticFileServiceDef();

      await expect(buildStaticFiles([sharedStaticFileServiceDef])).resolves.toEqual({
        'shared.json': { left: 'preloaded', right: 'preloaded' },
      });
    });

    it('skips services and queries without static config', async () => {
      const store = await buildStaticFiles([mutableRecordLookupServiceDef]);

      expect(Object.keys(store)).toHaveLength(0);
    });

    it('uses the shared registry when static preload and static inputs resolve another service', async () => {
      const sourceService = registerService(mutableRecordLookupServiceDef);
      await sourceService.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'match',
      });

      const staticLookupServiceDef = defineService({
        id: 'test/static-build-service-lookup',
        description: 'Copies state from another registered service during static preload.',
        initialState: { value: null as string | null },
        queries: {
          getValue: {
            description: 'Returns the value copied during static preload.',
            input: v.object({ build: v.literal('once') }),
            output: v.nullable(v.string()),
            handler: async (_input, ctx) => ctx.self.state.value,
            preload: async (_input, ctx) => {
              await ctx.self.commands.copyValue(undefined);
            },
            static: {
              inputs: async () => [{ build: 'once' as const }],
            },
          },
        },
        commands: {
          copyValue: {
            description: 'Copies marker state from the registered lookup service.',
            input: v.undefined(),
            output: v.undefined(),
            handler: async (_input, ctx) => {
              const source = await ctx.getService('test/mutable-record-lookup');
              const record = (await source.queries.getRecordFields({
                entryId: 'entry-a',
              })) as Record<string, string> | null;

              ctx.self.setState((draft) => {
                draft.value = record?.marker ?? null;
              });

              return undefined;
            },
          },
        },
      });

      await expect(buildStaticFiles([staticLookupServiceDef])).resolves.toEqual({
        'test/static-build-service-lookup.json': {
          value: 'match',
        },
      });

      const readyEntryIds: string[] = [];
      const parallelSourceServiceDef = defineService({
        id: 'test/parallel-static-input-source',
        description: 'Publishes static input ids once its own preload task starts running.',
        initialState: { built: false },
        queries: {
          getReadyEntryIds: {
            description: 'Returns the entry ids published by the source static build task.',
            input: v.undefined(),
            output: v.array(v.string()),
            handler: async () => readyEntryIds,
            preload: async (_input, ctx) => {
              await Promise.resolve();
              await ctx.self.commands.publishReadyEntryIds(undefined);
            },
            static: {
              inputs: async () => [undefined],
            },
          },
        },
        commands: {
          publishReadyEntryIds: {
            description: 'Publishes one static entry id and marks the source snapshot as built.',
            input: v.undefined(),
            output: v.undefined(),
            handler: async (_input, ctx) => {
              readyEntryIds.splice(0, readyEntryIds.length, 'entry-a');
              ctx.self.setState((draft) => {
                draft.built = true;
              });

              return undefined;
            },
          },
        },
      });

      registerService(parallelSourceServiceDef);

      const parallelLookupServiceDef = defineService({
        id: 'test/parallel-static-input-consumer',
        description:
          'Waits for another service query to publish its static inputs before preloading.',
        initialState: { value: null as string | null },
        queries: {
          getValue: {
            description: 'Stores one value for each id discovered through another service query.',
            input: v.object({ entryId: v.string() }),
            output: v.nullable(v.string()),
            handler: async (_input, ctx) => ctx.self.state.value,
            preload: async (input, ctx) => {
              await ctx.self.commands.setValue(input);
            },
            static: {
              inputs: async (ctx) => {
                const source = await ctx.getService('test/parallel-static-input-source');

                for (let attempt = 0; attempt < 5; attempt += 1) {
                  const entryIds = (await source.queries.getReadyEntryIds(undefined)) as string[];

                  if (entryIds.length > 0) {
                    return entryIds.map((entryId) => ({ entryId }));
                  }

                  await Promise.resolve();
                }

                throw new Error(
                  'Timed out waiting for parallel static inputs from the source service.'
                );
              },
            },
          },
        },
        commands: {
          setValue: {
            description: 'Stores the discovered entry id in the consumer snapshot.',
            input: v.object({ entryId: v.string() }),
            output: v.undefined(),
            handler: async (input, ctx) => {
              ctx.self.setState((draft) => {
                draft.value = input.entryId;
              });

              return undefined;
            },
          },
        },
      });

      await expect(
        buildStaticFiles([parallelLookupServiceDef, parallelSourceServiceDef])
      ).resolves.toEqual({
        'test/parallel-static-input-consumer.json': {
          value: 'entry-a',
        },
        'test/parallel-static-input-source.json': {
          built: true,
        },
      });
    });

    it('normalizes custom static paths to slash-separated logical keys', async () => {
      const customPathServiceDef = defineService({
        id: 'test/custom-static-paths',
        description: 'Exercises logical static path normalization.',
        initialState: { value: null as string | null },
        queries: {
          getValue: {
            description: 'Stores one custom value per static input.',
            input: v.object({
              path: v.string(),
              value: v.string(),
            }),
            output: v.nullable(v.string()),
            handler: async (_input, ctx) => ctx.self.state.value,
            preload: async (input, ctx) => {
              await ctx.self.commands.setValue(input);
            },
            static: {
              path: (input) => input.path,
              inputs: async () => [
                { path: './nested/value.json', value: 'dot' },
                { path: '/rooted.json', value: 'rooted' },
                { path: 'windows\\style.json', value: 'windows' },
              ],
            },
          },
        },
        commands: {
          setValue: {
            description:
              'Stores one value while preserving the custom path from the preload input.',
            input: v.object({
              path: v.string(),
              value: v.string(),
            }),
            output: v.undefined(),
            handler: async (input, ctx) => {
              ctx.self.setState((draft) => {
                draft.value = input.value;
              });

              return undefined;
            },
          },
        },
      });

      await expect(buildStaticFiles([customPathServiceDef])).resolves.toEqual({
        'nested/value.json': { value: 'dot' },
        'rooted.json': { value: 'rooted' },
        'windows/style.json': { value: 'windows' },
      });
    });

    it('rejects static paths that escape the services output root', async () => {
      const invalidPathServiceDef = defineService({
        id: 'test/invalid-static-path',
        description: 'Attempts to escape the static snapshot root.',
        initialState: { value: null as string | null },
        queries: {
          getValue: {
            description: 'Uses an invalid static path.',
            input: v.object({ build: v.literal('once') }),
            output: v.nullable(v.string()),
            handler: async (_input, ctx) => ctx.self.state.value,
            preload: async (_input, ctx) => {
              await ctx.self.commands.setValue(undefined);
            },
            static: {
              path: () => '../escape.json',
              inputs: async () => [{ build: 'once' as const }],
            },
          },
        },
        commands: {
          setValue: {
            description: 'Stores one placeholder value before the invalid path is resolved.',
            input: v.undefined(),
            output: v.undefined(),
            handler: async (_input, ctx) => {
              ctx.self.setState((draft) => {
                draft.value = 'invalid';
              });

              return undefined;
            },
          },
        },
      });

      await expect(buildStaticFiles([invalidPathServiceDef])).rejects.toMatchObject({
        fromStorybook: true,
        code: 10,
        message:
          'Invalid static path "../escape.json" for query "test/invalid-static-path.getValue": use a relative path with forward slashes and no ".." segments.',
      });
    });
  });

  describe('writeOpenServiceStaticFiles', () => {
    it('writes normalized snapshot files underneath outputDir/services', async () => {
      const outputDir = '/app/dist';
      const customPathServiceDef = defineService({
        id: 'test/write-open-service-static-files',
        description: 'Writes custom static paths to disk.',
        initialState: { value: null as string | null },
        queries: {
          getValue: {
            description: 'Stores one custom value per static input.',
            input: v.object({
              path: v.string(),
              value: v.string(),
            }),
            output: v.nullable(v.string()),
            handler: async (_input, ctx) => ctx.self.state.value,
            preload: async (input, ctx) => {
              await ctx.self.commands.setValue(input);
            },
            static: {
              path: (input) => input.path,
              inputs: async () => [
                { path: './nested/value.json', value: 'dot' },
                { path: '/rooted.json', value: 'rooted' },
                { path: 'windows\\style.json', value: 'windows' },
              ],
            },
          },
        },
        commands: {
          setValue: {
            description: 'Stores one value before the snapshot is written to disk.',
            input: v.object({
              path: v.string(),
              value: v.string(),
            }),
            output: v.undefined(),
            handler: async (input, ctx) => {
              ctx.self.setState((draft) => {
                draft.value = input.value;
              });

              return undefined;
            },
          },
        },
      });

      registerService(customPathServiceDef);

      await writeOpenServiceStaticFiles(outputDir);

      await expect(
        readFile(join(outputDir, 'services', 'nested', 'value.json'), 'utf8')
      ).resolves.toBe(JSON.stringify({ value: 'dot' }, null, 2));
      await expect(readFile(join(outputDir, 'services', 'rooted.json'), 'utf8')).resolves.toBe(
        JSON.stringify({ value: 'rooted' }, null, 2)
      );
      await expect(
        readFile(join(outputDir, 'services', 'windows', 'style.json'), 'utf8')
      ).resolves.toBe(JSON.stringify({ value: 'windows' }, null, 2));
    });
  });
});
