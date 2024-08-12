import type { PresetProperty, PresetPropertyFn } from 'storybook/internal/types';

import type { TransformOptions } from '@babel/core';
import { precompile } from 'ember-source/dist/ember-template-compiler';

import { findDistFile } from '../util';

let emberOptions: any;

function precompileWithPlugins(string: string, options: any) {
  const precompileOptions: any = options;
  if (emberOptions && emberOptions.polyfills) {
    precompileOptions.plugins = { ast: emberOptions.polyfills };
  }

  return precompile(string, precompileOptions);
}

export const babel: PresetPropertyFn<'babel'> = (config: TransformOptions, options) => {
  if (options && options.presetsList) {
    options.presetsList.forEach((e: any, index: number) => {
      if (e.preset && e.preset.emberOptions) {
        emberOptions = e.preset.emberOptions;
        if (options.presetsList) {
          delete options.presetsList[index].preset.emberOptions;
        }
      }
    });
  }

  const babelConfigPlugins = config?.plugins || [];

  const extraPlugins = [
    [
      require.resolve('babel-plugin-htmlbars-inline-precompile'),
      {
        precompile: precompileWithPlugins,
        modules: {
          'ember-cli-htmlbars': 'hbs',
          'ember-cli-htmlbars-inline-precompile': 'default',
          'htmlbars-inline-precompile': 'default',
        },
      },
    ],
    [require.resolve('babel-plugin-ember-modules-api-polyfill')],
  ];

  return {
    ...config,
    plugins: [...babelConfigPlugins, ...extraPlugins],
  };
};

export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entry = []) => {
  return [...entry, findDistFile(__dirname, 'client/preview/config')];
};
