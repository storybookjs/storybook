import { fileURLToPath } from 'node:url';

import { expect, it, vi } from 'vitest';

import { logger } from '@storybook/core/internal/node-logger';

import * as v from 'valibot';

import { defineService } from '../shared/open-service/service-definition.ts';
import { invokeToolsetMethod } from '../shared/open-service/toolset-definition.ts';
import fixtureFramework from './__fixtures__/annotation-order/framework/node.ts';
import dedupeAddon from './__fixtures__/dedupe-addon/node.ts';
import { createStorybook } from './create-storybook.ts';
import { defineAddon, ADDON_OPTIONS, type StorybookAddon } from './addons.ts';
import type { CreateStorybookInput, CreateStorybookOptions, Storybook } from './types.ts';

const CONFIG_DIR = fileURLToPath(new URL('./__fixtures__/first', import.meta.url));
const DEDUPE_ADDON = fileURLToPath(new URL('./__fixtures__/dedupe-addon', import.meta.url));
const HOST_COMMON = defineAddon(() => ({ meta: { name: 'host/common' }, setup(): void {} }))();
const HOST_ADDON = defineAddon(() => ({ meta: { name: 'host/addon' }, setup(): void {} }))();

// The stories path in indexing errors depends on the test runner's cwd.
const toMessage = (error: Error): string =>
  error.message.split('\n')[0].replace(/ \S*first\.stories\.ts$/, ' first.stories.ts');

async function describeInstance(options?: CreateStorybookOptions): Promise<unknown> {
  const storybook = createStorybook({ configDir: CONFIG_DIR, mode: 'headless' }, options);
  await storybook.ready();
  try {
    const index = await storybook.getIndex().then((value) => Object.keys(value.entries), toMessage);
    const docs = storybook.toolsets.values().find((toolset) => toolset.id === 'docs');
    const docsList = docs
      ? await invokeToolsetMethod(
          docs,
          'list',
          {},
          {
            transport: 'sdk',
            getService: storybook.services.get,
          }
        ).then(
          ({ data }) =>
            Object.fromEntries(
              Object.entries(
                (data as { manifests: { componentManifest: { components: object } } }).manifests
                  .componentManifest.components as Record<string, { error?: Error }>
              ).map(([id, entry]) => [id, entry.error?.name ?? 'documented'])
            ),
          toMessage
        )
      : 'no docs toolset';
    return {
      addons: storybook.addons.map((addon) => addon.name),
      toolsets: storybook.toolsets.values().map((toolset) => toolset.id),
      index,
      docsList,
    };
  } finally {
    await storybook.close();
  }
}

it('fills omitted options with core defaults', async () => {
  const cases: Record<string, CreateStorybookOptions | undefined> = {
    none: undefined,
    'common only': { common: HOST_COMMON },
    'builtInAddons only': { builtInAddons: [HOST_ADDON] },
    both: { common: HOST_COMMON, builtInAddons: [HOST_ADDON] },
  };
  const results: Record<string, unknown> = {};
  for (const [name, options] of Object.entries(cases)) {
    results[name] = await describeInstance(options);
  }
  expect(results).toMatchInlineSnapshot(`
    {
      "both": {
        "addons": [
          "@storybook/builder-vite",
          "@storybook/react",
          "@storybook/react-vite",
          "host/addon",
        ],
        "docsList": "no docs toolset",
        "index": "Unable to index first.stories.ts",
        "toolsets": [],
      },
      "builtInAddons only": {
        "addons": [
          "@storybook/builder-vite",
          "@storybook/react",
          "@storybook/react-vite",
          "host/addon",
        ],
        "docsList": "no docs toolset",
        "index": [
          "first--example",
        ],
        "toolsets": [
          "stories",
        ],
      },
      "common only": {
        "addons": [
          "@storybook/builder-vite",
          "@storybook/react",
          "@storybook/react-vite",
          "storybook/docgen",
          "storybook/story-docs",
          "storybook/change-detection",
        ],
        "docsList": "Unable to index first.stories.ts",
        "index": "Unable to index first.stories.ts",
        "toolsets": [
          "docs",
        ],
      },
      "none": {
        "addons": [
          "@storybook/builder-vite",
          "@storybook/react",
          "@storybook/react-vite",
          "storybook/docgen",
          "storybook/story-docs",
          "storybook/change-detection",
        ],
        "docsList": {
          "first": "documented",
        },
        "index": [
          "first--example",
        ],
        "toolsets": [
          "docs",
          "stories",
        ],
      },
    }
  `);
});

it('loads string addons with a native entry natively, without the legacy adapter', async () => {
  const storybook = createStorybook({
    configDir: CONFIG_DIR,
    mode: 'headless',
    main: {
      stories: [],
      addons: ['@storybook/addon-themes', { name: '@storybook/addon-links' }],
    },
  });
  await storybook.ready();
  try {
    expect(
      storybook.addons
        .filter((addon) => addon.kind === 'addon')
        .map((addon) => addon.name)
        .slice(-2)
    ).toMatchInlineSnapshot(`
      [
        "@storybook/addon-themes",
        "@storybook/addon-links",
      ]
    `);
  } finally {
    await storybook.close();
  }
});

it('keeps each instance index isolated within one process', async () => {
  const indexed = createStorybook({ configDir: CONFIG_DIR, mode: 'headless' });
  const unindexed = createStorybook(
    { configDir: CONFIG_DIR, mode: 'headless' },
    { common: HOST_COMMON, builtInAddons: [HOST_ADDON] }
  );
  await Promise.all([indexed.ready(), unindexed.ready()]);
  try {
    const results = {
      indexed: await indexed.getIndex().then((value) => Object.keys(value.entries), toMessage),
      unindexed: await unindexed.getIndex().then((value) => Object.keys(value.entries), toMessage),
    };
    expect(results).toMatchInlineSnapshot(`
      {
        "indexed": [
          "first--example",
        ],
        "unindexed": "Unable to index first.stories.ts",
      }
    `);
  } finally {
    await Promise.all([indexed.close(), unindexed.close()]);
  }
});

it.each([
  {
    name: 'the same string twice',
    input: { addons: [DEDUPE_ADDON, DEDUPE_ADDON] },
    expected: { setups: ['addon:fixture-dedupe-addon'], warnings: [] },
  },
  {
    name: 'a string, then a native addon with options',
    input: { addons: [DEDUPE_ADDON, dedupeAddon({ color: 'red' })] },
    expected: { setups: ['addon:fixture-dedupe-addon {"color":"red"}'], warnings: [] },
  },
  {
    name: 'a native addon with options, then a string',
    input: { addons: [dedupeAddon({ color: 'red' }), DEDUPE_ADDON] },
    expected: { setups: ['addon:fixture-dedupe-addon {"color":"red"}'], warnings: [] },
  },
  {
    name: 'an entry with options, then a string',
    input: { addons: [{ name: DEDUPE_ADDON, options: { color: 'red' } }, DEDUPE_ADDON] },
    expected: { setups: ['addon:fixture-dedupe-addon {"color":"red"}'], warnings: [] },
  },
  {
    name: 'two native addons with equal options',
    input: { addons: [dedupeAddon({ color: 'red' }), dedupeAddon({ color: 'red' })] },
    expected: { setups: ['addon:fixture-dedupe-addon {"color":"red"}'], warnings: [] },
  },
  {
    name: 'two native addons with different options',
    input: { addons: [dedupeAddon({ color: 'red' }), dedupeAddon({ color: 'blue' })] },
    expected: {
      setups: ['addon:fixture-dedupe-addon {"color":"red"}'],
      warnings: [
        '"fixture-dedupe-addon" is configured more than once with different options; using the first.',
      ],
    },
  },
  {
    name: 'a deprecated preset specifier and its package',
    input: { addons: ['@storybook/addon-themes/preset', '@storybook/addon-themes'] },
    expected: { setups: ['addon:@storybook/addon-themes'], warnings: [] },
  },
  {
    name: 'a built-in addon listed in main',
    input: { builtInAddons: [dedupeAddon()], addons: [DEDUPE_ADDON] },
    expected: { setups: ['addon:fixture-dedupe-addon'], warnings: [] },
  },
  {
    name: 'a framework addon listed in main with options',
    input: {
      framework: { ...fixtureFramework(), addons: [dedupeAddon()] },
      addons: [dedupeAddon({ color: 'red' })],
    },
    expected: {
      setups: [
        'builder:fixture-annotation-builder',
        'renderer:fixture-annotation-renderer',
        'addon:fixture-dedupe-addon {"color":"red"}',
        'framework:fixture-annotation-framework',
      ],
      warnings: [],
    },
  },
])('sets an addon up once for $name', async ({ input, expected }) => {
  const warn = vi.spyOn(logger, 'warn');
  const setups: string[] = [];
  const { builtInAddons = [], ...main } = input as typeof input & {
    builtInAddons?: CreateStorybookOptions['builtInAddons'];
  };
  const storybook = createStorybook(
    { configDir: CONFIG_DIR, mode: 'headless', main: { stories: [], ...main } },
    {
      builtInAddons,
      setupAddon(addon): void {
        const options = (addon as { [ADDON_OPTIONS]?: unknown })[ADDON_OPTIONS];
        setups.push(
          `${addon.meta.kind}:${addon.meta.name}${options ? ` ${JSON.stringify(options)}` : ''}`
        );
      },
    }
  );
  await storybook.ready();
  try {
    expect({
      setups,
      warnings: warn.mock.calls
        .map(([message]) => String(message))
        .filter((message) => message.includes('configured more than once')),
    }).toEqual(expected);
  } finally {
    warn.mockRestore();
    await storybook.close();
  }
});

it('merges overrides over the main configuration before addons load', async () => {
  const cases: Record<string, Pick<CreateStorybookInput, 'main' | 'overrides'>> = {
    'main input': {
      main: { stories: [], logLevel: 'info', docs: { defaultName: 'Docs', docsMode: false } },
      overrides: { logLevel: 'warn', docs: { docsMode: true } },
    },
    'loaded main.ts': {
      overrides: { docs: { defaultName: 'Guide' }, stories: [] },
    },
    'an override replacing an array': {
      main: { stories: ['./a.stories.ts'], docs: { defaultName: 'Docs' } },
      overrides: { stories: ['./b.stories.ts'] },
    },
  };
  const results: Record<string, unknown> = {};
  for (const [name, input] of Object.entries(cases)) {
    const storybook = createStorybook(
      { configDir: CONFIG_DIR, mode: 'headless', ...input },
      { builtInAddons: [] }
    );
    await storybook.ready();
    const { framework, stories, logLevel, docs } = storybook.options.main;
    results[name] = { main: { framework, stories, logLevel, docs }, docs: storybook.options.docs };
    await storybook.close();
  }
  expect(results).toMatchInlineSnapshot(`
    {
      "an override replacing an array": {
        "docs": {
          "defaultName": "Docs",
        },
        "main": {
          "docs": {
            "defaultName": "Docs",
          },
          "framework": undefined,
          "logLevel": undefined,
          "stories": [
            "./b.stories.ts",
          ],
        },
      },
      "loaded main.ts": {
        "docs": {
          "defaultName": "Guide",
        },
        "main": {
          "docs": {
            "defaultName": "Guide",
          },
          "framework": "@storybook/react-vite",
          "logLevel": undefined,
          "stories": [],
        },
      },
      "main input": {
        "docs": {
          "defaultName": "Docs",
          "docsMode": true,
        },
        "main": {
          "docs": {
            "defaultName": "Docs",
            "docsMode": true,
          },
          "framework": undefined,
          "logLevel": "warn",
          "stories": [],
        },
      },
    }
  `);
});

const recordingAddon = (
  log: string[],
  name: string,
  setup: (storybook: Storybook) => void = () => {}
): StorybookAddon =>
  defineAddon(() => ({
    meta: { name },
    setup(storybook): void {
      log.push(name);
      setup(storybook);
    },
  }))();

const attempt = async (fn: () => unknown): Promise<unknown> => {
  try {
    return await fn();
  } catch (error) {
    return (error as Error).message;
  }
};

it('loads on ready(), once, with addons added before ready and during setup', async () => {
  const setups: string[] = [];
  const storybook = createStorybook(
    {
      configDir: CONFIG_DIR,
      mode: 'headless',
      main: {
        stories: [],
        addons: [
          recordingAddon(setups, 'main/addon', (instance) =>
            instance.addAddon(recordingAddon(setups, 'main/child'))
          ),
        ],
      },
    },
    { builtInAddons: [] }
  );
  try {
    storybook.addAddon(recordingAddon(setups, 'host/addon'));
    const optionsBeforeReady = await attempt(() => storybook.options);
    const first = storybook.ready();
    const second = storybook.ready();
    await first;
    expect({
      sameReadyPromise: first === second,
      setups,
      addons: storybook.addons.filter((addon) => addon.kind === 'addon').map((addon) => addon.name),
      optionsBeforeReady,
      optionsFrozen: Object.isFrozen(storybook.options),
    }).toMatchInlineSnapshot(`
      {
        "addons": [
          "main/addon",
          "main/child",
          "host/addon",
        ],
        "optionsBeforeReady": "Storybook is not ready (current phase: load).",
        "optionsFrozen": true,
        "sameReadyPromise": true,
        "setups": [
          "main/addon",
          "main/child",
          "host/addon",
        ],
      }
    `);
  } finally {
    await storybook.close();
  }
});

it('keeps registration open after ready and closes everything on close', async () => {
  const storybook = createStorybook(
    { configDir: CONFIG_DIR, mode: 'headless', main: { stories: [] } },
    { builtInAddons: [] }
  );
  await storybook.ready();
  const service = defineService({
    id: 'test/late',
    initialState: {},
    queries: {},
    commands: { run: { input: v.void(), output: v.string(), handler: async () => 'late' } },
  });
  const afterReady = {
    addAddon: await attempt(() => storybook.addAddon(recordingAddon([], 'late/addon'))),
    hook: await attempt(() =>
      storybook.hook('preview:annotations:collect', () => ['late-preview.ts'])
    ),
    callHook: await attempt(() => storybook.callHook('preview:annotations:collect', [])),
    registerService: await attempt(() => {
      storybook.registerService(service);
      return storybook.services.get('test/late').commands.run(undefined);
    }),
    frozenAnnotations: storybook.options.previewAnnotations,
  };
  await storybook.close();
  const afterClose = {
    ready: await attempt(() => storybook.ready()),
    addAddon: await attempt(() => storybook.addAddon(recordingAddon([], 'closed/addon'))),
    hook: await attempt(() => storybook.hook('preview:annotations:collect', () => [])),
    callHook: await attempt(() => storybook.callHook('preview:annotations:collect', [])),
  };
  expect({ afterReady, afterClose }).toMatchInlineSnapshot(`
    {
      "afterClose": {
        "addAddon": "Storybook is closed.",
        "callHook": "Storybook is closed.",
        "hook": "Storybook is closed.",
        "ready": undefined,
      },
      "afterReady": {
        "addAddon": "Addons can only be added before ready() or during setup (current phase: ready).",
        "callHook": [
          "late-preview.ts",
        ],
        "frozenAnnotations": [],
        "hook": undefined,
        "registerService": "late",
      },
    }
  `);
});

it('rejects added addons of another kind or without setup', async () => {
  const storybook = createStorybook({ configDir: CONFIG_DIR, mode: 'headless' });
  try {
    const cases = {
      builder: { meta: { name: 'host/builder', kind: 'builder' }, setup(): void {} },
      'no setup': { meta: { name: 'host/no-setup', kind: 'addon' } },
    };
    const results: Record<string, unknown> = {};
    for (const [name, addon] of Object.entries(cases)) {
      results[name] = await attempt(() => storybook.addAddon(addon as StorybookAddon));
    }
    expect(results).toMatchInlineSnapshot(`
      {
        "builder": "addAddon only accepts addons; "host/builder" is a builder.",
        "no setup": "Every addon must declare meta.name, meta.kind, and setup(storybook).",
      }
    `);
  } finally {
    await storybook.close();
  }
});

it.each([
  {
    name: 'in headless mode',
    input: { mode: 'headless' as const, withHost: true, closeFirst: false },
    expected: 'storybook.dev() requires mode: "dev" (current mode: headless).',
  },
  {
    name: 'without an injected host',
    input: { mode: 'dev' as const, withHost: false, closeFirst: false },
    expected: 'This instance has no dev server; use createStorybook from "storybook" to start one.',
  },
  {
    name: 'after close',
    input: { mode: 'dev' as const, withHost: true, closeFirst: true },
    expected: 'Storybook is closed.',
  },
])('rejects dev() $name', async ({ input: { mode, withHost, closeFirst }, expected }) => {
  const startDevServer = vi.fn();
  const storybook = createStorybook(
    { configDir: CONFIG_DIR, mode, main: { stories: [] } },
    { builtInAddons: [], dev: withHost ? startDevServer : undefined }
  );
  if (closeFirst) {
    await storybook.close();
  }
  try {
    expect(await attempt(() => storybook.dev())).toBe(expected);
    expect(startDevServer).not.toHaveBeenCalled();
  } finally {
    await storybook.close();
  }
});

it.each([
  {
    name: 'in dev mode',
    input: { mode: 'dev' as const, withHost: true, closeFirst: false },
    expected: 'storybook.build() requires mode: "build" (current mode: dev).',
  },
  {
    name: 'without an injected host',
    input: { mode: 'build' as const, withHost: false, closeFirst: false },
    expected:
      'This instance has no static build; use createStorybook from "storybook" to build one.',
  },
  {
    name: 'after close',
    input: { mode: 'build' as const, withHost: true, closeFirst: true },
    expected: 'Storybook is closed.',
  },
])('rejects build() $name', async ({ input: { mode, withHost, closeFirst }, expected }) => {
  const runBuild = vi.fn();
  const storybook = createStorybook(
    { configDir: CONFIG_DIR, mode, main: { stories: [] } },
    { builtInAddons: [], build: withHost ? runBuild : undefined }
  );
  if (closeFirst) {
    await storybook.close();
  }
  try {
    expect(await attempt(() => storybook.build())).toBe(expected);
    expect(runBuild).not.toHaveBeenCalled();
  } finally {
    await storybook.close();
  }
});

it('runs the static build once, after ready', async () => {
  const runBuild = vi.fn(async (instance: Storybook) => ({
    outputDir: `frozen: ${Object.isFrozen(instance.options)}`,
  }));
  const storybook = createStorybook(
    { configDir: CONFIG_DIR, mode: 'build', main: { stories: [] } },
    { builtInAddons: [], build: runBuild }
  );
  try {
    const first = storybook.build();
    const second = storybook.build();
    expect({
      sameBuildPromise: first === second,
      result: await first,
      builds: runBuild.mock.calls.length,
    }).toMatchInlineSnapshot(`
      {
        "builds": 1,
        "result": {
          "outputDir": "frozen: true",
        },
        "sameBuildPromise": true,
      }
    `);
  } finally {
    await storybook.close();
  }
});

it('starts the dev server once, after ready, and stops it once on close', async () => {
  const log: string[] = [];
  const devServer = {
    port: 6006,
    address: 'http://localhost:6006/',
    networkAddress: 'http://192.168.0.1:6006/',
    close: vi.fn(async () => {
      log.push('dev server closed');
    }),
  };
  const startDevServer = vi.fn(async (instance: Storybook) => {
    log.push(`started, options frozen: ${Object.isFrozen(instance.options)}`);
    return devServer;
  });
  const storybook = createStorybook(
    { configDir: CONFIG_DIR, mode: 'dev', main: { stories: [] } },
    { builtInAddons: [], dev: startDevServer }
  );
  storybook.hook('core:instance:close', () => {
    log.push('core:instance:close');
  });
  const first = storybook.dev();
  const second = storybook.dev();
  const started = await first;
  await Promise.all([storybook.close(), storybook.close()]);
  expect({
    sameDevPromise: first === second,
    sameServer: started === devServer,
    starts: startDevServer.mock.calls.length,
    closes: devServer.close.mock.calls.length,
    log,
  }).toMatchInlineSnapshot(`
    {
      "closes": 1,
      "log": [
        "started, options frozen: true",
        "dev server closed",
        "core:instance:close",
      ],
      "sameDevPromise": true,
      "sameServer": true,
      "starts": 1,
    }
  `);
});
