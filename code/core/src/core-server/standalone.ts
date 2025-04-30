import { dirname } from 'node:path';

import { buildDevStandalone } from './build-dev';
import { buildIndexStandalone } from './build-index';
import { buildStaticStandalone } from './build-static';

async function build(options: any = {}, frameworkOptions: any = {}) {
  const { mode = 'dev' } = options;
  const packageJsonDir = dirname(require.resolve('storybook/internal/package.json'));
  const packageJson = JSON.parse(require('fs').readFileSync(`${packageJsonDir}/package.json`));

  const commonOptions = {
    ...options,
    ...frameworkOptions,
    frameworkPresets: [
      ...(options.frameworkPresets || []),
      ...(frameworkOptions.frameworkPresets || []),
    ],
    packageJson,
  };

  if (mode === 'dev') {
    return buildDevStandalone(commonOptions);
  }

  if (mode === 'static') {
    return buildStaticStandalone(commonOptions);
  }

  if (mode === 'index') {
    return buildIndexStandalone(commonOptions);
  }

  throw new Error(`'mode' parameter should be either 'dev', 'static', or 'index'`);
}

export default build;
