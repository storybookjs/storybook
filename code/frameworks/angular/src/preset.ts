import type { PresetProperty } from 'storybook/internal/types';

import type { StandaloneOptions } from './builders/utils/standalone-options';

export const addons: PresetProperty<'addons'> = [
  import.meta.resolve('@storybook/angular/server/framework-preset-angular-cli'),
  import.meta.resolve('@storybook/angular/server/framework-preset-angular-ivy'),
];

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  entries = [],
  options
) => {
  const config = import.meta.resolve('@storybook/angular/client/config');
  const annotations = [...entries, config];

  if ((options as any as StandaloneOptions).enableProdMode) {
    const previewProdPath = import.meta.resolve('@storybook/angular/client/preview-prod');
    annotations.unshift(previewProdPath);
  }

  const docsConfig = await options.presets.apply('docs', {}, options);
  const docsEnabled = Object.keys(docsConfig).length > 0;
  if (docsEnabled) {
    const docsConfigPath = import.meta.resolve('@storybook/angular/client/docs/config');
    annotations.push(docsConfigPath);
  }
  return annotations;
};

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: import.meta.resolve('@storybook/builder-webpack5'),
      options: typeof framework === 'string' ? {} : framework.options.builder || {},
    },
  };
};

export const typescript: PresetProperty<'typescript'> = async (config) => {
  return {
    ...config,
    skipCompiler: true,
  };
};
