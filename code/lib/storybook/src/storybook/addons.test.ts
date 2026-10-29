import { fileURLToPath } from 'node:url';

import { relative, resolve } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createStorybook,
  defineAddon,
  type Storybook,
  type StorybookConfig,
  type StorybookHooks,
} from 'storybook/internal/instance';
import type { CoreConfig, PreviewAnnotation, ServerApp } from '@storybook/core/internal/types';
import mcp from '@storybook/addon-mcp/node';

import main from '../../../../.storybook/main.ts';
import { getRegisteredServices } from '../../../../core/src/shared/open-service/service-registry.ts';
import { getRegisteredToolsets } from '@storybook/core/open-service';
import { getMcpMetadataFromMainConfig } from './server/utils/runtime-instance-registry.ts';

const CODE_DIR = fileURLToPath(new URL('../../../../', import.meta.url));
const CONFIG_DIR = resolve(CODE_DIR, '.storybook');
const INSTANCES: Storybook[] = [];
const BUILT_IN_DIST = ['lib/storybook/dist/features/', 'core/dist/', 'lib/manager/dist/'];
const LOCAL_ADDONS = ['storybook-internal-vite', 'storybook-internal-services'];
const FEATURES_PRESET = fileURLToPath(
  new URL('./__fixtures__/features-preset.ts', import.meta.url)
);
const FLAGS = {
  componentsManifest: true,
  actions: false,
  backgrounds: false,
  controls: false,
  highlight: false,
  interactions: false,
  measure: false,
  outline: false,
  viewport: false,
};
const BUILT_IN_PREVIEWS = [
  'lib/storybook/dist/features/measure/preview.js',
  'lib/storybook/dist/features/backgrounds/preview.js',
  'lib/storybook/dist/features/highlight/preview.js',
  'lib/storybook/dist/features/outline/preview.js',
  'lib/storybook/dist/features/viewport/preview.js',
  'lib/storybook/dist/features/actions/preview.js',
  'lib/storybook/dist/features/component-testing/preview.js',
  'core/dist/test/preview.js',
  'core/dist/story-index/ghost-stories/test-annotations.js',
  'core/dist/shared/open-service/services/docgen/preview.js',
  'core/dist/shared/open-service/services/story-docs/preview.js',
];
// The internal config's local addons have no package preset to map to.
const LEGACY_ADDONS = main
  .addons!.map((addon) => (typeof addon === 'object' && 'meta' in addon ? addon.meta.name : addon))
  .filter((addon) => !LOCAL_ADDONS.includes(addon as string));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline addon parity test.')));
});

afterEach(async () => {
  await Promise.all(INSTANCES.splice(0).map((instance) => instance.close()));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function shape(value: unknown): unknown {
  if (typeof value === 'function') {
    return '[Function]';
  }
  if (value instanceof RegExp) {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(shape);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, shape(entry)]));
  }
  return value;
}

/** Keep the built-in entries, relative to `code/`. */
function builtIn(entries: PreviewAnnotation[]): string[] {
  return entries
    .map((entry) => relative(CODE_DIR, typeof entry === 'string' ? entry : entry.absolute))
    .filter((entry) => BUILT_IN_DIST.some((dir) => entry.startsWith(dir)));
}

async function load(addons: StorybookConfig['addons']): Promise<Storybook> {
  const instance = await createStorybook({
    configDir: CONFIG_DIR,
    workingDir: CODE_DIR,
    mode: 'headless',
    main: { ...main, addons },
  });
  INSTANCES.push(instance);
  return instance;
}

describe('official native addons', () => {
  it.each([
    [
      '@storybook/addon-docs',
      [
        'builder:vite:extend',
        'builder:webpack-config:extend',
        'core:docs:extend',
        'legacy:resolvedReact:extend',
        'builder:vite-deps:collect',
        'index:manifests:extend',
        'index:indexers:collect',
        'preview:annotations:collect',
      ],
    ],
    ['@storybook/addon-a11y', ['preview:annotations:collect']],
    ['@storybook/addon-vitest', ['core:static-dirs:collect', 'server:channel:ready']],
    [
      '@storybook/addon-mcp',
      ['core:features:extend', 'preview:annotations:collect', 'server:app:extend'],
    ],
    ['@storybook/addon-onboarding', ['server:channel:ready']],
  ] as const)(
    '%s preserves its preset contributions on the internal config',
    async (name, hooks) => {
      const native = main.addons!.find(
        (addon) => typeof addon === 'object' && 'meta' in addon && addon.meta.name === name
      )!;
      const results: unknown[] = [];
      for (const entry of [name, native]) {
        let registered: unknown;
        const observer = defineAddon(() => ({
          meta: { name: 'observe-services' },
          setup(storybook): void {
            const callHook = storybook.callHook.bind(storybook);
            vi.spyOn(storybook, 'callHook').mockImplementation(async (hook, ...args) => {
              const result = await Reflect.apply(callHook, storybook, [hook, ...args]);
              if (hook === 'core:services:register') {
                registered = {
                  result,
                  services: getRegisteredServices().map((service) => service.id),
                  toolsets: getRegisteredToolsets().map((toolset) => toolset.id),
                };
              }
              return result;
            });
          },
        }))();
        const instance = await load([
          observer,
          ...LEGACY_ADDONS.map((addon) => (addon === name ? entry : addon)),
        ]);
        const values: Record<string, unknown> = {
          services: registered,
          present: instance.hasPlugin(name),
        };
        for (const hook of hooks) {
          const args =
            hook === 'builder:vite:extend'
              ? [{ plugins: [], resolve: { alias: {} } }]
              : hook === 'builder:webpack-config:extend'
                ? [{}]
                : hook === 'index:manifests:extend'
                  ? [{}, { manifestEntries: [] }]
                  : hook.endsWith(':collect')
                    ? [[]]
                    : hook === 'server:channel:ready'
                      ? [instance.channel]
                      : [{}];
          if (hook === 'server:channel:ready') {
            // The Vitest runner is gated off so this test cannot spawn a test host.
            const apply = instance.presets.apply.bind(instance.presets);
            vi.spyOn(instance.presets, 'apply').mockImplementation(async (key, ...rest) => {
              const result = await apply(key, ...rest);
              return key === 'core'
                ? { ...(result as CoreConfig), builder: '@storybook/builder-webpack5' }
                : result;
            });
          }
          if (hook === 'server:app:extend') {
            const app = { get: vi.fn(), post: vi.fn(), use: vi.fn() };
            await instance.callHook(hook, app as unknown as ServerApp);
            values[hook] = {
              get: app.get.mock.calls,
              post: app.post.mock.calls,
              use: app.use.mock.calls,
            };
          } else {
            const invoke = instance.callHook as (
              hook: keyof StorybookHooks,
              ...args: unknown[]
            ) => Promise<unknown>;
            values[hook] = await invoke(hook, ...args);
          }
        }
        results.push(shape(values));
        await instance.close();
      }
      expect(results[1]).toEqual(results[0]);
    }
  );

  it('preserves the complete internal preview annotation list', async () => {
    const before = await load(LEGACY_ADDONS);
    const after = await load(main.addons);
    expect(after.options.previewAnnotations).toEqual(before.options.previewAnnotations);
    expect(after.options.indexers.map(shape)).toEqual(before.options.indexers.map(shape));
  });

  it('publishes a native MCP addon endpoint to the hosted instance registry', async () => {
    const addons = main.addons!.map((addon) =>
      typeof addon === 'object' && 'meta' in addon && addon.meta.name === '@storybook/addon-mcp'
        ? mcp({ endpoint: '/tools' })
        : addon
    );
    const instance = await load(addons);
    expect(
      await instance.callHook('server:mcp:extend', getMcpMetadataFromMainConfig({ addons }))
    ).toEqual({ status: 'ready', endpoint: '/tools' });
  });
});

describe('manager entries', () => {
  it('collects built-in managers in metadata order and their previews in setup order', async () => {
    const instance = await load([]);

    expect({
      manager: builtIn(await instance.callHook('manager:entries:collect', [])),
      preview: builtIn(await instance.callHook('preview:annotations:collect', [])),
    }).toMatchInlineSnapshot(`
      {
        "manager": [
          "lib/manager/dist/shared/open-service/services/docgen/manager.js",
          "lib/manager/dist/shared/open-service/services/review/manager.js",
          "lib/storybook/dist/features/measure/manager.js",
          "lib/storybook/dist/features/actions/manager.js",
          "lib/storybook/dist/features/backgrounds/manager.js",
          "lib/storybook/dist/features/component-testing/manager.js",
          "lib/storybook/dist/features/controls/manager.js",
          "lib/storybook/dist/features/viewport/manager.js",
          "lib/storybook/dist/features/outline/manager.js",
        ],
        "preview": [
          "lib/storybook/dist/features/measure/preview.js",
          "lib/storybook/dist/features/backgrounds/preview.js",
          "lib/storybook/dist/features/highlight/preview.js",
          "lib/storybook/dist/features/outline/preview.js",
          "lib/storybook/dist/features/viewport/preview.js",
          "lib/storybook/dist/features/actions/preview.js",
          "lib/storybook/dist/features/component-testing/preview.js",
          "core/dist/test/preview.js",
          "core/dist/story-index/ghost-stories/test-annotations.js",
          "core/dist/shared/open-service/services/docgen/preview.js",
          "core/dist/shared/open-service/services/story-docs/preview.js",
        ],
      }
    `);
  });

  it.each([
    {
      source: 'main.ts `features`',
      config: { features: { ...main.features, ...FLAGS }, addons: [] },
    },
    {
      source: 'a `features` preset function',
      config: { addons: [{ name: FEATURES_PRESET, options: { flags: FLAGS } }] },
    },
    {
      source: 'a setup-time `core:features:extend` handler',
      config: {
        addons: [
          defineAddon(() => ({
            meta: { name: 'flags' },
            setup(storybook): void {
              storybook.hook('core:features:extend', (value) => ({ ...value, ...FLAGS }));
            },
          }))(),
        ],
      },
    },
  ])('flags from $source hide only the built-in managers', async ({ config }) => {
    const instance = await createStorybook({
      configDir: CONFIG_DIR,
      workingDir: CODE_DIR,
      mode: 'headless',
      main: { ...main, ...config },
    });
    INSTANCES.push(instance);
    const app = { get: vi.fn(), post: vi.fn(), use: vi.fn() };
    await instance.callHook('server:app:extend', app as unknown as ServerApp);

    expect({
      manager: builtIn(await instance.callHook('manager:entries:collect', [])),
      preview: builtIn(await instance.callHook('preview:annotations:collect', [])),
      manifestRoute: app.get.mock.calls.some(([path]) => String(path).startsWith('/manifests/')),
    }).toEqual({
      manager: [
        'lib/manager/dist/shared/open-service/services/docgen/manager.js',
        'lib/manager/dist/shared/open-service/services/review/manager.js',
      ],
      preview: BUILT_IN_PREVIEWS,
      manifestRoute: true,
    });
  });

  it('collects native managers in main order before main managerEntries', async () => {
    const native = (name: string) =>
      defineAddon(() => ({
        meta: { name, order: name === 'first' ? 100 : -100 },
        manager: `${name}-manager.js`,
        setup(): void {},
      }))();
    const config = {
      ...main,
      addons: [native('first'), native('second')],
      managerEntries: ['legacy-manager.js'],
    };
    const instance = await createStorybook({
      configDir: CONFIG_DIR,
      workingDir: CODE_DIR,
      mode: 'dev',
      main: config,
    });
    INSTANCES.push(instance);
    expect((await instance.callHook('manager:entries:collect', [])).slice(-3)).toEqual([
      'first-manager.js',
      'second-manager.js',
      'legacy-manager.js',
    ]);
  });

  it('preserves the final manager entry list before and after converting the internal config', async () => {
    const before = await load(LEGACY_ADDONS);
    const after = await load(main.addons);
    const entries = async (storybook: Storybook): Promise<string[]> =>
      (await storybook.callHook('manager:entries:collect', [])).map((entry) =>
        relative(CODE_DIR, entry)
      );
    const baseline = await entries(before);
    expect({ before: baseline, after: await entries(after) }).toMatchInlineSnapshot(`
      {
        "after": [
          "lib/manager/dist/shared/open-service/services/docgen/manager.js",
          "lib/manager/dist/shared/open-service/services/review/manager.js",
          "lib/storybook/dist/features/measure/manager.js",
          "lib/storybook/dist/features/actions/manager.js",
          "lib/storybook/dist/features/backgrounds/manager.js",
          "lib/storybook/dist/features/component-testing/manager.js",
          "lib/storybook/dist/features/controls/manager.js",
          "lib/storybook/dist/features/viewport/manager.js",
          "lib/storybook/dist/features/outline/manager.js",
          "addons/onboarding/dist/manager.js",
          "addons/themes/dist/manager.js",
          "addons/docs/dist/manager.js",
          "../node_modules/@storybook/addon-designs/dist/register-panel.js",
          "addons/vitest/dist/manager.js",
          "addons/a11y/dist/manager.js",
          "addons/pseudo-states/dist/manager.js",
          "../node_modules/@chromatic-com/storybook/dist/manager.mjs",
        ],
        "before": [
          "lib/manager/dist/shared/open-service/services/docgen/manager.js",
          "lib/manager/dist/shared/open-service/services/review/manager.js",
          "lib/storybook/dist/features/measure/manager.js",
          "lib/storybook/dist/features/actions/manager.js",
          "lib/storybook/dist/features/backgrounds/manager.js",
          "lib/storybook/dist/features/component-testing/manager.js",
          "lib/storybook/dist/features/controls/manager.js",
          "lib/storybook/dist/features/viewport/manager.js",
          "lib/storybook/dist/features/outline/manager.js",
          "addons/onboarding/dist/manager.js",
          "addons/themes/dist/manager.js",
          "addons/docs/dist/manager.js",
          "../node_modules/@storybook/addon-designs/dist/register-panel.js",
          "addons/vitest/dist/manager.js",
          "addons/a11y/dist/manager.js",
          "addons/pseudo-states/dist/manager.js",
          "../node_modules/@chromatic-com/storybook/dist/manager.mjs",
        ],
      }
    `);
    expect(await entries(after)).toEqual(baseline);
  });
});
