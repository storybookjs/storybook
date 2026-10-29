import { fileURLToPath } from 'node:url';

import { Channel } from '@storybook/core/internal/channels';
import {
  createStorybook,
  legacyPreset,
  type LegacyRegistrar,
  type Storybook,
} from '@storybook/core/internal/instance';
import { join, relative } from 'pathe';
import { afterEach, expect, it, vi } from 'vitest';

import { resolveNativeFactory } from '../../../../../core/src/instance/native-entry.ts';
import { PLUGIN_FACTORY } from '@storybook/core/internal/deep/instance/plugins';
import { legacyAdapter } from './legacy-adapter.ts';

vi.mock('@storybook/core/internal/deep/utils/module', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@storybook/core/internal/deep/utils/module')>();
  // Native builder entries become fakes that echo their entry and options.
  return {
    ...actual,
    importModule: vi.fn(async (path: string, options?: { skipCache?: boolean }) =>
      /builder-(vite|webpack5)[/\\](node|dist[/\\]node)/.test(path) &&
      process.env.STORYBOOK_FIXTURE_BUILDER
        ? Object.assign(
            (builderOptions: unknown) => ({
              meta: { name: path, kind: 'builder' },
              builderOptions,
            }),
            { [PLUGIN_FACTORY]: 'builder' }
          )
        : actual.importModule(path, options)
    ),
  };
});

const CODE_DIR = fileURLToPath(new URL('../../../../../', import.meta.url));
const INSTANCE_FIXTURES = join(CODE_DIR, 'core/src/instance/__fixtures__');
const LEGACY_FRAMEWORK_DIR = join(INSTANCE_FIXTURES, 'legacy-framework');
const THIRD_PARTY_BUILDER = join(LEGACY_FRAMEWORK_DIR, 'third-party-builder/index.js');
const CONFIG_DIR = join(INSTANCE_FIXTURES, 'first');
const ANNOTATION_DIR = join(INSTANCE_FIXTURES, 'annotation-order');
const FRAMEWORK_DIR = join(ANNOTATION_DIR, 'framework');
const NESTED_RENDERER_FRAMEWORK_DIR = join(ANNOTATION_DIR, 'nested-renderer-framework');
const LEGACY_ADDON_DIR = join(INSTANCE_FIXTURES, 'legacy-addon');
const INSTANCES: Storybook[] = [];

afterEach(async () => {
  await Promise.all(INSTANCES.splice(0).map((storybook) => storybook.close()));
  vi.unstubAllEnvs();
});

it.each([
  {
    name: 'a bare builder name',
    builder: '@storybook/builder-vite',
    expected: {
      name: 'builders/builder-vite/dist/node/index.js',
      options: undefined,
      wrapped: false,
    },
  },
  {
    name: 'a builder with options',
    builder: { name: '@storybook/builder-webpack5', options: { lazyCompilation: true } },
    expected: {
      name: 'builders/builder-webpack5/dist/node/index.js',
      options: { lazyCompilation: true },
      wrapped: false,
    },
  },
  {
    name: 'a third-party builder',
    builder: THIRD_PARTY_BUILDER,
    expected: {
      name: relative(CODE_DIR, THIRD_PARTY_BUILDER),
      options: undefined,
      wrapped: true,
    },
  },
])('bridges $name named by a legacy framework', async ({ builder, expected }) => {
  vi.stubEnv('STORYBOOK_FIXTURE_BUILDER', JSON.stringify(builder));
  const configDir = join(LEGACY_FRAMEWORK_DIR, '.storybook');
  const channel = new Channel({});
  const main = { framework: LEGACY_FRAMEWORK_DIR, stories: [] };
  const registrar: LegacyRegistrar = {
    virtualPreset: (plugin) => ({ type: 'virtual', name: plugin.meta.name }) as never,
    resolveBuild: async () => ({}),
    resolveNativeFactory,
  };
  const loaded = await legacyAdapter.load({
    storybook: { configDir, channel, mode: 'dev' } as Storybook,
    main,
    plugins: [],
    baseOptions: { configDir, configType: 'DEVELOPMENT', cacheKey: 'test', channel, main },
    registrar,
  });
  const plugin = loaded.builder as unknown as Record<string, unknown> & { meta: { name: string } };
  expect({
    name: plugin.meta.name.startsWith('/')
      ? relative(CODE_DIR, plugin.meta.name)
      : plugin.meta.name,
    options: plugin.builderOptions,
    wrapped: typeof plugin.dev === 'function',
  }).toEqual(expected);
});

it.each([
  {
    name: 'a legacy framework and renderer',
    framework: legacyPreset(FRAMEWORK_DIR, 'framework'),
    renderer: 'legacy',
    expected: {
      plugins: ['framework:framework', 'renderer:legacy-renderer/preset.js'],
      previewAnnotations: ['/renderer-preview.ts', '/framework-preview.ts'],
    },
  },
  {
    name: 'a legacy framework with a native renderer',
    framework: legacyPreset(FRAMEWORK_DIR, 'framework'),
    renderer: 'native',
    expected: {
      plugins: ['renderer:fixture-annotation-renderer', 'framework:framework'],
      previewAnnotations: ['/renderer-preview.ts', '/framework-preview.ts'],
    },
  },
  {
    name: 'a native framework',
    framework: FRAMEWORK_DIR,
    renderer: 'native',
    expected: {
      plugins: [
        'builder:fixture-annotation-builder',
        'renderer:fixture-annotation-renderer',
        'framework:fixture-annotation-framework',
      ],
      previewAnnotations: ['/renderer-preview.ts', '/framework-preview.ts'],
    },
  },
])('collects renderer annotations before framework annotations for $name', async (input) => {
  vi.stubEnv('STORYBOOK_FIXTURE_RENDERER', input.renderer);
  const storybook = await createStorybook(
    { configDir: CONFIG_DIR, mode: 'headless', main: { framework: input.framework, stories: [] } },
    { builtInAddons: [], legacy: legacyAdapter }
  );
  INSTANCES.push(storybook);
  expect({
    plugins: storybook.plugins.map(
      ({ kind, name }) => `${kind}:${name.startsWith('/') ? relative(ANNOTATION_DIR, name) : name}`
    ),
    previewAnnotations: storybook.options.previewAnnotations,
  }).toEqual(input.expected);
});

it.each([
  {
    name: 'a legacy addon listed twice',
    main: { stories: [], addons: [LEGACY_ADDON_DIR, LEGACY_ADDON_DIR] },
    expected: {
      plugins: ['addon:legacy-addon'],
      previewAnnotations: ['/legacy-addon-preview.ts'],
    },
  },
  {
    name: 'a legacy addon listed bare, then with options',
    main: {
      stories: [],
      addons: [LEGACY_ADDON_DIR, { name: LEGACY_ADDON_DIR, options: { flag: true } }],
    },
    expected: {
      plugins: ['addon:legacy-addon'],
      previewAnnotations: ['/legacy-addon-preview.ts'],
    },
  },
  {
    name: 'a legacy framework nesting the native renderer it names in core',
    main: {
      stories: [],
      framework: legacyPreset(NESTED_RENDERER_FRAMEWORK_DIR, 'framework'),
    },
    expected: {
      plugins: [
        'renderer:fixture-annotation-renderer',
        'framework:annotation-order/nested-renderer-framework',
      ],
      previewAnnotations: ['/renderer-preview.ts', '/framework-preview.ts'],
    },
  },
])('sets a plugin up once for $name', async ({ main, expected }) => {
  const storybook = await createStorybook(
    { configDir: CONFIG_DIR, mode: 'headless', main },
    { builtInAddons: [], legacy: legacyAdapter }
  );
  INSTANCES.push(storybook);
  expect({
    plugins: storybook.plugins.map(
      ({ kind, name }) =>
        `${kind}:${name.startsWith('/') ? relative(INSTANCE_FIXTURES, name) : name}`
    ),
    previewAnnotations: storybook.options.previewAnnotations,
  }).toEqual(expected);
});
