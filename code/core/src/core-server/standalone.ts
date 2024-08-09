import { dirname } from 'node:path';

import { buildDevStandalone } from './build-dev';
import { buildStaticStandalone } from './build-static';

async function build(options: any = {}, frameworkOptions: any = {}) {
  const { mode = 'dev' } = options;
  const packageJsonDir = dirname(require.resolve('@storybook/core/package.json'));
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

  throw new Error(`'mode' parameter should be either 'dev' or 'static'`);
}

export default build;
