// import {
//   ember,
//   /*, extensions */
// } from '@embroider/vite';
import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

import type { StorybookConfigVite } from '@storybook/builder-vite';

import type { TransformOptions } from '@babel/core';
import { buildMacros } from '@embroider/macros/babel';
import type { PluginOption } from 'vite';

import { emberIndexer } from './node/indexer';
import type { StorybookConfig } from './types';

// export { renderToCanvas } from './client/render';

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  entries = []
  //, options
) => {
  const config = fileURLToPath(import.meta.resolve('@storybook/ember/client/config'));
  const annotations = [...entries, config];

  // if ((options as any as StandaloneOptions).enableProdMode) {
  //   const previewProdPath = import.meta.resolve('@storybook/angular/client/preview-prod');
  //   annotations.unshift(previewProdPath);
  // }

  // const docsConfig = await options.presets.apply('docs', {}, options);
  // const docsEnabled = Object.keys(docsConfig).length > 0;
  // if (docsEnabled) {
  //   const docsConfigPath = import.meta.resolve('@storybook/angular/client/docs/config');
  //   annotations.push(docsConfigPath);
  // }
  return annotations;
};

export const viteFinal: StorybookConfigVite['viteFinal'] = async (config /*, options*/) => {
  // console.log('CONFIG', config);
  console.log('OPTIMIZE DEPS', config.optimizeDeps);
  // console.log('OPTIMIZE DEPS', config.esbuild);
  // console.log('OPTIMIZE DEPS', config.optimizeDeps.esbuildOptions);

  // console.log('PLUGINS', config.plugins);

  const plugins: PluginOption[] = [];

  for (const plugin of config.plugins ?? []) {
    if (Array.isArray(plugin)) {
      plugins.push(plugin.filter((p) => (p ? p?.name !== 'embroider-content-for' : true)));
    } else {
      if (plugin?.name !== 'babel') {
        plugins.push(plugin);
      }
    }
  }

  const build = config.build ?? {};
  const rollupOptions = build.rollupOptions ?? {};

  if (rollupOptions.external) {
    rollupOptions.external.push('@embroider/macros');
  } else {
    rollupOptions.external = ['@embroider/macros'];
  }

  build.rollupOptions = rollupOptions;

  // config.optimizeDeps.exclude.push('ember-source');
  // config.optimizeDeps.include.push('ember-source/@ember/template-compiler');

  return {
    ...config,
    plugins,
    build,
  };
};

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

const macros = buildMacros();

export function babelDefault(config: TransformOptions) {
  return {
    ...config,
    plugins: [
      [
        '@babel/plugin-transform-typescript',
        {
          allExtensions: true,
          onlyRemoveTypeImports: true,
          allowDeclareFields: true,
        },
      ],
      [
        'babel-plugin-ember-template-compilation',
        {
          transforms: [...macros.templateMacros],
        },
      ],
      [
        'module:decorator-transforms',
        {
          runtime: {
            import: fileURLToPath(import.meta.resolve('decorator-transforms/runtime-esm')),
          },
        },
      ],
      [
        '@babel/plugin-transform-runtime',
        {
          absoluteRuntime: import.meta.dirname,
          useESModules: true,
          regenerator: false,
        },
      ],
    ],

    generatorOpts: {
      compact: false,
    },
  };
}
