import { readFile } from 'node:fs/promises';
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
import type { CoreConfig, ServerApp } from '@storybook/core/internal/types';
import mcp from '@storybook/addon-mcp/node';

import main from '../../../../.storybook/main.ts';
import { getRegisteredServices } from '../../../../core/src/shared/open-service/service-registry.ts';
import { getRegisteredToolsets } from '@storybook/core/open-service';
import { getBuiltInManagerEntries } from './server/presets/manager-entries.ts';
import { getMcpMetadataFromMainConfig } from './server/utils/runtime-instance-registry.ts';

const CODE_DIR = fileURLToPath(new URL('../../../../', import.meta.url));
const CONFIG_DIR = resolve(CODE_DIR, '.storybook');
const INSTANCES: Storybook[] = [];
const LOCAL_ADDONS = ['storybook-internal-vite', 'storybook-internal-services'];
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
  it('bundles built-in managers in addon metadata order', async () => {
    const entries = getBuiltInManagerEntries();
    // Product entries are package-relative paths; other packages' entries are module specifiers.
    const fromCode = (entry: string) =>
      entry.startsWith('src/') ? `lib/storybook/${entry}` : entry;
    expect(entries.map(fromCode)).toMatchInlineSnapshot(`
      [
        "@storybook/manager/internal/deep/shared/open-service/services/docgen/manager",
        "@storybook/manager/internal/deep/shared/open-service/services/review/manager",
        "lib/storybook/src/features/measure/manager.tsx",
        "lib/storybook/src/features/actions/manager.tsx",
        "lib/storybook/src/features/backgrounds/manager.tsx",
        "lib/storybook/src/features/component-testing/manager.tsx",
        "lib/storybook/src/features/controls/manager.tsx",
        "lib/storybook/src/features/viewport/manager.tsx",
        "lib/storybook/src/features/outline/manager.tsx",
      ]
    `);
    const source = await readFile(
      new URL('./server/presets/common-manager.ts', import.meta.url),
      'utf8'
    );
    const imports = [...source.matchAll(/import manager\d+ from '([^']+)'/g)].map((match) =>
      match[1].startsWith('.')
        ? relative(
            resolve(CODE_DIR, 'lib/storybook'),
            resolve(CODE_DIR, 'lib/storybook/src/storybook/server/presets', match[1])
          )
        : match[1]
    );
    expect(imports).toEqual(entries);
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
    expect(await instance.callHook('manager:entries:collect', [])).toEqual([
      resolve(CODE_DIR, 'lib/storybook/dist/storybook/server/presets/common-manager.js'),
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
          "lib/storybook/dist/storybook/server/presets/common-manager.js",
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
          "lib/storybook/dist/storybook/server/presets/common-manager.js",
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
