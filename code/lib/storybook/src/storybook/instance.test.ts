import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { basename, dirname } from 'pathe';
import * as v from 'valibot';
import { reactVite, type StorybookConfig as ReactViteConfig } from '@storybook/react-vite/node';
import * as common from '@storybook/core/internal/common';
import * as presets from './compat/presets.ts';

import { getFeatures } from '@storybook/core/internal/common';
import { shouldWaitForServiceSnippet } from '@storybook/core/internal/docs-tools';

import { getChannel } from '@storybook/core/internal/channels';
import { getStatusStoreByTypeId as experimental_getStatusStore } from '@storybook/core/internal/deep/services/stores/status';
import { defineService } from '@storybook/core/open-service';
import { getService } from '../../../../core/src/shared/open-service/service-registry.ts';
import { defineToolset } from '@storybook/core/open-service';
import { getRegisteredToolsets } from '@storybook/core/open-service';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from '@storybook/core/internal/types';
import { UniversalStore } from '@storybook/core/internal/deep/shared/universal-store';
import {
  createStorybook,
  defineAddon,
  legacyPreset,
  type Storybook,
  type StorybookConfig,
} from 'storybook/internal/instance';
import { resolveChangeDetectionAdapter } from '@storybook/core/internal/services';
import { OpenServiceRemoteCommandConfigDriftError } from '@storybook/core/internal/server-errors';
import { SERVICE_COMMAND_INVOKE } from '../../../../core/src/shared/open-service/service-channel.ts';
import { createTransportPair } from './__fixtures__/transport-pair.ts';
import { runWithStorybook } from '@storybook/core/internal/deep/instance/instance-context';
import { getInstanceContext } from '@storybook/core/internal/deep/shared/instance-context';
import { logger } from '@storybook/core/internal/node-logger';
import { initializeChecklist } from '../features/checklist/checklist.ts';
import * as instance from '../../../../core/src/instance/create-storybook.ts';

vi.mock('./compat/presets.ts', { spy: true });
vi.mock('../features/checklist/checklist.ts', { spy: true });
const INSTANCES: Storybook[] = [];
const LOCAL_ADDONS = ['storybook-internal-vite', 'storybook-internal-services'];
const DESIGNS_PRESET = fileURLToPath(import.meta.resolve('@storybook/addon-designs/preset'));
const LEGACY_FRAMEWORK = fileURLToPath(
  new URL('./__fixtures__/legacy-react-vite-framework', import.meta.url)
);

afterEach(async () => {
  await Promise.all(INSTANCES.splice(0).map((storybook) => storybook.close()));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('createStorybook', () => {
  it.each([
    {
      caller: 'A',
      command: 'run',
      expected: {
        attached: [false, true],
        modes: ['headless', 'headless'],
        result: 'ran-in-A',
        configDrift: false,
        invokes: 0,
        registryUnchanged: true,
        localAfterAttach: 'ran-in-A',
      },
    },
    {
      caller: 'B',
      command: 'run',
      expected: {
        attached: [false, true],
        modes: ['headless', 'headless'],
        result: 'ran-in-A',
        configDrift: false,
        invokes: 1,
        registryUnchanged: true,
        localAfterAttach: 'ran-in-A',
      },
    },
    {
      caller: 'B',
      command: 'missing',
      expected: {
        attached: [false, true],
        modes: ['headless', 'headless'],
        result: 'SB_CORE-COMMON_0030 (OpenServiceRemoteCommandConfigDriftError)',
        configDrift: true,
        invokes: 1,
        registryUnchanged: true,
        localAfterAttach: 'ran-in-A',
      },
    },
  ] as const)(
    'isolates $caller.$command across local and attached instances',
    async ({ caller, command, expected }) => {
      const [serverTransport, clientTransport] = createTransportPair();
      const definition = defineService({
        id: 'instance/attachment',
        initialState: {},
        queries: {},
        commands: {
          run: { input: v.void(), output: v.string(), handler: async () => 'ran-in-A' },
          missing: { input: v.void(), output: v.string() },
        },
      });
      const addon = defineAddon(() => ({
        meta: { name: 'instance-attachment' },
        setup(storybook): void {
          storybook.registerService(definition);
        },
      }));
      const input = {
        configDir: fileURLToPath(
          new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
        ),
        mode: 'headless' as const,
        main: { stories: [], addons: [addon()] },
      };
      const A = instance.createStorybook(input, { builtInAddons: [] });
      INSTANCES.push(A);
      await A.ready();
      A.channel.addTransport(serverTransport);
      const localService = A.services.get(definition.id);
      const invokes = vi.fn();
      A.channel.on(SERVICE_COMMAND_INVOKE, invokes);
      const B = instance.createStorybook(
        { ...input, attach: { transport: clientTransport } },
        { builtInAddons: [] }
      );
      INSTANCES.push(B);
      await B.ready();
      const client = caller === 'A' ? A : B;
      const result = await client.services
        .get(definition.id)
        .commands[command](undefined)
        .catch((error: unknown) => error);
      const observed = {
        attached: [A.attached, B.attached],
        modes: [A.mode, B.mode],
        result: result instanceof Error ? result.name : result,
        configDrift: result instanceof OpenServiceRemoteCommandConfigDriftError,
        invokes: invokes.mock.calls.length,
        registryUnchanged: A.services.get(definition.id) === localService,
        localAfterAttach: await A.services.get(definition.id).commands.run(undefined),
      };
      expect(observed).toEqual(expected);
    }
  );

  it.each(['dev', 'build'] as const)('rejects attachment in %s mode', async (mode) => {
    const [transport] = createTransportPair();
    expect(() =>
      createStorybook({ configDir: '.storybook', mode, attach: { transport } })
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Attaching to Storybook requires mode: "headless".]`
    );
  });

  it('sets up built-ins in list order before user addons', async () => {
    const order: string[] = [];
    const createInstance = instance.createStorybook;
    vi.spyOn(instance, 'createStorybook').mockImplementation((input, options) => {
      for (const addon of options?.builtInAddons ?? []) {
        const setup = addon.setup;
        vi.spyOn(addon, 'setup').mockImplementation(async (storybook) => {
          order.push(addon.meta.name);
          await setup(storybook);
        });
      }
      return createInstance(input, options);
    });
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: {
        stories: [],
        addons: [
          defineAddon(() => ({
            meta: { name: 'user' },
            setup() {
              order.push('user');
            },
          }))(),
        ],
      },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    expect(order).toMatchInlineSnapshot(`
      [
        "storybook/measure",
        "storybook/backgrounds",
        "storybook/highlight",
        "storybook/outline",
        "storybook/viewport",
        "storybook/actions",
        "storybook/component-testing",
        "storybook/test",
        "storybook/ghost-stories",
        "storybook/docgen",
        "storybook/review",
        "storybook/story-docs",
        "storybook/controls",
        "storybook/toolbar",
        "storybook/components-manifest",
        "storybook/change-detection",
        "storybook/checklist",
        "storybook/whats-new",
        "storybook/open-in-editor",
        "user",
      ]
    `);
  });

  it('lists completed addons by package name, including native and legacy addons', async () => {
    const framework = reactVite();
    const addon = defineAddon(() => ({
      meta: { name: 'native-addon' },
      setup(storybook): void {
        expect(() => storybook.addons).toThrow('until all addons have completed setup');
        storybook.hook('core:services:register', () => {
          expect(storybook.hasAddon('@storybook/addon-a11y')).toBe(true);
        });
      },
    }));
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: { framework, stories: [], addons: [addon(), '@storybook/addon-a11y'] },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    expect(storybook.addons.map(({ name }) => name)).toMatchInlineSnapshot(`
      [
        "@storybook/builder-vite",
        "@storybook/react",
        "@storybook/react-vite",
        "storybook/measure",
        "storybook/backgrounds",
        "storybook/highlight",
        "storybook/outline",
        "storybook/viewport",
        "storybook/actions",
        "storybook/component-testing",
        "storybook/test",
        "storybook/ghost-stories",
        "storybook/docgen",
        "storybook/review",
        "storybook/story-docs",
        "storybook/controls",
        "storybook/toolbar",
        "storybook/components-manifest",
        "storybook/change-detection",
        "storybook/checklist",
        "storybook/whats-new",
        "storybook/open-in-editor",
        "native-addon",
        "@storybook/addon-a11y",
      ]
    `);
    expect(storybook.hasAddon('native-addon')).toBe(true);
    expect(storybook.hasAddon('@storybook/addon-a11y')).toBe(true);
    expect(storybook.hasAddon('absent-addon')).toBe(false);
    expect(Object.isFrozen(storybook.addons)).toBe(true);
  });

  it.each([
    {
      name: 'a native string',
      framework: '@storybook/react-vite',
      expected: { name: '@storybook/react-vite', options: {} },
    },
    {
      name: 'a bridged string',
      framework: legacyPreset(LEGACY_FRAMEWORK, 'framework'),
      expected: { name: LEGACY_FRAMEWORK, options: {} },
    },
    {
      name: 'a native entry',
      framework: { name: '@storybook/react-vite', options: { strictMode: true } },
      expected: { name: '@storybook/react-vite', options: { strictMode: true } },
    },
    {
      name: 'a bridged entry',
      framework: legacyPreset(
        { name: LEGACY_FRAMEWORK, options: { strictMode: true } },
        'framework'
      ),
      expected: { name: LEGACY_FRAMEWORK, options: { strictMode: true } },
    },
  ])('applies the framework as a name and options for $name', async ({ framework, expected }) => {
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: { framework, stories: [] },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    expect(await storybook.presets.apply('framework')).toEqual(expected);
    expect(storybook.options.framework).toBe(framework);
  });

  it.each([
    {
      case: 'a package name by that name',
      addon: '@storybook/addon-designs',
      name: '@storybook/addon-designs',
      expected: true,
    },
    {
      case: 'a preset path by its package name',
      addon: DESIGNS_PRESET,
      name: '@storybook/addon-designs',
      expected: true,
    },
    {
      case: 'a preset path by that path',
      addon: DESIGNS_PRESET,
      name: DESIGNS_PRESET,
      expected: true,
    },
    {
      case: 'a preset path by another package name',
      addon: DESIGNS_PRESET,
      name: '@storybook/addon-a11y',
      expected: false,
    },
  ])('checks for a legacy addon written as $case', async ({ addon, name, expected }) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline addon name test.')));
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: { stories: [], addons: [addon] },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    expect(storybook.hasAddon(name)).toBe(expected);
  });

  it('loads a composed React Vite framework without the preset loader and indexes its stories', async () => {
    const configDir = fileURLToPath(
      new URL('./__fixtures__/react-vite-framework', import.meta.url)
    );
    const load = vi.spyOn(presets, 'loadAllPresets');
    const storybook = createStorybook({ configDir, mode: 'headless' });
    INSTANCES.push(storybook);
    await storybook.ready();
    expect(load).not.toHaveBeenCalled();
    expect(storybook.builder?.meta).toEqual({ name: '@storybook/builder-vite', kind: 'builder' });
    expect(Object.keys((await storybook.getIndex()).entries)).toEqual(['composed--example']);
  });

  it('sets up builder, renderer, default addons, framework, then user addons', async () => {
    const order: string[] = [];
    const framework = reactVite();
    for (const addon of [framework, framework.builder, framework.renderer]) {
      const setup = addon.setup;
      vi.spyOn(addon, 'setup').mockImplementation(async (storybook) => {
        order.push(addon.meta.kind);
        storybook.hook('core:static-dirs:collect', () => [addon.meta.kind]);
        await setup(storybook);
      });
    }
    const probe = defineAddon<{ name: string }>(({ name }) => ({
      meta: { name },
      setup(storybook) {
        order.push(name);
        storybook.hook('core:static-dirs:collect', () => [name]);
        expect(() => storybook.builder).toThrow('not ready');
      },
    }));
    framework.addons = [probe({ name: 'default-addon' })];
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: { framework, stories: ['./*.stories.ts'], addons: [probe({ name: 'user-addon' })] },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    expect(order).toMatchInlineSnapshot(`
      [
        "builder",
        "renderer",
        "default-addon",
        "framework",
        "user-addon",
      ]
    `);
    expect(storybook.options.staticDirs.filter((dir) => typeof dir === 'string'))
      .toMatchInlineSnapshot(`
      [
        "builder",
        "renderer",
        "default-addon",
        "framework",
        "user-addon",
      ]
    `);
    expect(Object.keys((await storybook.getIndex()).entries)).toEqual(['first--example']);
  });

  it('notifies the ready hook once, after setup, with readable options', async () => {
    const calls: string[] = [];
    const addon = defineAddon(() => ({
      meta: { name: 'ready-addon' },
      setup(storybook): void {
        storybook.hook('core:instance:ready', (instance) => {
          expect(instance).toBe(storybook);
          calls.push(`ready ${instance.options.stories.length} ${instance.addons.length > 0}`);
        });
      },
    }));
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: { stories: ['./*.stories.ts'], addons: [addon()] },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    await storybook.getIndex();
    expect(calls).toEqual(['ready 1 true']);
  });

  it.each([
    { mode: 'headless', registered: true, expected: ['close same-instance'] },
    { mode: 'dev', registered: true, expected: ['close same-instance'] },
    { mode: 'build', registered: true, expected: ['close same-instance'] },
    { mode: 'headless', registered: false, expected: [] },
  ] as const)(
    'notifies the close hook once in $mode mode when registered: $registered',
    async ({ mode, registered, expected }) => {
      const calls: string[] = [];
      let setupInstance: Storybook | undefined;
      const addon = defineAddon(() => ({
        meta: { name: 'close-addon' },
        setup(storybook): void {
          setupInstance = storybook;
          if (registered) {
            storybook.hook('core:instance:close', (instance) => {
              calls.push(`close ${instance === setupInstance ? 'same-instance' : 'other'}`);
            });
          }
        },
      }));
      const storybook = createStorybook({
        configDir: fileURLToPath(
          new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
        ),
        mode,
        main: { framework: reactVite(), stories: [], addons: [addon()] },
      });
      await storybook.ready();
      await Promise.all([storybook.close(), storybook.close()]);
      await storybook.close();
      expect(calls).toEqual(expected);
    }
  );

  it('closes listeners in reverse order before internal cleanups, logging failures', async () => {
    const calls: string[] = [];
    const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const listener = (name: string, fail = false) =>
      defineAddon(() => ({
        meta: { name },
        setup(storybook): void {
          storybook.hook('core:instance:close', () => {
            calls.push(name);
            if (fail) {
              throw new Error(`${name} failed`);
            }
          });
        },
      }));
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: {
        stories: [],
        addons: [listener('first')(), listener('failing', true)(), listener('last')()],
      },
    });
    await storybook.ready();
    runWithStorybook(storybook, () =>
      getInstanceContext()!.cleanups.add(() => {
        calls.push('cleanup');
      })
    );

    await expect(storybook.close()).resolves.toBeUndefined();
    expect(calls).toEqual(['last', 'failing', 'first', 'cleanup']);
    expect(logError.mock.calls.map(([value]) => String(value))).toMatchInlineSnapshot(`
      [
        "A core:instance:close listener failed:",
        "Error: failing failed",
      ]
    `);
  });

  it('notifies the close hook of addons set up before startup failed', async () => {
    const calls: string[] = [];
    const registered = defineAddon(() => ({
      meta: { name: 'registered-addon' },
      setup(storybook): void {
        storybook.hook('core:instance:close', () => {
          calls.push('close');
        });
      },
    }));
    const broken = defineAddon(() => ({
      meta: { name: 'broken-addon' },
      setup(): void {
        throw new Error('setup failed');
      },
    }));
    await expect(
      createStorybook({
        configDir: fileURLToPath(
          new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
        ),
        mode: 'headless',
        main: { stories: [], addons: [registered(), broken()] },
      }).ready()
    ).rejects.toThrow('setup failed');
    expect(calls).toEqual(['close']);
  });

  it('collects renderer entries before its setup entries and addon entries', async () => {
    const framework = reactVite();
    framework.renderer.previewAnnotations = ['/renderer-entry.ts'];
    const setup = framework.renderer.setup;
    framework.renderer.setup = async (storybook) => {
      storybook.hook('preview:annotations:collect', () => ['/renderer-setup.ts']);
      await setup(storybook);
    };
    const addon = defineAddon(() => ({
      meta: { name: 'preview-addon' },
      setup(storybook): void {
        storybook.hook('preview:annotations:collect', () => ['/addon-entry.ts']);
      },
    }));
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: { framework, stories: [], addons: [addon()] },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    expect(
      storybook.options.previewAnnotations.filter(
        (entry) =>
          (typeof entry === 'string' && entry.startsWith('/renderer')) ||
          entry === '/addon-entry.ts'
      )
    ).toEqual(['/renderer-entry.ts', '/renderer-setup.ts', '/addon-entry.ts']);
    expect(framework.renderer).not.toHaveProperty('types');
  });

  it.each([
    {
      hook: 'preview:annotations:collect',
      setup(storybook: Storybook): void {
        storybook.hook('preview:annotations:collect', () => ['/native-preview.ts']);
      },
      assert(storybook: Storybook): void {
        expect(storybook.options.previewAnnotations.slice(-1)).toMatchInlineSnapshot(`
          [
            "/native-preview.ts",
          ]
        `);
      },
    },
    {
      hook: 'index:indexers:collect',
      setup(storybook: Storybook): void {
        storybook.hook('index:indexers:collect', () => [
          { test: /native/, createIndex: async () => [] },
        ]);
      },
      assert(storybook: Storybook): void {
        expect(storybook.options.indexers.slice(-1)).toMatchInlineSnapshot(`
          [
            {
              "createIndex": [Function],
              "test": /native/,
            },
          ]
        `);
      },
    },
    {
      hook: 'core:static-dirs:collect',
      setup(storybook: Storybook): void {
        storybook.hook('core:static-dirs:collect', () => [
          { from: './native-public', to: '/native' },
        ]);
      },
      assert(storybook: Storybook): void {
        expect(storybook.options.staticDirs.slice(-1)).toMatchInlineSnapshot(`
          [
            {
              "from": "./native-public",
              "to": "/native",
            },
          ]
        `);
      },
    },
  ])('collects $hook contributions from a native addon into options', async ({ setup, assert }) => {
    const addon = defineAddon(() => ({ meta: { name: 'native-contributions' }, setup }));
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: { stories: [], addons: [addon()] },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    assert(storybook);
  });

  it('collects legacy, native, and main static directories in preset order', async () => {
    const addon = defineAddon(() => ({
      meta: { name: 'native-static-dirs' },
      setup(storybook): void {
        storybook.hook('core:static-dirs:collect', () => [
          { from: './native-public', to: '/native' },
        ]);
      },
    }));
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: {
        stories: [],
        addons: [
          fileURLToPath(new URL('./__fixtures__/static-dirs-preset.ts', import.meta.url)),
          addon(),
        ],
        staticDirs: ['./main-public'],
      },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    expect(
      storybook.options.staticDirs.map((entry) => (typeof entry === 'string' ? entry : entry.to))
    ).toMatchInlineSnapshot(`
      [
        "/sb-common-assets",
        "./legacy-public",
        "/native",
        "./main-public",
      ]
    `);
    expect(await storybook.callHook('core:static-dirs:collect', [])).toEqual(
      storybook.options.staticDirs
    );
    expect(await storybook.presets.apply('staticDirs', [])).toEqual(storybook.options.staticDirs);
  });

  it.each([
    {
      name: 'drops a native addon in a test build',
      input: { test: true, disabledAddons: ['native-addon'] },
      expected: ['static-dirs-preset.ts'],
    },
    {
      name: 'drops a legacy addon in a test build',
      input: { test: true, disabledAddons: ['static-dirs-preset'] },
      expected: ['native-addon'],
    },
    {
      name: 'keeps addons that match no entry',
      input: { test: true, disabledAddons: ['not-installed'] },
      expected: ['static-dirs-preset.ts', 'native-addon'],
    },
    {
      name: 'keeps every addon outside a test build',
      input: { test: false, disabledAddons: ['native-addon', 'static-dirs-preset'] },
      expected: ['static-dirs-preset.ts', 'native-addon'],
    },
  ])('build.test.disabledAddons: $name', async ({ input, expected }) => {
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'build',
      cliOptions: { test: input.test },
      main: {
        stories: ['./*.stories.ts'],
        addons: [
          fileURLToPath(new URL('./__fixtures__/static-dirs-preset.ts', import.meta.url)),
          { meta: { name: 'example/native-addon', kind: 'addon' }, setup(): void {} },
        ],
        build: { test: { disabledAddons: input.disabledAddons } },
      },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    expect(
      storybook.addons
        .map(({ name }) => basename(name))
        .filter((name) => /static-dirs-preset|native-addon/.test(name))
    ).toEqual(expected);
  });

  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])('resolves React annotations with docs=%s and RSC=%s', async (docs, experimentalRSC) => {
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: {
        framework: reactVite(),
        stories: [],
        docs: docs ? { defaultName: 'Documentation' } : {},
        features: { experimentalRSC },
      },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    const entries = storybook.options.previewAnnotations.filter(
      (entry) => typeof entry === 'string' && /react[\\/]dist[\\/]entry-preview/.test(entry)
    );
    expect(entries).toEqual([
      fileURLToPath(import.meta.resolve('@storybook/react/entry-preview')),
      fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-argtypes')),
      ...(docs ? [fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-docs'))] : []),
      ...(experimentalRSC
        ? [fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-rsc'))]
        : []),
    ]);
    expect(storybook.options.features?.componentsManifest).toBe(true);
  });

  it('wraps the legacy framework builder after its two preset passes', async () => {
    const load = vi.spyOn(presets, 'loadAllPresets');
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: {
        framework: legacyPreset(LEGACY_FRAMEWORK, 'framework'),
        stories: ['./*.stories.ts'],
      },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    expect(load).toHaveBeenCalledTimes(2);
    // The old `@storybook/react/preset` renderer specifier loads the native React renderer.
    expect(storybook.addons).toEqual(
      expect.arrayContaining([
        { name: LEGACY_FRAMEWORK, kind: 'framework' },
        expect.objectContaining({ kind: 'builder' }),
        { name: '@storybook/react', kind: 'renderer' },
      ])
    );
    expect(storybook.builder?.meta.kind).toBe('builder');
    expect(storybook.builder?.meta.name).toContain('builder-vite');
    expect(storybook.builder).toEqual(
      expect.objectContaining({
        dev: expect.any(Function),
        build: expect.any(Function),
        changeDetectionAdapter: expect.any(Function),
      })
    );
    expect(Object.keys((await storybook.getIndex()).entries)).toEqual(['first--example']);
  });

  it.each<{ name: string; framework: StorybookConfig['framework']; expected: unknown }>([
    {
      name: 'a native framework name',
      framework: '@storybook/react-vite',
      expected: {
        presetPasses: 0,
        addons: [
          'builder:@storybook/builder-vite',
          'renderer:@storybook/react',
          'framework:@storybook/react-vite',
        ],
        frameworkOptions: {},
      },
    },
    {
      name: 'a native framework with options',
      framework: {
        name: '@storybook/react-vite',
        options: { strictMode: true, builder: { viteConfigPath: null } },
      },
      expected: {
        presetPasses: 0,
        addons: [
          'builder:@storybook/builder-vite',
          'renderer:@storybook/react',
          'framework:@storybook/react-vite',
        ],
        frameworkOptions: { strictMode: true, builder: { viteConfigPath: null } },
      },
    },
    {
      name: 'a legacy-only framework',
      framework: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/legacy-vite-framework', import.meta.url)
      ),
      expected: {
        presetPasses: 2,
        addons: [
          'framework:<code>/core/src/instance/__fixtures__/legacy-vite-framework',
          'builder:@storybook/builder-vite',
        ],
        frameworkOptions: {},
      },
    },
    {
      name: 'an absolute framework path',
      framework: dirname(fileURLToPath(import.meta.resolve('@storybook/react-vite/package.json'))),
      expected: {
        presetPasses: 0,
        addons: [
          'builder:@storybook/builder-vite',
          'renderer:@storybook/react',
          'framework:@storybook/react-vite',
        ],
        frameworkOptions: {},
      },
    },
    {
      name: 'an unresolvable framework name',
      framework: 'storybook-framework-that-does-not-exist',
      expected: 'SB_CORE-COMMON_0003 (CouldNotEvaluateFrameworkError)',
    },
  ])('loads $name natively or through the legacy bridge', async ({ framework, expected }) => {
    const load = vi.spyOn(presets, 'loadAllPresets');
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: { framework, stories: [] },
    });
    const result = await storybook.ready().then(
      () => storybook,
      (error: Error) => error
    );
    if (result instanceof Error) {
      expect(result.name).toEqual(expected);
      return;
    }
    INSTANCES.push(result);
    const codeDir = fileURLToPath(new URL('../../../../', import.meta.url));
    expect(result.options.framework).toBe(framework);
    expect({
      presetPasses: load.mock.calls.length,
      addons: result.addons
        .filter(({ kind }) => kind !== 'addon')
        .map(({ kind, name }) => `${kind}:${name.replace(codeDir, '<code>/')}`),
      frameworkOptions: await result.callHook('core:framework-options:extend', undefined),
    }).toEqual(expected);
  });

  it('keeps framework and builder config hooks before the main finalizer', async () => {
    const framework = reactVite({ strictMode: true, docgen: false });
    const frameworkSetup = framework.setup;
    vi.spyOn(framework, 'setup').mockImplementation(async (storybook) => {
      await frameworkSetup(storybook);
      storybook.hook('builder:vite:extend', (config) => ({ ...config, clearScreen: false }));
    });
    const builderSetup = framework.builder.setup;
    vi.spyOn(framework.builder, 'setup').mockImplementation(async (storybook) => {
      await builderSetup(storybook);
      storybook.hook('builder:vite:extend', (config) => ({ ...config, logLevel: 'info' }));
    });
    const main: ReactViteConfig = {
      framework,
      stories: [],
      viteFinal(config) {
        expect(config).toEqual({ clearScreen: false, logLevel: 'info' });
        return { ...config, logLevel: 'silent' };
      },
    };
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main,
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    expect(await storybook.presets.apply('frameworkOptions')).toEqual({
      strictMode: true,
      docgen: false,
    });
    expect(await storybook.presets.apply('viteFinal', {}, storybook.options)).toEqual({
      clearScreen: false,
      logLevel: 'silent',
    });
  });

  it.each([undefined, { docgenServer: true }])(
    'reads realm FEATURES %j outside instances and isolates resolved features inside',
    async (fallback) => {
      vi.stubGlobal('FEATURES', fallback);
      if (fallback === undefined) {
        Reflect.deleteProperty(globalThis, 'FEATURES');
      }
      expect(getFeatures()).toEqual(fallback ?? {});
      const observed: unknown[] = [];
      const addon = defineAddon(() => ({
        meta: { name: 'observe-features' },
        setup() {
          observed.push(getFeatures().argTypeTargetsV7);
        },
      }));
      const [first, second] = [true, false].map((argTypeTargetsV7) =>
        createStorybook({
          configDir: fileURLToPath(
            new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
          ),
          mode: 'headless',
          main: {
            stories: [],
            features: { argTypeTargetsV7, docgenServer: argTypeTargetsV7 },
            addons: [addon()],
          },
        })
      );
      INSTANCES.push(first, second);
      await Promise.all([first.ready(), second.ready()]);
      expect(getFeatures()).toEqual(fallback ?? {});
      expect(runWithStorybook(first, () => shouldWaitForServiceSnippet(undefined, false))).toBe(
        true
      );
      expect(runWithStorybook(second, () => shouldWaitForServiceSnippet(undefined, false))).toBe(
        false
      );
      expect(observed).toEqual(expect.arrayContaining([true, false]));
      expect(runWithStorybook(first, () => getFeatures())).toBe(first.options.features);
      expect(runWithStorybook(second, () => getFeatures())).toBe(second.options.features);
      expect(first.options.features?.argTypeTargetsV7).toBe(true);
      expect(second.options.features?.argTypeTargetsV7).toBe(false);
    }
  );

  it('isolates same-id stores and status stores across instances and close', async () => {
    const stores: UniversalStore<{ count: number }>[] = [];
    const addon = defineAddon(() => ({
      meta: { name: 'stores' },
      setup() {
        stores.push(
          UniversalStore.create({ id: 'storybook/test', owner: true, initialState: { count: 0 } })
        );
      },
    }));
    const first = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: { stories: ['./*.stories.ts'], addons: [addon()] },
    });
    INSTANCES.push(first);
    await first.ready();
    const second = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/second', import.meta.url)
      ),
      mode: 'headless',
      main: { stories: ['./*.stories.ts'], addons: [addon()] },
    });
    INSTANCES.push(second);
    await second.ready();
    const [firstStore, secondStore] = stores;
    expect(firstStore).not.toBe(secondStore);
    expect(stores.map((store) => ({ status: store.status, type: store.actor.type })))
      .toMatchInlineSnapshot(`
        [
          {
            "status": "READY",
            "type": "OWNER",
          },
          {
            "status": "READY",
            "type": "OWNER",
          },
        ]
      `);
    firstStore.setState({ count: 1 });
    expect(stores.map((store) => store.getState())).toMatchInlineSnapshot(`
      [
        {
          "count": 1,
        },
        {
          "count": 0,
        },
      ]
    `);
    const firstStatus = runWithStorybook(first, () =>
      experimental_getStatusStore(CHANGE_DETECTION_STATUS_TYPE_ID)
    );
    const secondStatus = runWithStorybook(second, () =>
      experimental_getStatusStore(CHANGE_DETECTION_STATUS_TYPE_ID)
    );
    expect(firstStatus).not.toBe(secondStatus);
    firstStatus.set([
      {
        storyId: 'example--story',
        typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
        value: 'status-value:modified',
        title: 'Changed',
        description: '',
      },
    ]);
    expect([firstStatus.getAll(), secondStatus.getAll()]).toMatchInlineSnapshot(`
      [
        {
          "example--story": {
            "storybook/change-detection": {
              "description": "",
              "storyId": "example--story",
              "title": "Changed",
              "typeId": "storybook/change-detection",
              "value": "status-value:modified",
            },
          },
        },
        {},
      ]
    `);
    const stopListening = vi.spyOn(first.channel, 'off');
    await first.close();
    expect(stopListening).toHaveBeenCalledWith(
      'UNIVERSAL_STORE:storybook/test',
      expect.any(Function)
    );
    secondStore.setState({ count: 2 });
    expect(secondStore.getState()).toMatchInlineSnapshot(`
      {
        "count": 2,
      }
    `);
    // Outside an instance there is no Node channel to share, so the store never connects.
    const outsideStore = UniversalStore.create({
      id: 'storybook/test',
      owner: true,
      initialState: { count: 3 },
    });
    expect(outsideStore.status).toBe('UNPREPARED');
    outsideStore.__dispose();
  });

  it('isolates two configurations, channels, toolsets, and close', async () => {
    const fallbackChannel = getChannel();
    const first = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
    });
    const second = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/second', import.meta.url)
      ),
      mode: 'headless',
    });
    INSTANCES.push(first, second);
    await Promise.all([first.ready(), second.ready()]);
    const indexes = await Promise.all([first.getIndex(), second.getIndex()]);
    expect(indexes.map((index) => Object.keys(index.entries))).toMatchInlineSnapshot(`
      [
        [
          "first--example",
        ],
        [
          "second--example",
        ],
      ]
    `);
    expect(first.channel).not.toBe(second.channel);
    expect(getChannel()).toBe(fallbackChannel);
    expect(() => getRegisteredToolsets()).toThrow('outside a Storybook instance');
    expect(first.services.get('core/module-graph', { internal: true })).not.toBe(
      second.services.get('core/module-graph', { internal: true })
    );
    expect(first.toolsets.get('docs')).not.toBe(second.toolsets.get('docs'));
    expect(await first.getStoryIndexGenerator()).toBe(
      await first.presets.apply('storyIndexGenerator')
    );
    expect(await first.presets.apply('storyIndexGenerator')).not.toBe(
      await second.presets.apply('storyIndexGenerator')
    );
    await first.close();
    expect(getChannel()).toBe(fallbackChannel);
    expect(() => getRegisteredToolsets()).toThrow('outside a Storybook instance');
    expect(second.toolsets.get('docs').id).toBe('docs');
    await expect(second.getIndex()).resolves.toEqual(indexes[1]);
    await expect(first.getIndex()).rejects.toThrow('not ready');
  });

  it('hands the checklist AI-setup detection the instance story index', async () => {
    vi.mocked(initializeChecklist).mockResolvedValueOnce(undefined);
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    await storybook.callHook('server:channel:ready', storybook.channel);

    // Called outside the instance's async context, as a channel listener would be.
    const generator = await vi.mocked(initializeChecklist).mock.lastCall?.[2]?.();
    expect(generator).toBe(await storybook.getStoryIndexGenerator());
    expect(Object.keys((await generator!.getIndex()).entries)).toEqual(['first--example']);
  });

  it('sorts the instance index with the main configuration storySorts', async () => {
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: {
        framework: '@storybook/react-vite',
        stories: ['./*.stories.ts', '../second/*.stories.ts'],
        storySorts: [{ order: ['Second', 'First'] }],
      },
    });
    INSTANCES.push(storybook);
    await storybook.ready();

    expect(Object.keys((await storybook.getIndex()).entries)).toEqual([
      'second--example',
      'first--example',
    ]);
  });

  it('runs mixed addons during setup and prevents premature options reads', async () => {
    const setupReads: string[] = [];
    const addon = defineAddon<{ verbose?: boolean }>((options) => ({
      meta: { name: 'example-addon' },
      setup(storybook) {
        try {
          void storybook.options;
        } catch (error) {
          setupReads.push((error as Error).message);
        }
        storybook.hook('preview:annotations:collect', () => ['example-preview.ts']);
        if (options.verbose) {
          storybook.registerToolset(
            defineToolset({ id: 'example', description: 'Example.', methods: {} })
          );
        }
      },
    }));
    const first = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: {
        framework: legacyPreset(LEGACY_FRAMEWORK, 'framework'),
        stories: ['./*.stories.ts'],
        addons: [addon({ verbose: true })],
      },
    });
    const second = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/second', import.meta.url)
      ),
      mode: 'headless',
    });
    INSTANCES.push(first, second);
    await first.ready();
    await second.ready();
    expect(setupReads).toMatchInlineSnapshot(`
      [
        "Storybook is not ready (current phase: setup).",
      ]
    `);
    expect(Object.isFrozen(first.options)).toBe(true);
    expect(first.toolsets.get('example').id).toBe('example');
    expect(() => second.toolsets.get('example')).toThrow();
    expect(await first.callHook('preview:annotations:collect', [])).toEqual(
      first.options.previewAnnotations
    );
    expect(await first.presets.apply('previewAnnotations', [])).toEqual(
      first.options.previewAnnotations
    );
    expect(first.options.previewAnnotations).toContain('example-preview.ts');
    first.hook('preview:annotations:collect', () => ['late.ts']);
    expect(await first.callHook('preview:annotations:collect', [])).toContain('late.ts');
    expect(first.options.previewAnnotations).not.toContain('late.ts');
  });

  it('provides host configuration context before ready and preserves call overrides', async () => {
    let setupContext: unknown;
    const addon = defineAddon(() => ({
      meta: { name: 'host-context' },
      setup(storybook): void {
        storybook.hook('core:services:register', (_value, ctx) => {
          setupContext = ctx;
        });
        storybook.hook('manager:title:extend', (_value, ctx) => String(ctx?.port));
      },
    }));
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'headless',
      main: { stories: [], addons: [addon()] },
      cliOptions: { port: 6007, disableTelemetry: true },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    expect(setupContext).toMatchObject({
      port: 6007,
      disableTelemetry: true,
      channel: storybook.channel,
    });
    expect(await storybook.callHook('manager:title:extend', '')).toBe('6007');
    expect(await storybook.callHook('manager:title:extend', '', { port: 6008 })).toBe('6008');
  });

  it.each([
    ['headless', 'DEVELOPMENT'],
    ['dev', 'DEVELOPMENT'],
    ['build', 'PRODUCTION'],
  ] as const)('resolves %s mode and freezes host CLI options', async (mode, configType) => {
    const framework = reactVite();
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode,
      main: { framework, stories: [] },
      cliOptions: {
        port: 6007,
        outputDir: 'dist-storybook',
        quiet: true,
        configType: 'DEVELOPMENT',
      },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    expect(storybook.options).toMatchObject({
      configType,
      port: 6007,
      outputDir: 'dist-storybook',
      quiet: true,
    });
    expect(storybook.options.framework).toBe(framework);
    expect(Object.isFrozen(storybook.options)).toBe(true);
  });

  it('resolves the dev host adapter in the instance module graph', async () => {
    const framework = reactVite();
    const getAdapter = vi.spyOn(framework.builder, 'changeDetectionAdapter');
    const storybook = createStorybook({
      configDir: fileURLToPath(
        new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
      ),
      mode: 'dev',
      main: { framework, stories: ['./*.stories.ts'] },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    runWithStorybook(storybook, () => resolveChangeDetectionAdapter(undefined));
    const graph = storybook.services.get('core/module-graph', { internal: true });
    await graph.commands._waitForSettledEngine(undefined);
    expect(graph.queries.status.get(undefined)).toMatchObject({ value: 'unavailable' });
    expect(getAdapter).not.toHaveBeenCalled();
  });

  it('preserves the old dev host preset order for the internal configuration', async () => {
    const configDir = fileURLToPath(new URL('../../../../.storybook', import.meta.url));
    const workingDir = fileURLToPath(new URL('../../../../', import.meta.url));
    const repoDir = fileURLToPath(new URL('../../../../../', import.meta.url));
    const main = (await common.loadMainConfig({ configDir })) as StorybookConfig;
    const { loadAllPresets: load } = await vi.importActual<typeof presets>('./compat/presets.ts');
    let names: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline preset order test.')));
    vi.spyOn(presets, 'loadAllPresets').mockImplementation((options, onLoad) =>
      load(options, (presets, context) => {
        names = presets
          .filter(({ preset }) => !Object.getOwnPropertySymbols(preset).length)
          .map(({ name }) =>
            (name === 'main' ? `${configDir}/main.ts` : name)
              .replace('file://', '')
              .replace(workingDir, '<code>/')
              .replace(repoDir, '<repo>/')
          );
        onLoad?.(presets, context);
      })
    );
    const storybook = createStorybook({
      configDir,
      workingDir,
      mode: 'dev',
      main: {
        ...main,
        framework: legacyPreset(LEGACY_FRAMEWORK, 'framework'),
        // The internal config's local addons have no package preset to map to.
        addons: main.addons
          ?.map((addon) => (typeof addon === 'object' && 'meta' in addon ? addon.meta.name : addon))
          .filter((addon) => !LOCAL_ADDONS.includes(addon as string)),
      },
    });
    INSTANCES.push(storybook);
    await storybook.ready();
    expect(storybook.builder?.hmr).toBe('vite');
    expect(names).toMatchInlineSnapshot(`
      [
        "<code>/lib/storybook/src/storybook/__fixtures__/legacy-react-vite-framework/preset",
        "<repo>/node_modules/@storybook/addon-designs/dist/preset.js",
        "@storybook/addon-designs",
        "<repo>/node_modules/@chromatic-com/storybook/dist/preset.js",
        "@chromatic-com/storybook",
        "<code>/.storybook/main.ts",
      ]
    `);
  });

  it('keeps later asynchronous service and toolset calls in their owning context', async () => {
    const channelOwners: string[] = [];
    const addon = defineAddon<{ owner: string }>(({ owner }) => ({
      meta: { name: 'owners' },
      setup(storybook) {
        storybook.channel.on('example:inspect', () => {
          channelOwners.push(String(getService('example/owner').queries.owner.get(undefined)));
        });
        storybook.registerService(
          defineService({
            id: 'example/owner',
            description: 'Instance owner.',
            initialState: { owner },
            queries: {
              owner: {
                description: 'Read owner.',
                input: v.void(),
                output: v.string(),
                handler: (_input, ctx) => ctx.self.state.owner,
              },
            },
            commands: {
              inspect: {
                description: 'Inspect the owning context.',
                input: v.void(),
                output: v.object({ owner: v.string(), channel: v.boolean() }),
                handler: async () => {
                  await Promise.resolve();
                  return {
                    owner: String(getService('example/owner').queries.owner.get(undefined)),
                    channel: getChannel() === storybook.channel,
                  };
                },
              },
            },
          })
        );
        storybook.registerToolset(
          defineToolset({
            id: owner,
            description: 'Owner tools.',
            methods: {
              inspect: {
                title: 'Inspect',
                description: 'Read owner.',
                input: v.strictObject({}),
                handler: async () => ({
                  ok: true,
                  data: getRegisteredToolsets().map((toolset) => toolset.id),
                  markdown: '',
                }),
              },
            },
          })
        );
      },
    }));
    const [first, second] = ['first', 'second'].map((owner) =>
      createStorybook({
        configDir: fileURLToPath(
          new URL(`../../../../core/src/instance/__fixtures__/${owner}`, import.meta.url)
        ),
        mode: 'headless',
        main: { stories: ['./*.stories.ts'], addons: [addon({ owner })] },
      })
    );
    INSTANCES.push(first, second);
    await Promise.all([first.ready(), second.ready()]);
    const ownToolsets = (storybook: Storybook): string[] =>
      storybook.toolsets
        .values()
        .map((toolset) => toolset.id)
        .filter((id) => id === 'first' || id === 'second');
    expect([first, second].map(ownToolsets)).toEqual([['first'], ['second']]);
    first.channel.emit('example:inspect');
    second.channel.receive({ type: 'example:inspect', args: [], from: 'test' });
    expect(channelOwners).toEqual(['first', 'second']);
    const services = [first, second].map((storybook) => storybook.services.get('example/owner'));
    expect(await Promise.all(services.map((service) => service.commands.inspect(undefined))))
      .toMatchInlineSnapshot(`
      [
        {
          "channel": true,
          "owner": "first",
        },
        {
          "channel": true,
          "owner": "second",
        },
      ]
    `);
    await first.close();
    expect(await services[1].commands.inspect(undefined)).toEqual({
      owner: 'second',
      channel: true,
    });
    const outcome = await second.toolsets.get('second').methods.inspect.handler(
      {},
      {
        transport: 'sdk',
        getService: second.services.get,
        signal: new AbortController().signal,
      }
    );
    expect(outcome.data).toContain('second');
    expect(outcome.data).not.toContain('first');
    expect(ownToolsets(second)).toEqual(['second']);
    expect(() => first.toolsets.values()).toThrow('not ready');
  });
});
