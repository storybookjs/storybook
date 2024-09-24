import { dirname, join } from 'node:path';

import type { PresetProperty } from 'storybook/internal/types';

import type { StorybookConfig } from './types';

export * from './types';

const getAbsolutePath = <I extends string>(input: I): I =>
  dirname(require.resolve(join(input, 'package.json'))) as any;

export const webpackFinal: StorybookConfig['webpackFinal'] = (config) => {
  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...(config.resolve?.alias || {}),
        react: getAbsolutePath('preact/compat'),
        'react-dom/test-utils': getAbsolutePath('preact/test-utils'),
        'react-dom': getAbsolutePath('preact/compat'),
        'react/jsx-runtime': getAbsolutePath('preact/jsx-runtime'),
      },
    },
  };
};

export const swc: PresetProperty<'swc'> = (config: any): any => {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  return {
    ...config,
    jsc: {
      ...(config?.jsc ?? {}),
      transform: {
        ...(config?.jsc?.transform ?? {}),
        react: {
          ...(config?.jsc?.transform?.react ?? {}),
          runtime: 'automatic',
          importSource: 'preact',
          pragma: 'h',
          pragmaFrag: 'Fragment',
          development: isDevelopment,
        },
      },
    },
  };
};
