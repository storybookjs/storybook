import type { Configuration as WebpackConfig } from 'webpack';

import { resolvePackageDir } from '../../../../core/src/shared/utils/module';
import { configureCompatibilityAliases } from '../compatibility/compatibility-map';
import { configureNextExportMocks } from '../export-mocks/webpack';

export const configureAliases = (baseConfig: WebpackConfig): void => {
  configureNextExportMocks(baseConfig);
  configureCompatibilityAliases(baseConfig);

  baseConfig.resolve = {
    ...(baseConfig.resolve ?? {}),
    alias: {
      ...(baseConfig.resolve?.alias ?? {}),
      '@opentelemetry/api': 'next/dist/compiled/@opentelemetry/api',
      next: resolvePackageDir('next'),
    },
  };

  // remove warnings regarding compatibility paths
  baseConfig.ignoreWarnings = [
    ...(baseConfig.ignoreWarnings ?? []),
    (warning) =>
      warning.message.includes("export 'draftMode'") &&
      warning.message.includes('next/dist/server/request/headers'),
  ];
};
