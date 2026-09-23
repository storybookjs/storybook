import type { PresetProperty, TestBuildFlags } from 'storybook/internal/types';

import { removeMDXEntries } from '../utils/remove-mdx-entries.ts';
import { getWsToken } from './wsToken.ts';

export const framework: PresetProperty<'framework'> = async (config) => {
  // This will get called with the values from the user's main config, but before
  // framework preset from framework packages e.g. react-webpack5 gets called.
  // This means we can add default values to the framework config, before it's requested by other packages.
  const name = typeof config === 'string' ? config : config?.name;
  const options = typeof config === 'string' ? {} : config?.options || {};

  return {
    name,
    options,
  };
};

export const stories: PresetProperty<'stories'> = async (entries, options) => {
  if (options?.build?.test?.disableMDXEntries) {
    return removeMDXEntries(entries, options);
  }
  return entries;
};

export const typescript: PresetProperty<'typescript'> = async (input, options) => {
  if (options?.build?.test?.disableDocgen) {
    return { ...(input ?? {}), reactDocgen: false, check: false };
  }
  return input;
};

const createTestBuildFeatures = (value: boolean): Required<TestBuildFlags> => ({
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
});

export const build: PresetProperty<'build'> = async (value, options) => {
  return {
    ...value,
    test: options.test
      ? {
          ...createTestBuildFeatures(!!options.test),
          ...value?.test,
        }
      : createTestBuildFeatures(false),
  };
};

/**
 * `core` in `common-preset.ts` runs before the user's main config, and `applyPresets` shallow
 * merges a plain `core` object from `main.ts` over the accumulated value (see
 * `code/core/src/common/presets.ts`). A user-defined `core.channelOptions` therefore replaces the
 * object that the dev server websocket token was added to, and that token is lost.
 *
 * This preset is applied after the user config, so it is where the token is normalized: the
 * resolved telejson options are kept as they are, the token is added in development, where the
 * websocket channel exists, and it is left out everywhere else so it cannot end up in a static
 * build.
 */
export const core: PresetProperty<'core'> = async (existing, options) => {
  const channelOptions = { ...existing?.channelOptions };
  delete channelOptions.wsToken;

  if (options.configType === 'DEVELOPMENT') {
    channelOptions.wsToken = getWsToken();
  }

  return { ...existing, channelOptions };
};
