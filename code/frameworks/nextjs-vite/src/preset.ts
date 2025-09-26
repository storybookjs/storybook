// https://storybook.js.org/docs/react/addons/writing-presets
import { dirname, join } from 'node:path';

import type { PresetProperty } from 'storybook/internal/types';

import type { StorybookConfigVite } from '@storybook/builder-vite';
import { viteFinal as reactViteFinal } from '@storybook/react-vite/preset';

import vitePluginStorybookNextjs from 'vite-plugin-storybook-nextjs';

import { normalizePostCssConfig } from './find-postcss-config';
import type { FrameworkOptions } from './types';
import { isNextVersionGte } from './utils';

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: dirname(
        require.resolve(join('@storybook/builder-vite', 'package.json'))
      ) as '@storybook/builder-vite',
      options: {
        ...(typeof framework === 'string' ? {} : framework.options.builder || {}),
      },
    },
    renderer: dirname(require.resolve(join('@storybook/react', 'package.json'))),
  };
};

export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entry = []) => {
  const nextDir = dirname(require.resolve('@storybook/nextjs-vite/package.json'));
  const annotations = [...entry, join(nextDir, 'dist/preview.mjs')];

  const isNext16orNewer = isNextVersionGte('16.0.0');

  // TODO: Remove this once we only support Next.js v16 and above
  if (!isNext16orNewer) {
    annotations.push(join(nextDir, 'dist/config/preview.mjs'));
  }

  return annotations;
};

export const optimizeViteDeps = [
  '@storybook/nextjs-vite/navigation.mock',
  '@storybook/nextjs-vite/router.mock',
  '@storybook/nextjs-vite > styled-jsx',
  '@storybook/nextjs-vite > styled-jsx/style',
];

export const viteFinal: StorybookConfigVite['viteFinal'] = async (config, options) => {
  const reactConfig = await reactViteFinal(config, options);

  const inlineOptions = config.css?.postcss;
  const searchPath = typeof inlineOptions === 'string' ? inlineOptions : config.root;

  if (searchPath) {
    await normalizePostCssConfig(searchPath);
  }

  const { nextConfigPath } = await options.presets.apply<FrameworkOptions>('frameworkOptions');

  const nextDir = nextConfigPath ? dirname(nextConfigPath) : undefined;

  return {
    ...reactConfig,
    resolve: {
      ...(reactConfig?.resolve ?? {}),
      alias: {
        ...(reactConfig?.resolve?.alias ?? {}),
        'styled-jsx': dirname(require.resolve('styled-jsx/package.json')),
        'styled-jsx/style': require.resolve('styled-jsx/style'),
        'styled-jsx/style.js': require.resolve('styled-jsx/style'),
      },
    },
    plugins: [...(reactConfig?.plugins ?? []), vitePluginStorybookNextjs({ dir: nextDir })],
  };
};
