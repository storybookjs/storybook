import type { PresetProperty, PresetPropertyFn, TestBuildFlags } from 'storybook/internal/types';
import { once } from 'storybook/internal/node-logger';

import {
  extractFrameworkPackageName,
  getFrameworkName,
} from '../../common/utils/get-framework-name.ts';
import { extractRenderer } from '../../common/utils/get-renderer-name.ts';
import { removeMDXEntries } from '../utils/remove-mdx-entries.ts';

export const features: PresetPropertyFn<'features'> = async (input = {}, options) => {
  const frameworkName = extractFrameworkPackageName(await getFrameworkName(options));
  const isReact = (await extractRenderer(frameworkName)) === 'react';
  const isVue = frameworkName === '@storybook/vue3-vite';
  const supported =
    isReact ||
    isVue ||
    frameworkName === '@storybook/angular-vite' ||
    frameworkName === '@storybook/svelte-vite' ||
    frameworkName === '@storybook/web-components-vite';
  const { experimentalDocgenServer, ...stableFeatures } = input;
  const explicit = input.docgenServer ?? experimentalDocgenServer;

  if (experimentalDocgenServer !== undefined) {
    once.warn(
      'features.experimentalDocgenServer is deprecated and will be removed in Storybook 12. Use features.docgenServer in your main config instead.'
    );
  }

  if (!supported) {
    if (explicit) {
      once.warn(
        `features.docgenServer is not supported by ${frameworkName}. Server-side docgen remains disabled. Remove this feature flag from your main config.`
      );
    }
    return { ...stableFeatures, docgenServer: false };
  }

  const typescriptOptions = isReact
    ? await options.presets.apply<{
        reactDocgen?: false | 'react-docgen' | 'react-docgen-typescript';
      }>('typescript', {}, options)
    : undefined;
  const frameworkOptions = isVue
    ? await options.presets.apply<{
        docgen?: boolean | string | { plugin: string; tsconfig?: string };
      }>('frameworkOptions', {}, options)
    : undefined;
  const legacyReact =
    typescriptOptions?.reactDocgen === false ||
    typescriptOptions?.reactDocgen === 'react-docgen-typescript';
  const legacyVue = frameworkOptions?.docgen !== undefined;
  // SB11 preserves SB10 extractor choices for configs that could not be migrated; remove in SB12.
  const preservesLegacy = legacyReact || legacyVue;

  if (explicit && preservesLegacy) {
    once.warn(
      'features.docgenServer: true ignores typescript.reactDocgen, reactDocgenTypescriptOptions, and framework.options.docgen. Set features.docgenServer: false to keep your legacy extractor settings. The server does not translate RDT propFilter or Vue docgen tsconfig options.'
    );
  }

  return { ...stableFeatures, docgenServer: explicit ?? !preservesLegacy };
};

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
