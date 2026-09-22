import { describe, expect, it, vi } from 'vitest';

import type { Options, PresetProperty } from 'storybook/internal/types';

import { Channel } from '../../channels/main.ts';

import * as overridePreset from './common-override-preset.ts';

vi.mock('../utils/remove-mdx-entries.ts', () => ({ removeMDXEntries: vi.fn() }));

const overrides: {
  features?: PresetProperty<'features'>;
  stories: typeof overridePreset.stories;
} = overridePreset;

const frameworks = [
  ['@storybook/react-vite', '@storybook/react', true],
  ['@storybook/react-webpack5', '@storybook/react', true],
  ['@storybook/nextjs', '@storybook/react', true],
  ['@storybook/vue3-vite', '@storybook/vue3', true],
  ['@storybook/angular-vite', '@storybook/angular', true],
  ['@storybook/html-vite', '@storybook/html', false],
  ['@storybook/svelte-vite', '@storybook/svelte', false],
] as const;

async function resolveFeatures(
  framework: string,
  renderer: string,
  input: Record<string, boolean> = {},
  legacy: { reactDocgen?: false | 'react-docgen-typescript'; docgen?: false | string } = {}
) {
  const configs = new Map<string, object>([
    ['framework', { name: framework, options: legacy }],
    ['core', { renderer }],
    ['frameworkOptions', legacy],
    ['typescript', legacy],
  ]);
  const options: Options = {
    configDir: '/project/.storybook',
    channel: new Channel({}),
    presets: { apply: vi.fn().mockImplementation(async (key: string) => configs.get(key)) },
  };
  return typeof overrides.features === 'function' ? overrides.features(input, options) : input;
}

describe('SB11 docgen server defaults', () => {
  it.each(frameworks)('resolves the default for %s', async (framework, renderer, enabled) => {
    expect(await resolveFeatures(framework, renderer)).toMatchObject({ docgenServer: enabled });
  });

  it.each(frameworks)('preserves explicit opt-out for %s', async (framework, renderer) => {
    expect(await resolveFeatures(framework, renderer, { docgenServer: false })).toMatchObject({
      docgenServer: false,
    });
  });

  it.each([true, false])('preserves deprecated flag %s', async (enabled) => {
    expect(
      await resolveFeatures('@storybook/react-vite', '@storybook/react', {
        experimentalDocgenServer: enabled,
      })
    ).toMatchObject({ docgenServer: enabled });
  });

  it.each([true, false])('stable %s wins over the deprecated flag', async (enabled) => {
    expect(
      await resolveFeatures('@storybook/react-vite', '@storybook/react', {
        docgenServer: enabled,
        experimentalDocgenServer: !enabled,
      })
    ).toMatchObject({ docgenServer: enabled });
  });

  it.each([false, 'react-docgen-typescript'] as const)(
    'preserves React legacy extraction choice %s',
    async (reactDocgen) => {
      expect(
        await resolveFeatures('@storybook/react-vite', '@storybook/react', {}, { reactDocgen })
      ).toMatchObject({ docgenServer: false });
    }
  );

  it.each([false, 'vue-component-meta', 'vue-docgen-api'] as const)(
    'preserves Vue legacy extraction choice %s',
    async (docgen) => {
      expect(
        await resolveFeatures('@storybook/vue3-vite', '@storybook/vue3', {}, { docgen })
      ).toMatchObject({ docgenServer: false });
    }
  );

  it('does not activate service-backed Docs for an unsupported renderer', async () => {
    expect(
      await resolveFeatures('@storybook/html-vite', '@storybook/html', { docgenServer: true })
    ).toMatchObject({ docgenServer: false });
  });
});
