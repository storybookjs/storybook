import { expectTypeOf, test } from 'vitest';

import { defineAddon, defineMain, type StorybookConfig } from 'storybook';

import type {} from '@storybook/react-vite';
import type { reactVite as reactViteFactory } from '@storybook/react-vite/node';
import type {} from '@storybook/react-webpack5';

import type { InlineConfig } from 'vite';
import type { Configuration } from 'webpack';

declare const reactVite: typeof reactViteFactory;

test('accepts a string framework and string addons', () => {
  const main = defineMain({
    stories: [],
    framework: '@storybook/react-vite',
    addons: ['@storybook/addon-docs'],
  });

  expectTypeOf(main).toMatchTypeOf<StorybookConfig>();
  expectTypeOf(main.framework).toEqualTypeOf<'@storybook/react-vite'>();
});

test('accepts native addons', () => {
  const addon = defineAddon(() => ({ meta: { name: 'x' }, setup() {} }));

  defineMain({ stories: [], framework: '@storybook/react-vite', addons: [addon()] });
});

test('rejects unknown top-level keys without a framework', () => {
  defineMain({
    stories: [],
    // @ts-expect-error Not a main configuration field.
    unknownField: true,
  });
});

test('types builder fields from a string framework', () => {
  defineMain({
    stories: [],
    framework: '@storybook/react-vite',
    viteFinal: (config) => {
      expectTypeOf(config).toEqualTypeOf<InlineConfig>();
      return config;
    },
  });

  defineMain({
    stories: [],
    framework: '@storybook/react-vite',
    // @ts-expect-error React Vite has no Webpack builder.
    webpackFinal: (config: Configuration) => config,
  });
});

test('types builder fields and options from an object framework', () => {
  defineMain({
    stories: [],
    framework: { name: '@storybook/react-webpack5', options: { strictMode: true } },
    webpackFinal: (config) => {
      expectTypeOf(config).toEqualTypeOf<Configuration>();
      return config;
    },
  });

  defineMain({
    stories: [],
    // @ts-expect-error `strictMode` is a boolean.
    framework: { name: '@storybook/react-webpack5', options: { strictMode: 'yes' } },
  });
});

test('types builder fields from a native framework', () => {
  const main = defineMain({
    stories: [],
    framework: reactVite({ docgen: 'react-docgen' }),
    viteFinal: (config) => {
      expectTypeOf(config).toEqualTypeOf<InlineConfig>();
      return config;
    },
  });

  expectTypeOf(main.framework.meta.name).toEqualTypeOf<'@storybook/react-vite'>();
});

test('accepts any key for an unregistered framework', () => {
  defineMain({
    stories: [],
    framework: '@third-party/framework',
    customFinal: (config: unknown) => config,
  });
});
