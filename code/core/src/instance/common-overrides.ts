import type { Options, PresetPropertyFn, TestBuildFlags } from '@storybook/core/internal/types';

import { removeMDXEntries } from '../story-index/remove-mdx-entries.ts';
import type { createHookRuntime, HookContext } from './hooks.ts';

/** Core's last word on `main.ts` values, keyed like preset fields. */
export const COMMON_OVERRIDES = {
  features: (async (input, options) =>
    options?.build?.test?.disableDocgen
      ? { ...input, docgenServer: false }
      : input) as PresetPropertyFn<'features'>,
  framework: (async (config) => {
    // Frameworks read `options` from here before their own presets run.
    const name = typeof config === 'string' ? config : config?.name;
    const options = typeof config === 'string' ? {} : config?.options || {};
    return { name, options };
  }) as PresetPropertyFn<'framework'>,
  stories: (async (entries, options) =>
    options?.build?.test?.disableMDXEntries
      ? removeMDXEntries(entries, options)
      : entries) as PresetPropertyFn<'stories'>,
  typescript: (async (input, options) =>
    options?.build?.test?.disableDocgen
      ? { ...(input ?? {}), reactDocgen: false, check: false }
      : input) as PresetPropertyFn<'typescript'>,
  build: (async (value, options) => ({
    ...value,
    test: options.test
      ? { ...createTestBuildFeatures(!!options.test), ...value?.test }
      : createTestBuildFeatures(false),
  })) as PresetPropertyFn<'build'>,
};

/** Give core the last word on `main.ts` values, after every preset, addon and `main.ts` itself. */
export function registerCommonOverrides(
  hooks: ReturnType<typeof createHookRuntime>,
  options: Partial<Options>
): void {
  // Some callers pass no context, while the overrides read the base options such as `build`.
  const { features, framework, stories, typescript, build } = COMMON_OVERRIDES;
  const withOptions = (ctx?: HookContext): Options => ({ ...options, ...ctx }) as Options;
  hooks.hook(
    'core:features:extend',
    async (value, ctx) => (await features(value, withOptions(ctx)))!,
    'reduce',
    'override'
  );
  hooks.hook(
    'core:framework:extend',
    async (value, ctx) => (await framework(value, withOptions(ctx)))!,
    'reduce',
    'override'
  );
  hooks.hook(
    'core:stories:collect',
    async (value, ctx) => stories(value, withOptions(ctx)),
    'reduce',
    'override'
  );
  hooks.hook(
    'core:typescript:extend',
    async (value, ctx) => (await typescript(value, withOptions(ctx)))!,
    'reduce',
    'override'
  );
  hooks.hook(
    'core:build:extend',
    async (value, ctx) => (await build(value, withOptions(ctx)))!,
    'reduce',
    'override'
  );
}

function createTestBuildFeatures(value: boolean): Required<TestBuildFlags> {
  return {
    disableBlocks: value,
    disabledAddons: value
      ? ['@storybook/addon-docs', '@storybook/addon-essentials/docs', '@storybook/addon-coverage']
      : [],
    disableMDXEntries: value,
    disableAutoDocs: value,
    disableDocgen: value,
    disableSourcemaps: value,
    disableTreeShaking: value,
    esbuildMinify: value,
  };
}
