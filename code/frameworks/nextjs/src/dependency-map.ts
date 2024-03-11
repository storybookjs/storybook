import type { Configuration as WebpackConfig } from 'webpack';
import semver from 'semver';
import { getNextjsVersion, addScopedAlias } from './utils';

const mapping: Record<string, Record<string, string>> = {
  '<11.1.0': {
    'next/dist/next-server/lib/router-context': 'next/dist/next-server/lib/router-context',
  },
  '>=11.1.0 <13.5.0': {
    'next/dist/shared/lib/router-context': 'next/dist/shared/lib/router-context',
  },
  '>=13.0.2 <13.5.0': {
    'next/dist/shared/lib/hooks-client-context.shared-runtime':
      'next/dist/shared/lib/hooks-client-context',
  },
  '<13.0.0': {
    '@storybook/nextjs/dist/routing/app-router-provider':
      '@storybook/nextjs/dist/routing/app-router-provider-mock',
  },
  '<13.5.0': {
    'next/dist/shared/lib/router-context.shared-runtime': 'next/dist/shared/lib/router-context',
    'next/dist/shared/lib/head-manager-context.shared-runtime':
      'next/dist/shared/lib/head-manager-context',
    'next/dist/shared/lib/app-router-context.shared-runtime':
      'next/dist/shared/lib/app-router-context',
  },
};

export const configureAliasing = (baseConfig: WebpackConfig): void => {
  const version = getNextjsVersion();
  const result: Record<string, string> = {};

  Object.keys(mapping).forEach((key) => {
    if (semver.intersects(version, key)) {
      Object.assign(result, mapping[key]);
    }
  });

  Object.entries(result).forEach(([name, alias]) => {
    addScopedAlias(baseConfig, name, alias);
  });
};
