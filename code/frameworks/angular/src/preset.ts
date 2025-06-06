import type { PresetProperty } from 'storybook/internal/types';

import { dirname, join } from 'node:path';

import type { StandaloneOptions } from './builders/utils/standalone-options';

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
  const config = join(getAbsolutePath('@storybook/angular'), 'dist/client/config.mjs');
  const annotations = [...entries, config];

  if ((options as any as StandaloneOptions).enableProdMode) {
    const previewProd = join(getAbsolutePath('@storybook/angular'), 'dist/client/preview-prod.mjs');
    annotations.unshift(previewProd);
  }

  const docsConfig = await options.presets.apply('docs', {}, options);
  const docsEnabled = Object.keys(docsConfig).length > 0;
  if (docsEnabled) {
    const docsConfig = join(getAbsolutePath('@storybook/angular'), 'dist/client/docs/config.mjs');
    annotations.push(docsConfig);
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
