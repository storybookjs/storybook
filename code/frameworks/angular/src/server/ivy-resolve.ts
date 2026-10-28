import type { Configuration } from 'webpack';

import type { AngularOptions } from '../types.ts';

/** Resolve Ivy-compatible package entry points unless `enableIvy` is `false`. */
export function withIvyResolve(
  webpackConfig: Configuration,
  angularOptions: AngularOptions
): Configuration {
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
}
