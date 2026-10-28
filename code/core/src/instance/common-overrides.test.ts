import { expect, it } from 'vitest';

import { registerCommonOverrides } from './common-overrides.ts';
import { createHookRuntime } from './hooks.ts';

it.each([
  {
    name: 'normalizes a string framework',
    hook: 'core:framework:extend' as const,
    input: '@storybook/react-vite',
    options: {},
    expected: { name: '@storybook/react-vite', options: {} },
  },
  {
    name: 'keeps typescript outside test builds',
    hook: 'core:typescript:extend' as const,
    input: { check: true },
    options: {},
    expected: { check: true },
  },
  {
    name: 'disables docgen in test builds',
    hook: 'core:typescript:extend' as const,
    input: { check: true },
    options: { build: { test: { disableDocgen: true } } },
    expected: { check: false, reactDocgen: false },
  },
  {
    name: 'disables the docgen server in test builds',
    hook: 'core:features:extend' as const,
    input: { docgenServer: true },
    options: { build: { test: { disableDocgen: true } } },
    expected: { docgenServer: false },
  },
])('$name', async ({ hook, input, options, expected }) => {
  const hooks = createHookRuntime();
  registerCommonOverrides(hooks, options);
  hooks.hook(hook, () => input as never);

  expect(await hooks.callHook(hook, undefined)).toEqual(expected);
});

it('resolves test build flags from the base options when the caller passes no context', async () => {
  const hooks = createHookRuntime();
  registerCommonOverrides(hooks, { test: true });

  expect(await hooks.callHook('core:build:extend', {})).toMatchInlineSnapshot(`
    {
      "test": {
        "disableAutoDocs": true,
        "disableBlocks": true,
        "disableDocgen": true,
        "disableMDXEntries": true,
        "disableSourcemaps": true,
        "disableTreeShaking": true,
        "disabledAddons": [
          "@storybook/addon-docs",
          "@storybook/addon-essentials/docs",
          "@storybook/addon-coverage",
        ],
        "esbuildMinify": true,
      },
    }
  `);
});
