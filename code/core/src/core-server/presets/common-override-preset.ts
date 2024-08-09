import type { PresetProperty, TestBuildFlags } from '@storybook/core/types';

import { removeMDXEntries } from '../utils/remove-mdx-entries';

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

export const docs: PresetProperty<'docs'> = async (input, options) => {
  if (options?.build?.test?.disableAutoDocs) {
    return {};
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
