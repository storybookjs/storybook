import { fileURLToPath, pathToFileURL } from 'node:url';

import { join } from 'pathe';
import { expect, it } from 'vitest';

import { resolveNativeFactory, toNativeEntryName } from './native-entry.ts';
import type { AddonMeta } from './addons.ts';

const CODE_DIR = fileURLToPath(new URL('../../../', import.meta.url));
const CONFIG_DIR = fileURLToPath(new URL('./__fixtures__/first', import.meta.url));
const FIXTURE_DIR = fileURLToPath(new URL('./__fixtures__/annotation-order', import.meta.url));
const FRAMEWORK_DIR = join(FIXTURE_DIR, 'framework');

it.each<{ name: string; kind: AddonMeta['kind']; expected: string | undefined }>([
  { name: '@storybook/builder-vite', kind: 'builder', expected: 'builder:@storybook/builder-vite' },
  {
    name: '@storybook/react-vite',
    kind: 'framework',
    expected: 'framework:@storybook/react-vite',
  },
  { name: '@storybook/react-vite', kind: 'builder', expected: undefined },
  { name: '@storybook/react/preset', kind: 'renderer', expected: 'renderer:@storybook/react' },
  {
    name: '@storybook/builder-vite/preset',
    kind: 'builder',
    expected: 'builder:@storybook/builder-vite',
  },
  {
    name: '@storybook/preset-react-webpack',
    kind: 'addon',
    expected: 'addon:@storybook/preset-react-webpack',
  },
  {
    name: '@storybook/preset-react-webpack/preset-react-docs',
    kind: 'addon',
    expected: 'addon:@storybook/preset-react-webpack',
  },
  {
    name: '@storybook/preset-server-webpack',
    kind: 'addon',
    expected: 'addon:@storybook/preset-server-webpack',
  },
  {
    name: pathToFileURL(join(CODE_DIR, 'builders/builder-vite/dist/index.js')).href,
    kind: 'builder',
    expected: 'builder:@storybook/builder-vite',
  },
  {
    name: join(CODE_DIR, 'renderers/react/dist/node.js'),
    kind: 'renderer',
    expected: 'renderer:@storybook/react',
  },
  {
    name: join(CODE_DIR, 'builders/builder-webpack5'),
    kind: 'builder',
    expected: 'builder:@storybook/builder-webpack5',
  },
  {
    name: join(CODE_DIR, 'core/src/instance/__fixtures__/legacy-vite-framework'),
    kind: 'framework',
    expected: undefined,
  },
  { name: 'storybook-builder-rsbuild', kind: 'builder', expected: undefined },
  {
    name: join(CODE_DIR, 'core/src/instance/__fixtures__/legacy-framework'),
    kind: 'framework',
    expected: undefined,
  },
  {
    name: FRAMEWORK_DIR,
    kind: 'framework',
    expected: 'framework:fixture-annotation-framework',
  },
])('resolves the native $kind factory of $name', async ({ name, kind, expected }) => {
  const factory = await resolveNativeFactory(name, kind, CONFIG_DIR);
  const addon = factory?.(undefined);
  expect(addon && `${addon.meta.kind}:${addon.meta.name}`).toBe(expected);
});

it('maps official preset specifiers to their package', () => {
  const inputs = [
    '@storybook/react/preset',
    '@storybook/addon-docs/preset',
    '@storybook/addon-docs/preset.js',
    '@storybook/preset-react-webpack',
    '@storybook/preset-react-webpack/preset-react-docs',
    '@storybook/angular/server/framework-preset-angular-cli',
    '@storybook/ember/server/framework-preset-babel-ember',
    'storybook-addon-pseudo-states/preset',
    '@storybook/addon-docs',
    '@storybook/addon-docs/manager',
    '@storybook/react/preview',
    'storybook-addon-designs/preset',
    '@chromatic-com/storybook/preset',
    '/project/node_modules/@storybook/react/dist/preset.js',
  ];
  expect(Object.fromEntries(inputs.map((input) => [input, toNativeEntryName(input)])))
    .toMatchInlineSnapshot(`
      {
        "/project/node_modules/@storybook/react/dist/preset.js": "/project/node_modules/@storybook/react/dist/preset.js",
        "@chromatic-com/storybook/preset": "@chromatic-com/storybook/preset",
        "@storybook/addon-docs": "@storybook/addon-docs",
        "@storybook/addon-docs/manager": "@storybook/addon-docs/manager",
        "@storybook/addon-docs/preset": "@storybook/addon-docs",
        "@storybook/addon-docs/preset.js": "@storybook/addon-docs",
        "@storybook/angular/server/framework-preset-angular-cli": "@storybook/angular",
        "@storybook/ember/server/framework-preset-babel-ember": "@storybook/ember",
        "@storybook/preset-react-webpack": "@storybook/preset-react-webpack",
        "@storybook/preset-react-webpack/preset-react-docs": "@storybook/preset-react-webpack",
        "@storybook/react/preset": "@storybook/react",
        "@storybook/react/preview": "@storybook/react/preview",
        "storybook-addon-designs/preset": "storybook-addon-designs/preset",
        "storybook-addon-pseudo-states/preset": "storybook-addon-pseudo-states",
      }
    `);
});
