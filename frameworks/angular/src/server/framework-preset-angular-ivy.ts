import { join } from 'node:path';

import type { Preset } from 'storybook/internal/types';

import type { Configuration } from 'webpack';

import type { AngularOptions } from '../types';
import type { PresetOptions } from './preset-options';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Source :
 * https://github.com/angular/angular-cli/blob/ebccb5de4a455af813c5e82483db6af20666bdbd/packages/angular_devkit/build_angular/src/utils/load-esm.ts#L23
 * This uses a dynamic import to load a module which may be ESM. CommonJS code can load ESM code via
 * a dynamic import. Unfortunately, TypeScript will currently, unconditionally downlevel dynamic
 * import into a require call. require calls cannot load ESM code and will result in a runtime
 * error. To workaround this, a Function constructor is used to prevent TypeScript from changing the
 * dynamic import. Once TypeScript provides support for keeping the dynamic import this workaround
 * can be dropped.
 *
 * @param modulePath The path of the module to load.
 * @returns A Promise that resolves to the dynamically imported module.
 */
function loadEsmModule<T>(modulePath: string): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function('modulePath', `return import(modulePath);`)(modulePath) as Promise<T>;
}

/**
 * Run ngcc for converting modules to ivy format before starting storybook This step is needed in
 * order to support Ivy in storybook
 *
 * Information about Ivy can be found here https://angular.io/guide/ivy
 */
export const runNgcc = async () => {
  let ngcc: any;
  try {
    ngcc = require('@angular/compiler-cli/ngcc');
  } catch (error) {
    ngcc = await loadEsmModule('@angular/compiler-cli/ngcc');
  }

  ngcc.process({
    // should be async: true but does not work due to
    // https://github.com/storybookjs/storybook/pull/11157/files#r615413803
    async: false,
    basePath: join(process.cwd(), 'node_modules'), // absolute path to node_modules
    createNewEntryPointFormats: true, // --create-ivy-entry-points
    compileAllFormats: false, // --first-only
  });
};

export const webpack = async (webpackConfig: Configuration, options: PresetOptions) => {
  const framework = await options.presets.apply<Preset>('framework');
  const angularOptions = (typeof framework === 'object' ? framework.options : {}) as AngularOptions;

  // Default to true, if undefined
  if (angularOptions.enableIvy === false) {
    return webpackConfig;
  }

  return {
    ...webpackConfig,
    resolve: {
      ...webpackConfig.resolve,
      mainFields: ['browser', 'module', 'main'],
    },
  };
};
