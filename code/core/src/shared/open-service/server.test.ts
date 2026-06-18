import { mkdir, readFile, writeFile } from 'node:fs/promises';

import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  type MutableRecordLookupService,
  mutableRecordLookupServiceDef,
} from './fixtures.ts';

// Spy-only mock: keep the real `node:fs/promises` module shape, then redirect the calls used by
// the static-files writer (and this test's own `readFile` assertions) to `memfs` so disk state
// stays scoped to `vol`.
vi.mock('node:fs/promises', { spy: true });

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  vi.mocked(mkdir).mockImplementation(
    memfs.fs.promises.mkdir as unknown as typeof import('node:fs/promises').mkdir
  );
  vi.mocked(writeFile).mockImplementation(
    memfs.fs.promises.writeFile as unknown as typeof import('node:fs/promises').writeFile
  );
  vi.mocked(readFile).mockImplementation(
    memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
  );
});

afterEach(() => {
  clearRegistry();
  vol.reset();
});

describe('server static builds', () => {
  describe('buildStaticFiles', () => {
    it('runs load from initial state for each input and deep-merges by path', async () => {
      registerService(awaitedPreloadValueServiceDef);

      await expect(buildStaticFiles()).resolves.toEqual({
        'internal-fixture/awaited-preload-value/state.json': {
          'entry-a': 'preloaded',
          'entry-b': 'preloaded',
        },
      });
    });

    it('uses a single staticPath for every input on one query', async () => {
      registerService(awaitedPreloadValueServiceDef);

      const store = await buildStaticFiles();

      expect(Object.keys(store)).toEqual(['internal-fixture/awaited-preload-value/state.json']);
    });

    it('skips services and queries without staticPath or staticInputs', async () => {
      registerService(mutableRecordLookupServiceDef);

      const store = await buildStaticFiles();

      expect(Object.keys(store)).toHaveLength(0);
    });

    it('deep-merges outputs from different queries that resolve to the same staticPath', async () => {
      registerService(createSharedStaticFileServiceDef());

      await expect(buildStaticFiles()).resolves.toEqual({
        'internal-fixture/shared-static-file/shared.json': {
          left: 'preloaded',
          right: 'preloaded',
        },
      });
    });

    it('uses the shared registry when static load and static inputs resolve another service', async () => {
      const sourceService = registerService(mutableRecordLookupServiceDef);
      await sourceService.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'match',
      });

      const staticLookupServiceDef = defineService({
        id: 'internal-fixture/static-build-service-lookup',
        description: 'Copies state from another registered service during static load.',
        initialState: { value: null as string | null },
        queries: {
          getValue: {
            description: 'Returns the value copied during static load.',
            input: v.object({ build: v.literal('once') }),
            output: v.nullable(v.string()),
            handler: (_input, ctx) => ctx.self.state.value,
            load: async (_input, ctx) => {
              await ctx.self.commands.copyValue(undefined);
            },
            staticPath: () => 'state.json',
            staticInputs: async () => [{ build: 'once' as const }],
          },
        },
        commands: {
          copyValue: {
            description: 'Reads marker state from the lookup service in the registry.',
            input: v.undefined(),
            output: v.undefined(),
            handler: async (_input, ctx) => {
              const source = ctx.getService<MutableRecordLookupService>(
                'internal-fixture/mutable-record-lookup'
              );
              const record = source.queries.getRecordFields.get({
                entryId: 'entry-a',
              });

              ctx.self.setState((state) => {
                state.value = record?.marker ?? null;
              });

              return undefined;
            },
          },
        },
      });

      registerService(staticLookupServiceDef);

      await expect(buildStaticFiles()).resolves.toEqual({
        'internal-fixture/static-build-service-lookup/state.json': {
          value: 'match',
        },
      });
    });

    it('runs load tasks in parallel so one snapshot can read state another snapshot publishes', async () => {
      const readyEntryIds: string[] = [];
      const parallelSourceServiceDef = defineService({
        id: 'internal-fixture/parallel-static-input-source',
        description: 'Publishes static input ids once its own load task starts running.',
        initialState: { built: false },
        queries: {
          getReadyEntryIds: {
            description: 'Returns the entry ids published by the source static build task.',
            input: v.undefined(),
            output: v.array(v.string()),
            handler: () => readyEntryIds,
            load: async (_input, ctx) => {
              await Promise.resolve();
              await ctx.self.commands.publishReadyEntryIds(undefined);
            },
            staticPath: () => 'state.json',
            staticInputs: async () => [undefined],
          },
        },
        commands: {
          publishReadyEntryIds: {
            description: 'Publishes one static entry id and marks the source snapshot as built.',
            input: v.undefined(),
            output: v.undefined(),
            handler: async (_input, ctx) => {
              readyEntryIds.splice(0, readyEntryIds.length, 'entry-a');
              ctx.self.setState((state) => {
                state.built = true;
              });

              return undefined;
            },
          },
        },
      });

      const parallelLookupServiceDef = defineService({
        id: 'internal-fixture/parallel-static-input-consumer',
        description:
          'Waits for another service query to publish its static inputs before running load.',
        initialState: { value: null as string | null },
        queries: {
          getValue: {
            description: 'Stores one value for each id discovered through another service query.',
            input: v.object({ entryId: v.string() }),
            output: v.nullable(v.string()),
            handler: (_input, ctx) => ctx.self.state.value,
            load: async (input, ctx) => {
              await ctx.self.commands.setValue(input);
            },
            staticPath: () => 'state.json',
          },
        },
        commands: {
          setValue: {
            description: 'Stores the discovered entry id in the consumer snapshot.',
            input: v.object({ entryId: v.string() }),
            output: v.undefined(),
            handler: async (input, ctx) => {
              ctx.self.setState((state) => {
                state.value = input.entryId;
              });

              return undefined;
            },
          },
        },
      });

      registerService(parallelSourceServiceDef);
      registerService(parallelLookupServiceDef, {
        queries: {
          getValue: {
            staticInputs: async (ctx) => {
              const source = ctx.getService('internal-fixture/parallel-static-input-source');

              for (let attempt = 0; attempt < 5; attempt += 1) {
                const entryIds = (await source.queries.getReadyEntryIds.loaded(
                  undefined
                )) as string[];

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
      });

      await expect(buildStaticFiles()).resolves.toEqual({
        'internal-fixture/parallel-static-input-consumer/state.json': {
          value: 'entry-a',
        },
        'internal-fixture/parallel-static-input-source/state.json': {
          built: true,
        },
      });
    });

    it('normalizes custom static paths to slash-separated logical keys', async () => {
      const customPathServiceDef = defineService({
        id: 'internal-fixture/custom-static-paths',
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
            handler: (_input, ctx) => ctx.self.state.value,
            load: async (input, ctx) => {
              await ctx.self.commands.setValue(input);
            },
            staticPath: (input) => input.path,
            staticInputs: async () => [
              { path: './nested/value.json', value: 'dot' },
              { path: '/rooted.json', value: 'rooted' },
              { path: 'windows\\style.json', value: 'windows' },
            ],
          },
        },
        commands: {
          setValue: {
            description: 'Stores one value while preserving the custom path from the load input.',
            input: v.object({
              path: v.string(),
              value: v.string(),
            }),
            output: v.undefined(),
            handler: async (input, ctx) => {
              ctx.self.setState((state) => {
                state.value = input.value;
              });

              return undefined;
            },
          },
        },
      });

      registerService(customPathServiceDef);

      await expect(buildStaticFiles()).resolves.toEqual({
        'internal-fixture/custom-static-paths/nested/value.json': { value: 'dot' },
        'internal-fixture/custom-static-paths/rooted.json': { value: 'rooted' },
        'internal-fixture/custom-static-paths/windows/style.json': { value: 'windows' },
      });
    });

    it('scopes staticPath values under the service id so two services cannot collide', async () => {
      const firstServiceDef = defineService({
        id: 'internal-fixture/scoped-static-path-a',
        description: 'Uses the same relative staticPath as another service.',
        initialState: { value: 'a' },
        queries: {
          getValue: {
            description: 'Returns one scoped value.',
            input: v.undefined(),
            output: v.string(),
            handler: (_input, ctx) => ctx.self.state.value,
            load: async () => {},
            staticPath: () => 'state.json',
            staticInputs: async () => [undefined],
          },
        },
        commands: {},
      });

      const secondServiceDef = defineService({
        id: 'internal-fixture/scoped-static-path-b',
        description: 'Uses the same relative staticPath as another service.',
        initialState: { value: 'b' },
        queries: {
          getValue: {
            description: 'Returns one scoped value.',
            input: v.undefined(),
            output: v.string(),
            handler: (_input, ctx) => ctx.self.state.value,
            load: async () => {},
            staticPath: () => 'state.json',
            staticInputs: async () => [undefined],
          },
        },
        commands: {},
      });

      registerService(firstServiceDef);
      registerService(secondServiceDef);

      await expect(buildStaticFiles()).resolves.toEqual({
        'internal-fixture/scoped-static-path-a/state.json': { value: 'a' },
        'internal-fixture/scoped-static-path-b/state.json': { value: 'b' },
      });
    });

    it('rejects static paths that escape the service output folder', async () => {
      const invalidPathServiceDef = defineService({
        id: 'internal-fixture/invalid-static-path',
        description: 'Attempts to escape the static snapshot root.',
        initialState: { value: null as string | null },
        queries: {
          getValue: {
            description: 'Uses an invalid static path.',
            input: v.object({ build: v.literal('once') }),
            output: v.nullable(v.string()),
            handler: (_input, ctx) => ctx.self.state.value,
            load: async (_input, ctx) => {
              await ctx.self.commands.setValue(undefined);
            },
            staticPath: () => '../escape.json',
            staticInputs: async () => [{ build: 'once' as const }],
          },
        },
        commands: {
          setValue: {
            description: 'Stores one placeholder value before the invalid path is resolved.',
            input: v.undefined(),
            output: v.undefined(),
            handler: async (_input, ctx) => {
              ctx.self.setState((state) => {
                state.value = 'invalid';
              });

              return undefined;
            },
          },
        },
      });

      registerService(invalidPathServiceDef);

      await expect(buildStaticFiles()).rejects.toMatchObject({
        fromStorybook: true,
        code: 10,
        message:
          'Invalid static path "../escape.json" for query "internal-fixture/invalid-static-path.getValue": use a relative path with forward slashes and no ".." segments.',
      });
    });
  });

  describe('writeOpenServiceStaticFiles', () => {
    it('writes normalized snapshot files underneath outputDir/services', async () => {
      const outputDir = '/app/dist';
      const customPathServiceDef = defineService({
        id: 'internal-fixture/write-open-service-static-files',
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
            handler: (_input, ctx) => ctx.self.state.value,
            load: async (input, ctx) => {
              await ctx.self.commands.setValue(input);
            },
            staticPath: (input) => input.path,
            staticInputs: async () => [
              { path: './nested/value.json', value: 'dot' },
              { path: '/rooted.json', value: 'rooted' },
              { path: 'windows\\style.json', value: 'windows' },
            ],
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
              ctx.self.setState((state) => {
                state.value = input.value;
              });

              return undefined;
            },
          },
        },
      });

      registerService(customPathServiceDef);

      await writeOpenServiceStaticFiles(outputDir);

      await expect(
        readFile(
          join(
            outputDir,
            'services',
            'internal-fixture',
            'write-open-service-static-files',
            'nested',
            'value.json'
          ),
          'utf8'
        )
      ).resolves.toBe(JSON.stringify({ value: 'dot' }, null, 2));
      await expect(
        readFile(
          join(
            outputDir,
            'services',
            'internal-fixture',
            'write-open-service-static-files',
            'rooted.json'
          ),
          'utf8'
        )
      ).resolves.toBe(JSON.stringify({ value: 'rooted' }, null, 2));
      await expect(
        readFile(
          join(
            outputDir,
            'services',
            'internal-fixture',
            'write-open-service-static-files',
            'windows',
            'style.json'
          ),
          'utf8'
        )
      ).resolves.toBe(JSON.stringify({ value: 'windows' }, null, 2));
    });
  });
});
