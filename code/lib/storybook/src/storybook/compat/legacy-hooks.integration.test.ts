import '@storybook/core/internal/deep/preview/hooks';
import '../../../../../core/src/story-index/hooks.ts';
import '../../../../../core/src/services/hooks.ts';

import { fileURLToPath } from 'node:url';

import { Channel } from '@storybook/core/internal/channels';
import { loadMainConfig } from '@storybook/core/internal/common';
import type { InterPresetOptions } from '@storybook/core/internal/common';
import type { LoadedPreset, StorybookConfig } from '@storybook/core/internal/types';
import { join } from 'pathe';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { StoryIndexGenerator } from '../../../../../core/src/story-index/StoryIndexGenerator.ts';
import type { InstanceContext } from '@storybook/core/internal/deep/shared/instance-context';
import { clearRegistry } from '../../../../../core/src/shared/open-service/service-registry.ts';
import { clearToolsetRegistry } from '../../../../../core/src/shared/open-service/toolset-registry.ts';
import { createHookRuntime } from '../../../../../core/src/instance/hooks.ts';
import { instanceContext } from '@storybook/core/internal/deep/instance/instance-context';
import {
  bridgeLegacyPresets,
  LEGACY_HOOKS,
} from '../../../../../core/src/instance/legacy-hooks.ts';
import { loadAllPresets } from './presets.ts';

const CONFIG_DIR = fileURLToPath(new URL('../../../../../.storybook', import.meta.url));
const WORKING_DIR = fileURLToPath(new URL('../../../../../', import.meta.url));
let main: StorybookConfig;

beforeAll(async () => {
  main = await loadMainConfig({ configDir: CONFIG_DIR });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function apply(extension: string, bridged: boolean): Promise<unknown> {
  const channel = new Channel({});
  const generator = new StoryIndexGenerator([], {
    configDir: CONFIG_DIR,
    workingDir: WORKING_DIR,
    indexers: [],
    docs: {},
    features: {},
  });
  let initialized: Promise<StoryIndexGenerator> | undefined;
  const context: InstanceContext = {
    channel,
    workingDir: WORKING_DIR,
    state: new Map(),
    cleanups: new Set(),
    getStoryIndexGenerator: () => (initialized ??= generator.initialize().then(() => generator)),
  };
  return instanceContext.run(context, async () => {
    try {
      let loaded!: { presetsList: LoadedPreset[]; options: InterPresetOptions };
      const raw = await loadAllPresets(
        {
          configDir: CONFIG_DIR,
          channel,
          main,
          corePresets: [join('@storybook/react-vite', 'preset')],
          overridePresets: [],
        },
        (presetsList, options) => {
          loaded = { presetsList, options };
        }
      );
      const hooks = createHookRuntime();
      const presets = bridged ? bridgeLegacyPresets(loaded, hooks, hooks.callHook) : raw;
      const name = LEGACY_HOOKS[extension as keyof typeof LEGACY_HOOKS];
      const value =
        extension === 'experimental_serverChannel'
          ? channel
          : extension === 'experimental_devServer'
            ? { get: vi.fn(), post: vi.fn(), use: vi.fn() }
            : name.endsWith(':collect')
              ? []
              : [
                    'viteFinal',
                    'webpack',
                    'webpackFinal',
                    'babel',
                    'babelDefault',
                    'swc',
                    'experimental_serverAPI',
                    'refs',
                    'build',
                  ].includes(extension)
                ? {}
                : extension === 'experimental_storyDocsProvider'
                  ? async () => undefined
                  : undefined;
      return shape(
        await presets.apply(extension, value, { manifestEntries: [], watch: false, port: 6006 })
      );
    } finally {
      await Promise.all([...context.cleanups].map((cleanup) => cleanup()));
      clearRegistry();
      clearToolsetRegistry();
      channel.removeAllListeners();
    }
  });
}

function shape(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'function') {
    return '[Function]';
  }
  if (typeof value === 'symbol') {
    return '[Symbol]';
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof RegExp) {
    return value.toString();
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((entry) => shape(entry, seen));
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    return { type: value.constructor.name, keys: Object.keys(value).sort() };
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, shape(entry, seen)]));
}

describe('internal Storybook preset equivalence', () => {
  it.each(Object.keys(LEGACY_HOOKS))('matches the existing loader for %s', async (extension) => {
    vi.stubEnv('STORYBOOK_DISABLE_TELEMETRY', '1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network disabled in preset equivalence test.'))
    );
    expect(await apply(extension, true)).toEqual(await apply(extension, false));
  });
});
