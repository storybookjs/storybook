import { dirname, join } from 'node:path';

import type { PresetProperty } from 'storybook/internal/types';

import type { StandaloneOptions } from './builders/utils/standalone-options';
import { logger } from 'storybook/internal/node-logger';

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

  const isTestBedRenderer = options.features?.previewTestBedRenderer ?? false;
  const isProdMode = (options as any as StandaloneOptions).enableProdMode;

  if (isProdMode && isTestBedRenderer !== true) {
    logger.info('Angular is running in production mode');
    const previewProdPath = join(
      getAbsolutePath('@storybook/angular'),
      'dist/client/preview-prod.mjs'
    );
    annotations.unshift(previewProdPath);
  } else {
    logger.info(
      isProdMode
        ? 'New TestBed Renderer is enabled: Angular is running in development mode'
        : 'Angular is running in development mode'
    );
  }

  const docsConfig = await options.presets.apply('docs', {}, options);
  const docsEnabled = Object.keys(docsConfig).length > 0;
  if (docsEnabled) {
    const docsConfigPath = join(
      getAbsolutePath('@storybook/angular'),
      'dist/client/docs/config.mjs'
    );
    annotations.push(docsConfigPath);
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
