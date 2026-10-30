import { fileURLToPath } from 'node:url';

import { join } from 'pathe';
import { afterEach, expect, it } from 'vitest';

import { createStorybook } from './create-storybook.ts';
import { legacyPreset } from './addons.ts';
import type { CreateStorybookInput, Storybook } from './types.ts';

type Main = NonNullable<CreateStorybookInput['main']>;

const FIXTURES = fileURLToPath(new URL('./__fixtures__', import.meta.url));
const CONFIG_DIR = join(FIXTURES, 'first');
const INSTANCES: Storybook[] = [];

afterEach(async () => {
  await Promise.all(INSTANCES.splice(0).map((storybook) => storybook.close()));
});

it.each<{ name: string; main: Main; expected: string }>([
  { name: 'no framework', main: { stories: [] }, expected: 'loaded' },
  {
    name: 'a native framework',
    main: { framework: '@storybook/react-vite', stories: [] },
    expected: 'loaded',
  },
  {
    name: 'a legacy framework',
    main: { framework: join(FIXTURES, 'legacy-vite-framework'), stories: [] },
    expected: `LegacyAdapterMissingError ${join(FIXTURES, 'legacy-vite-framework')}`,
  },
  {
    name: 'a legacy addon',
    main: { stories: [], addons: [legacyPreset('storybook-addon-pseudo-states')] },
    expected: 'LegacyAdapterMissingError storybook-addon-pseudo-states',
  },
  {
    name: 'main.presets',
    main: { stories: [], presets: ['some-preset'] } as Main,
    expected: 'LegacyAdapterMissingError main.presets',
  },
  {
    name: 'a builder named in main.core',
    main: { stories: [], core: { builder: '@storybook/builder-vite' } },
    expected: 'LegacyAdapterMissingError main.core',
  },
])('loads $name without a legacy adapter: $expected', async ({ main, expected }) => {
  const storybook = createStorybook(
    { configDir: CONFIG_DIR, mode: 'headless', main },
    { builtInAddons: [] }
  );
  INSTANCES.push(storybook);
  const result = await storybook.ready().then(
    () => 'loaded',
    (error: Error & { data?: { name: string } }) => `${error.constructor.name} ${error.data?.name}`
  );
  expect(result).toBe(expected);
});
