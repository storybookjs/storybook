import type { Configuration as WebpackConfig } from 'webpack';

import { resolvePackageDir } from '../../../../core/src/shared/utils/module.ts';
import { configureNextExportMocks } from '../export-mocks/webpack.ts';

export const configureAliases = (baseConfig: WebpackConfig): void => {
  configureNextExportMocks(baseConfig);

  baseConfig.resolve = {
    ...(baseConfig.resolve ?? {}),
    alias: {
      ...(baseConfig.resolve?.alias ?? {}),
      '@opentelemetry/api': 'next/dist/compiled/@opentelemetry/api',
      next: resolvePackageDir('next'),
      'next/dist/shared/lib/app-router-context.shared-runtime':
        'next/dist/shared/lib/app-router-context.shared-runtime',
      'next/dist/shared/lib/app-router-context':
        'next/dist/shared/lib/app-router-context.shared-runtime',
    },
  };
};
