import type { Storybook } from '@storybook/core';
import { expectTypeOf, test } from 'vitest';
import type { InlineConfig } from 'vite';

import './hooks.ts';

declare const storybook: Storybook;

test('infers declared hooks and rejects invalid names and results', () => {
  storybook.hook('builder:vite:extend', (config, ctx) => {
    expectTypeOf(config).toEqualTypeOf<InlineConfig>();
    expectTypeOf(ctx?.configType).toEqualTypeOf<'DEVELOPMENT' | 'PRODUCTION' | undefined>();
    return config;
  });

  // @ts-expect-error Unknown hooks must be declared by their owner.
  storybook.hook('builder:vite:typo', (config) => config);
  // @ts-expect-error A Vite hook must return a Vite configuration.
  storybook.hook('builder:vite:extend', () => 'invalid');
});
