import '@storybook/core/internal/deep/preview/hooks';
import '../../../../../core/src/story-index/hooks.ts';
import '../../../../../core/src/services/hooks.ts';

import type { LoadedPreset, PresetConfig, Presets } from '@storybook/core/internal/types';
import { describe, expect, it } from 'vitest';

import type { InterPresetOptions } from '@storybook/core/internal/common';

import { getPresets } from './presets.ts';
import { createHookRuntime } from '../../../../../core/src/instance/hooks.ts';
import {
  bridgeLegacyPresets,
  LEGACY_HOOKS,
  legacyHookName,
} from '../../../../../core/src/instance/legacy-hooks.ts';

async function bothPaths(presets: LoadedPreset[]) {
  let loaded!: Parameters<typeof bridgeLegacyPresets>[0];
  const original = await getPresets(
    presets.map(
      ({ name, preset, options }) => ({ type: 'virtual', name, ...preset, options }) as PresetConfig
    ),
    { configDir: '/config', configType: 'DEVELOPMENT' } as InterPresetOptions,
    (presetsList, options) => {
      loaded = { presetsList, options };
    }
  );
  const hooks = createHookRuntime();
  const compat = bridgeLegacyPresets(loaded, hooks, hooks.callHook);
  return { original, compat, hooks };
}

describe('legacy preset hooks', () => {
  it.each(Object.entries(LEGACY_HOOKS))('preserves %s on %s', async (extension, name) => {
    const collect = name.endsWith(':collect');
    const initial = collect ? ['seed'] : { seed: true };
    const { original, compat } = await bothPaths([
      {
        name: 'first',
        options: { label: 'first' },
        preset: { [extension]: collect ? ['static'] : { first: true } },
      },
      {
        name: 'second',
        options: { label: 'second' },
        preset: {
          [extension](value: unknown, options: { label: string }) {
            return collect
              ? [options.label, ...(value as string[]).slice(1)]
              : { value, label: options.label };
          },
        },
      },
    ]);
    expect(await compat.apply(extension, initial)).toEqual(
      await original.apply(extension, initial)
    );
  });

  it.each(Object.keys(LEGACY_HOOKS))(
    'preserves absent %s with an undefined default',
    async (name) => {
      const { original, compat } = await bothPaths([]);
      expect(await compat.apply(name)).toEqual(await original.apply(name));
    }
  );

  it.each(['isAddonA11yEnabled', 'isAddonVitestEnabled'])(
    'preserves the legacy %s marker through the fallback',
    async (extension) => {
      expect(legacyHookName(extension)).toBe(`legacy:${extension}:extend`);
      const absent = await bothPaths([]);
      expect(await absent.compat.apply(extension, false)).toBe(false);
      const { compat } = await bothPaths([
        { name: 'third-party', options: {}, preset: { [extension]: true } },
      ]);
      expect(await compat.apply(extension, false)).toBe(true);
    }
  );

  it('preserves recursive calls, this, per-preset options and preset list', async () => {
    const preset = {
      label: 'owner',
      title: async function (
        this: { label: string },
        value: unknown,
        options: { label: string; configDir: string; presets: Presets; presetsList: LoadedPreset[] }
      ) {
        return {
          value,
          owner: this.label,
          nested: await options.presets.apply('private:key', {}, { label: 'call' }),
          names: options.presetsList.map((preset: LoadedPreset) => preset.name),
          configDir: options.configDir,
          label: options.label,
        };
      },
      'private:key': (
        _value: unknown,
        options: { label: string; configDir: string; presets: Presets; presetsList: LoadedPreset[] }
      ) => options.label,
    };
    const { original, compat } = await bothPaths([
      { name: 'example', preset, options: { label: 'preset' } },
    ]);
    expect(await compat.apply('title', 'seed', { label: 'argument' })).toEqual(
      await original.apply('title', 'seed', { label: 'argument' })
    );
  });

  it.each([false, 0, '', null, undefined])('skips falsy static values: %j', async (change) => {
    const { original, compat } = await bothPaths([
      { name: 'example', preset: { title: change }, options: {} },
    ]);
    expect(await compat.apply('title', 'seed')).toEqual(await original.apply('title', 'seed'));
  });

  it('keeps legacy list replacement and native collection in one hook', async () => {
    const { compat, hooks } = await bothPaths([
      { name: 'first', preset: { stories: ['first'] }, options: {} },
      { name: 'second', preset: { stories: () => ['replacement'] }, options: {} },
    ]);
    hooks.hook('core:stories:collect', () => ['native']);
    expect(await compat.apply('stories', ['seed'])).toEqual(['replacement', 'native']);
    expect(await hooks.callHook('core:stories:collect', ['seed'])).toEqual([
      'replacement',
      'native',
    ]);
  });

  it('preserves independent concurrent reductions', async () => {
    const { compat } = await bothPaths([
      {
        name: 'example',
        options: {},
        preset: {
          title: async (value: number) => {
            await Promise.resolve();
            return value * 2;
          },
        },
      },
    ]);
    expect(await Promise.all([compat.apply('title', 2), compat.apply('title', 3)])).toEqual([4, 6]);
  });

  it('sanitizes private names without collisions', async () => {
    const names = ['', 'a:b', 'a%3Ab', 'a_b', '__proto__'];
    expect(new Set(names.map(legacyHookName)).size).toBe(names.length);
    for (const extension of names) {
      expect(legacyHookName(extension).split(':')).toHaveLength(3);
      const { compat } = await bothPaths([
        { name: 'example', options: {}, preset: Object.fromEntries([[extension, 'value']]) },
      ]);
      expect(await compat.apply(extension)).toBe('value');
    }
  });
});
