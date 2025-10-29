import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

import { type StorybookConfigVite, withoutVitePlugins } from '@storybook/builder-vite';

import type { UserConfig } from 'vite';

import { emberIndexer } from './node/indexer';
import type { StorybookConfig } from './types';

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  entries = [],
  options
) => {
  const config = fileURLToPath(import.meta.resolve('@storybook/ember/client/config'));
  const annotations = [...entries, config];

  const docsConfig = await options.presets.apply('docs', {}, options);
  const docsEnabled = Object.keys(docsConfig).length > 0;
  if (docsEnabled) {
    const docsConfigPath = fileURLToPath(
      import.meta.resolve('@storybook/ember/client/docs/config')
    );
    annotations.push(docsConfigPath);
  }

  return annotations;
};

export const viteFinal: StorybookConfigVite['viteFinal'] = async (config: UserConfig) => {
  const { mergeConfig } = await import('vite');

  config.plugins = await withoutVitePlugins(config.plugins, ['embroider-content-for']);

  return mergeConfig(config, {
    optimizeDeps: {
      // esbuild doesn't handle disabling modules when using plugins.
      // `object-inspect` gets pulled in by `qs` which is automatically
      // optimized by Storybook, and qs is a default dependency by ember-cli.
      // `object-inspect` isn't going to work in Ember with Vite, so it's
      // safe to exclude it.
      exclude: ['object-inspect'],
    },
    resolve: {
      dedupe: ['ember-source'],
    },
  });
};

export const experimental_indexers: StorybookConfig['experimental_indexers'] = (indexers) => {
  return [emberIndexer, ...(indexers || [])];
};

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: import.meta.resolve('@storybook/builder-vite'),
      options: typeof framework === 'string' ? {} : framework.options.builder || {},
    },
  };
};
