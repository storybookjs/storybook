// https://storybook.js.org/docs/react/addons/writing-presets
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

import type { StorybookConfigVite } from '@storybook/builder-vite';
import { viteFinal as reactViteFinal } from '@storybook/react-vite/preset';

import semver from 'semver';

import { normalizePostCssConfig } from './find-postcss-config';
import type { FrameworkOptions } from './types';
import { getNextjsVersion } from './utils';

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
  const annotations = [
    ...entry,
    fileURLToPath(import.meta.resolve('@storybook/nextjs-vite/preview')),
  ];

  const nextjsVersion = getNextjsVersion();
  const isNext16orNewer = semver.gte(nextjsVersion, '16.0.0');

  // TODO: Remove this once we only support Next.js v16 and above
  if (!isNext16orNewer) {
    annotations.push(fileURLToPath(import.meta.resolve('@storybook/nextjs-vite/config/preview')));
  }

  return annotations;
};

export const optimizeViteDeps = [
  '@storybook/nextjs-vite/navigation.mock',
  '@storybook/nextjs-vite/router.mock',
  '@storybook/nextjs-vite > styled-jsx',
  '@storybook/nextjs-vite > styled-jsx/style',
  '@opentelemetry/api',
];

export const viteFinal: StorybookConfigVite['viteFinal'] = async (config, options) => {
  const reactConfig = await reactViteFinal(config, options);

  const inlineOptions = config.css?.postcss;
  const searchPath = typeof inlineOptions === 'string' ? inlineOptions : config.root;

  if (searchPath) {
    await normalizePostCssConfig(searchPath);
  }

  const { nextConfigPath, image = {} } =
    await options.presets.apply<FrameworkOptions>('frameworkOptions');

  const nextDir = nextConfigPath ? dirname(nextConfigPath) : undefined;

  const vitePluginOptions = {
    image,
    dir: nextDir,
  };

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
    plugins: [...(reactConfig?.plugins ?? []), vitePluginStorybookNextjs(vitePluginOptions)],
  };
};
