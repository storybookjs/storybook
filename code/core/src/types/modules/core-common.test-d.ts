import { expectTypeOf } from 'vitest';

import type { StorybookConfig } from './core-common';

// Sync array form
const syncConfig: StorybookConfig = {
  stories: ['./src/**/*.stories.tsx'],
};
expectTypeOf(syncConfig.stories).toMatchTypeOf<StorybookConfig['stories']>();

// Async function form with no args (the fixed case)
const asyncNoArgs: StorybookConfig = {
  stories: async () => ['./src/**/*.stories.tsx'],
};
expectTypeOf(asyncNoArgs.stories).toMatchTypeOf<StorybookConfig['stories']>();

// Async function form with config arg
const asyncWithArgs: StorybookConfig = {
  stories: async (config) => config ?? [],
};
expectTypeOf(asyncWithArgs.stories).toMatchTypeOf<StorybookConfig['stories']>();
