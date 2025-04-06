import { PresetProperty } from 'storybook/internal/types';

import { dirname, join } from 'node:path';

import { StandaloneOptions } from './builders/utils/standalone-options';

const getAbsolutePath = <I extends string>(input: I): I =>
  dirname(require.resolve(join(input, 'package.json'))) as any;

export const addons: PresetProperty<'addons'> = [
  require.resolve('./server/framework-preset-angular-cli'),
  require.resolve('./server/framework-preset-angular-ivy'),
  require.resolve('./server/framework-preset-angular-docs'),
];

export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entries = [], options) => {
  const annotations = [...entries, require.resolve('./client/config')];

  if ((options as any as StandaloneOptions).enableProdMode) {
    annotations.unshift(require.resolve('./client/preview-prod'));
  }

  return annotations;
};

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');
  const builder =
    (options as StandaloneOptions).bundler === 'vite'
      ? '@storybook/builder-vite'
      : '@storybook/builder-webpack5';
  return {
    ...config,
    builder: {
      name: getAbsolutePath(builder),
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

export const viteFinal: NonNullable<StorybookConfig['viteFinal']> = async (
  config,
  options: Options & StandaloneOptions
) => {
  // Merge custom configuration into the default config
  const { mergeConfig } = await import('vite');
  const { default: angular } = await import('@analogjs/vite-plugin-angular');

  return mergeConfig(config, {
    // Add dependencies to pre-optimization
    optimizeDeps: {
      include: [
        '@storybook/angular/dist/client/index.js',
        '@angular/compiler',
        '@angular/platform-browser/animations',
        '@storybook/addon-docs/angular',
        'react/jsx-dev-runtime',
        '@storybook/blocks',
        'tslib',
        'zone.js',
      ],
    },
    plugins: [
      angular({
        jit: true,
        liveReload: false,
        tsconfig: options?.tsConfig ?? './.storybook/tsconfig.json',
      }),
    ],
    define: {
      STORYBOOK_ANGULAR_OPTIONS: JSON.stringify({
        experimentalZoneless: !!options?.angularBuilderOptions?.experimentalZoneless,
      }),
    },
  });
};
