import { fileURLToPath } from 'node:url';

import { loadMainConfig } from '@storybook/core/internal/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createStorybook, type Storybook } from '@storybook/core';

import { legacyAdapter } from './legacy-adapter.ts';

const CONFIG_DIR = fileURLToPath(new URL('../../../../../.storybook', import.meta.url));
const LEGACY_ADDONS = ['@storybook/addon-designs', '@chromatic-com/storybook'];

let storybook: Storybook;

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline internal config test.')));
  storybook = createStorybook(
    { configDir: CONFIG_DIR, mode: 'headless' },
    { builtInAddons: [], legacy: legacyAdapter }
  );
  await storybook.ready();
});

afterAll(async () => {
  await storybook?.close();
  vi.unstubAllGlobals();
});

it('routes only the third-party addons through the legacy bridge', async () => {
  const main = await loadMainConfig({ configDir: CONFIG_DIR });
  const entries = [main.framework, ...(main.addons ?? [])];
  const legacy = entries
    .filter((entry) => !(typeof entry === 'object' && entry && 'meta' in entry))
    .map((entry) => (typeof entry === 'string' ? entry : entry?.name));

  expect(legacy).toEqual(LEGACY_ADDONS);
  expect(storybook.addons.map(({ name }) => name)).toEqual(
    expect.arrayContaining([
      ...LEGACY_ADDONS,
      'storybook-internal-vite',
      'storybook-internal-services',
    ])
  );
  expect(main).not.toHaveProperty('viteFinal');
});

describe('storybook-internal-vite', () => {
  it.each<{ name: string; configType: 'DEVELOPMENT' | 'PRODUCTION'; expected: string[] }>([
    {
      name: 'development',
      configType: 'DEVELOPMENT',
      expected: [
        '/^storybook\\/internal\\/components$/',
        '/^@storybook\\/ui\\/internal\\/components$/',
        '/^storybook\\/manager-api$/',
        '/^@storybook\\/manager\\/manager-api$/',
        '/^storybook\\/preview-api$/',
        '/^@storybook\\/core\\/preview-api$/',
        '/^storybook\\/theming\\/create$/',
        '/^@storybook\\/ui\\/theming\\/create$/',
        '/^storybook\\/theming$/',
        '/^@storybook\\/ui\\/theming$/',
        '/^sb-original\\/image-context$/',
      ],
    },
    {
      name: 'production',
      configType: 'PRODUCTION',
      expected: [
        '/^storybook\\/internal\\/components$/',
        '/^@storybook\\/ui\\/internal\\/components$/',
        '/^storybook\\/manager-api$/',
        '/^@storybook\\/manager\\/manager-api$/',
        '/^storybook\\/preview-api$/',
        '/^@storybook\\/core\\/preview-api$/',
      ],
    },
  ])('aliases the $name source entries', async ({ configType, expected }) => {
    const config = await storybook.presets.apply<{
      resolve?: { alias?: { find: RegExp | string }[] };
    }>('viteFinal', {}, { configType });
    const aliases = [config.resolve?.alias ?? []].flat();

    expect(aliases.map(({ find }) => String(find))).toEqual(expected);
  });
});
