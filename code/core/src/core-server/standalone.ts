import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDevStandalone } from './build-dev';
import { buildIndexStandalone } from './build-index';
import { buildStaticStandalone } from './build-static';

async function build(options: any = {}, frameworkOptions: any = {}) {
  const { mode = 'dev' } = options;
  const packageJsonDir = dirname(
    fileURLToPath(import.meta.resolve('storybook/internal/package.json'))
  );
  const packageJson = JSON.parse(readFileSync(`${packageJsonDir}/package.json`, 'utf8').toString());

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
