import { PresetProperty } from 'storybook/internal/types';

import { dirname, join } from 'node:path';

import { StandaloneOptions } from './builders/utils/standalone-options';

const getAbsolutePath = <I extends string>(input: I): I =>
  dirname(require.resolve(join(input, 'package.json'))) as any;

export const addons: PresetProperty<'addons'> = [
  require.resolve('./server/framework-preset-angular-cli'),
  require.resolve('./server/framework-preset-angular-ivy'),
];

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  entries = [],
  options
) => {
  const annotations = [...entries, require.resolve('./client/config')];

  if ((options as any as StandaloneOptions).enableProdMode) {
    annotations.unshift(require.resolve('./client/preview-prod'));
  }

  const docsConfig = await options.presets.apply('docs', {}, options);
  const docsEnabled = Object.keys(docsConfig).length > 0;
  if (docsEnabled) {
    annotations.push(require.resolve('./client/docs/config'));
  }
  return annotations;
};

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: getAbsolutePath('@storybook/builder-webpack5'),
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
