// import type { StorybookConfigVite } from '@storybook/builder-vite';
// import {
//   ember,
//   /*, extensions */
// } from '@embroider/vite';
// import { fileURLToPath } from 'node:url';
import type { PresetProperty } from 'storybook/internal/types';

// import type { TransformOptions } from '@babel/core';
// import { buildMacros } from '@embroider/macros/babel';
import { emberIndexer } from './node/indexer';
import type { StorybookConfig } from './types';

// export const viteFinal: StorybookConfigVite['viteFinal'] = async (config /*, options*/) => {
//   return {
//     ...config,
//     plugins: [...(config.plugins ?? []), ember()],
//   };
// };

export const experimental_indexers: StorybookConfig['experimental_indexers'] = (indexers) => {
  console.log('HELLOOOOO');

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

// const macros = buildMacros();

// export function babelDefault(config: TransformOptions) {
//   return {
//     ...config,
//     plugins: [
//       [
//         '@babel/plugin-transform-typescript',
//         {
//           allExtensions: true,
//           onlyRemoveTypeImports: true,
//           allowDeclareFields: true,
//         },
//       ],
//       [
//         'babel-plugin-ember-template-compilation',
//         {
//           transforms: [...macros.templateMacros],
//         },
//       ],
//       [
//         'module:decorator-transforms',
//         {
//           runtime: {
//             import: fileURLToPath(import.meta.resolve('decorator-transforms/runtime-esm')),
//           },
//         },
//       ],
//       [
//         '@babel/plugin-transform-runtime',
//         {
//           absoluteRuntime: import.meta.dirname,
//           useESModules: true,
//           regenerator: false,
//         },
//       ],
//     ],

//     generatorOpts: {
//       compact: false,
//     },
//   };
// }
