// https://storybook.js.org/docs/react/addons/writing-presets
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getProjectRoot } from 'storybook/internal/common';
import { IncompatiblePostCssConfigError } from 'storybook/internal/server-errors';
import type { PresetProperty } from 'storybook/internal/types';

import type { StorybookConfigVite } from '@storybook/builder-vite';
import { viteFinal as reactViteFinal } from '@storybook/react-vite/preset';

import postCssLoadConfig from 'postcss-load-config';

import type { FrameworkOptions } from './types';

const require = createRequire(import.meta.url);

// the ESM output of this package is broken, so I had to force it to use the CJS version it's shipping.
const vitePluginStorybookNextjs = require('vite-plugin-storybook-nextjs');

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: fileURLToPath(import.meta.resolve('@storybook/builder-vite')),
      options: {
        ...(typeof framework === 'string' ? {} : framework.options.builder || {}),
      },
    },
    renderer: fileURLToPath(import.meta.resolve('@storybook/react/preset')),
  };
};

export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entry = []) => {
  const result = [...entry, fileURLToPath(import.meta.resolve('@storybook/nextjs-vite/preview'))];
  return result;
};

export const optimizeViteDeps = [
  '@storybook/nextjs-vite/navigation.mock',
  '@storybook/nextjs-vite/router.mock',
  '@storybook/nextjs-vite > styled-jsx',
  '@storybook/nextjs-vite > styled-jsx/style',
];

export const viteFinal: StorybookConfigVite['viteFinal'] = async (config, options) => {
  const reactConfig = await reactViteFinal(config, options);

  try {
    const inlineOptions = config.css?.postcss;
    const searchPath = typeof inlineOptions === 'string' ? inlineOptions : config.root;
    await postCssLoadConfig({}, searchPath, { stopDir: getProjectRoot() });
  } catch (e: any) {
    if (!e.message.includes('No PostCSS Config found')) {
      // This is a custom error that we throw when the PostCSS config is invalid
      if (e.message.includes('Invalid PostCSS Plugin found')) {
        throw new IncompatiblePostCssConfigError({ error: e });
      }
    }
  }

  const { nextConfigPath } = await options.presets.apply<FrameworkOptions>('frameworkOptions');

  const nextDir = nextConfigPath ? dirname(nextConfigPath) : undefined;

  return {
    ...reactConfig,
    resolve: {
      ...(reactConfig?.resolve ?? {}),
      alias: {
        ...(reactConfig?.resolve?.alias ?? {}),
        'styled-jsx': dirname(fileURLToPath(import.meta.resolve('styled-jsx/package.json'))),
        'styled-jsx/style': fileURLToPath(import.meta.resolve('styled-jsx/style')),
        'styled-jsx/style.js': fileURLToPath(import.meta.resolve('styled-jsx/style')),
      },
    },
    plugins: [...(reactConfig?.plugins ?? []), vitePluginStorybookNextjs({ dir: nextDir })],
  };
};
